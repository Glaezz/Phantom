import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src';
import { resetRuntime, pageFeatures, passwordForm, testEnv } from './helpers';

const GEMINI_URL = 'https://generativelanguage.googleapis.com';

function gemini(parts: unknown[]) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts } }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

function submitParts(refs: string[] = []) {
  return [
    {
      functionCall: {
        id: 'submit-1',
        name: 'submit_verdict',
        args: {
          verdict: 'danger',
          confidence: 0.9,
          reasons: ['Form kredensial dikirim ke domain lain.'],
          evidenceRefs: refs,
        },
      },
    },
  ];
}

function stubAgentFetch() {
  let calls = 0;
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith(GEMINI_URL)) {
      calls += 1;
      if (calls === 1) {
        return gemini([{ functionCall: { id: 'tool-1', name: 'get_form_target', args: {} } }]);
      }
      return gemini(submitParts(['get_form_target#1']));
    }
    throw new Error(`unexpected fetch ${String(input)}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function analyzeBody(url: string, features: unknown, consent = { cloud: true, domainAge: false }) {
  return { url, features, consent };
}

async function post(path: string, body: unknown, env = testEnv(), headers: Record<string, string> = {}) {
  return app.request(
    `http://local${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

beforeEach(() => {
  resetRuntime();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/api/analyze', () => {
  it('returns rules for an official domain without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({ url: 'https://www.bca.co.id', forms: [] });
    const response = await post('/api/analyze', analyzeBody('https://www.bca.co.id', features));
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.result.status).toBe('official');
    expect(body.final).toMatchObject({ status: 'official', source: 'rules' });
    expect(body.agent).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not page the agent for a danger rules result', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({
      url: 'https://bca-secure.my.id',
      title: 'Login BCA',
      forms: [passwordForm()],
    });
    const response = await post('/api/analyze', analyzeBody('https://bca-secure.my.id', features));
    const body = (await response.json()) as any;
    expect(body.result.status).toBe('danger');
    expect(body.result.needsAgent).toBe(false);
    expect(body.agent).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades when cloud consent is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({
      url: 'https://login-xyz.top',
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody('https://login-xyz.top', features, { cloud: false, domainAge: false }),
    );
    const body = (await response.json()) as any;
    expect(body.final.source).toBe('rules');
    expect(body.degraded).toEqual(['cloud_consent_missing']);
    expect(body.final.skipReason).toBe('deepCheckDisabled');
    expect(body.l4[0].data).toMatchObject({ available: false, skippedBy: 'consent' });
    expect(body.agent).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the agent and then serves the cached verdict', async () => {
    const fetchMock = stubAgentFetch();
    const url = 'https://login-xyz.top/a1';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const env = testEnv({ GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: '' });

    const first = await post('/api/analyze', analyzeBody(url, features), env);
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as any;
    expect(firstBody.final).toMatchObject({ status: 'danger', source: 'agent' });
    expect(firstBody.agent).toMatchObject({ used: true, steps: 2 });
    expect(firstBody.cache.written).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = await post('/api/analyze', analyzeBody(url, features), env);
    const secondBody = (await second.json()) as any;
    expect(secondBody.final).toMatchObject({ source: 'cache', status: 'danger' });
    expect(secondBody.agent).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('analyses the extracted features url, not the request url', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('rdap.org')) throw new Error('rdap down');
      throw new Error(`unexpected fetch ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({ url: 'https://www.bca.co.id', forms: [] });
    const response = await post('/api/analyze', analyzeBody('https://evil.example', features));
    const body = (await response.json()) as any;
    expect(body.result.status).toBe('official');
    expect(body.result.page.hostname).toBe('www.bca.co.id');
  });

  it('ignores a cached verdict written by older rules', async () => {
    const url = 'https://login-xyz.top/g7';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const staleKv = {
      async get() {
        return JSON.stringify({
          status: 'danger',
          reasons: ['lama'],
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          rulesVersion: '0.0.1',
        });
      },
      async put() {},
    } as unknown as KVNamespace;
    const fetchMock = stubAgentFetch();
    const env = testEnv({
      GEMINI_API_KEY: 'gemini-key',
      GROQ_API_KEY: '',
      AGENT_DEADLINE_MS: '10',
      LLM_ATTEMPT_TIMEOUT_MS: '1000',
      PHANTOM_CACHE: staleKv,
    });
    const response = await post('/api/analyze', analyzeBody(url, features), env);
    const body = (await response.json()) as any;
    expect(body.final.source).not.toBe('cache');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns L3 and L4 rows for the transparency panel', async () => {
    stubAgentFetch();
    const url = 'https://login-xyz.top/h8';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody(url, features, { cloud: true, domainAge: false }),
      testEnv({ GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: '' }),
    );
    const body = (await response.json()) as any;
    expect(Array.isArray(body.l3)).toBe(true);
    expect(body.l4[0]).toMatchObject({ stage: 'L4', data: { tool: 'agent', verdict: 'danger' } });
  });

  it('reports L3 as unchecked, not as missing consent, when RDAP fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('rdap.org')) throw new Error('rdap down');
      return gemini([{ functionCall: { id: 's', name: 'submit_verdict', args: {
        verdict: 'danger', confidence: 0.9, reasons: ['Form kredensial ke domain lain.'],
        evidenceRefs: ['get_form_target#1'],
      } } }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({
      url: 'https://login-xyz.top/j1',
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody('https://login-xyz.top/j1', features, { cloud: true, domainAge: true }),
      testEnv({ GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: '' }),
    );
    const body = (await response.json()) as any;
    expect(body.degraded).toContain('rdap_unavailable');
    expect(body.l3).toHaveLength(1);
    expect(body.l3[0].data).toMatchObject({ tool: 'rdap', available: false, domain: 'login-xyz.top' });
    expect(body.l3[0].data.skippedBy).toBeUndefined();
  });

  it('marks L3 as disabled in settings when domain age consent is off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rdap down'); }));
    const features = pageFeatures({
      url: 'https://login-xyz.top/k2',
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody('https://login-xyz.top/k2', features, { cloud: true, domainAge: false }),
      testEnv({ GEMINI_API_KEY: '', GROQ_API_KEY: '' }),
    );
    const body = (await response.json()) as any;
    expect(body.final.skipReason).toBe('deepCheckDisabled');
    expect(body.l3[0].data).toMatchObject({ available: false, skippedBy: 'consent' });
  });

  it('marks L4 as served from cache on a cache hit', async () => {
    stubAgentFetch();
    const url = 'https://login-xyz.top/i9';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const env = testEnv({ GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: '' });
    await post('/api/analyze', analyzeBody(url, features), env);
    const second = await post('/api/analyze', analyzeBody(url, features), env);
    const body = (await second.json()) as any;
    expect(body.final).toMatchObject({ source: 'cache', skipReason: 'cacheHit' });
    expect(body.l4[0]).toMatchObject({ stage: 'L4', data: { tool: 'cache' } });
  });

  it('recomputes from features and ignores an extra client verdict', async () => {    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const features = pageFeatures({
      url: 'https://login-xyz.top/b2',
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const body = {
      ...analyzeBody('https://login-xyz.top/b2', features, { cloud: false, domainAge: false }),
      status: 'official',
      final: { status: 'official', source: 'rules' },
      needsAgent: false,
    };
    const response = await post('/api/analyze', body);
    const data = (await response.json()) as any;
    expect(data.result.status).toBe('caution');
    expect(data.result.needsAgent).toBe(true);
    expect(data.final.status).not.toBe('official');
  });

  it('returns 413 for a body over 64 KB', async () => {
    const body = {
      ...analyzeBody('https://www.bca.co.id', pageFeatures({ url: 'https://www.bca.co.id' })),
      pad: 'x'.repeat(70 * 1024),
    };
    const response = await post('/api/analyze', body);
    expect(response.status).toBe(413);
    const data = (await response.json()) as any;
    expect(data.error.code).toBe('payload_too_large');
  });

  it('returns 400 for invalid JSON', async () => {
    const response = await app.request(
      'http://local/api/analyze',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      },
      testEnv(),
    );
    expect(response.status).toBe(400);
  });

  it('keeps analysis successful when the cache write throws', async () => {
    stubAgentFetch();
    const failingKv = {
      async get() {
        return null;
      },
      async put() {
        throw new Error('quota');
      },
    } as unknown as KVNamespace;
    const url = 'https://login-xyz.top/c3';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody(url, features),
      testEnv({ GEMINI_API_KEY: 'gemini-key', PHANTOM_CACHE: failingKv }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.final.source).toBe('agent');
    expect(body.cache.written).toBe(false);
  });

  it('degrades to llm_unavailable when every provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const url = 'https://login-xyz.top/d4';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody(url, features),
      testEnv({ GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: 'groq-key' }),
    );
    const body = (await response.json()) as any;
    expect(response.status).toBe(200);
    expect(body.final.source).toBe('rules');
    expect(body.agent).toBeNull();
    expect(body.degraded).toEqual(['llm_unavailable']);
    expect(body.meta.attempts).toHaveLength(3);
  });

  it('degrades to agent_timeout when the deadline expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );
    const url = 'https://login-xyz.top/e5';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody(url, features),
      testEnv({
        GEMINI_API_KEY: 'gemini-key',
        GROQ_API_KEY: 'groq-key',
        AGENT_DEADLINE_MS: '10',
        LLM_ATTEMPT_TIMEOUT_MS: '1000',
      }),
    );
    const body = (await response.json()) as any;
    expect(body.agent).toBeNull();
    expect(body.degraded).toEqual(['agent_timeout']);
  });

  it('records rdap_unavailable without stopping analysis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('rdap.org')) return new Response('missing', { status: 404 });
        throw new Error('unexpected');
      }),
    );
    const url = 'https://login-xyz.top/f6';
    const features = pageFeatures({
      url,
      forms: [passwordForm('https://collector.biz.id/post')],
    });
    const response = await post(
      '/api/analyze',
      analyzeBody(url, features, { cloud: true, domainAge: true }),
      testEnv({ GEMINI_API_KEY: '', GROQ_API_KEY: '' }),
    );
    const body = (await response.json()) as any;
    expect(body.degraded).toContain('rdap_unavailable');
    expect(body.meta.stagesMs.rdap).toBeTypeOf('number');
  });
});

describe('/api/cache/lookup', () => {
  it('returns hit false for a missing key and validates the key shape', async () => {
    const missing = await post('/api/cache/lookup', { key: 'a'.repeat(64) });
    expect(missing.status).toBe(200);
    expect(await missing.json()).toEqual({ hit: false });

    const invalid = await post('/api/cache/lookup', { key: 'abc' });
    expect(invalid.status).toBe(400);
  });
});

describe('middleware', () => {
  it('rejects an unknown Origin', async () => {
    const response = await post(
      '/api/cache/lookup',
      { key: 'a'.repeat(64) },
      testEnv(),
      { Origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as any;
    expect(body.error.code).toBe('origin_not_allowed');
  });

  it('allows extension origins', async () => {
    const response = await post(
      '/api/cache/lookup',
      { key: 'a'.repeat(64) },
      testEnv(),
      { Origin: 'chrome-extension://abc' },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('chrome-extension://abc');
  });

  it('reflects an exactly allowed origin', async () => {
    const response = await post(
      '/api/cache/lookup',
      { key: 'a'.repeat(64) },
      testEnv({ ALLOWED_ORIGINS: 'https://web.test,http://localhost:5173' }),
      { Origin: 'https://web.test' },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://web.test');
  });

  it('rate limits the 31st analyze request', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const features = pageFeatures({ url: 'https://www.bca.co.id', forms: [] });
    const body = analyzeBody('https://www.bca.co.id', features);
    let last: Response | null = null;
    for (let index = 0; index < 31; index += 1) {
      last = await post('/api/analyze', body, testEnv(), { 'CF-Connecting-IP': '203.0.113.5' });
    }
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get('retry-after'))).toBeGreaterThan(0);
    const error = (await last!.json()) as any;
    expect(error.error.code).toBe('rate_limited');
  });

  it('never logs URLs, hosts, titles, or API keys', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    const url = 'https://www.bca.co.id/secret-path';
    const features = pageFeatures({ url, title: 'Rahasia Sekali', forms: [] });
    await post(
      '/api/analyze',
      analyzeBody(url, features),
      testEnv({ GEMINI_API_KEY: 'should-not-appear' }),
    );
    const output = logs.join('\n');
    expect(output).not.toContain('bca.co.id');
    expect(output).not.toContain('secret-path');
    expect(output).not.toContain('Rahasia');
    expect(output).not.toContain('should-not-appear');
    expect(JSON.parse(logs[0])).toMatchObject({ route: '/api/analyze', status: 200 });
  });
});
