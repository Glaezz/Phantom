import {
  analyze,
  engine,
  parseUrl,
  type CacheStore,
  type PageFeatures,
} from '@phantom/core';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  prepareAnalysis,
  runPreparedAgent,
  worstStatus,
  type PreparedAnalysis,
  type PreparedWithAgent,
} from '../analysis';
import { createKvCache } from '../cache/kvCache';
import { ApiError, invalidRequest } from '../errors';
import { createLlmChain } from '../llm/chain';
import { readJsonLimited } from '../middleware/bodyLimit';
import { extractFeatures } from '../net/extractFeatures';
import { createRdapLookup } from '../net/rdap';
import { unrollRedirects } from '../net/redirects';
import { safeFetch } from '../net/safeFetch';
import type { AppEnv } from '../types';
import { logRequest, type AttemptRecord } from '../util/log';
import { extractUrls } from '../util/urls';

const CheckSchema = z
  .object({
    input: z.string().max(4000),
    noAi: z.boolean().optional(),
  })
  .strict();

interface FetchInfo {
  ok: boolean;
  status?: number;
  reason?: string;
}

interface ItemState {
  inputUrl: string;
  analyzedUrl: string;
  redirectChain: string[];
  fetch: FetchInfo;
  limitations: string[];
  features?: PageFeatures;
  prepared: PreparedAnalysis;
  agentEligible: boolean;
}

const noopCache: CacheStore = {
  async get() {
    return null;
  },
  async set() {
    return;
  },
};

function signalSeverity(state: ItemState): number {
  return state.prepared.result.signals.reduce(
    (score, signal) => score + (signal.severity === 'hard' ? 10 : 1),
    0,
  );
}

function agentSummary(result: PreparedWithAgent) {
  if (!result.agent) return null;
  return {
    used: result.agent.used,
    provider: result.agent.provider,
    model: result.agent.model,
    steps: result.agent.steps,
    verdict: result.agent.verdict,
    confidence: result.agent.confidence,
    reasons: result.agent.reasons,
    capped: result.agent.capped,
    usage: result.agent.usage,
  };
}

export const checkRoute = new Hono<AppEnv>();

checkRoute.post('/', async (c) => {
  const started = performance.now();
  const body = await readJsonLimited(c, 8 * 1024);
  const parsed = CheckSchema.safeParse(body);
  if (!parsed.success) throw invalidRequest();

  const urls = extractUrls(parsed.data.input);
  if (urls.length === 0) {
    throw new ApiError('no_url_found', 400, 'Tidak ada URL yang ditemukan.');
  }

  const config = c.get('config');
  const noAi = parsed.data.noAi === true;
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

  const states: ItemState[] = [];

  for (const inputUrl of urls) {
    const parsedUrl = parseUrl(inputUrl);
    if (!parsedUrl.ok) continue;

    const official = engine.matchOfficial(inputUrl);
    const limitations = new Set<string>(['static_html_only']);
    let analyzedUrl = inputUrl;
    let redirectChain: string[] = [];
    let fetchInfo: FetchInfo = { ok: true };
    let features: PageFeatures | undefined;
    let agentEligible = true;

    if (!official.matched) {
      const initial = analyze({ url: inputUrl });
      const isShortener = initial.signals.some((signal) => signal.id === 'URL_SHORTENER');

      if (isShortener) {
        const redirect = await unrollRedirects(inputUrl);
        analyzedUrl = redirect.finalUrl;
        redirectChain = redirect.chain;
      }

      const finalParsed = parseUrl(analyzedUrl);
      if (finalParsed.ok && finalParsed.isIp) {
        limitations.add('ip_host_not_fetched');
        fetchInfo = { ok: false, reason: 'ip_host_not_fetched' };
        agentEligible = false;
      } else {
        const fetched = await safeFetch(analyzedUrl, {
          timeoutMs: config.fetchTimeoutMs,
          maxBytes: config.fetchMaxBytes,
        });

        if (!fetched.ok) {
          limitations.add('fetch_failed');
          fetchInfo = { ok: false, reason: fetched.reason };
          agentEligible = false;
        } else {
          analyzedUrl = fetched.finalUrl;
          fetchInfo = { ok: true, status: fetched.status };
          features = await extractFeatures(fetched.html, fetched.finalUrl);
          if (features.forms.length === 0) limitations.add('no_forms_found_static');
        }
      }
    }

    const effectiveNoAi = noAi || !agentEligible;
    const prepared = await prepareAnalysis(
      {
        url: analyzedUrl,
        features,
        consent: { cloud: !noAi, domainAge: !noAi },
        noAi: effectiveNoAi,
      },
      deps,
    );

    states.push({
      inputUrl,
      analyzedUrl,
      redirectChain,
      fetch: fetchInfo,
      limitations: [...limitations],
      features,
      prepared,
      agentEligible,
    });
  }

  if (states.length === 0) {
    throw new ApiError('no_url_found', 400, 'Tidak ada URL yang ditemukan.');
  }

  const withAgents = new Map<number, PreparedWithAgent>();
  if (!noAi) {
    const candidates = states
      .map((state, index) => ({ state, index }))
      .filter(
        ({ state }) =>
          state.agentEligible &&
          state.prepared.result.status === 'caution' &&
          state.prepared.result.needsAgent &&
          !state.prepared.cache.hit,
      )
      .sort((a, b) => signalSeverity(b.state) - signalSeverity(a.state))
      .slice(0, 2);

    for (const { state, index } of candidates) {
      const withAgent = await runPreparedAgent(
        state.prepared,
        {
          url: state.analyzedUrl,
          features: state.features,
          consent: { cloud: true, domainAge: true },
        },
        deps,
      );
      withAgents.set(index, withAgent);
    }
  }

  const items = states.map((state, index) => {
    const prepared = withAgents.get(index) ?? {
      ...state.prepared,
      agent: null,
      tokens: { input: 0, output: 0 },
    };
    return {
      inputUrl: state.inputUrl,
      analyzedUrl: state.analyzedUrl,
      redirectChain: state.redirectChain.slice(0, 3),
      fetch: state.fetch,
      limitations: state.limitations,
      result: prepared.result,
      final: prepared.final,
      agent: agentSummary(prepared),
      cache: prepared.cache,
      degraded: prepared.degraded,
    };
  });

  const latencyMs = performance.now() - started;
  const anyHit = states.some((state) => state.prepared.cache.hit);
  const anyWrite = states.some((state) => state.prepared.cache.written);
  const anyAgent = items.find((item) => item.agent?.used)?.agent;

  logRequest({
    requestId: c.get('requestId'),
    route: '/api/check',
    status: 200,
    latencyMs,
    cache: anyHit ? 'hit' : anyWrite ? 'write' : 'miss',
    agent: anyAgent ?? undefined,
    attempts,
    degraded: [...new Set(items.flatMap((item) => item.degraded))],
  });

  return c.json({
    items,
    worst: worstStatus(items.map((item) => item.final.status)),
    limitations: ['static_html_only'],
  });
});
