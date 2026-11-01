import { afterEach, describe, expect, it, vi } from 'vitest';
import { SsrfError, assertFetchable } from '../src/net/ssrf';
import { safeFetch } from '../src/net/safeFetch';
import { unrollRedirects } from '../src/net/redirects';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ssrfReason(url: string): string {
  try {
    assertFetchable(url);
    return 'ok';
  } catch (error) {
    return error instanceof SsrfError ? error.reason : 'unknown';
  }
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

describe('SSRF', () => {
  it.each([
    ['http://127.0.0.1/', 'ip_literal'],
    ['http://[::1]/', 'ip_literal'],
    ['http://localhost/', 'internal_host'],
    ['http://intranet/', 'internal_host'],
    ['http://x.local/', 'internal_host'],
    ['ftp://x.com', 'scheme'],
    ['http://x.com:8080/', 'port'],
    ['http://u:p@x.com/', 'userinfo'],
    [`https://x.com/${'a'.repeat(3000)}`, 'too_long'],
  ])('rejects %s with %s', (url, reason) => {
    expect(ssrfReason(url)).toBe(reason);
  });

  it('allows ordinary http and https URLs', () => {
    expect(ssrfReason('https://www.example.com/path')).toBe('ok');
    expect(ssrfReason('http://example.com:80/')).toBe('ok');
  });
});

describe('safeFetch', () => {
  it('stops after a redirect to an internal host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://intranet/' } })),
    );
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 1024 });
    expect(result).toEqual({ ok: false, reason: 'ssrf:internal_host' });
  });

  it('fails after more than three redirects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://next.example/' } })),
    );
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 1024 });
    expect(result.ok).toBe(false);
  });

  it('rejects content over the byte limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse('x'.repeat(50))));
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 10 });
    expect(result).toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects non-html content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })),
    );
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 1024 });
    expect(result).toEqual({ ok: false, reason: 'not_html' });
  });

  it('returns timeout when the request aborts', async () => {
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
    const result = await safeFetch('https://example.com', { timeoutMs: 10, maxBytes: 1024 });
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('returns network instead of throwing when the body stream errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.error(new Error('boom'));
          },
        });
        return new Response(stream, { headers: { 'content-type': 'text/html' } });
      }),
    );
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 1024 });
    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('returns the final URL and html', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? new Response(null, { status: 302, headers: { location: '/next' } })
          : htmlResponse('<h1>ok</h1>');
      }),
    );
    const result = await safeFetch('https://example.com', { timeoutMs: 200, maxBytes: 1024 });
    expect(result).toMatchObject({
      ok: true,
      finalUrl: 'https://example.com/next',
      status: 200,
      html: '<h1>ok</h1>',
    });
  });
});

describe('unrollRedirects', () => {
  it('reports the redirect host chain', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? new Response(null, { status: 302, headers: { location: 'https://target.example/' } })
          : htmlResponse('done');
      }),
    );
    const result = await unrollRedirects('https://short.example/a');
    expect(result.finalUrl).toBe('https://target.example/');
    expect(result.chain).toEqual(['short.example', 'target.example']);
  });
});
