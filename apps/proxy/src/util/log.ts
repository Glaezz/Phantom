export interface AttemptRecord {
  provider: string;
  model: string;
  outcome: string;
  ms: number;
}

export interface RequestLog {
  requestId: string;
  route: string;
  status: number;
  latencyMs: number;
  cache?: 'hit' | 'miss' | 'write';
  agent?: { used: boolean; provider?: string; model?: string; steps?: number };
  attempts?: AttemptRecord[];
  degraded?: string[];
}

/** Log line intentionally accepts only metadata; never page URLs, hosts, inputs, or keys. */
export function logRequest(entry: RequestLog): void {
  console.log(
    JSON.stringify({
      requestId: entry.requestId,
      route: entry.route,
      status: entry.status,
      latencyMs: Math.round(entry.latencyMs),
      cache: entry.cache,
      agent: entry.agent,
      attempts: entry.attempts,
      degraded: entry.degraded,
    }),
  );
}
