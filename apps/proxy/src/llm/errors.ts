export type LlmFailureOutcome =
  | 'network'
  | 'timeout'
  | 'invalid_output'
  | 'auth'
  | 'model_not_found'
  | `http_${number}`;

export class LlmProviderError extends Error {
  readonly provider: string;
  readonly model: string;
  readonly outcome: LlmFailureOutcome;
  readonly status?: number;

  constructor(
    provider: string,
    model: string,
    outcome: LlmFailureOutcome,
    status?: number,
  ) {
    super(`llm:${provider}:${outcome}`);
    this.name = 'LlmProviderError';
    this.provider = provider;
    this.model = model;
    this.outcome = outcome;
    this.status = status;
  }
}

export class LlmInvalidOutputError extends LlmProviderError {
  constructor(provider: string, model: string) {
    super(provider, model, 'invalid_output');
    this.name = 'LlmInvalidOutputError';
  }
}

export class LlmChainExhausted extends Error {
  constructor() {
    super('llm:chain_exhausted');
    this.name = 'LlmChainExhausted';
  }
}

export class AgentDeadlineError extends Error {
  constructor() {
    super('agent:deadline');
    this.name = 'AgentDeadlineError';
  }
}
