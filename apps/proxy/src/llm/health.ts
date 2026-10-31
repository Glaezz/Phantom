const cooldowns = new Map<string, number>();

function key(provider: string, model: string): string {
  return `${provider}:${model}`;
}

export function isHealthy(provider: string, model: string, now = Date.now()): boolean {
  const until = cooldowns.get(key(provider, model));
  if (until === undefined) return true;
  if (until <= now) {
    cooldowns.delete(key(provider, model));
    return true;
  }
  return false;
}

export function markUnhealthy(
  provider: string,
  model: string,
  status: number,
  cooldownMs: number,
): void {
  if (status === 404) {
    cooldowns.set(key(provider, model), Date.now() + 600_000);
  } else if (status === 429 || status === 503) {
    cooldowns.set(key(provider, model), Date.now() + cooldownMs);
  }
}

export function resetHealth(): void {
  cooldowns.clear();
}
