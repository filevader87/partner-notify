const { ApiError } = require('./apiError');

function createCaptchaVerifier({
  secret = process.env.TURNSTILE_SECRET,
  endpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  fetchImpl = global.fetch
} = {}) {
  return async function verifyCaptcha(token, remoteIp) {
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new ApiError(503, 'CAPTCHA_NOT_CONFIGURED', 'Captcha verification is not configured.');
      }

      return token === 'captcha-dev-ok';
    }

    const body = new URLSearchParams({
      secret,
      response: token
    });

    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body
    });

    if (!response.ok) {
      throw new ApiError(503, 'CAPTCHA_UNAVAILABLE', 'Captcha verification is temporarily unavailable.');
    }

    const result = await response.json();
    if (result.success === true) {
      return true;
    }

    const errorCodes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    if (errorCodes.includes('timeout-or-duplicate')) {
      throw new ApiError(403, 'CAPTCHA_EXPIRED', 'Captcha token expired. Complete the challenge again.');
    }

    return false;
  };
}

module.exports = {
  createCaptchaVerifier
};
