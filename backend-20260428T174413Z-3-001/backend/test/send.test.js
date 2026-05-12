const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { createApp } = require('../src/app');

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
    idempotencyKey: cryptoRandomUuid(),
    ...overrides
  };
}

function cryptoRandomUuid() {
  return `${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}-1111-4111-8111-111111111111`;
}

test('GET /health reports service readiness', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
  });
});

test('GET /templates returns constrained public template catalog', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/templates`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.version, '2026-05-12');
    assert.deepEqual(Object.keys(body.templates).sort(), ['HIV', 'OTHER', 'STI', 'SYPHILIS']);
    assert.deepEqual(Object.keys(body.templates.STI).sort(), ['DIRECT', 'NEUTRAL', 'SUPPORTIVE']);
    assert.match(body.templates.STI.NEUTRAL, /Find nearby testing: https:\/\/gettested\.cdc\.gov\//);
  });
});

test('OPTIONS /send allows configured web origins', async () => {
  await withServer({ allowedOrigins: ['http://127.0.0.1:5173'] }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/send`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  });
});

test('OPTIONS /send allows local Vite origin by default outside production', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/send`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  });
});

test('POST /send rejects client-supplied message bodies', async () => {
  const sentMessages = [];

  await withServer({
    smsService: { send: async (message) => sentMessages.push(message) },
    verifyCaptcha: async () => true
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload({ message: 'custom text' }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'CLIENT_MESSAGE_NOT_ALLOWED');
    assert.equal(sentMessages.length, 0);
  });
});

test('POST /send rejects invalid phone numbers before sending', async () => {
  const sentMessages = [];

  await withServer({
    smsService: { send: async (message) => sentMessages.push(message) },
    verifyCaptcha: async () => true
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload({ phoneNumbers: ['555-1234'] }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_PHONE_NUMBER');
    assert.equal(sentMessages.length, 0);
  });
});

test('POST /send rejects unsupported template selections', async () => {
  await withServer({ verifyCaptcha: async () => true }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload({ templateType: 'CHLAMYDIA' }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_TEMPLATE_SELECTION');
  });
});

test('POST /send rejects failed captcha verification', async () => {
  await withServer({ verifyCaptcha: async () => false }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload());

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'CAPTCHA_FAILED');
  });
});

test('POST /send enforces rate limits before sending', async () => {
  const sentMessages = [];

  await withServer({
    smsService: { send: async (message) => sentMessages.push(message) },
    verifyCaptcha: async () => true,
    rateLimiter: { consume: () => false }
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload());

    assert.equal(response.status, 429);
    assert.equal(response.body.error.code, 'RATE_LIMITED');
    assert.equal(sentMessages.length, 0);
  });
});

test('POST /send sends server-selected template to each recipient', async () => {
  const sentMessages = [];

  await withServer({
    smsService: { send: async (message) => sentMessages.push(message) },
    verifyCaptcha: async () => true
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload({
      phoneNumbers: ['+12035551234', '+12035551235'],
      templateType: 'HIV',
      tone: 'DIRECT'
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.sentCount, 2);
    assert.deepEqual(sentMessages.map((message) => message.to), ['+12035551234', '+12035551235']);
    assert.match(sentMessages[0].body, /HIV/i);
    assert.match(sentMessages[0].body, /Find nearby testing: https:\/\/gettested\.cdc\.gov\//);
    assert.doesNotMatch(sentMessages[0].body, /custom text/i);
  });
});

test('POST /send returns upstream failure without exposing provider details', async () => {
  await withServer({
    smsService: { send: async () => { throw new Error('Twilio credential failure'); } },
    verifyCaptcha: async () => true
  }, async (baseUrl) => {
    const response = await postJson(baseUrl, '/send', validPayload());

    assert.equal(response.status, 502);
    assert.equal(response.body.status, 'failed');
    assert.equal(response.body.sentCount, 0);
    assert.equal(response.body.failedCount, 1);
  });
});
