function createMemoryRateLimiter({ limit = 5, windowMs = 86_400_000, clock = Date } = {}) {
  const attemptsByKey = new Map();

  function consume(key) {
    const now = clock.now();
    const windowStart = now - windowMs;
    const previousAttempts = attemptsByKey.get(key) || [];
    const recentAttempts = previousAttempts.filter((timestamp) => timestamp > windowStart);

    if (recentAttempts.length >= limit) {
      attemptsByKey.set(key, recentAttempts);
      return false;
    }

    recentAttempts.push(now);
    attemptsByKey.set(key, recentAttempts);
    return true;
  }

  return {
    consume
  };
}

function createMemoryRateLimitStore({ clock = Date, onConsume } = {}) {
  const attemptsByKey = new Map();

  return {
    async consumeWindow(key, { limit, windowMs }) {
      onConsume?.(key);
      const now = clock.now();
      const windowStart = now - windowMs;
      const previousAttempts = attemptsByKey.get(key) || [];
      const recentAttempts = previousAttempts.filter((timestamp) => timestamp > windowStart);

      if (recentAttempts.length >= limit) {
        attemptsByKey.set(key, recentAttempts);
        return false;
      }

      recentAttempts.push(now);
      attemptsByKey.set(key, recentAttempts);
      return true;
    },

    attemptsByKey
  };
}

function createRedisRestRateLimitStore({
  url = process.env.REDIS_REST_URL,
  token = process.env.REDIS_REST_TOKEN,
  fetchImpl = global.fetch
} = {}) {
  async function command(args) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      throw new Error('Redis rate limit store unavailable.');
    }

    return response.json();
  }

  return {
    async consumeWindow(key, { limit, windowMs }) {
      const result = await command(['INCR', key]);
      const count = Number(result.result);
      if (count === 1) {
        await command(['PEXPIRE', key, windowMs]);
      }
      return count <= limit;
    }
  };
}

function createCompositeRateLimiter({
  store,
  phoneHashSecret,
  limits = {
    ip: { limit: 20, windowMs: 86_400_000 },
    device: { limit: 5, windowMs: 86_400_000 },
    recipient: { limit: 3, windowMs: 86_400_000 }
  }
} = {}) {
  const effectiveStore = store || createMemoryRateLimitStore();

  return {
    async consume({ ip = 'unknown', deviceHash, phoneNumbers }) {
      const { hashRecipient } = require('./recipientHash');
      const checks = [
        [`ip:${ip}`, limits.ip],
        [`device:${deviceHash}`, limits.device],
        ...phoneNumbers.map((phoneNumber) => [
          `recipient:${hashRecipient(phoneNumber, phoneHashSecret)}`,
          limits.recipient
        ])
      ];

      for (const [key, limitConfig] of checks) {
        const allowed = await effectiveStore.consumeWindow(key, limitConfig);
        if (!allowed) {
          return false;
        }
      }

      return true;
    }
  };
}

module.exports = {
  createCompositeRateLimiter,
  createMemoryRateLimiter,
  createMemoryRateLimitStore,
  createRedisRestRateLimitStore
};
