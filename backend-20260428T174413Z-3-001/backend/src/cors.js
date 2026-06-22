const localDevelopmentOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];

function parseAllowedOrigins(value = process.env.ALLOWED_ORIGINS || '', env = process.env) {
  const configured = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0 || env.NODE_ENV === 'production') {
    return configured;
  }

  return localDevelopmentOrigins;
}

function createCorsMiddleware({ allowedOrigins = parseAllowedOrigins() } = {}) {
  const allowed = new Set(allowedOrigins);

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    if (origin && (allowed.has(origin) || allowed.has('*'))) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
      res.setHeader('access-control-allow-headers', 'content-type');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  };
}

module.exports = {
  createCorsMiddleware,
  parseAllowedOrigins
};
