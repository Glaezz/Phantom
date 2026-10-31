import { parse } from 'tldts';
import { z } from 'zod';
import { BrandSchema, type Brand } from './schemas';
import type { ParsedUrl } from './url';
import type { Config } from './config';
import { DEFAULT_CONFIG } from './config';

export interface KeywordEntry {
  brand: Brand;
  keyword: string;
  weak: boolean;
}

export interface OfficialLabel {
  brand: Brand;
  label: string;
  source: string;
}

export interface BrandIndex {
  brands: Brand[];
  byRegisteredDomain: Map<string, Brand[]>;
  byExactHost: Map<string, Brand[]>;
  keywords: KeywordEntry[];
  officialLabels: OfficialLabel[];
}

export function loadBrands(raw: unknown): Brand[] {
  const brands = z.array(BrandSchema).parse(raw);

  return brands.map((brand) => ({
    ...brand,
    officialDomains: brand.officialDomains.map((value) => value.toLowerCase()),
    exactHosts: brand.exactHosts.map((value) => value.toLowerCase()),
    keywords: brand.keywords.map((value) => value.toLowerCase()),
  }));
}

function looksLikeBadHost(value: string): boolean {
  return value !== value.toLowerCase() || /[\s/:]/.test(value);
}

export function validateBrandDb(
  brands: Brand[],
  config: Config = DEFAULT_CONFIG,
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const brand of brands) {
    if (ids.has(brand.id)) issues.push(`duplicate brand id: ${brand.id}`);
    ids.add(brand.id);

    for (const domain of brand.officialDomains) {
      if (looksLikeBadHost(domain)) {
        issues.push(`${brand.id}: official domain not a lowercase host: ${domain}`);
        continue;
      }
      const tld = parse(domain, { allowPrivateDomains: true });
      if (tld.isIp) {
        issues.push(`${brand.id}: official domain is an IP: ${domain}`);
      }
      if (!tld.domain) {
        issues.push(`${brand.id}: official domain is a public suffix: ${domain}`);
      }
      if (tld.isPrivate) {
        issues.push(`${brand.id}: official domain uses a private suffix: ${domain}`);
      }
      if (tld.domain && config.sharedContentDomains.includes(tld.domain)) {
        issues.push(`${brand.id}: official domain is a shared content platform: ${domain}`);
      }
    }

    for (const host of brand.exactHosts) {
      if (looksLikeBadHost(host)) {
        issues.push(`${brand.id}: exact host not a lowercase host: ${host}`);
        continue;
      }
      const tld = parse(host, { allowPrivateDomains: true });
      if (!tld.domain) issues.push(`${brand.id}: exact host has no domain: ${host}`);
    }

    const keywords = new Set<string>();
    for (const keyword of brand.keywords) {
      if (!keyword) issues.push(`${brand.id}: empty keyword`);
      if (keyword !== keyword.toLowerCase()) {
        issues.push(`${brand.id}: keyword not lowercase: ${keyword}`);
      }
      if (keywords.has(keyword)) issues.push(`${brand.id}: duplicate keyword: ${keyword}`);
      keywords.add(keyword);
    }

    if (brand.sources.length === 0) issues.push(`${brand.id}: no sources`);
    for (const source of brand.sources) {
      try {
        const parsed = new URL(source);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          issues.push(`${brand.id}: source is not http(s): ${source}`);
        }
      } catch {
        issues.push(`${brand.id}: invalid source URL: ${source}`);
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(brand.verifiedAt)) {
      issues.push(`${brand.id}: verifiedAt is not YYYY-MM-DD`);
    }
  }

  for (const brand of brands) {
    if (!brand.demo) continue;
    const realDomains = new Set(
      brands
        .filter((other) => !other.demo)
        .flatMap((other) => [...other.officialDomains, ...other.exactHosts]),
    );
    for (const value of [...brand.officialDomains, ...brand.exactHosts]) {
      if (realDomains.has(value)) {
        issues.push(`${brand.id}: demo brand uses a real brand domain: ${value}`);
      }
    }
  }

  return issues;
}

export function buildBrandIndex(brands: Brand[]): BrandIndex {
  const byRegisteredDomain = new Map<string, Brand[]>();
  const byExactHost = new Map<string, Brand[]>();
  const keywords: KeywordEntry[] = [];
  const officialLabels: OfficialLabel[] = [];
  const seenLabels = new Set<string>();

  for (const brand of brands) {
    for (const domain of brand.officialDomains) {
      const list = byRegisteredDomain.get(domain) ?? [];
      list.push(brand);
      byRegisteredDomain.set(domain, list);

      const label = parse(domain, { allowPrivateDomains: true }).domainWithoutSuffix;
      if (label) {
        const key = `${brand.id}|${label}`;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          officialLabels.push({ brand, label, source: domain });
        }
      }
    }

    for (const host of brand.exactHosts) {
      const list = byExactHost.get(host) ?? [];
      list.push(brand);
      byExactHost.set(host, list);

      const label = parse(host, { allowPrivateDomains: true }).domainWithoutSuffix;
      if (label) {
        const key = `${brand.id}|${label}`;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          officialLabels.push({ brand, label, source: host });
        }
      }
    }

    for (const keyword of brand.keywords) {
      keywords.push({
        brand,
        keyword,
        weak: brand.ambiguousToken || keyword.length <= 3,
      });
    }
  }

  return { brands, byRegisteredDomain, byExactHost, keywords, officialLabels };
}

export function isHostOwnedByBrand(
  index: BrandIndex,
  brand: Brand,
  parsed: ParsedUrl,
): boolean {
  if (parsed.registeredDomain && brand.officialDomains.includes(parsed.registeredDomain)) {
    return true;
  }
  return brand.exactHosts.includes(parsed.hostname);
}

export function isHostOwnedByAnyBrand(index: BrandIndex, parsed: ParsedUrl): boolean {
  if (parsed.registeredDomain && index.byRegisteredDomain.has(parsed.registeredDomain)) {
    return true;
  }
  return index.byExactHost.has(parsed.hostname);
}
