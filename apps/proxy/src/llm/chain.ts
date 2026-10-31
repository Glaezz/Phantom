import type { LlmProvider, LlmRequest, LlmResponse } from '@phantom/core';
import type { LlmChainEntry } from '../env';
import { isAbortError, timeoutSignal } from '../util/timeout';
import type { AttemptRecord } from '../util/log';
import {
  AgentDeadlineError,
  LlmChainExhausted,
  LlmInvalidOutputError,
  LlmProviderError,
} from './errors';
import { createGeminiProvider } from './gemini';
import { createGroqProvider } from './groq';
import { isHealthy, markUnhealthy } from './health';

export interface LlmChainDeps {
  apiKeys: { gemini: string | null; groq: string | null };
  attemptTimeoutMs: number;
  cooldownMs?: number;
  maxCalls?: number;
  onAttempt?: (record: AttemptRecord) => void;
}

export interface LlmChain extends LlmProvider {
  readonly entries: LlmChainEntry[];
  available(index: number): boolean;
  attempt(index: number, req: LlmRequest, opts: { signal: AbortSignal }): Promise<LlmResponse>;
}

export function createLlmChain(entries: LlmChainEntry[], deps: LlmChainDeps): LlmChain {
  const providers = entries.map((entry): LlmProvider | null => {
    const key = entry.provider === 'gemini' ? deps.apiKeys.gemini : deps.apiKeys.groq;
    if (!key) return null;
    return entry.provider === 'gemini'
      ? createGeminiProvider(entry.model, key)
      : createGroqProvider(entry.model, key);
  });

  const available = (index: number): boolean => {
    const entry = entries[index];
    return Boolean(entry && providers[index] && isHealthy(entry.provider, entry.model));
  };

  const record = (record: AttemptRecord): void => {
    deps.onAttempt?.(record);
  };

  const maxCalls = deps.maxCalls ?? 8;
  let calls = 0;

  const attempt = async (
    index: number,
    req: LlmRequest,
    opts: { signal: AbortSignal },
  ): Promise<LlmResponse> => {
    const entry = entries[index];
    const provider = providers[index];
    if (!entry || !provider || !isHealthy(entry.provider, entry.model)) {
      throw new LlmChainExhausted();
    }
    if (opts.signal.aborted) throw new AgentDeadlineError();
    if (calls >= maxCalls) throw new LlmChainExhausted();
    calls += 1;

    const started = performance.now();
    const timeout = timeoutSignal(deps.attemptTimeoutMs, opts.signal);

    try {
      const response = await provider.generate(req, { signal: timeout.signal });
      record({ provider: entry.provider, model: entry.model, outcome: 'ok', ms: performance.now() - started });
      return response;
    } catch (error) {
      const ms = performance.now() - started;

      if (opts.signal.aborted) {
        record({ provider: entry.provider, model: entry.model, outcome: 'timeout', ms });
        throw new AgentDeadlineError();
      }

      let outcome: string;
      if (error instanceof LlmProviderError) {
        outcome = error.outcome;
        if (error.status !== undefined) {
          markUnhealthy(entry.provider, entry.model, error.status, deps.cooldownMs ?? 60_000);
        }
      } else if (error instanceof LlmInvalidOutputError) {
        outcome = 'invalid_output';
      } else if (isAbortError(error) || timeout.signal.aborted) {
        outcome = 'timeout';
      } else {
        outcome = 'network';
      }

      record({ provider: entry.provider, model: entry.model, outcome, ms });
      throw error;
    } finally {
      timeout.cleanup();
    }
  };

  return {
    name: 'llm-chain',
    entries,
    available,
    attempt,
    async generate(req, opts): Promise<LlmResponse> {
      for (let index = 0; index < entries.length; index += 1) {
        if (!available(index)) continue;
        try {
          return await attempt(index, req, opts);
        } catch (error) {
          if (error instanceof AgentDeadlineError) throw error;
        }
      }
      throw new LlmChainExhausted();
    },
  };
}
