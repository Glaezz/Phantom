import type { MiddlewareHandler } from 'hono';
import { rateLimited } from '../errors';
import type { AppEnv } from '../types';

interface WindowCounter {
  resetAt: number;
  count: number;
}

const memory = new Map<string, WindowCounter>();

export function resetRateLimits(): void {
  memory.clear();
}

function memoryLimit(key: string, limit: number): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const current = memory.get(key);

  if (!current || current.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + 60_000 });
    return { ok: true };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export type RateLimitKind = 'analyze' | 'check';

export function rateLimit(kind: RateLimitKind): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = c.get('config');
    const limit = kind === 'analyze' ? config.rateLimitAnalyzePerMin : config.rateLimitCheckPerMin;
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const key = `${kind}:${ip}`;

    let allowed = true;
    let retryAfter = 60;

    const binding = kind === 'analyze' ? c.env.RATE_LIMIT_ANALYZE : c.env.RATE_LIMIT_CHECK;
    if (binding && typeof binding.limit === 'function') {
      try {
        const result = await binding.limit({ key });
        allowed = result.success;
      } catch {
        const fallback = memoryLimit(key, limit);
        allowed = fallback.ok;
        if (!fallback.ok) retryAfter = fallback.retryAfter;
      }
    } else {
      const fallback = memoryLimit(key, limit);
      allowed = fallback.ok;
      if (!fallback.ok) retryAfter = fallback.retryAfter;
    }

    if (!allowed) {
      c.set('retryAfter', String(retryAfter));
      c.header('Retry-After', String(retryAfter));
      throw rateLimited();
    }

    await next();
  };
}
