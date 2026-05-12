const { ApiError } = require('./apiError');
const { getTemplate } = require('./templates');

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECIPIENTS = 3;

function validateSendPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'INVALID_REQUEST_BODY', 'Request body must be a JSON object.');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'message')) {
    throw new ApiError(400, 'CLIENT_MESSAGE_NOT_ALLOWED', 'Message content is selected by the server.');
  }

  const { phoneNumbers, templateType, tone, captchaToken, deviceHash, idempotencyKey } = payload;

  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0 || phoneNumbers.length > MAX_RECIPIENTS) {
    throw new ApiError(400, 'INVALID_PHONE_NUMBER', `Provide 1 to ${MAX_RECIPIENTS} recipient phone numbers.`);
  }

  for (const phoneNumber of phoneNumbers) {
    if (typeof phoneNumber !== 'string' || !E164_PHONE_NUMBER.test(phoneNumber)) {
      throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Phone numbers must be E.164 formatted, for example +12035551234.');
    }
  }

  if (typeof templateType !== 'string' || typeof tone !== 'string' || !getTemplate(templateType, tone)) {
    throw new ApiError(400, 'INVALID_TEMPLATE_SELECTION', 'Template type and tone must be supported.');
  }

  if (typeof captchaToken !== 'string' || captchaToken.trim().length < 8) {
    throw new ApiError(400, 'INVALID_CAPTCHA_TOKEN', 'Captcha token is required.');
  }

  if (typeof deviceHash !== 'string' || !SHA256_HEX.test(deviceHash)) {
    throw new ApiError(400, 'INVALID_DEVICE_HASH', 'Device hash must be a SHA-256 hex digest.');
  }

  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency key must be a UUID.');
  }

  return {
    phoneNumbers,
    templateType,
    tone,
    captchaToken,
    deviceHash: deviceHash.toLowerCase(),
    idempotencyKey: idempotencyKey.toLowerCase()
  };
}

module.exports = {
  MAX_RECIPIENTS,
  validateSendPayload
};
