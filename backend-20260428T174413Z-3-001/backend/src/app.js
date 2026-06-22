const crypto = require('node:crypto');
const express = require('express');
const { ApiError, toErrorResponse } = require('./apiError');
const { createCaptchaVerifier } = require('./captcha');
const { createCorsMiddleware } = require('./cors');
const { createConsoleDeliveryLedger } = require('./deliveryLedger');
const { createMemoryIdempotencyStore, createRedisRestIdempotencyStore } = require('./idempotencyStore');
const { hashRecipient } = require('./recipientHash');
const { createCompositeRateLimiter, createMemoryRateLimitStore, createRedisRestRateLimitStore } = require('./rateLimiter');
const { getPublicTemplates, getTemplate } = require('./templates');
const { createTwilioSmsService } = require('./twilioService');
const { validateSendPayload } = require('./validation');

function createDefaultRateLimiter() {
  const store = process.env.REDIS_REST_URL && process.env.REDIS_REST_TOKEN
    ? createRedisRestRateLimitStore()
    : createMemoryRateLimitStore();

  return createCompositeRateLimiter({
    store,
    phoneHashSecret: process.env.PHONE_HASH_SECRET
  });
}

function createDefaultIdempotencyStore() {
  return process.env.REDIS_REST_URL && process.env.REDIS_REST_TOKEN
    ? createRedisRestIdempotencyStore()
    : createMemoryIdempotencyStore();
}

function fingerprintPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      phoneNumbers: payload.phoneNumbers,
      templateType: payload.templateType,
      tone: payload.tone,
      deviceHash: payload.deviceHash
    }))
    .digest('hex');
}

function createApp({
  smsService = createTwilioSmsService(),
  rateLimiter = createDefaultRateLimiter(),
  verifyCaptcha = createCaptchaVerifier(),
  idempotencyStore = createDefaultIdempotencyStore(),
  deliveryLedger = createConsoleDeliveryLedger(),
  phoneHashSecret = process.env.PHONE_HASH_SECRET,
  supportUrl = process.env.SUPPORT_URL,
  testingLocatorUrl = process.env.TESTING_LOCATOR_URL,
  allowedOrigins
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(createCorsMiddleware({ allowedOrigins }));
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/templates', (req, res) => {
    res.status(200).json(getPublicTemplates({ supportUrl, testingLocatorUrl }));
  });

  app.post('/send', async (req, res, next) => {
    const requestId = crypto.randomUUID();
    let idempotencyReserved = false;
    let idempotencyKey;

    try {
      const payload = validateSendPayload(req.body);
      idempotencyKey = payload.idempotencyKey;
      const fingerprint = fingerprintPayload(payload);
      const reservation = await idempotencyStore.reserve(payload.idempotencyKey, fingerprint);

      if (!reservation.reserved) {
        if (reservation.record.fingerprint !== fingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key was already used for a different request.');
        }
        if (reservation.record.state === 'completed') {
          return res.status(reservation.record.httpStatus || 200).json({
            ...reservation.record.response,
            status: 'duplicate',
            duplicate: true
          });
        }
        throw new ApiError(409, 'REQUEST_IN_PROGRESS', 'A matching notification request is already in progress.');
      }
      idempotencyReserved = true;

      const captchaOk = await verifyCaptcha(payload.captchaToken, req.ip);

      if (!captchaOk) {
        throw new ApiError(403, 'CAPTCHA_FAILED', 'Captcha verification failed.');
      }

      if (!await rateLimiter.consume({
        ip: req.ip || 'unknown',
        deviceHash: payload.deviceHash,
        phoneNumbers: payload.phoneNumbers
      })) {
        throw new ApiError(429, 'RATE_LIMITED', 'Notification limit reached for this device.');
      }

      const body = getTemplate(payload.templateType, payload.tone, { supportUrl, testingLocatorUrl });
      const sent = [];
      const failed = [];

      for (const phoneNumber of payload.phoneNumbers) {
        const hashedRecipient = hashRecipient(phoneNumber, phoneHashSecret);
        try {
          const providerResponse = await smsService.send({ to: phoneNumber, body });
          const providerMessageSid = providerResponse?.sid || providerResponse?.messageSid || providerResponse?.MessageSid || null;
          sent.push({ hashedRecipient, providerMessageSid });
          await deliveryLedger.recordRecipient({
            requestId,
            hashedRecipient,
            templateType: payload.templateType,
            tone: payload.tone,
            templateVersion: require('./templates').TEMPLATE_VERSION,
            providerMessageSid,
            state: 'provider_accepted',
            createdAt: new Date().toISOString()
          });
        } catch {
          failed.push({ hashedRecipient });
          await deliveryLedger.recordRecipient({
            requestId,
            hashedRecipient,
            templateType: payload.templateType,
            tone: payload.tone,
            templateVersion: require('./templates').TEMPLATE_VERSION,
            providerMessageSid: null,
            state: 'provider_failed',
            createdAt: new Date().toISOString()
          });
        }
      }

      const status = failed.length === 0 ? 'accepted' : sent.length === 0 ? 'failed' : 'partial_failed';
      const httpStatus = status === 'accepted' ? 200 : status === 'partial_failed' ? 207 : 502;
      const responseBody = {
        success: status === 'accepted',
        status,
        duplicate: false,
        sentCount: sent.length,
        failedCount: failed.length,
        requestId
      };

      await idempotencyStore.complete(payload.idempotencyKey, responseBody, httpStatus);

      console.info(JSON.stringify({
        event: 'send_completed',
        requestId,
        templateType: payload.templateType,
        tone: payload.tone,
        recipientCount: payload.phoneNumbers.length,
        sentCount: sent.length,
        failedCount: failed.length,
        status
      }));

      res.status(httpStatus).json(responseBody);
    } catch (error) {
      if (idempotencyReserved && idempotencyKey) {
        await idempotencyStore.release(idempotencyKey).catch(() => {});
      }
      error.requestId = requestId;
      next(error);
    }
  });

  app.post('/twilio/status', async (req, res) => {
    await deliveryLedger.recordProviderStatus({
      providerMessageSid: req.body.MessageSid || null,
      providerStatus: req.body.MessageStatus || req.body.SmsStatus || null,
      errorCode: req.body.ErrorCode || null,
      recordedAt: new Date().toISOString()
    });

    res.status(204).end();
  });

  app.use((error, req, res, next) => {
    const requestId = error.requestId || crypto.randomUUID();
    const response = toErrorResponse(error, requestId);

    if (response.status >= 500) {
      console.error(JSON.stringify({
        event: 'request_failed',
        requestId,
        code: response.body.error.code
      }));
    }

    res.status(response.status).json(response.body);
  });

  return app;
}

module.exports = {
  createApp
};
