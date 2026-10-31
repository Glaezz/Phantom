import { z } from 'zod';

export interface LlmChainEntry {
  provider: 'gemini' | 'groq';
  model: string;
}

export interface AppConfig {
  llmChain: LlmChainEntry[];
  agentMaxSteps: number;
  agentDeadlineMs: number;
  llmAttemptTimeoutMs: number;
  llmCooldownMs: number;
  fetchTimeoutMs: number;
  fetchMaxBytes: number;
  cacheTtlDangerDays: number;
  cacheTtlNeutralDays: number;
  rateLimitAnalyzePerMin: number;
  rateLimitCheckPerMin: number;
  allowedOrigins: string[];
  allowExtensionOrigins: boolean;
  geminiApiKey: string | null;
  groqApiKey: string | null;
}

const DEFAULT_CHAIN =
  'gemini:gemini-3.5-flash-lite,gemini:gemini-3.1-flash-lite,groq:qwen/qwen3.6-27b';

function positiveInt(env: Record<string, unknown>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const schema = z.coerce.number().int().positive();
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`invalid config: ${key}`);
  return result.data;
}

function parseChain(raw: string | undefined): LlmChainEntry[] {
  const value = (raw ?? DEFAULT_CHAIN).trim();
  if (!value) throw new Error('invalid config: LLM_CHAIN');

  const entries = value.split(',').map((part) => {
    const trimmed = part.trim();
    const separator = trimmed.indexOf(':');
    if (separator <= 0 || separator === trimmed.length - 1) {
      throw new Error('invalid config: LLM_CHAIN');
    }
    const provider = trimmed.slice(0, separator);
    const model = trimmed.slice(separator + 1);
    if (provider !== 'gemini' && provider !== 'groq') {
      throw new Error('invalid config: LLM_CHAIN');
    }
    if (!/^[A-Za-z0-9._/-]+$/.test(model)) throw new Error('invalid config: LLM_CHAIN');
    return { provider, model } as LlmChainEntry;
  });

  if (entries.length === 0) throw new Error('invalid config: LLM_CHAIN');
  return entries;
}

export function parseConfig(env: Env): AppConfig {
  const raw = env as unknown as Record<string, unknown>;
  return {
    llmChain: parseChain(typeof raw.LLM_CHAIN === 'string' ? raw.LLM_CHAIN : undefined),
    agentMaxSteps: positiveInt(raw, 'AGENT_MAX_STEPS', 4),
    agentDeadlineMs: positiveInt(raw, 'AGENT_DEADLINE_MS', 6000),
    llmAttemptTimeoutMs: positiveInt(raw, 'LLM_ATTEMPT_TIMEOUT_MS', 3000),
    llmCooldownMs: positiveInt(raw, 'LLM_COOLDOWN_MS', 60000),
    fetchTimeoutMs: positiveInt(raw, 'FETCH_TIMEOUT_MS', 5000),
    fetchMaxBytes: positiveInt(raw, 'FETCH_MAX_BYTES', 1048576),
    cacheTtlDangerDays: positiveInt(raw, 'CACHE_TTL_DANGER_DAYS', 14),
    cacheTtlNeutralDays: positiveInt(raw, 'CACHE_TTL_NEUTRAL_DAYS', 3),
    rateLimitAnalyzePerMin: positiveInt(raw, 'RATE_LIMIT_ANALYZE_PER_MIN', 30),
    rateLimitCheckPerMin: positiveInt(raw, 'RATE_LIMIT_CHECK_PER_MIN', 6),
    allowedOrigins: (typeof raw.ALLOWED_ORIGINS === 'string' ? raw.ALLOWED_ORIGINS : '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowExtensionOrigins: (typeof raw.ALLOW_EXTENSION_ORIGINS === 'string'
      ? raw.ALLOW_EXTENSION_ORIGINS
      : 'true') !== 'false',
    geminiApiKey: (typeof raw.GEMINI_API_KEY === 'string' ? raw.GEMINI_API_KEY.trim() : '') || null,
    groqApiKey: (typeof raw.GROQ_API_KEY === 'string' ? raw.GROQ_API_KEY.trim() : '') || null,
  };
}
