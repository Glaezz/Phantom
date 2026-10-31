import { CACHE_KEY_VERSION, type CacheRecord, type CacheStore } from '@phantom/core';
import { z } from 'zod';

const CacheRecordSchema = z.object({
  status: z.enum(['neutral', 'caution', 'danger']),
  reasons: z.array(z.string().max(160)).max(3),
  createdAt: z.number().finite(),
  expiresAt: z.number().finite(),
  rulesVersion: z.string().min(1),
});

export function createKvCache(kv: KVNamespace): CacheStore {
  return {
    async get(key) {
      try {
        const raw = await kv.get(`${CACHE_KEY_VERSION}:${key}`);
        if (!raw) return null;
        const parsed = CacheRecordSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return null;
        if (parsed.data.expiresAt <= Date.now()) return null;
        return parsed.data as CacheRecord;
      } catch {
        return null;
      }
    },

    async set(key, record, ttlSeconds) {
      const expirationTtl = Math.max(60, Math.ceil(ttlSeconds));
      await kv.put(`${CACHE_KEY_VERSION}:${key}`, JSON.stringify(record), { expirationTtl });
    },
  };
}
