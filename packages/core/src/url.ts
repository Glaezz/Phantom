import { parse } from 'tldts';
import { punycodeToUnicode } from './punycode';

export interface ParsedUrl {
  ok: boolean;
  href: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  hostnameUnicode: string;
  registeredDomain: string | null;
  publicSuffix: string | null;
  isPrivateSuffix: boolean;
  label: string | null;
  subdomain: string;
  isIp: boolean;
  hasUserinfo: boolean;
  path: string;
  hasPunycode: boolean;
}

function invalid(input: string): ParsedUrl {
  return {
    ok: false,
    href: input,
    protocol: 'https:',
    hostname: '',
    hostnameUnicode: '',
    registeredDomain: null,
    publicSuffix: null,
    isPrivateSuffix: false,
    label: null,
    subdomain: '',
    isIp: false,
    hasUserinfo: false,
    path: '',
    hasPunycode: false,
  };
}

export function parseUrl(input: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return invalid(input);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return invalid(input);

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return invalid(input);

  const tld = parse(hostname, { allowPrivateDomains: true });
  const isIp = tld.isIp === true;
  const registeredDomain = isIp ? null : tld.domain ?? null;
  const publicSuffix = isIp ? null : tld.publicSuffix ?? null;
  const isPrivateSuffix = tld.isPrivate === true;

  let label: string | null = null;
  if (registeredDomain && publicSuffix && registeredDomain.endsWith(`.${publicSuffix}`)) {
    label = registeredDomain.slice(0, -(publicSuffix.length + 1));
  }

  let subdomain = '';
  if (registeredDomain) {
    if (hostname === registeredDomain) subdomain = '';
    else if (hostname.endsWith(`.${registeredDomain}`)) {
      subdomain = hostname.slice(0, -(registeredDomain.length + 1));
    }
  }

  const labels = hostname.split('.');
  const hasPunycode = labels.some((part) => part.startsWith('xn--'));
  const hostnameUnicode = labels.map((part) => punycodeToUnicode(part)).join('.');

  return {
    ok: true,
    href: url.href,
    protocol: url.protocol as 'http:' | 'https:',
    hostname,
    hostnameUnicode,
    registeredDomain,
    publicSuffix,
    isPrivateSuffix,
    label,
    subdomain,
    isIp,
    hasUserinfo: url.username.length > 0 || url.password.length > 0,
    path: url.pathname,
    hasPunycode,
  };
}
