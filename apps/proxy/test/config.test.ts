import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/env';
import { testEnv } from './helpers';

describe('parseConfig', () => {
  it('parses defaults and the configured chain', () => {
    const config = parseConfig(testEnv());
    expect(config.llmChain).toEqual([
      { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
      { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
      { provider: 'groq', model: 'qwen/qwen3.6-27b' },
    ]);
    expect(config.agentMaxSteps).toBe(4);
    expect(config.cacheTtlDangerDays).toBe(14);
  });

  it('throws for an empty LLM_CHAIN', () => {
    expect(() => parseConfig(testEnv({ LLM_CHAIN: '' }))).toThrow();
  });

  it('throws for a negative number', () => {
    expect(() => parseConfig(testEnv({ AGENT_MAX_STEPS: '-1' }))).toThrow();
  });

  it('throws for an invalid chain provider', () => {
    expect(() => parseConfig(testEnv({ LLM_CHAIN: 'openai:gpt-x' }))).toThrow();
  });
});
