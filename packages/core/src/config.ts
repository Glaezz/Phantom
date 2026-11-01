export const RULES_VERSION = '1.1.0';
export const CACHE_KEY_VERSION = 'v2';

export const CHEAP_SUFFIXES = [
  'my.id',
  'biz.id',
  'web.id',
  'xyz',
  'top',
  'click',
  'icu',
  'buzz',
  'cfd',
  'sbs',
  'cyou',
  'rest',
  'lol',
] as const;

export const SHORTENER_DOMAINS = [
  's.id',
  'bit.ly',
  'tinyurl.com',
  'cutt.ly',
  'rebrand.ly',
  'is.gd',
  'shorturl.at',
  't.ly',
  'rb.gy',
  'bitly.com',
  'forms.gle',
] as const;

export const SHARED_FORM_DOMAINS = ['forms.gle'] as const;

// Suffixes that do not by themselves make a matching brand claim suspicious.
export const COMMON_PUBLIC_SUFFIXES = [
  'com',
  'net',
  'org',
  'io',
  'co',
  'ai',
  'app',
  'dev',
  'id',
  'co.id',
  'go.id',
  'ac.id',
  'or.id',
  'web.id',
  'my.id',
  'sch.id',
  'biz.id',
  'desa.id',
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.sg',
  'com.my',
  'com.hk',
  'com.tw',
  'com.cn',
  'co.in',
  'com.br',
  'com.mx',
  'com.ar',
  'com.tr',
  'com.sa',
  'co.za',
  'com.ng',
  'co.ke',
  'com.ph',
  'co.th',
  'com.vn',
  'co.kr',
  'com.pk',
  'com.bd',
  'com.eg',
  'com.ua',
  'co.il',
  'de',
  'fr',
  'nl',
  'ru',
  'jp',
  'kr',
  'cn',
  'in',
  'br',
  'mx',
  'es',
  'it',
  'pl',
  'se',
  'no',
  'fi',
  'dk',
  'ch',
  'at',
  'be',
  'pt',
  'gr',
  'cz',
  'ro',
  'hu',
  'ie',
  'nz',
  'za',
  'sg',
  'my',
  'th',
  'vn',
  'ph',
  'tr',
  'sa',
  'ae',
  'il',
  'ke',
  'ng',
  'gh',
  'pk',
  'bd',
  'lk',
  'np',
] as const;

export const CONTEXT_TOKENS = [
  'login',
  'masuk',
  'verifikasi',
  'verif',
  'secure',
  'aman',
  'akun',
  'account',
  'update',
  'bantuan',
  'cs',
  'promo',
  'hadiah',
  'klaim',
] as const;

export const LEADING_STOPWORDS = [
  'login',
  'log',
  'masuk',
  'sign',
  'signin',
  'in',
  'ke',
  'di',
  'selamat',
  'datang',
  'portal',
  'halaman',
  'akun',
  'internet',
  'mobile',
  'klik',
  'official',
  'resmi',
] as const;

export const TRAILING_STOPWORDS = [
  'indonesia',
  'id',
  'official',
  'resmi',
  'dompet',
  'digital',
  'login',
  'masuk',
  'aplikasi',
  'app',
  'web',
  'website',
] as const;

export const CREDENTIAL_TOKENS = [
  'otp',
  'pin',
  'mpin',
  'passcode',
  'password',
  'passwd',
  'pwd',
  'sandi',
  'katasandi',
] as const;

export const CREDENTIAL_TYPES = ['text', 'tel', 'number', 'password'] as const;

export const AUTOCOMPLETE_TOKENS = [
  'one-time-code',
  'current-password',
  'new-password',
] as const;

export const TRUSTED_AUTH_HOSTS = [
  'accounts.google.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
  'login.live.com',
] as const;

export const SHARED_CONTENT_DOMAINS = [
  'google.com',
  'googleusercontent.com',
  'github.com',
  'facebook.com',
  'youtube.com',
  'tiktok.com',
  'wordpress.com',
  'blogspot.com',
] as const;

export const NEW_DOMAIN_DAYS = 30;

export const TYPOSQUAT_MAX_DISTANCE_SHORT = 0;
export const TYPOSQUAT_MAX_DISTANCE_MEDIUM = 1;
export const TYPOSQUAT_MAX_DISTANCE_LONG = 2;

export interface Config {
  rulesVersion: string;
  cacheKeyVersion: string;
  cheapSuffixes: readonly string[];
  shortenerDomains: readonly string[];
  sharedFormDomains: readonly string[];
  commonPublicSuffixes: readonly string[];
  contextTokens: readonly string[];
  leadingStopwords: readonly string[];
  trailingStopwords: readonly string[];
  credentialTokens: readonly string[];
  trustedAuthHosts: readonly string[];
  sharedContentDomains: readonly string[];
  newDomainDays: number;
  typosquatMaxDistanceShort: number;
  typosquatMaxDistanceMedium: number;
  typosquatMaxDistanceLong: number;
  validateOutput: boolean;
}

export const DEFAULT_CONFIG: Config = {
  rulesVersion: RULES_VERSION,
  cacheKeyVersion: CACHE_KEY_VERSION,
  cheapSuffixes: CHEAP_SUFFIXES,
  shortenerDomains: SHORTENER_DOMAINS,
  sharedFormDomains: SHARED_FORM_DOMAINS,
  commonPublicSuffixes: COMMON_PUBLIC_SUFFIXES,
  contextTokens: CONTEXT_TOKENS,
  leadingStopwords: LEADING_STOPWORDS,
  trailingStopwords: TRAILING_STOPWORDS,
  credentialTokens: CREDENTIAL_TOKENS,
  trustedAuthHosts: TRUSTED_AUTH_HOSTS,
  sharedContentDomains: SHARED_CONTENT_DOMAINS,
  newDomainDays: NEW_DOMAIN_DAYS,
  typosquatMaxDistanceShort: TYPOSQUAT_MAX_DISTANCE_SHORT,
  typosquatMaxDistanceMedium: TYPOSQUAT_MAX_DISTANCE_MEDIUM,
  typosquatMaxDistanceLong: TYPOSQUAT_MAX_DISTANCE_LONG,
  validateOutput: false,
};
