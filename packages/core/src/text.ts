export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

/** Tokenizer for identifiers: also splits camelCase and acronym boundaries. */
export function tokenizeIdentifier(s: string): string[] {
  const spaced = s
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return tokenize(spaced);
}

export function splitSegments(s: string): string[] {
  return s
    .split(/[-–—|:·•]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
