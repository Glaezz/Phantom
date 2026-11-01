import {
  RULES_VERSION,
  analyze,
  cacheKey,
  deriveL3Steps,
  deriveL4Steps,
  mergeVerdict,
  parseUrl,
  type AnalyzeL3Entry,
  type AgentVerdict,
  type AnalysisResult,
  type CacheStore,
  type DomainAgeLookup,
  type PageFeatures,
  type Status,
  type TraceStep,
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
  /** Set when L4 was skipped because a cached verdict answered instead. */
  skipReason?: 'cacheHit' | 'deepCheckDisabled';
}

export interface AgentResponse {
  used: boolean;
  provider?: string;
  model?: string;
  steps?: number;
  trace?: AgentTraceStep[];
}

export interface CacheResponse {
  key: string;
  hit: boolean;
  written: boolean;
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
  l3?: AnalyzeL3Entry[];
  l3Disabled?: boolean;
}

export interface PreparedWithAgent extends PreparedAnalysis {
  agent: AgentResponse | null;
  tokens: { input: number; output: number };
  /** L3 lookups actually performed; `domainAge` fills the rest when results exist. */
  l3: AnalyzeL3Entry[];
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
  // The extracted features are authoritative: they come from the page the user is on.
  // Using input.url alone could analyse a different host than the one inspected.
  deps.agentDeadlineAt ??= Date.now() + Math.min(deps.config.agentDeadlineMs, 5_500);
  const url = input.features?.url ?? input.url;
  const stages: Record<string, number> = {};
  let started = performance.now();

  const initial = analyze({ url, features: input.features });
  stages.rules = performance.now() - started;
  let key = '';
  try {
    key = await cacheKey(url);
  } catch {
    key = '';
  }

  if (initial.status === 'official' || !initial.needsAgent) {
    return rulesOnly(initial, key, stages);
  }

  if (input.noAi || !input.consent.cloud) {
    // `noAi` datang dari server (budget/darurat), `consent.cloud` dari pengguna.
    // Bedanya dipakai panel untuk menampilkan alasan yang tepat.
    let prepared = rulesOnly(initial, key, stages);
    if (!input.noAi) prepared = { ...prepared, degraded: ['cloud_consent_missing'] };
    return { ...prepared, final: { ...prepared.final, skipReason: 'deepCheckDisabled' } };
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
    // A verdict produced by older rules must not outlive them.
    if (record && record.rulesVersion === RULES_VERSION) {
      return {
        result: initial,
        final: {
          status: higher(initial.floor, record.status),
          source: 'cache',
          capped: false,
          skipReason: 'cacheHit',
        },
        degraded: [],
        cache: { key, hit: true, written: false },
        stages,
      };
    }
  }

  let result = initial;
  const degraded: string[] = [];
  const l3: AnalyzeL3Entry[] = [];

  // Tanpa izin umur domain, L3 tidak pernah dijalankan: katakan begitu, bukan "tidak tersedia".
  if (!input.consent.domainAge) {
    return {
      result,
      final: { status: result.status, source: 'rules', capped: false },
      l3Disabled: true,
      degraded,
      l3,
      cache: { key, hit: false, written: false },
      stages,
    };
  }

  if (result.page.registeredDomain && parseUrl(url).isPrivateSuffix) {
    l3.push({ domain: result.page.registeredDomain, ageDays: null, reason: 'private_hosting' });
  } else if (result.page.registeredDomain) {
    started = performance.now();
    const timeout = timeoutSignal(3_000);
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

    l3.push({ domain: result.page.registeredDomain!, ageDays });
    if (ageDays === null) {
      degraded.push('rdap_unavailable');
    } else {
      started = performance.now();
      result = analyze({
        url,
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
      l3,
      cache: { key, hit: false, written: false },
      stages,
    };
  }

  return {
    result,
    final: { status: result.status, source: 'rules', capped: false },
    degraded,
    l3,
    cache: { key, hit: false, written: false },
    stages,
  };
}

function agentFailureDegraded(run: AgentRunResult): string[] {
  if (run.ok) return [];
  return [run.reason];
}

export async function runPreparedAgent(
  prepared: PreparedAnalysis,
  input: AnalysisInput,
  deps: PipelineDeps,
): Promise<PreparedWithAgent> {
  if (prepared.cache.hit || input.noAi || !input.consent.cloud || !prepared.result.needsAgent) {
    return { ...prepared, agent: null, tokens: { input: 0, output: 0 }, l3: prepared.l3 ?? [] };
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
      rdap: { async ageDays(domain, options) {
        const recorded = prepared.l3?.find((entry) => entry.domain === domain);
        return recorded ? recorded.ageDays : deps.rdap.ageDays(domain, options);
      } },
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
      l3: prepared.l3 ?? [],
    };
  }
  prepared.stages.agent = performance.now() - started;

  if (!run.ok) {
    return {
      ...prepared,
      degraded: [...new Set([...prepared.degraded, ...agentFailureDegraded(run)])],
      agent: null,
      tokens: { input: run.usage.inputTokens, output: run.usage.outputTokens },
      l3: prepared.l3 ?? [],
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
    l3: prepared.l3 ?? [],
    agent: {
      used: true,
      provider: run.provider,
      model: run.model,
      steps: run.steps,
      trace: run.trace,
    },
    tokens: { input: run.usage.inputTokens, output: run.usage.outputTokens },
  };
}

export interface TraceRows {
  l3: TraceStep[];
  l4: TraceStep[];
}

/** L3/L4 rows for the transparency panel; L0–L2 rows stay inside `result.trace`. */
export function traceRows(prepared: PreparedWithAgent): TraceRows {
  return {
    l3: deriveL3Steps(
      prepared.l3.length > 0
        ? prepared.l3
        : prepared.degraded.includes('rdap_unavailable') && prepared.result.page.registeredDomain
          ? [{ domain: prepared.result.page.registeredDomain, ageDays: null }]
          : [],
      prepared.l3Disabled || prepared.final.skipReason === 'deepCheckDisabled' ? 'deepCheckDisabled' : undefined,
    ),
    l4: deriveL4Steps(
      prepared.agent
        ? {
            used: true,
            provider: prepared.agent.provider,
            model: prepared.agent.model,
            verdict:
              prepared.final.status === 'official' ? 'neutral' : prepared.final.status,
          }
        : null,
      prepared.final.skipReason ?? (!prepared.result.needsAgent ? 'notNeeded' : undefined),
      prepared.degraded.find((reason) => reason.startsWith('llm_') || reason === 'agent_timeout' || reason === 'no_verdict'),
    ),
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
