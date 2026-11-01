import { AnalyzeRequestSchema, AnalyzeResponseSchema } from '@phantom/core';

const PROXY_URL = (import.meta.env.VITE_PROXY_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '');

export default defineBackground(() => {
  const pending = new Map<string, AbortController>();
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || !sender.tab || typeof message?.id !== 'string') return;
    const key = `${sender.tab.id}:${sender.frameId}:${sender.documentId}:${message.id}`;
    if (message.type === 'phantom:cancelAnalyze') {
      pending.get(key)?.abort();
      return;
    }
    if (message.type !== 'phantom:analyze') return;
    const request = AnalyzeRequestSchema.safeParse(message.request);
    if (!request.success || pending.has(key)) return Promise.resolve({ ok: false });
    return (async () => {
      const controller = new AbortController();
      pending.set(key, controller);
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(`${PROXY_URL}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data),
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
        });
        if (response.status === 429) return { ok: false, reason: 'rate_limited' };
        if (!response.ok) return { ok: false };
        const parsed = AnalyzeResponseSchema.safeParse(await response.json());
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
      } catch {
        return { ok: false };
      } finally {
        clearTimeout(timer);
        pending.delete(key);
      }
    })();
  });
});
