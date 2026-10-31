import type { MiddlewareHandler } from 'hono';
import { parseConfig } from '../env';
import type { AppEnv } from '../types';

export function config(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('config', parseConfig(c.env));
    await next();
  };
}
