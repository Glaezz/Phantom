import type { Context, MiddlewareHandler } from 'hono';
import { originNotAllowed } from '../errors';
import type { AppConfig } from '../env';
import type { AppEnv } from '../types';

export function isOriginAllowed(origin: string, config: AppConfig): boolean {
  if (config.allowedOrigins.includes(origin)) return true;
  return (
    config.allowExtensionOrigins &&
    (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))
  );
}

export function applyCors(c: Context<AppEnv>, config: AppConfig): void {
  const origin = c.req.header('Origin');
  c.header('Vary', 'Origin');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  if (origin && isOriginAllowed(origin, config)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
}

export function cors(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = c.get('config');
    const origin = c.req.header('Origin');
    if (origin && !isOriginAllowed(origin, config)) throw originNotAllowed();

    applyCors(c, config);

    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();
  };
}
