import type { BrandIndex } from './brands';
import type { Brand } from './schemas';
import { parseUrl, type ParsedUrl } from './url';

export interface OfficialMatch {
  matched: boolean;
  brandIds: string[];
  via: 'registered' | 'exact' | null;
}

const NO_MATCH: OfficialMatch = { matched: false, brandIds: [], via: null };

export function isSharedContentPath(brand: Brand, parsed: ParsedUrl): boolean {
  if (!parsed.ok) return false;
  return (brand.sharedContentPaths ?? []).some((prefix) => parsed.path.startsWith(prefix));
}

export function matchParsedUrl(parsed: ParsedUrl, index: BrandIndex): OfficialMatch {
  if (!parsed.ok) return NO_MATCH;

  if (parsed.registeredDomain) {
    const brands = (index.byRegisteredDomain.get(parsed.registeredDomain) ?? []).filter(
      (brand) => !isSharedContentPath(brand, parsed),
    );
    if (brands.length > 0) {
      return {
        matched: true,
        brandIds: [...new Set(brands.map((brand) => brand.id))],
        via: 'registered',
      };
    }
  }

  const hosts = index.byExactHost.get(parsed.hostname) ?? [];
  if (hosts.length > 0) {
    return {
      matched: true,
      brandIds: [...new Set(hosts.map((brand) => brand.id))],
      via: 'exact',
    };
  }

  return NO_MATCH;
}

export function matchOfficial(url: string, index: BrandIndex): OfficialMatch {
  return matchParsedUrl(parseUrl(url), index);
}
