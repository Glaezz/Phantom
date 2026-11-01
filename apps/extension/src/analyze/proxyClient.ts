import type { AnalyzeResponse, PageFeatures } from '@phantom/core';

// Only place in the extension that talks to the proxy. Failures never throw:
// any problem degrades to rules-only so the overlay keeps working offline.
export type DeepResult =
  | { ok: true; data: AnalyzeResponse }
  | { ok: false; reason: 'rate_limited' | 'agent_timeout' | 'llm_unavailable' | 'offline' };

const PROXY_URL = (import.meta.env.VITE_PROXY_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '');

// Matches the 6 s hold budget in EXT-04.
const TIMEOUT_MS = 6000;

export async function analyzeDeep(
  features: PageFeatures,
  consent: { cloud: boolean; domainAge: boolean },
  signal?: AbortSignal,
): Promise<DeepResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline' };
  }

  const timeout = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const combined = signal && timeout ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);

  try {
    const response = await fetch(`${PROXY_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: features.url, features, consent }),
      signal: combined,
    });

    if (response.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!response.ok) return { ok: false, reason: 'llm_unavailable' };

    return { ok: true, data: (await response.json()) as AnalyzeResponse };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, reason: aborted ? 'agent_timeout' : 'llm_unavailable' };
  }
}
