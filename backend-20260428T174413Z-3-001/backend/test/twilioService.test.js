const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTwilioSmsService } = require('../src/twilioService');

test('mock SMS delivery returns a deterministic provider response', async () => {
  const service = createTwilioSmsService({ mockDelivery: true });

  const result = await service.send({
    to: '+12035551234',
    body: 'Health notice'
  });

  assert.equal(result.status, 'mocked');
  assert.match(result.sid, /^SMmock/);
});
