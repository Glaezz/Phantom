import type { Context, ErrorHandler } from 'hono';
import { ApiError, errorBody } from '../errors';
import { isOriginAllowed, applyCors } from './cors';
import type { AppEnv } from '../types';
import { logRequest } from '../util/log';

function baseHeaders(c: Context<AppEnv>): void {
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Request-Id', c.get('requestId') ?? '');
}

function knownRoute(path: string): string {
  if (path === '/health') return '/health';
  if (path === '/api/analyze') return '/api/analyze';
  if (path === '/api/check') return '/api/check';
  if (path === '/api/cache/lookup') return '/api/cache/lookup';
  return 'unknown';
}

export const onError: ErrorHandler<AppEnv> = (error, c) => {
  baseHeaders(c);
  try {
    const config = c.get('config');
    const origin = c.req.header('Origin');
    if (origin && isOriginAllowed(origin, config)) applyCors(c, config);
  } catch {
    // Config may have failed before it was stored.
  }

  const status = error instanceof ApiError ? error.status : 500;
  logRequest({
    requestId: c.get('requestId') ?? '',
    route: knownRoute(c.req.path),
    status,
    latencyMs: performance.now() - (c.get('startedAt') ?? performance.now()),
  });

  if (error instanceof ApiError) {
    if (error.code === 'rate_limited') {
      c.header('Retry-After', c.get('retryAfter') ?? '60');
    }
    return c.json(errorBody(error.code, error.message), error.status as 400);
  }

  return c.json(errorBody('internal', 'Terjadi kesalahan internal.'), 500);
};
