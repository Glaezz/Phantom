import type { DomainAgeLookup } from '@phantom/core';
import { timeoutSignal } from '../util/timeout';

export interface RdapOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Pemetaan TLD -> URL server RDAP. Default: diambil dari IANA bootstrap. */
  bootstrap?: () => Promise<Map<string, string>>;
}

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
// rdap.org dan bootstrap IANA tidak mengenali sejumlah ccTLD (.kz, .de, .ru ...).
// Dipakai sebagai pelengkap, bukan pengganti: bootstrap tetap sumber utama.
const SUFFIX_SERVERS: Record<string, string> = {
  kz: 'https://rdap.nic.kz/',
  'com.kz': 'https://rdap.nic.kz/',
  de: 'https://rdap.denic.de/',
};

const AGE_MS = 86_400_000;

// ponytail: bootstrap di-cache selama umur isolate; cukup untuk registry yang jarang berubah.
// Kalau perlu lebih, pindahkan ke KV dengan TTL harian.
let bootstrapPromise: Promise<Map<string, string>> | null = null;

async function fetchBootstrap(fetchImpl: typeof fetch): Promise<Map<string, string>> {
  const timeout = timeoutSignal(3000);
  try {
    const response = await fetchImpl(BOOTSTRAP_URL, {
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
    });
    if (!response.ok) return new Map();
    const body = (await response.json()) as { services?: [string[], string[]][] };
    const map = new Map<string, string>();
    for (const [tlds, urls] of body.services ?? []) {
      const url = urls.find((u) => u.startsWith('https://')) ?? urls[0];
      if (!url) continue;
      for (const tld of tlds) map.set(tld.toLowerCase(), url);
    }
    return map;
  } catch {
    return new Map();
  } finally {
    timeout.cleanup();
  }
}

/** `login.roblox.com.kz` -> [`com.kz`, `kz`] lalu kecocokan terpanjang yang menang. */
export function tldCandidates(registeredDomain: string): string[] {
  const labels = registeredDomain.toLowerCase().replace(/\.$/, '').split('.');
  return labels.slice(1).map((_, i) => labels.slice(i + 1).join('.'));
}

function joinUrl(base: string, domain: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}domain/${encodeURIComponent(domain)}`;
}

function ageFromEvents(body: unknown): number | null {
  const events = (body as { events?: { eventAction?: string; eventDate?: string }[] }).events;
  const registration = events?.find((event) => event.eventAction?.toLowerCase() === 'registration');
  if (!registration?.eventDate) return null;
  const timestamp = Date.parse(registration.eventDate);
  if (!Number.isFinite(timestamp)) return null;
  const age = Math.floor((Date.now() - timestamp) / AGE_MS);
  return age >= 0 ? age : null;
}

export function createRdapLookup(opts: RdapOptions = {}): DomainAgeLookup {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2500;
  const memo = new Map<string, Promise<number | null>>();
  const bootstrap = opts.bootstrap ?? (() => (bootstrapPromise ??= fetchBootstrap(fetchImpl)));

  const query = async (url: string, signal: AbortSignal): Promise<number | null> => {
    const timeout = timeoutSignal(timeoutMs, signal);
    try {
      const response = await fetchImpl(url, {
        redirect: 'follow',
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: timeout.signal,
      });
      if (!response.ok) return null;
      return ageFromEvents(await response.json());
    } catch {
      return null;
    } finally {
      timeout.cleanup();
    }
  };

  const lookup = async (registeredDomain: string, signal: AbortSignal): Promise<number | null> => {
    if (!registeredDomain || registeredDomain.length > 253) return null;
    if (!/^[a-z0-9.-]+$/i.test(registeredDomain)) return null;

    let servers: Map<string, string>;
    try {
      servers = await bootstrap();
    } catch {
      servers = new Map();
    }

    // Registry resmi lebih dulu (bootstrap IANA, lalu tabel ccTLD), `rdap.org` terakhir.
    // `rdap.org` dijalankan paralel: kalau registry lambat/gagal, hasilnya sudah menunggu.
    const suffixes = tldCandidates(registeredDomain);
    const known = suffixes.find((suffix) => servers.has(suffix) || suffix in SUFFIX_SERVERS);
    const base = known ? (servers.get(known) ?? SUFFIX_SERVERS[known]) : undefined;

    const fallback = query(`https://rdap.org/domain/${encodeURIComponent(registeredDomain)}`, signal);
    if (base) {
      const direct = await query(joinUrl(base, registeredDomain), signal);
      if (direct !== null) return direct;
    }
    return fallback;
  };

  return {
    ageDays(registeredDomain, { signal }) {
      const key = registeredDomain.toLowerCase();
      const existing = memo.get(key);
      if (existing) return existing;

      const pending = lookup(registeredDomain, signal);
      memo.set(key, pending);
      return pending;
    },
  };
}
