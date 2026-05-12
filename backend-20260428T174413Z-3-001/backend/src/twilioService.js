const twilio = require('twilio');
const { ApiError } = require('./apiError');

function createTwilioSmsService({
  accountSid = process.env.TWILIO_SID,
  authToken = process.env.TWILIO_TOKEN,
  messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID,
  statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL,
  mockDelivery = process.env.MOCK_SMS_DELIVERY === 'true'
} = {}) {
  if (mockDelivery) {
    return {
      async send() {
        return {
          status: 'mocked',
          sid: `SMmock${Date.now()}`
        };
      }
    };
  }

  if (!accountSid || !authToken || !messagingServiceSid) {
    return {
      async send() {
        throw new ApiError(503, 'SMS_NOT_CONFIGURED', 'SMS delivery is not configured.');
      }
    };
  }

  const client = twilio(accountSid, authToken);

  return {
    async send({ to, body }) {
      const message = {
        body,
        to
      };

      message.messagingServiceSid = messagingServiceSid;

      if (statusCallback) {
        message.statusCallback = statusCallback;
      }

      return client.messages.create(message);
    }
  };
}

module.exports = {
  createTwilioSmsService
};
