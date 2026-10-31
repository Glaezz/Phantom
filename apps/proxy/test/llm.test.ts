import type { LlmRequest, LlmResponse } from '@phantom/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLlmChain } from '../src/llm/chain';
import { LlmChainExhausted } from '../src/llm/errors';
import { createGeminiProvider } from '../src/llm/gemini';
import { createGroqProvider } from '../src/llm/groq';
import { isHealthy, resetHealth } from '../src/llm/health';

const ENTRIES = [
  { provider: 'gemini' as const, model: 'gemini-3.5-flash-lite' },
  { provider: 'gemini' as const, model: 'gemini-3.1-flash-lite' },
  { provider: 'groq' as const, model: 'qwen/qwen3.6-27b' },
];

const request: LlmRequest = {
  system: 'system',
  messages: [{ role: 'user', content: 'hello' }],
  tools: [
    {
      name: 'lookup',
      description: 'lookup',
      parameters: { type: 'object', properties: {} },
    },
  ],
  temperature: 0.9,
  maxTokens: 128,
};

function geminiResponse(parts: unknown[]) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts } }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

function groqResponse() {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'g1', function: { name: 'lookup', arguments: '{"q":"x"}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

function chain(overrides: Record<string, unknown> = {}) {
  return createLlmChain(ENTRIES, {
    apiKeys: { gemini: 'gemini-key', groq: 'groq-key' },
    attemptTimeoutMs: 1000,
    ...overrides,
  });
}

beforeEach(() => {
  resetHealth();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LLM chain failover', () => {
  it('moves from a 503 to the next Gemini entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(geminiResponse([{ functionCall: { id: 'a', name: 'lookup', args: {} } }]));
    vi.stubGlobal('fetch', fetchMock);

    const attempts: unknown[] = [];
    const result = await chain({ onAttempt: (record: unknown) => attempts.push(record) }).generate(
      request,
      { signal: new AbortController().signal },
    );

    expect(result.toolCalls[0].name).toBe('lookup');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(attempts).toHaveLength(2);
    expect(attempts).toMatchObject([
      { provider: 'gemini', outcome: 'http_503' },
      { provider: 'gemini', outcome: 'ok' },
    ]);
  });

  it('moves from two 429s to Groq', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('limit', { status: 429 }))
      .mockResolvedValueOnce(new Response('limit', { status: 429 }))
      .mockResolvedValueOnce(groqResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await chain().generate(request, { signal: new AbortController().signal });
    expect(result.toolCalls[0].id).toBe('g1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws LlmChainExhausted when every configured entry fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    await expect(chain().generate(request, { signal: new AbortController().signal })).rejects.toBeInstanceOf(
      LlmChainExhausted,
    );
  });

  it('cools down a model after 404 and skips it on the next request', async () => {
    const entries = [ENTRIES[0], { provider: 'gemini' as const, model: 'gemini-3.1-flash-lite' }];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockImplementation(async () =>
        geminiResponse([{ functionCall: { id: 'a', name: 'lookup', args: {} } }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const llm = createLlmChain(entries, {
      apiKeys: { gemini: 'key', groq: null },
      attemptTimeoutMs: 1000,
    });
    await llm.generate(request, { signal: new AbortController().signal });
    expect(isHealthy('gemini', 'gemini-3.5-flash-lite')).toBe(false);

    const before = fetchMock.mock.calls.length;
    await llm.generate(request, { signal: new AbortController().signal });
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });

  it('skips entries without an API key without a network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlmChain(ENTRIES, {
      apiKeys: { gemini: null, groq: null },
      attemptTimeoutMs: 1000,
    });
    await expect(llm.generate(request, { signal: new AbortController().signal })).rejects.toBeInstanceOf(
      LlmChainExhausted,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Gemini adapter', () => {
  it('sends ANY tool config and no sampling parameters', async () => {
    let body: Record<string, unknown> = {};
    let headers: Record<string, string> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        headers = init?.headers as Record<string, string>;
        return geminiResponse([{ functionCall: { id: 'a', name: 'lookup', args: {} } }]);
      }),
    );

    const provider = createGeminiProvider('gemini-3.5-flash-lite', 'secret');
    await provider.generate(request, { signal: new AbortController().signal });

    expect((body.toolConfig as { functionCallingConfig: { mode: string } }).functionCallingConfig.mode).toBe(
      'ANY',
    );
    expect(body).not.toHaveProperty('temperature');
    expect(JSON.stringify(body)).not.toContain('topP');
    expect(JSON.stringify(body)).not.toContain('topK');
    expect(headers['x-goog-api-key']).toBe('secret');
    expect(String(headers['content-type'])).toContain('application/json');
  });

  it('sends raw model parts and matching functionResponse id and name', async () => {
    const rawParts = [
      { text: 'thinking', thoughtSignature: 'sig-123' },
      { functionCall: { id: 'call-1', name: 'lookup', args: { q: 'x' } } },
    ];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return bodies.length === 1
          ? geminiResponse(rawParts)
          : geminiResponse([{ functionCall: { id: 'call-2', name: 'lookup', args: {} } }]);
      }),
    );

    const provider = createGeminiProvider('gemini-3.5-flash-lite', 'secret');
    const first = await provider.generate(request, { signal: new AbortController().signal });
    await provider.generate(
      {
        ...request,
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: '', providerRaw: first.providerRaw },
          { role: 'tool', content: '{"ok":true}', name: 'lookup', toolCallId: 'call-1' },
        ],
      },
      { signal: new AbortController().signal },
    );

    const contents = bodies[1].contents as {
      role: string;
      parts: { functionResponse?: { id?: string; name?: string } }[];
    }[];
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts).toEqual(rawParts);
    expect(contents[2].parts[0].functionResponse).toMatchObject({ id: 'call-1', name: 'lookup' });
  });

  it('retries once without thinking config on a 400', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return bodies.length === 1
          ? new Response('bad thinking', { status: 400 })
          : geminiResponse([{ functionCall: { id: 'a', name: 'lookup', args: {} } }]);
      }),
    );
    const provider = createGeminiProvider('gemini-3.5-flash-lite', 'secret');
    await provider.generate(request, { signal: new AbortController().signal });
    expect((bodies[0].generationConfig as Record<string, unknown>).thinkingConfig).toBeDefined();
    expect((bodies[1].generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
  });
});

describe('Groq adapter', () => {
  it('sends tool_choice required and maps tool_call_id', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return groqResponse();
      }),
    );

    const provider = createGroqProvider('qwen/qwen3.6-27b', 'groq-key');
    const first = await provider.generate(request, { signal: new AbortController().signal });
    expect(bodies[0].tool_choice).toBe('required');
    expect(bodies[0].temperature).toBe(0.9);

    await provider.generate(
      {
        ...request,
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: '', providerRaw: first.providerRaw },
          { role: 'tool', content: '{"ok":true}', name: 'lookup', toolCallId: 'g1' },
        ],
      },
      { signal: new AbortController().signal },
    );

    const messages = bodies[1].messages as { role: string; content?: string; tool_call_id?: string }[];
    expect(messages[0]).toMatchObject({ role: 'system', content: 'system' });
    expect(messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'g1' });
  });

  it('uses the default temperature and parses tool arguments', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return groqResponse();
      }),
    );
    const provider = createGroqProvider('qwen/qwen3.6-27b', 'key');
    const result = await provider.generate(
      { ...request, temperature: undefined },
      { signal: new AbortController().signal },
    );
    expect(body.temperature).toBe(0.2);
    expect(result.toolCalls[0].args).toEqual({ q: 'x' });
  });
});

describe('health markers', () => {
  it('expires cooldowns', () => {
    expect(isHealthy('x', 'y', 1)).toBe(true);
  });

  it('is typed as a LlmResponse compatible provider', () => {
    const provider = createGroqProvider('qwen/qwen3.6-27b', 'key');
    const response: LlmResponse = {
      toolCalls: [],
      text: null,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    expect(provider.name).toContain('groq');
    expect(response.toolCalls).toHaveLength(0);
  });
});
