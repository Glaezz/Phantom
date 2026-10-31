import type { Context } from 'hono';
import { invalidRequest, payloadTooLarge } from '../errors';
import type { AppEnv } from '../types';

export async function readJsonLimited(c: Context<AppEnv>, maxBytes: number): Promise<unknown> {
  const declared = Number(c.req.header('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge();

  const body = c.req.raw.body;
  if (!body) throw invalidRequest();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) throw invalidRequest();
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    throw invalidRequest();
  }
}
