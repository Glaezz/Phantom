import type { AgentVerdict } from '@phantom/core';
import { AgentVerdictSchema } from '@phantom/core';

export { AgentVerdictSchema };
export type { AgentVerdict };

export interface AgentTraceStep {
  step: number;
  provider: string;
  model: string;
  toolCalls: { name: string; args: Record<string, unknown>; resultRef?: string }[];
  text?: string;
}

export interface AgentRunSuccess {
  ok: true;
  verdict: AgentVerdict;
  provider: string;
  model: string;
  steps: number;
  trace: AgentTraceStep[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface AgentRunFailure {
  ok: false;
  reason: 'llm_unavailable' | 'agent_timeout' | 'no_verdict' | 'llm_quota' | 'llm_model_unavailable' | 'llm_invalid_response';
  trace: AgentTraceStep[];
  usage: { inputTokens: number; outputTokens: number };
}

export type AgentRunResult = AgentRunSuccess | AgentRunFailure;
