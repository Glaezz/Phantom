import { PageFeaturesSchema, type CacheStore } from '@phantom/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { prepareAnalysis, runPreparedAgent, traceRows } from '../analysis';
import { createKvCache } from '../cache/kvCache';
import { invalidRequest } from '../errors';
import { createLlmChain } from '../llm/chain';
import { readJsonLimited } from '../middleware/bodyLimit';
import { createRdapLookup } from '../net/rdap';
import type { AppEnv } from '../types';
import { logRequest, type AttemptRecord } from '../util/log';

const AnalyzeSchema = z
  .object({
    url: z.string().min(1).max(2048),
    features: PageFeaturesSchema,
    consent: z.object({ cloud: z.boolean(), domainAge: z.boolean() }),
  });

const noopCache: CacheStore = {
  async get() {
    return null;
  },
  async set() {
    return;
  },
};

export const analyzeRoute = new Hono<AppEnv>();

analyzeRoute.post('/', async (c) => {
  const started = performance.now();
  const body = await readJsonLimited(c, 64 * 1024);
  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) throw invalidRequest();

  const config = c.get('config');
  const attempts: AttemptRecord[] = [];
  const chain = createLlmChain(config.llmChain, {
    apiKeys: { gemini: config.geminiApiKey, groq: config.groqApiKey },
    attemptTimeoutMs: config.llmAttemptTimeoutMs,
    cooldownMs: config.llmCooldownMs,
    onAttempt: (record) => attempts.push(record),
  });

  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    c.executionCtx.waitUntil;
    waitUntil = (promise) => c.executionCtx.waitUntil(promise);
  } catch {
    waitUntil = undefined;
  }

  const deps = {
    config,
    cache: c.env.PHANTOM_CACHE ? createKvCache(c.env.PHANTOM_CACHE) : noopCache,
    rdap: createRdapLookup(),
    chain,
    waitUntil,
  };

  const prepared = await prepareAnalysis(
    {
      url: parsed.data.url,
      features: parsed.data.features,
      consent: parsed.data.consent,
    },
    deps,
  );
  const withAgent = await runPreparedAgent(
    prepared,
    {
      url: parsed.data.url,
      features: parsed.data.features,
      consent: parsed.data.consent,
    },
    deps,
  );

  const latencyMs = performance.now() - started;
  logRequest({
    requestId: c.get('requestId'),
    route: '/api/analyze',
    status: 200,
    latencyMs,
    cache: withAgent.cache.hit ? 'hit' : withAgent.cache.written ? 'write' : 'miss',
    agent: withAgent.agent
      ? {
          used: withAgent.agent.used,
          provider: withAgent.agent.provider,
          model: withAgent.agent.model,
          steps: withAgent.agent.steps,
        }
      : undefined,
    attempts,
    degraded: withAgent.degraded,
  });

  return c.json({
    result: withAgent.result,
    final: withAgent.final,
    ...traceRows(withAgent),
    agent: withAgent.agent,
    cache: withAgent.cache,
    degraded: withAgent.degraded,
    meta: {
      latencyMs,
      stagesMs: withAgent.stages,
      tokens: withAgent.tokens,
      attempts,
    },
  });
});
