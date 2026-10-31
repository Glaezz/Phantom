import { Hono } from 'hono';
import { z } from 'zod';
import { createKvCache } from '../cache/kvCache';
import { invalidRequest } from '../errors';
import { readJsonLimited } from '../middleware/bodyLimit';
import type { AppEnv } from '../types';
import { logRequest } from '../util/log';

const LookupSchema = z.object({ key: z.string().regex(/^[0-9a-f]{64}$/) }).strict();

export const cacheLookupRoute = new Hono<AppEnv>();

cacheLookupRoute.post('/', async (c) => {
  const started = performance.now();
  const body = await readJsonLimited(c, 8 * 1024);
  const parsed = LookupSchema.safeParse(body);
  if (!parsed.success) throw invalidRequest();

  const cache = c.env.PHANTOM_CACHE ? createKvCache(c.env.PHANTOM_CACHE) : null;
  const record = cache ? await cache.get(parsed.data.key) : null;

  logRequest({
    requestId: c.get('requestId'),
    route: '/api/cache/lookup',
    status: 200,
    latencyMs: performance.now() - started,
    cache: record ? 'hit' : 'miss',
  });

  return c.json(record ? { hit: true, record } : { hit: false });
});
