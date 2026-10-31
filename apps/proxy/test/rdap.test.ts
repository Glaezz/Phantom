import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRdapLookup } from '../src/net/rdap';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signal = new AbortController().signal;

describe('RDAP', () => {
  it('computes domain age from the registration event', async () => {
    const date = new Date(Date.now() - 10 * 86_400_000).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: date }] }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const age = await createRdapLookup().ageDays('example.com', { signal });
    expect(age).toBe(10);
  });

  it('returns null on 404 or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await createRdapLookup().ageDays('example.com', { signal })).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network'))));
    expect(await createRdapLookup().ageDays('example.com', { signal })).toBeNull();
  });

  it('returns null for missing or invalid registration data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: 'bad' }] }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    expect(await createRdapLookup().ageDays('example.com', { signal })).toBeNull();
  });
});
