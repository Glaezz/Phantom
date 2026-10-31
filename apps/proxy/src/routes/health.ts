import { RULES_VERSION } from '@phantom/core';
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { logRequest } from '../util/log';

export const healthRoute = new Hono<AppEnv>();

healthRoute.get('/', (c) => {
  const started = c.get('startedAt') ?? performance.now();
  const config = c.get('config');
  logRequest({
    requestId: c.get('requestId'),
    route: '/health',
    status: 200,
    latencyMs: performance.now() - started,
  });
  return c.json({
    ok: true,
    service: 'phantom-proxy',
    rulesVersion: RULES_VERSION,
    llm: {
      chain: config.llmChain.map((entry) => `${entry.provider}:${entry.model}`),
      configured: {
        gemini: Boolean(config.geminiApiKey),
        groq: Boolean(config.groqApiKey),
      },
    },
    cache: Boolean(c.env.PHANTOM_CACHE),
  });
});
