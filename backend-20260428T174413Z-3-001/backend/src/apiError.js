class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function toErrorResponse(error, requestId) {
  const knownStatusByCode = {
    CAPTCHA_EXPIRED: 403
  };
  const status = Number.isInteger(error.status) ? error.status : knownStatusByCode[error.code] || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.status ? error.message : 'An unexpected server error occurred.';

  return {
    status,
    body: {
      error: {
        code,
        message,
        requestId
      }
    }
  };
}

module.exports = {
  ApiError,
  toErrorResponse
};
