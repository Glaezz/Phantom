import { describe, expect, it } from 'vitest';
import app from '../src';
import { testEnv } from './helpers';

describe('smoke', () => {
  it('serves health', async () => {
    const response = await app.request('http://local/health', {}, testEnv());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('phantom-proxy');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
