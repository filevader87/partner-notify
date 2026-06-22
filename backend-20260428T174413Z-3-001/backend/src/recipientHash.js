const crypto = require('node:crypto');

function hashRecipient(phoneNumber, secret = process.env.PHONE_HASH_SECRET || 'development-phone-hash-secret') {
  return crypto
    .createHmac('sha256', secret)
    .update(phoneNumber)
    .digest('hex');
}

module.exports = {
  hashRecipient
};
