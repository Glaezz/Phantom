import { env } from 'cloudflare:test';
import { resetRateLimits } from '../src/middleware/rateLimit';
import { resetHealth } from '../src/llm/health';

export function testEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    ...(env as unknown as Record<string, unknown>),
    GEMINI_API_KEY: '',
    GROQ_API_KEY: '',
    RATE_LIMIT_ANALYZE: undefined,
    RATE_LIMIT_CHECK: undefined,
    ...overrides,
  } as unknown as Env;
}

export function resetRuntime(): void {
  resetRateLimits();
  resetHealth();
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export function passwordForm(action: string | null = null) {
  return {
    action,
    method: 'post' as const,
    fields: [
      {
        type: 'password',
        name: 'password',
        id: null,
        autocomplete: 'current-password',
        placeholder: null,
      },
      {
        type: 'text',
        name: 'username',
        id: null,
        autocomplete: 'username',
        placeholder: null,
      },
    ],
  };
}

export function pageFeatures(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://login-xyz.top',
    title: 'Halaman Masuk',
    headings: [],
    siteName: null,
    forms: [],
    externalResources: [],
    ...overrides,
  };
}
