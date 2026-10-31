import type { DomainAgeLookup } from '@phantom/core';
import { timeoutSignal } from '../util/timeout';

export interface RdapOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createRdapLookup(opts: RdapOptions = {}): DomainAgeLookup {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const memo = new Map<string, Promise<number | null>>();

  const lookup = async (registeredDomain: string, signal: AbortSignal): Promise<number | null> => {
    if (!registeredDomain || registeredDomain.length > 253) return null;
    if (!/^[a-z0-9.-]+$/i.test(registeredDomain)) return null;

    const timeout = timeoutSignal(timeoutMs, signal);
    try {
      const response = await fetchImpl(
        `https://rdap.org/domain/${encodeURIComponent(registeredDomain)}`,
        {
          redirect: 'follow',
          headers: { Accept: 'application/rdap+json, application/json' },
          signal: timeout.signal,
        },
      );

      if (!response.ok) return null;
      const body = (await response.json()) as {
        events?: { eventAction?: string; eventDate?: string }[];
      };
      const registration = body.events?.find(
        (event) => event.eventAction?.toLowerCase() === 'registration',
      );
      if (!registration?.eventDate) return null;

      const timestamp = Date.parse(registration.eventDate);
      if (!Number.isFinite(timestamp)) return null;

      const age = Math.floor((Date.now() - timestamp) / 86_400_000);
      return age >= 0 ? age : null;
    } catch {
      return null;
    } finally {
      timeout.cleanup();
    }
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
