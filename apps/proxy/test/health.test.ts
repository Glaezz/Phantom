import { describe, expect, it } from 'vitest';
import app from '../src';
import { testEnv } from './helpers';

describe('/health', () => {
  it('reports chain and key presence without values', async () => {
    const env = testEnv({ GEMINI_API_KEY: 'secret-gemini', GROQ_API_KEY: '' });
    const response = await app.request('http://local/health', {}, env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body).toMatchObject({
      ok: true,
      service: 'phantom-proxy',
      llm: {
        chain: [
          'gemini:gemini-3.5-flash-lite',
          'gemini:gemini-3.1-flash-lite',
          'groq:qwen/qwen3.8-27b',
        ],
        configured: { gemini: true, groq: false },
      },
      cache: true,
    });
    expect(JSON.stringify(body)).not.toContain('secret-gemini');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
