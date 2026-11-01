import type { Config } from './config';
import { AUTOCOMPLETE_TOKENS, CREDENTIAL_TOKENS, CREDENTIAL_TYPES } from './config';
import type { BrandIndex } from './brands';
import { isHostOwnedByAnyBrand, isHostOwnedByBrand } from './brands';
import type { BrandClaim } from './claims';
import type { FieldFeature, PageFeatures, SignalHit } from './schemas';
import { tokenize, tokenizeIdentifier } from './text';
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

function tokensHaveCredential(tokens: string[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (CREDENTIAL_TOKEN_SET.has(token)) return true;
    if (token === 'kata' && tokens[index + 1] === 'sandi') return true;
    if (token === 'kode' && (tokens[index + 1] === 'otp' || tokens[index + 1] === 'verifikasi')) {
      return true;
    }
  }
  return false;
}

export function isCredentialText(text: string): boolean {
  return tokensHaveCredential(tokenizeIdentifier(text));
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

const CLAIM_IGNORED_TOKENS = new Set([
  'to',
  'the',
  'of',
  'for',
  'with',
  'and',
  'dan',
  'ini',
  'itu',
  'page',
  'halaman',
  'website',
  'web',
  'situs',
  'download',
  'aplikasi',
  'app',
  'reset',
  'lupa',
  'mail',
  'email',
  'webmail',
  'news',
  'shop',
  'store',
  'blog',
  'admin',
  'dashboard',
  'support',
  'help',
  'home',
  'play',
  'about',
  'contact',
  'careers',
  'terms',
  'privacy',
]);

function hostTokensForClaim(parsed: ParsedUrl): string[] {
  const suffix = parsed.publicSuffix;
  const withoutSuffix =
    suffix && parsed.hostname.endsWith(`.${suffix}`)
      ? parsed.hostname.slice(0, -(suffix.length + 1))
      : parsed.hostname;
  return withoutSuffix.split(/[-._]+/).filter(Boolean);
}

function detectUnverifiedBrandClaim(
  features: PageFeatures,
  parsed: ParsedUrl,
  index: BrandIndex,
  config: Config,
): string | null {
  if (!parsed.registeredDomain || !parsed.publicSuffix) return null;
  if (parsed.isPrivateSuffix) return null;
  if (config.commonPublicSuffixes.includes(parsed.publicSuffix)) return null;
  if (isHostOwnedByAnyBrand(index, parsed)) return null;

  const ignored = new Set<string>([
    ...config.contextTokens,
    ...config.leadingStopwords,
    ...config.trailingStopwords,
    ...CREDENTIAL_TOKENS,
    ...CLAIM_IGNORED_TOKENS,
  ]);
  const hostTokens = new Set(hostTokensForClaim(parsed));
  const texts = [features.title, ...features.headings, features.siteName ?? ''];

  for (const text of texts) {
    for (const token of tokenize(text)) {
      if (token.length < 4 || ignored.has(token) || !hostTokens.has(token)) continue;
      return token;
    }
  }

  return null;
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
  const hasSharedForm = l1Signals.some((signal) => signal.id === 'SHARED_CONTENT_FORM');

  if (hasCredentialField) {
    add({ id: 'CREDENTIAL_FIELD', severity: 'hard', stage: 'L2' });
  }

  const credentialText = [
    features.title,
    ...features.headings,
    ...(features.formLabels ?? []),
  ].some(isCredentialText);
  if (credentialText && (features.forms.length > 0 || hasSharedForm)) {
    add({ id: 'CREDENTIAL_TEXT', severity: 'soft', stage: 'L2' });
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

  const unverifiedClaim = detectUnverifiedBrandClaim(features, parsed, index, config);
  if (unverifiedClaim) {
    add({
      id: 'UNVERIFIED_BRAND_CLAIM',
      severity: 'soft',
      stage: 'L2',
      detail: unverifiedClaim,
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
