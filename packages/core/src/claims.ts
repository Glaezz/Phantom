import type { Config } from './config';
import type { BrandIndex } from './brands';
import { splitSegments, tokenize } from './text';

export interface ClaimTextInput {
  title: string;
  headings: string[];
  siteName: string | null;
}

export interface BrandClaim {
  brandId: string;
  strength: 'strong' | 'weak';
  sources: ('title' | 'h1' | 'siteName')[];
}

type ClaimSource = 'title' | 'h1' | 'siteName';

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let matches = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function startsWithSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  return needle.every((token, index) => haystack[index] === token);
}

function stripLeading(tokens: string[], stopwords: readonly string[]): string[] {
  let index = 0;
  while (index < tokens.length && stopwords.includes(tokens[index])) index += 1;
  return tokens.slice(index);
}

function stripTrailing(tokens: string[], stopwords: readonly string[]): string[] {
  let end = tokens.length;
  while (end > 0 && stopwords.includes(tokens[end - 1])) end -= 1;
  return tokens.slice(0, end);
}

function matchSource(
  text: string,
  source: ClaimSource,
  candidates: string[][],
  ambiguous: boolean,
  config: Config,
): 'strong' | 'weak' | null {
  if (!text.trim()) return null;

  if (source === 'siteName') {
    const tokens = tokenize(text);
    for (const candidate of candidates) {
      if (candidate.length > 0 && containsSequence(tokens, candidate)) {
        if (!ambiguous && tokens.length === candidate.length) return 'strong';
        if (ambiguous && tokens.length === candidate.length) return 'strong';
      }
    }
    return null;
  }

  const segments = splitSegments(text);
  for (const segment of segments) {
    const tokens = tokenize(segment);
    if (tokens.length === 0) continue;

    if (ambiguous) {
      const trimmed = stripTrailing(
        stripLeading(tokens, config.leadingStopwords),
        config.trailingStopwords,
      );
      for (const candidate of candidates) {
        if (trimmed.length === candidate.length && startsWithSequence(trimmed, candidate)) {
          return 'strong';
        }
      }
      continue;
    }

    const leadingTrimmed = stripLeading(tokens, config.leadingStopwords);
    for (const candidate of candidates) {
      if (startsWithSequence(leadingTrimmed, candidate)) return 'strong';
    }
    for (const candidate of candidates) {
      if (containsSequence(tokens, candidate)) return 'weak';
    }
  }

  return null;
}

export function detectBrandClaims(
  input: ClaimTextInput,
  index: BrandIndex,
  config: Config,
): BrandClaim[] {
  const claims: BrandClaim[] = [];

  for (const brand of index.brands) {
    const candidates: string[][] = [];
    for (const value of [...brand.keywords, brand.name]) {
      const tokens = tokenize(value);
      if (tokens.length > 0) candidates.push(tokens);
    }

    const sourceHits = new Map<ClaimSource, 'strong' | 'weak'>();

    const titleStrength = matchSource(
      input.title,
      'title',
      candidates,
      brand.ambiguousToken,
      config,
    );
    if (titleStrength) sourceHits.set('title', titleStrength);

    for (const heading of input.headings) {
      const strength = matchSource(heading, 'h1', candidates, brand.ambiguousToken, config);
      if (strength === 'strong') {
        sourceHits.set('h1', 'strong');
        break;
      }
      if (strength === 'weak') sourceHits.set('h1', 'weak');
    }

    const siteStrength = matchSource(
      input.siteName ?? '',
      'siteName',
      candidates,
      brand.ambiguousToken,
      config,
    );
    if (siteStrength) sourceHits.set('siteName', siteStrength);

    if (sourceHits.size === 0) continue;

    const strength = [...sourceHits.values()].includes('strong') ? 'strong' : 'weak';
    claims.push({
      brandId: brand.id,
      strength,
      sources: [...sourceHits.keys()],
    });
  }

  return claims;
}
