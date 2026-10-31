import { assertFetchable, SsrfError } from './ssrf';

export type SafeFetchFailure =
  | { ok: false; reason: `ssrf:${string}` }
  | { ok: false; reason: 'timeout' | 'too_large' | 'not_html' | 'network' | `http_${number}` };

export type SafeFetchResult =
  | { ok: true; finalUrl: string; status: number; html: string }
  | SafeFetchFailure;

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBytes: number;
  fetchImpl?: typeof fetch;
}

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort.
  }
}

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await cancelBody(response);
    return { ok: false };
  }

  if (!response.body) return { ok: true, text: '' };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}

export async function safeFetch(url: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let current = url;

  for (let redirects = 0; ; redirects += 1) {
    try {
      assertFetchable(current);
    } catch (error) {
      if (error instanceof SsrfError) return { ok: false, reason: `ssrf:${error.reason}` };
      return { ok: false, reason: 'network' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

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
          signal: controller.signal,
        });
      } catch {
        return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network' };
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          await cancelBody(response);
          return { ok: false, reason: `http_${response.status}` };
        }
        if (redirects >= 3) {
          await cancelBody(response);
          return { ok: false, reason: 'network' };
        }

        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          await cancelBody(response);
          return { ok: false, reason: 'network' };
        }
        await cancelBody(response);
        current = next.href;
        continue;
      }

      if (!response.ok) {
        await cancelBody(response);
        return { ok: false, reason: `http_${response.status}` };
      }

      const contentType = (response.headers.get('content-type') ?? '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (!HTML_TYPES.has(contentType)) {
        await cancelBody(response);
        return { ok: false, reason: 'not_html' };
      }

      let body: Awaited<ReturnType<typeof readLimited>>;
      try {
        body = await readLimited(response, opts.maxBytes);
      } catch {
        await cancelBody(response);
        return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network' };
      }
      if (!body.ok) return { ok: false, reason: 'too_large' };
      return { ok: true, finalUrl: current, status: response.status, html: body.text };
    } finally {
      clearTimeout(timer);
    }
  }
}
