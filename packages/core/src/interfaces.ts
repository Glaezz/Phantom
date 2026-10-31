export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDef[];
  temperature: number;
  maxTokens: number;
}

export interface LlmResponse {
  toolCalls: { id: string; name: string; args: unknown }[];
  text: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  generate(req: LlmRequest, opts: { signal: AbortSignal }): Promise<LlmResponse>;
}

export interface CacheRecord {
  status: 'neutral' | 'caution' | 'danger';
  reasons: string[];
  createdAt: number;
  expiresAt: number;
  rulesVersion: string;
}

export interface CacheStore {
  get(key: string): Promise<CacheRecord | null>;
  set(key: string, record: CacheRecord, ttlSeconds: number): Promise<void>;
}

export interface PageFetcher {
  fetchHtml(
    url: string,
    opts: { signal: AbortSignal },
  ): Promise<{ finalUrl: string; html: string }>;
}

export interface DomainAgeLookup {
  ageDays(registeredDomain: string, opts: { signal: AbortSignal }): Promise<number | null>;
}
