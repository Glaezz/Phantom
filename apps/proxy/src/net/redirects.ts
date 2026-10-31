import { parseUrl } from '@phantom/core';
import { timeoutSignal } from '../util/timeout';
import { assertFetchable, SsrfError } from './ssrf';

export interface RedirectResult {
  finalUrl: string;
  chain: string[];
  error?: string;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort.
  }
}

export interface RedirectOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function unrollRedirects(
  url: string,
  opts: RedirectOptions = {},
): Promise<RedirectResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const chain: string[] = [];
  let current = url;

  const pushHost = (value: string) => {
    const parsed = parseUrl(value);
    chain.push(parsed.ok ? parsed.hostname : value);
  };

  pushHost(current);

  for (let hops = 0; hops < 4; hops += 1) {
    try {
      assertFetchable(current);
    } catch (error) {
      return {
        finalUrl: current,
        chain: chain.slice(0, 3),
        error: error instanceof SsrfError ? `ssrf:${error.reason}` : 'network',
      };
    }

    const timeout = timeoutSignal(timeoutMs, opts.signal);

    try {
      let response: Response;
      try {
        response = await fetchImpl(current, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'PhantomBot/1.0',
            Accept: 'text/html,application/xhtml+xml',
          },
          signal: timeout.signal,
        });
      } catch {
        return {
          finalUrl: current,
          chain: chain.slice(0, 3),
          error: opts.signal?.aborted ? 'timeout' : timeout.signal.aborted ? 'timeout' : 'network',
        };
      }

      if (response.status < 300 || response.status >= 400) {
        await cancelBody(response);
        return { finalUrl: current, chain: chain.slice(0, 3) };
      }

      const location = response.headers.get('location');
      await cancelBody(response);
      if (!location) return { finalUrl: current, chain: chain.slice(0, 3) };

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { finalUrl: current, chain: chain.slice(0, 3), error: 'network' };
      }

      current = next.href;
      pushHost(current);
      if (hops === 2) return { finalUrl: current, chain: chain.slice(0, 3) };
    } finally {
      timeout.cleanup();
    }
  }

  return { finalUrl: current, chain: chain.slice(0, 3), error: 'too_many_redirects' };
}
