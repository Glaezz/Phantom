const DIRECT_URL = /^https?:\/\/\S+$/i;
const DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;

export function extractUrls(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (DIRECT_URL.test(trimmed)) return [trimmed];
  if (DOMAIN.test(trimmed)) return [`https://${trimmed}`];

  const matches = trimmed.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const unique: string[] = [];
  for (const match of matches) {
    const cleaned = match.replace(/[),.;!?]+$/g, '');
    if (!unique.includes(cleaned)) unique.push(cleaned);
    if (unique.length === 3) break;
  }
  return unique;
}
