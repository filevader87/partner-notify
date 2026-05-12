const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { createApp } = require('../src/app');
const { validateProductionConfig } = require('../src/config');
const { createMemoryDeliveryLedger } = require('../src/deliveryLedger');
const { createMemoryIdempotencyStore } = require('../src/idempotencyStore');
const { createCompositeRateLimiter, createMemoryRateLimitStore } = require('../src/rateLimiter');

async function withServer(options, run) {
  const app = createApp(options);
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

function validPayload(overrides = {}) {
  return {
    phoneNumbers: ['+12035551234'],
    templateType: 'STI',
    tone: 'NEUTRAL',
    captchaToken: 'captcha-ok',
    deviceHash: 'a'.repeat(64),
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    ...overrides
  };
}

function validProductionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    TURNSTILE_SECRET: 'turnstile-secret',
    MOCK_SMS_DELIVERY: 'false',
    ALLOWED_ORIGINS: 'https://partnernotify.app',
    OPERATOR_NAME: 'Partner Notify',
    PUBLIC_BASE_URL: 'https://partnernotify.app',
    PRIVACY_URL: 'https://partnernotify.app/privacy',
    SUPPORT_URL: 'https://partnernotify.app/support',
    ABUSE_REPORT_URL: 'https://partnernotify.app/report-abuse',
    TESTING_LOCATOR_URL: 'https://gettested.cdc.gov/',
    PHONE_HASH_SECRET: 'x'.repeat(32),
    REDIS_REST_URL: 'https://example.upstash.io',
    REDIS_REST_TOKEN: 'redis-token',
    TWILIO_SID: 'AC123',
    TWILIO_TOKEN: 'twilio-token',
    TWILIO_MESSAGING_SERVICE_SID: 'MG123',
    ...overrides
  };
}

test('production config rejects unsafe launch settings', () => {
  assert.throws(
    () => validateProductionConfig(validProductionEnv({ TURNSTILE_SECRET: '' })),
    /TURNSTILE_SECRET/
  );
  assert.throws(
    () => validateProductionConfig(validProductionEnv({ MOCK_SMS_DELIVERY: 'true' })),
    /MOCK_SMS_DELIVERY/
  );
  assert.throws(
    () => validateProductionConfig(validProductionEnv({ ALLOWED_ORIGINS: '*' })),
    /ALLOWED_ORIGINS/
  );
  assert.throws(
    () => validateProductionConfig(validProductionEnv({ ABUSE_REPORT_URL: '' })),
    /ABUSE_REPORT_URL/
  );
});

test('production config accepts explicit web, abuse, Redis, and Twilio settings', () => {
  const config = validateProductionConfig(validProductionEnv());
  assert.equal(config.publicBaseUrl, 'https://partnernotify.app');
  assert.deepEqual(config.allowedOrigins, ['https://partnernotify.app']);
  assert.equal(config.twilioMessagingServiceSid, 'MG123');
  assert.equal(config.testingLocatorUrl, 'https://gettested.cdc.gov/');
});

test('composite rate limiter applies recipient-hash limits without raw phone keys', async () => {
  const keys = [];
  const store = createMemoryRateLimitStore({
    onConsume(key) {
      keys.push(key);
    }
  });
  const limiter = createCompositeRateLimiter({
    store,
    phoneHashSecret: 'secret-for-tests',
    limits: {
      ip: { limit: 10, windowMs: 86_400_000 },
      device: { limit: 10, windowMs: 86_400_000 },
      recipient: { limit: 1, windowMs: 86_400_000 }
    }
  });

  assert.equal(await limiter.consume({
    ip: '127.0.0.1',
    deviceHash: 'a'.repeat(64),
    phoneNumbers: ['+12035551234']
  }), true);

  assert.equal(await limiter.consume({
    ip: '127.0.0.1',
    deviceHash: 'b'.repeat(64),
    phoneNumbers: ['+12035551234']
  }), false);

  assert.equal(keys.some((key) => key.includes('+12035551234')), false);
});

test('POST /send stores idempotent success and does not resend duplicates', async () => {
  const sentMessages = [];

  await withServer({
    smsService: {
      send: async (message) => {
        sentMessages.push(message);
        return { sid: `SM${sentMessages.length}` };
      }
    },
    verifyCaptcha: async () => true,
    rateLimiter: { consume: async () => true },
    idempotencyStore: createMemoryIdempotencyStore(),
    phoneHashSecret: 'secret-for-tests'
  }, async (baseUrl) => {
    const first = await postJson(baseUrl, '/send', validPayload());
    const second = await postJson(baseUrl, '/send', validPayload());

    assert.equal(first.status, 200);
    assert.equal(first.body.status, 'accepted');
    assert.equal(second.status, 200);
    assert.equal(second.body.status, 'duplicate');
    assert.equal(sentMessages.length, 1);
    assert.equal(second.body.requestId, first.body.requestId);
  });
});

test('POST /send reports partial delivery without storing raw phone numbers in ledger', async () => {
  const ledger = createMemoryDeliveryLedger();

  await withServer({
    smsService: {
      send: async ({ to }) => {
        if (to.endsWith('235')) {
          throw new Error('provider failed');
        }
        return { sid: 'SM123' };
      }
    },
    verifyCaptcha: async () => true,
    rateLimiter: { consume: async () => true },
    deliveryLedger: ledger,
    idempotencyStore: createMemoryIdempotencyStore(),
    phoneHashSecret: 'secret-for-tests'
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload({
      phoneNumbers: ['+12035551234', '+12035551235']
    }));

    assert.equal(response.status, 207);
    assert.equal(response.body.status, 'partial_failed');
    assert.equal(response.body.sentCount, 1);
    assert.equal(response.body.failedCount, 1);
    assert.equal(ledger.records.length, 2);
    assert.equal(JSON.stringify(ledger.records).includes('+12035551234'), false);
    assert.equal(JSON.stringify(ledger.records).includes('+12035551235'), false);
  });
});

test('POST /send maps duplicate or expired Turnstile tokens to refreshable captcha errors', async () => {
  await withServer({
    verifyCaptcha: async () => {
      const error = new Error('expired');
      error.code = 'CAPTCHA_EXPIRED';
      throw error;
    },
    rateLimiter: { consume: async () => true },
    idempotencyStore: createMemoryIdempotencyStore()
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload());

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'CAPTCHA_EXPIRED');
  });
});
