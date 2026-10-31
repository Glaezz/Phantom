import { CACHE_KEY_VERSION } from './config';
import { parseUrl } from './url';

export function normalizeUrlForCache(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed.ok) return '';

  const host = parsed.hostname.replace(/^www\./, '');
  const segments = parsed.path
    .toLowerCase()
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return '*';
      if (/^[a-z0-9_-]{16,}$/.test(segment)) return '*';
      return segment;
    });

  const path = segments.length > 0 ? `/${segments.join('/')}` : '/';
  return `${host}${path}`;
}

export async function cacheKey(url: string): Promise<string> {
  const normalized = normalizeUrlForCache(url);
  if (!normalized) throw new Error('invalid-url');

  const data = new TextEncoder().encode(`${CACHE_KEY_VERSION}|${normalized}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
