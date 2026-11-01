import { AnalyzeRequestSchema, AnalyzeResponseSchema, type AnalyzeResponse, type PageFeatures } from '@phantom/core';
import { browser } from 'wxt/browser';

export type DeepResult =
  | { ok: true; data: AnalyzeResponse }
  | { ok: false; reason: 'rate_limited' | 'agent_timeout' | 'llm_unavailable' | 'offline' };

export async function analyzeDeep(
  features: PageFeatures,
  consent: { cloud: boolean; domainAge: boolean },
  signal?: AbortSignal,
): Promise<DeepResult> {
  const request = AnalyzeRequestSchema.safeParse({ url: features.url, features, consent });
  if (!request.success || signal?.aborted) return { ok: false, reason: 'llm_unavailable' };
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result: DeepResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(result);
    };
    const cancel = () => {
      void browser.runtime.sendMessage({ type: 'phantom:cancelAnalyze', id }).catch(() => {});
      finish({ ok: false, reason: 'agent_timeout' });
    };
    const timer = setTimeout(cancel, 6000);
    signal?.addEventListener('abort', cancel, { once: true });
    void browser.runtime.sendMessage({ type: 'phantom:analyze', id, request: request.data }).then((reply) => {
      const parsed = AnalyzeResponseSchema.safeParse(reply?.data);
      finish(reply?.ok && parsed.success
        ? { ok: true, data: parsed.data }
        : { ok: false, reason: reply?.reason === 'rate_limited' ? 'rate_limited' : 'llm_unavailable' });
    }, () => finish({ ok: false, reason: 'llm_unavailable' }));
  });
}
