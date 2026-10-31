import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.set('startedAt', performance.now());
    c.header('X-Request-Id', id);
    await next();
    c.header('X-Request-Id', id);
  };
}
