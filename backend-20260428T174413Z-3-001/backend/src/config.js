function parseAllowedOrigins(value = '') {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requireValue(env, name, errors) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${name} is required in production.`);
    return '';
  }
  return value.trim();
}

function requireHttpsUrl(env, name, errors) {
  const value = requireValue(env, name, errors);
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      errors.push(`${name} must be an HTTPS URL.`);
    }
  } catch {
    errors.push(`${name} must be a valid HTTPS URL.`);
  }

  return value;
}

function validateProductionConfig(env = process.env) {
  const errors = [];
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');

  if (!isProduction) {
    return {
      isProduction: false,
      allowedOrigins,
      publicBaseUrl: env.PUBLIC_BASE_URL || 'http://127.0.0.1:5173',
      privacyUrl: env.PRIVACY_URL || 'http://127.0.0.1:5173/privacy',
      supportUrl: env.SUPPORT_URL || 'http://127.0.0.1:5173/support',
      abuseReportUrl: env.ABUSE_REPORT_URL || 'http://127.0.0.1:5173/report-abuse',
      twilioMessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID || ''
    };
  }

  requireValue(env, 'TURNSTILE_SECRET', errors);
  requireValue(env, 'OPERATOR_NAME', errors);
  requireValue(env, 'PHONE_HASH_SECRET', errors);
  requireValue(env, 'REDIS_REST_URL', errors);
  requireValue(env, 'REDIS_REST_TOKEN', errors);
  requireValue(env, 'TWILIO_SID', errors);
  requireValue(env, 'TWILIO_TOKEN', errors);
  const twilioMessagingServiceSid = requireValue(env, 'TWILIO_MESSAGING_SERVICE_SID', errors);
  const publicBaseUrl = requireHttpsUrl(env, 'PUBLIC_BASE_URL', errors);
  const privacyUrl = requireHttpsUrl(env, 'PRIVACY_URL', errors);
  const supportUrl = requireHttpsUrl(env, 'SUPPORT_URL', errors);
  const abuseReportUrl = requireHttpsUrl(env, 'ABUSE_REPORT_URL', errors);
  const testingLocatorUrl = requireHttpsUrl(env, 'TESTING_LOCATOR_URL', errors);

  if (env.MOCK_SMS_DELIVERY === 'true') {
    errors.push('MOCK_SMS_DELIVERY cannot be true in production.');
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
    errors.push('ALLOWED_ORIGINS must list exact HTTPS web origins in production.');
  }

  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:') {
        errors.push(`ALLOWED_ORIGINS entry must use HTTPS: ${origin}`);
      }
    } catch {
      errors.push(`ALLOWED_ORIGINS entry is invalid: ${origin}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unsafe production configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    isProduction: true,
    allowedOrigins,
    publicBaseUrl,
    privacyUrl,
    supportUrl,
    abuseReportUrl,
    testingLocatorUrl,
    twilioMessagingServiceSid
  };
}

module.exports = {
  parseAllowedOrigins,
  validateProductionConfig
};
