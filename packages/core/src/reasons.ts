import type { AnalysisResult, Brand, SignalHit } from './schemas';

export interface ReasonInput {
  status: AnalysisResult['status'];
  signals: SignalHit[];
  matchedOfficialBrandIds: string[];
  page: AnalysisResult['page'];
}

const IMITATION_ORDER = [
  'TYPOSQUAT',
  'HOMOGLYPH',
  'BRAND_TOKEN_IN_HOST',
  'SAME_LABEL_DIFFERENT_SUFFIX',
] as const;

const SOFT_ORDER = [
  'CHEAP_TLD',
  'FREE_SUBDOMAIN_PLATFORM',
  'URL_SHORTENER',
  'IP_HOST',
  'USERINFO_IN_URL',
  'PUNYCODE',
  'HOTLINKS_OFFICIAL_ASSETS',
  'INSECURE_CREDENTIAL_FORM',
  'NEW_DOMAIN',
] as const;

function reasonFor(signal: SignalHit, input: ReasonInput, brandName: (id: string) => string): string | null {
  const brand = signal.brandId ? brandName(signal.brandId) : 'merek terverifikasi';
  const domain = input.page.registeredDomain ?? input.page.hostname;

  switch (signal.id) {
    case 'BRAND_CLAIM_UNOFFICIAL_DOMAIN':
      return `Laman ini mengaku sebagai ${brand}, tetapi alamatnya (${domain}) bukan alamat resmi ${brand}.`;
    case 'CREDENTIAL_FIELD':
      return 'Laman ini meminta sandi, PIN, atau kode OTP.';
    case 'FORM_CROSS_DOMAIN':
      return `Data yang Anda isi akan dikirim ke situs lain (${signal.detail ?? 'tidak dikenal'}).`;
    case 'TYPOSQUAT':
      return `Alamat ini mirip alamat resmi ${brand} (${signal.detail ?? ''}), tetapi tidak sama.`;
    case 'HOMOGLYPH':
      return `Alamat ini memakai huruf yang menyerupai huruf lain untuk meniru ${brand}.`;
    case 'BRAND_TOKEN_IN_HOST':
      return `Alamat ini memuat nama ${brand}, tetapi bukan milik ${brand}.`;
    case 'SAME_LABEL_DIFFERENT_SUFFIX':
      return `Nama alamat ini sama dengan ${brand}, tetapi akhirannya berbeda (${signal.detail ?? domain}).`;
    case 'CHEAP_TLD':
      return `Alamat ini memakai akhiran murah yang sering disalahgunakan (${signal.detail ?? ''}).`;
    case 'FREE_SUBDOMAIN_PLATFORM':
      return `Laman ini dibuat di layanan hosting gratis (${signal.detail ?? ''}).`;
    case 'URL_SHORTENER':
      return 'Tautan ini adalah tautan pendek yang menyembunyikan tujuan sebenarnya.';
    case 'IP_HOST':
      return 'Alamat ini berupa angka (IP), bukan nama situs.';
    case 'USERINFO_IN_URL':
      return 'Alamat ini memakai tanda @ untuk menyamarkan tujuan sebenarnya.';
    case 'PUNYCODE':
      return 'Alamat ini memuat karakter khusus yang dapat menyerupai huruf biasa.';
    case 'HOTLINKS_OFFICIAL_ASSETS':
      return `Laman ini memuat gambar atau berkas dari situs resmi ${brand} untuk meniru tampilannya.`;
    case 'INSECURE_CREDENTIAL_FORM':
      return 'Laman ini meminta data sensitif lewat koneksi tidak aman (http).';
    case 'NEW_DOMAIN':
      return `Alamat ini baru terdaftar (${signal.detail ?? '?'} hari lalu).`;
    default:
      return null;
  }
}

export function buildReasons(input: ReasonInput, brands: Brand[] = []): string[] {
  const nameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const brandName = (id: string): string => nameById.get(id) ?? id;

  if (input.status === 'official') {
    const brand = input.matchedOfficialBrandIds[0];
    if (brand) return [`Alamat ini terdaftar sebagai alamat resmi ${brandName(brand)}.`];
    return ['Alamat ini terdaftar sebagai alamat resmi.'];
  }

  const reasons: string[] = [];
  const used = new Set<string>();
  const push = (reason: string | null): void => {
    if (!reason || used.has(reason) || reasons.length >= 3) return;
    used.add(reason);
    reasons.push(reason);
  };

  const byId = (id: string): SignalHit[] => input.signals.filter((signal) => signal.id === id);

  for (const signal of byId('BRAND_CLAIM_UNOFFICIAL_DOMAIN')) {
    push(reasonFor(signal, input, brandName));
  }
  for (const signal of byId('FORM_CROSS_DOMAIN')) {
    push(reasonFor(signal, input, brandName));
  }
  for (const signal of byId('CREDENTIAL_FIELD')) {
    push(reasonFor(signal, input, brandName));
  }
  for (const id of IMITATION_ORDER) {
    for (const signal of byId(id)) push(reasonFor(signal, input, brandName));
  }
  for (const id of SOFT_ORDER) {
    for (const signal of byId(id)) push(reasonFor(signal, input, brandName));
  }

  return reasons;
}
