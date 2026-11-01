import { CACHE_KEY_VERSION } from './config';
import { parseUrl } from './url';

export function normalizeUrlForCache(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed.ok) return '';

  const parsedUrl = new URL(parsed.href);
  const host = parsed.hostname.replace(/^www\./, '');
  const rawPath = parsedUrl.pathname;
  const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const params: [string, string][] = [];
  parsedUrl.searchParams.forEach((value, key) => params.push([key, value]));
  const query = params
    .sort(([aKey, aValue], [bKey, bValue]) => {
      const keyOrder = aKey.localeCompare(bKey);
      return keyOrder !== 0 ? keyOrder : aValue.localeCompare(bValue);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${host}${path || '/'}${query ? `?${query}` : ''}`;
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
