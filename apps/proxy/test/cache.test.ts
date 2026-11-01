import type { CacheRecord } from '@phantom/core';
import { describe, expect, it } from 'vitest';
import { createKvCache } from '../src/cache/kvCache';

class FakeKv {
  readonly store = new Map<string, string>();
  lastPut?: { key: string; options?: KVNamespacePutOptions };

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void> {
    this.lastPut = { key, options };
    this.store.set(key, value);
  }
}

function record(overrides: Partial<CacheRecord> = {}): CacheRecord {
  return {
    status: 'caution',
    reasons: ['Alasan'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    rulesVersion: '1.0.0',
    ...overrides,
  };
}

describe('KV cache', () => {
  it('writes and reads the same record', async () => {
    const kv = new FakeKv();
    const cache = createKvCache(kv as unknown as KVNamespace);
    const value = record();
    await cache.set('a'.repeat(64), value, 30);
    expect(await cache.get('a'.repeat(64))).toEqual(value);
    expect(kv.lastPut?.key).toBe(`v2:${'a'.repeat(64)}`);
    expect(kv.lastPut?.options?.expirationTtl).toBe(60);
  });

  it('returns null for expired records', async () => {
    const kv = new FakeKv();
    const cache = createKvCache(kv as unknown as KVNamespace);
    const key = 'b'.repeat(64);
    kv.store.set(
      `v2:${key}`,
      JSON.stringify(record({ expiresAt: Date.now() - 1 })),
    );
    expect(await cache.get(key)).toBeNull();
  });

  it('returns null for invalid JSON and reads that throw', async () => {
    const kv = new FakeKv();
    const cache = createKvCache(kv as unknown as KVNamespace);
    const key = 'c'.repeat(64);
    kv.store.set(`v2:${key}`, '{bad');
    expect(await cache.get(key)).toBeNull();

    const throwing = {
      async get() {
        throw new Error('quota');
      },
    } as unknown as KVNamespace;
    expect(await createKvCache(throwing).get(key)).toBeNull();
  });
});
