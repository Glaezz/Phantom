import {
  RULES_VERSION,
  analyze,
  cacheKey,
  mergeVerdict,
  type AgentVerdict,
  type AnalysisResult,
  type CacheStore,
  type DomainAgeLookup,
  type PageFeatures,
  type Status,
} from '@phantom/core';
import type { AgentRunResult, AgentTraceStep } from './agent/schemas';
import { runAgent } from './agent/loop';
import type { LlmChain } from './llm/chain';
import type { AppConfig } from './env';
import { timeoutSignal } from './util/timeout';

export interface FinalVerdict {
  status: Status;
  source: 'rules' | 'cache' | 'agent';
  capped: boolean;
}

export interface AgentResponse {
  used: boolean;
  provider?: string;
  model?: string;
  steps?: number;
  trace?: AgentTraceStep[];
  verdict?: AgentVerdict['verdict'];
  confidence?: number;
  reasons?: string[];
  capped?: boolean;
  usage?: { input: number; output: number };
}

export interface CacheResponse {
  key: string;
  hit: boolean;
  written: boolean;
  reasons?: string[];
  createdAt?: number;
  expiresAt?: number;
}

export interface AnalysisInput {
  url: string;
  features?: PageFeatures;
  consent: { cloud: boolean; domainAge: boolean };
  noAi?: boolean;
}

export interface PipelineDeps {
  config: AppConfig;
  cache: CacheStore;
  rdap: DomainAgeLookup;
  chain: LlmChain;
  waitUntil?: (promise: Promise<unknown>) => void;
  agentDeadlineAt?: number;
}

export interface PreparedAnalysis {
  result: AnalysisResult;
  final: FinalVerdict;
  degraded: string[];
  cache: CacheResponse;
  stages: Record<string, number>;
}

export interface PreparedWithAgent extends PreparedAnalysis {
  agent: AgentResponse | null;
  tokens: { input: number; output: number };
}

const RANK: Record<'neutral' | 'caution' | 'danger', number> = {
  neutral: 0,
  caution: 1,
  danger: 2,
};

function higher(a: Status, b: 'neutral' | 'caution' | 'danger'): Status {
  if (a === 'official') return a;
  return RANK[a] >= RANK[b] ? a : b;
}

function cappedVerdict(verdict: AgentVerdict): AgentVerdict {
  if (verdict.verdict === 'danger' && verdict.evidenceRefs.length === 0) {
    return { ...verdict, verdict: 'caution' };
  }
  return verdict;
}

function rulesOnly(
  result: AnalysisResult,
  key: string,
  stages: Record<string, number>,
): PreparedAnalysis {
  return {
    result,
    final: { status: result.status, source: 'rules', capped: false },
    degraded: [],
    cache: { key, hit: false, written: false },
    stages,
  };
}

export async function prepareAnalysis(
  input: AnalysisInput,
  deps: PipelineDeps,
): Promise<PreparedAnalysis> {
  const stages: Record<string, number> = {};
  let started = performance.now();

  const initial = analyze({ url: input.url, features: input.features });
  stages.rules = performance.now() - started;
  let key = '';
  try {
    key = await cacheKey(input.url);
  } catch {
    key = '';
  }

  if (initial.status === 'official' || !initial.needsAgent) {
    return rulesOnly(initial, key, stages);
  }

  if (input.noAi || !input.consent.cloud) {
    const prepared = rulesOnly(initial, key, stages);
    if (!input.consent.cloud && !input.noAi) prepared.degraded = ['cloud_consent_missing'];
    return prepared;
  }

  if (key) {
    started = performance.now();
    let record = null;
    try {
      record = await deps.cache.get(key);
    } catch {
      record = null;
    }
    stages.cache = performance.now() - started;
    if (record) {
      return {
        result: initial,
        final: {
          status: higher(initial.floor, record.status),
          source: 'cache',
          capped: false,
        },
        degraded: [],
        cache: {
          key,
          hit: true,
          written: false,
          reasons: record.reasons.slice(0, 3),
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
        },
        stages,
      };
    }
  }

  let result = initial;
  const degraded: string[] = [];

  if (input.consent.domainAge && result.page.registeredDomain) {
    started = performance.now();
    const timeout = timeoutSignal(2_500);
    let ageDays: number | null = null;
    try {
      ageDays = await deps.rdap.ageDays(result.page.registeredDomain, {
        signal: timeout.signal,
      });
    } catch {
      ageDays = null;
    } finally {
      timeout.cleanup();
      stages.rdap = performance.now() - started;
    }

    if (ageDays === null) {
      degraded.push('rdap_unavailable');
    } else {
      started = performance.now();
      result = analyze({
        url: input.url,
        features: input.features,
        context: { domainAgeDays: ageDays },
      });
      stages.rulesRerun = performance.now() - started;
    }
  }

  if (result.status === 'official' || !result.needsAgent) {
    return {
      result,
      final: { status: result.status, source: 'rules', capped: false },
      degraded,
      cache: { key, hit: false, written: false },
      stages,
    };
  }

  return {
    result,
    final: { status: result.status, source: 'rules', capped: false },
    degraded,
    cache: { key, hit: false, written: false },
    stages,
  };
}

function agentFailureDegraded(run: AgentRunResult): string[] {
  if (run.ok) return [];
  if (run.reason === 'agent_timeout') return ['agent_timeout'];
  if (run.reason === 'llm_unavailable') return ['llm_unavailable'];
  return [];
}

export async function runPreparedAgent(
  prepared: PreparedAnalysis,
  input: AnalysisInput,
  deps: PipelineDeps,
): Promise<PreparedWithAgent> {
  if (prepared.cache.hit || input.noAi || !input.consent.cloud || !prepared.result.needsAgent) {
    return { ...prepared, agent: null, tokens: { input: 0, output: 0 } };
  }

  const started = performance.now();
  if (deps.agentDeadlineAt === undefined) {
    deps.agentDeadlineAt = Date.now() + deps.config.agentDeadlineMs;
  }
  let run: AgentRunResult;
  try {
    run = await runAgent(deps.chain, {
      result: prepared.result,
      features: input.features ?? null,
      consent: { cloud: input.consent.cloud, domainAge: input.consent.domainAge },
      rdap: deps.rdap,
      signal: new AbortController().signal,
      maxSteps: deps.config.agentMaxSteps,
      deadlineMs: Math.max(1, deps.agentDeadlineAt - Date.now()),
    });
  } catch {
    return {
      ...prepared,
      degraded: [...new Set([...prepared.degraded, 'llm_unavailable'])],
      agent: null,
      tokens: { input: 0, output: 0 },
    };
  }
  prepared.stages.agent = performance.now() - started;

  if (!run.ok) {
    return {
      ...prepared,
      degraded: [...new Set([...prepared.degraded, ...agentFailureDegraded(run)])],
      agent: null,
      tokens: { input: run.usage.inputTokens, output: run.usage.outputTokens },
    };
  }

  const merged = mergeVerdict(prepared.result, run.verdict);
  const final: FinalVerdict = {
    status: merged.status,
    source: 'agent',
    capped: merged.capped,
  };

  if (prepared.cache.key) {
    const effective = cappedVerdict(run.verdict);
    const ttlDays =
      effective.verdict === 'neutral'
        ? deps.config.cacheTtlNeutralDays
        : deps.config.cacheTtlDangerDays;
    const now = Date.now();
    const record = {
      status: effective.verdict,
      reasons: effective.reasons.slice(0, 3),
      createdAt: now,
      expiresAt: now + ttlDays * 86_400_000,
      rulesVersion: RULES_VERSION,
    };

    let write: Promise<void> | null = null;
    try {
      write = deps.cache.set(prepared.cache.key, record, ttlDays * 86_400);
    } catch {
      write = null;
    }

    if (!write) {
      prepared.cache = { ...prepared.cache, written: false };
    } else if (deps.waitUntil) {
      try {
        deps.waitUntil(write.catch(() => undefined));
        prepared.cache = { ...prepared.cache, written: true };
      } catch {
        prepared.cache = { ...prepared.cache, written: false };
      }
    } else {
      try {
        await write;
        prepared.cache = { ...prepared.cache, written: true };
      } catch {
        prepared.cache = { ...prepared.cache, written: false };
      }
    }
  }

  return {
    ...prepared,
    final,
    agent: {
      used: true,
      provider: run.provider,
      model: run.model,
      steps: run.steps,
      trace: run.trace,
      verdict: run.verdict.verdict,
      confidence: run.verdict.confidence,
      reasons: run.verdict.reasons.slice(0, 3),
      capped: merged.capped,
      usage: { input: run.usage.inputTokens, output: run.usage.outputTokens },
    },
    tokens: { input: run.usage.inputTokens, output: run.usage.outputTokens },
  };
}

export function worstStatus(statuses: Status[]): Status {
  if (statuses.length === 0) return 'neutral';
  let worst: 'neutral' | 'caution' | 'danger' = 'neutral';
  let hasNonOfficial = false;
  for (const status of statuses) {
    if (status === 'official') continue;
    hasNonOfficial = true;
    if (RANK[status] > RANK[worst]) worst = status;
  }
  return hasNonOfficial ? worst : 'official';
}
