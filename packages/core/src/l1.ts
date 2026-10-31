import type { Config } from './config';
import { skeleton } from './confusables';
import { punycodeToUnicode } from './punycode';
import { damerauLevenshtein } from './similarity';
import { isHostOwnedByAnyBrand, isHostOwnedByBrand, type BrandIndex } from './brands';
import type { SignalHit } from './schemas';
import type { ParsedUrl } from './url';

function maxDistanceFor(length: number, config: Config): number {
  if (length <= 3) return 0;
  if (length <= 7) return config.typosquatMaxDistanceMedium;
  return config.typosquatMaxDistanceLong;
}

function hostTokens(parsed: ParsedUrl): string[] {
  if (!parsed.hostname || parsed.isIp) return [];
  const suffix = parsed.publicSuffix;
  const withoutSuffix =
    suffix && parsed.hostname.endsWith(`.${suffix}`)
      ? parsed.hostname.slice(0, -(suffix.length + 1))
      : parsed.hostname;
  return withoutSuffix.split(/[-._]+/).filter(Boolean);
}

export function analyzeUrlSignals(
  parsed: ParsedUrl,
  index: BrandIndex,
  config: Config,
): SignalHit[] {
  if (!parsed.ok) return [];

  const signals: SignalHit[] = [];
  const seen = new Set<string>();

  const add = (signal: SignalHit): void => {
    const key = `${signal.id}|${signal.brandId ?? ''}|${signal.detail ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push(signal);
  };

  if (parsed.publicSuffix && config.cheapSuffixes.includes(parsed.publicSuffix)) {
    add({
      id: 'CHEAP_TLD',
      severity: 'soft',
      stage: 'L1',
      detail: parsed.publicSuffix,
    });
  }

  if (parsed.isPrivateSuffix) {
    add({
      id: 'FREE_SUBDOMAIN_PLATFORM',
      severity: 'soft',
      stage: 'L1',
      detail: parsed.publicSuffix ?? undefined,
    });
  }

  if (parsed.registeredDomain && config.shortenerDomains.includes(parsed.registeredDomain)) {
    add({
      id: 'URL_SHORTENER',
      severity: 'soft',
      stage: 'L1',
      detail: parsed.registeredDomain,
    });
  }

  if (parsed.isIp) {
    add({ id: 'IP_HOST', severity: 'soft', stage: 'L1', detail: parsed.hostname });
  }

  if (parsed.hasUserinfo) {
    add({ id: 'USERINFO_IN_URL', severity: 'soft', stage: 'L1', detail: parsed.hostname });
  }

  if (parsed.hasPunycode) {
    add({ id: 'PUNYCODE', severity: 'soft', stage: 'L1', detail: parsed.hostnameUnicode });
  }

  const tokens = hostTokens(parsed);
  const hasContext = tokens.some((token) => config.contextTokens.includes(token));
  const ownedByAny = isHostOwnedByAnyBrand(index, parsed);

  let labelUnicode: string | null = null;
  if (parsed.label) {
    try {
      labelUnicode = punycodeToUnicode(parsed.label);
    } catch {
      labelUnicode = parsed.label;
    }
  }

  if (labelUnicode) {
    for (const official of index.officialLabels) {
      if (labelUnicode.toLowerCase() === official.label.toLowerCase()) continue;

      if (skeleton(labelUnicode) === skeleton(official.label)) {
        add({
          id: 'HOMOGLYPH',
          severity: 'soft',
          stage: 'L1',
          brandId: official.brand.id,
          detail: official.label,
        });
        continue;
      }

      if (official.label.length <= 3) continue;

      const distance = damerauLevenshtein(
        skeleton(labelUnicode),
        skeleton(official.label),
      );
      if (distance === 0 || distance > maxDistanceFor(official.label.length, config)) {
        continue;
      }
      if (ownedByAny) continue;

      const weak = official.brand.ambiguousToken || official.label.length <= 3;
      if (weak && !hasContext) continue;

      add({
        id: 'TYPOSQUAT',
        severity: 'soft',
        stage: 'L1',
        brandId: official.brand.id,
        detail: official.source,
      });
    }

    for (const official of index.officialLabels) {
      if (labelUnicode.toLowerCase() !== official.label.toLowerCase()) continue;
      if (isHostOwnedByBrand(index, official.brand, parsed)) continue;

      const weak = official.brand.ambiguousToken || official.label.length <= 3;
      if (weak && !hasContext) continue;

      add({
        id: 'SAME_LABEL_DIFFERENT_SUFFIX',
        severity: 'soft',
        stage: 'L1',
        brandId: official.brand.id,
        detail: parsed.registeredDomain ?? parsed.hostname,
      });
    }
  }

  for (const entry of index.keywords) {
    if (/[^\p{L}\p{N}]+/u.test(entry.keyword)) continue;
    if (isHostOwnedByBrand(index, entry.brand, parsed)) continue;

    const matched = tokens.some(
      (token) =>
        token === entry.keyword ||
        (entry.keyword.length >= 5 &&
          (token.startsWith(entry.keyword) || token.endsWith(entry.keyword))),
    );
    if (!matched) continue;
    if (entry.weak && !hasContext) continue;

    add({
      id: 'BRAND_TOKEN_IN_HOST',
      severity: 'soft',
      stage: 'L1',
      brandId: entry.brand.id,
      detail: entry.keyword,
    });
  }

  return signals;
}
