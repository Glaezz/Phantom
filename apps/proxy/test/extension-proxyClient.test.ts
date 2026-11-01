import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyze, type PageFeatures } from '@phantom/core';
import { analyzeDeep } from '../../extension/src/analyze/proxyClient';

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage } } }));
const features: PageFeatures = {
  url: 'https://example.test/', title: '', headings: [], siteName: null, forms: [], externalResources: [],
};
const consent = { cloud: true, domainAge: true };
afterEach(() => { vi.useRealTimers(); sendMessage.mockReset(); });

describe('extension background transport', () => {
  it('validates replies and forwards only analysis data, not an endpoint', async () => {
    const result = analyze({ url: features.url, features });
    const data = { result, final: { status: result.status, source: 'rules', capped: false }, l3: [] };
    sendMessage.mockResolvedValueOnce({ ok: true, data });
    expect(await analyzeDeep(features, consent)).toEqual({ ok: true, data });
    expect(sendMessage.mock.calls[0][0]).toMatchObject({ type: 'phantom:analyze', request: { features, consent } });
    expect(sendMessage.mock.calls[0][0]).not.toHaveProperty('endpoint');
    sendMessage.mockResolvedValueOnce({ ok: true, data: {} });
    expect((await analyzeDeep(features, consent)).ok).toBe(false);
  });

  it('cancels pending work, removes abort listeners, and ignores late replies', async () => {
    let reply!: (value: unknown) => void;
    sendMessage.mockImplementationOnce(() => new Promise((resolve) => { reply = resolve; }));
    sendMessage.mockResolvedValue(undefined);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = analyzeDeep(features, consent, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: 'agent_timeout' });
    expect(sendMessage.mock.calls[1][0]).toEqual({ type: 'phantom:cancelAnalyze', id: sendMessage.mock.calls[0][0].id });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    reply({ ok: true, data: {} });
  });

  it('bounds unanswered messages to six seconds', async () => {
    vi.useFakeTimers();
    sendMessage.mockImplementationOnce(() => new Promise(() => {}));
    sendMessage.mockResolvedValue(undefined);
    const pending = analyzeDeep(features, consent);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await pending).toEqual({ ok: false, reason: 'agent_timeout' });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
