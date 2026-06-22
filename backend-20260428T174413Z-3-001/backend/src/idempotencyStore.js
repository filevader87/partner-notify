function createMemoryIdempotencyStore({ clock = Date, ttlMs = 86_400_000 } = {}) {
  const records = new Map();

  function prune() {
    const now = clock.now();
    for (const [key, record] of records.entries()) {
      if (now - record.createdAt > ttlMs) {
        records.delete(key);
      }
    }
  }

  return {
    async reserve(key, fingerprint) {
      prune();
      const existing = records.get(key);
      if (existing) {
        return { reserved: false, record: existing };
      }

      records.set(key, {
        key,
        fingerprint,
        state: 'pending',
        createdAt: clock.now()
      });
      return { reserved: true };
    },

    async complete(key, response, httpStatus) {
      const existing = records.get(key);
      if (!existing) {
        return;
      }

      records.set(key, {
        ...existing,
        state: 'completed',
        response,
        httpStatus,
        completedAt: clock.now()
      });
    },

    async release(key) {
      const existing = records.get(key);
      if (existing?.state === 'pending') {
        records.delete(key);
      }
    },

    records
  };
}

function createRedisRestIdempotencyStore({
  url = process.env.REDIS_REST_URL,
  token = process.env.REDIS_REST_TOKEN,
  fetchImpl = global.fetch,
  ttlSeconds = 86_400
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
      throw new Error('Redis idempotency store unavailable.');
    }

    return response.json();
  }

  return {
    async reserve(key, fingerprint) {
      const recordKey = `idempotency:${key}`;
      const record = {
        key,
        fingerprint,
        state: 'pending',
        createdAt: new Date().toISOString()
      };
      const result = await command(['SET', recordKey, JSON.stringify(record), 'NX', 'EX', ttlSeconds]);

      if (result.result === 'OK') {
        return { reserved: true };
      }

      const existing = await command(['GET', recordKey]);
      return { reserved: false, record: JSON.parse(existing.result) };
    },

    async complete(key, response, httpStatus) {
      const recordKey = `idempotency:${key}`;
      const existing = await command(['GET', recordKey]);
      if (!existing.result) {
        return;
      }
      const record = {
        ...JSON.parse(existing.result),
        state: 'completed',
        response,
        httpStatus,
        completedAt: new Date().toISOString()
      };
      await command(['SET', recordKey, JSON.stringify(record), 'EX', ttlSeconds]);
    },

    async release(key) {
      await command(['DEL', `idempotency:${key}`]);
    }
  };
}

module.exports = {
  createMemoryIdempotencyStore,
  createRedisRestIdempotencyStore
};
