import type { Config } from './config';
import { AUTOCOMPLETE_TOKENS, CREDENTIAL_TOKENS, CREDENTIAL_TYPES } from './config';
import type { BrandIndex } from './brands';
import { isHostOwnedByBrand } from './brands';
import type { BrandClaim } from './claims';
import type { FieldFeature, PageFeatures, SignalHit } from './schemas';
import { tokenizeIdentifier } from './text';
import { parseUrl, type ParsedUrl } from './url';

const CREDENTIAL_TYPE_SET = new Set<string>(CREDENTIAL_TYPES);
const AUTOCOMPLETE_TOKEN_SET = new Set<string>(AUTOCOMPLETE_TOKENS);
const CREDENTIAL_TOKEN_SET = new Set<string>(CREDENTIAL_TOKENS);

export interface ResolvedTarget {
  kind: 'same' | 'external' | 'ignored';
  url?: string;
  registeredDomain?: string | null;
  host?: string;
}

export function isCredentialField(field: FieldFeature): boolean {
  const type = field.type.toLowerCase();
  if (type === 'password') return true;

  if (field.autocomplete) {
    const tokens = field.autocomplete.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.some((token) => AUTOCOMPLETE_TOKEN_SET.has(token))) return true;
  }

  if (!CREDENTIAL_TYPE_SET.has(type)) return false;

  for (const value of [field.name, field.id, field.placeholder]) {
    if (!value) continue;
    const tokens = tokenizeIdentifier(value);
    if (tokens.some((token) => CREDENTIAL_TOKEN_SET.has(token))) return true;
    if (tokens.some((token) => token === 'kata')) {
      const index = tokens.indexOf('kata');
      if (tokens[index + 1] === 'sandi') return true;
    }
    if (tokens.some((token) => token === 'kode')) {
      const index = tokens.indexOf('kode');
      if (tokens[index + 1] === 'otp') return true;
    }
  }

  return false;
}

export function resolveFormTarget(action: string | null, pageUrl: string): ResolvedTarget {
  const trimmed = action?.trim() ?? '';
  if (!trimmed || trimmed.startsWith('#')) return { kind: 'same' };

  let resolved: URL;
  try {
    resolved = new URL(trimmed, pageUrl);
  } catch {
    return { kind: 'ignored' };
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    return { kind: 'ignored' };
  }

  const target = parseUrl(resolved.href);
  const page = parseUrl(pageUrl);
  if (!target.ok) return { kind: 'ignored' };

  const sameDomain =
    (target.registeredDomain !== null &&
      page.registeredDomain !== null &&
      target.registeredDomain === page.registeredDomain) ||
    (target.registeredDomain === null &&
      page.registeredDomain === null &&
      target.hostname === page.hostname);

  return {
    kind: sameDomain ? 'same' : 'external',
    url: target.href,
    registeredDomain: target.registeredDomain,
    host: target.hostname,
  };
}

function hasCredential(form: PageFeatures['forms'][number]): boolean {
  return form.fields.some((field) => isCredentialField(field));
}

function trustedTarget(index: BrandIndex, target: ResolvedTarget, config: Config): boolean {
  if (target.host && config.trustedAuthHosts.includes(target.host)) return true;

  const brands = target.registeredDomain
    ? index.byRegisteredDomain.get(target.registeredDomain) ?? []
    : [];
  return brands.some((brand) => brand.category === 'oauth_payment');
}

export interface PageSignalInput {
  parsed: ParsedUrl;
  features: PageFeatures;
  claims: BrandClaim[];
  l1Signals: SignalHit[];
  index: BrandIndex;
  config: Config;
  domainAgeDays?: number | null;
}

export function analyzePageSignals(input: PageSignalInput): SignalHit[] {
  const { parsed, features, claims, l1Signals, index, config } = input;
  const signals: SignalHit[] = [];
  const seen = new Set<string>();

  const add = (signal: SignalHit): void => {
    const key = `${signal.id}|${signal.brandId ?? ''}|${signal.detail ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push(signal);
  };

  const hasCredentialField = features.forms.some(hasCredential);

  if (hasCredentialField) {
    add({ id: 'CREDENTIAL_FIELD', severity: 'hard', stage: 'L2' });
  }

  for (const form of features.forms) {
    if (!hasCredential(form)) continue;
    const target = resolveFormTarget(form.action, parsed.href);
    if (target.kind !== 'external') continue;
    if (trustedTarget(index, target, config)) continue;

    add({
      id: 'FORM_CROSS_DOMAIN',
      severity: 'hard',
      stage: 'L2',
      detail: target.host ?? target.registeredDomain ?? target.url,
    });
  }

  for (const resource of features.externalResources) {
    if (resource.kind === 'iframe') continue;
    const resourceUrl = parseUrl(resource.url);
    if (!resourceUrl.ok || !resourceUrl.registeredDomain) continue;

    const brands = index.byRegisteredDomain.get(resourceUrl.registeredDomain) ?? [];
    for (const brand of brands) {
      if (isHostOwnedByBrand(index, brand, parsed)) continue;
      add({
        id: 'HOTLINKS_OFFICIAL_ASSETS',
        severity: 'soft',
        stage: 'L2',
        brandId: brand.id,
        detail: resourceUrl.hostname,
      });
    }
  }

  if (hasCredentialField && parsed.protocol === 'http:') {
    add({ id: 'INSECURE_CREDENTIAL_FORM', severity: 'soft', stage: 'L2' });
  }

  const domainAgeDays = input.domainAgeDays;
  if (typeof domainAgeDays === 'number' && domainAgeDays >= 0 && domainAgeDays < config.newDomainDays) {
    add({
      id: 'NEW_DOMAIN',
      severity: 'soft',
      stage: 'L3',
      detail: String(domainAgeDays),
    });
  }

  const softIds = new Set<string>();
  for (const signal of [...l1Signals, ...signals]) {
    if (signal.severity === 'soft') softIds.add(signal.id);
  }

  for (const claim of claims) {
    const brand = index.brands.find((candidate) => candidate.id === claim.brandId);
    if (!brand) continue;
    if (isHostOwnedByBrand(index, brand, parsed)) continue;
    if (claim.strength === 'weak' && softIds.size === 0) continue;

    add({
      id: 'BRAND_CLAIM_UNOFFICIAL_DOMAIN',
      severity: 'hard',
      stage: 'L2',
      brandId: brand.id,
    });
  }

  return signals;
}
