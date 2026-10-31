import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRdapLookup, tldCandidates } from '../src/net/rdap';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signal = new AbortController().signal;
const comOnly = async () => new Map([['com', 'https://rdap.verisign.com/com/v1/']]);

function stub(handler: (url: string) => Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL) => handler(String(input)));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function registration(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return new Response(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: date }] }), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('RDAP', () => {
  it('computes domain age from the registration event', async () => {
    stub(async () => registration(10));
    const lookup = createRdapLookup({ bootstrap: comOnly });
    expect(await lookup.ageDays('example.com', { signal })).toBe(10);
  });

  it('asks the registry named by the bootstrap for the tld', async () => {
    const fetchMock = stub(async (url) =>
      url.includes('rdap.verisign.com') ? registration(5) : new Response('', { status: 500 }),
    );
    const age = await createRdapLookup({ bootstrap: comOnly }).ageDays('example.com', { signal });
    expect(age).toBe(5);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toContain(
      'https://rdap.verisign.com/com/v1/domain/example.com',
    );
  });

  it('falls back to rdap.org when the tld is not bootstrapped', async () => {
    const fetchMock = stub(async () => registration(7));
    const age = await createRdapLookup({ bootstrap: comOnly }).ageDays('example.test', { signal });
    expect(age).toBe(7);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://rdap.org/domain/example.test');
  });

  it('uses the kz registry, which rdap.org rejects with 404', async () => {
    const fetchMock = stub(async (url) =>
      url.includes('rdap.org') ? new Response('not found', { status: 404 }) : registration(340),
    );
    const age = await createRdapLookup({ bootstrap: comOnly }).ageDays('roblox.com.kz', { signal });
    expect(age).toBe(340);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toContain(
      'https://rdap.nic.kz/domain/roblox.com.kz',
    );
  });

  it('returns null on 404 or network failure', async () => {
    stub(async () => new Response('not found', { status: 404 }));
    expect(await createRdapLookup({ bootstrap: comOnly }).ageDays('example.com', { signal })).toBeNull();

    stub(async () => Promise.reject(new Error('network')));
    expect(await createRdapLookup({ bootstrap: comOnly }).ageDays('example.com', { signal })).toBeNull();
  });

  it('returns null for missing or invalid registration data', async () => {
    stub(
      async () =>
        new Response(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: 'bad' }] }), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    const lookup = createRdapLookup({ bootstrap: comOnly });
    expect(await lookup.ageDays('example.com', { signal })).toBeNull();
  });
});

describe('tldCandidates', () => {
  it('lists every registrable suffix, longest first', () => {
    expect(tldCandidates('roblox.com.kz')).toEqual(['com.kz', 'kz']);
    expect(tldCandidates('bca.co.id')).toEqual(['co.id', 'id']);
  });
});
