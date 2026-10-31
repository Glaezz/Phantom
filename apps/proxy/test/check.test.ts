import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src';
import { extractUrls } from '../src/util/urls';
import { resetRuntime, testEnv } from './helpers';

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

async function check(body: unknown, env = testEnv()) {
  return app.request(
    'http://local/api/check',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
});

describe('/api/check', () => {
  it('treats a single bare domain as one https URL', () => {
    expect(extractUrls('bca.co.id')).toEqual(['https://bca.co.id']);
    expect(extractUrls('https://a.com/x https://a.com/x https://b.com/y')).toEqual([
      'https://a.com/x',
      'https://b.com/y',
    ]);
  });

  it('does not fetch an official URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await check({ input: 'https://www.bca.co.id' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.items[0].final.status).toBe('official');
    expect(body.items[0].fetch).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.limitations).toEqual(['static_html_only']);
  });

  it('follows a shortener and analyzes the destination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://s.id/')) {
          return new Response(null, { status: 302, headers: { location: 'https://phish-login.top/' } });
        }
        if (url.includes('rdap.org')) return new Response('no rdap', { status: 404 });
        return html(
          '<title>Login BCA</title><form action="https://collector.biz.id/post" method="post"><input type="password" name="password"></form>',
        );
      }),
    );

    const response = await check({ input: 'https://s.id/abc' });
    const body = (await response.json()) as any;
    expect(response.status).toBe(200);
    expect(body.items[0].analyzedUrl).toBe('https://phish-login.top/');
    expect(body.items[0].redirectChain).toEqual(['s.id', 'phish-login.top']);
    expect(body.items[0].fetch.ok).toBe(true);
    expect(body.items[0].limitations).toContain('static_html_only');
  });

  it('falls back to L1 when fetching fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const response = await check({ input: 'https://gagal.example' });
    const body = (await response.json()) as any;
    expect(body.items[0].fetch).toEqual({ ok: false, reason: 'http_500' });
    expect(body.items[0].limitations).toContain('fetch_failed');
    expect(body.items[0].final.source).toBe('rules');
  });

  it('does not fetch an IP host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await check({ input: 'http://127.0.0.1/' });
    const body = (await response.json()) as any;
    expect(body.items[0].limitations).toContain('ip_host_not_fetched');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('processes at most three unique URLs from text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html('<title>Halaman</title><p>Halo</p>')));
    const input =
      'https://one.com/a https://two.com/b https://three.com/c https://four.com/d https://five.com/e';
    const response = await check({ input, noAi: true });
    const body = (await response.json()) as any;
    expect(body.items).toHaveLength(3);
    expect(body.items.map((item: any) => item.inputUrl)).toEqual([
      'https://one.com/a',
      'https://two.com/b',
      'https://three.com/c',
    ]);
    expect(body.items[0].limitations).toContain('no_forms_found_static');
  });

  it('returns no_url_found for text without a URL', async () => {
    const response = await check({ input: 'halo, tolong cek pesan ini' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.error.code).toBe('no_url_found');
  });
});
