import { parseUrl } from '@phantom/core';

export type SsrfReason =
  | 'scheme'
  | 'userinfo'
  | 'port'
  | 'ip_literal'
  | 'internal_host'
  | 'too_long';

export class SsrfError extends Error {
  readonly reason: SsrfReason;

  constructor(reason: SsrfReason) {
    super(`ssrf:${reason}`);
    this.name = 'SsrfError';
    this.reason = reason;
  }
}

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.onion'];

export function assertFetchable(input: string): URL {
  if (input.length > 2048) throw new SsrfError('too_long');

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SsrfError('scheme');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('scheme');
  }
  if (url.username || url.password) throw new SsrfError('userinfo');
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new SsrfError('port');
  }

  const parsed = parseUrl(input);
  if (parsed.isIp) throw new SsrfError('ip_literal');

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host === 'intranet' ||
    !host.includes('.') ||
    INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new SsrfError('internal_host');
  }

  return url;
}
