import type { AnalysisResult } from '@phantom/core';
import { BRANDS, engine } from '@phantom/core';
import { copy } from '../ui/copy.id';
import type { ClaimedBrand, ParsedItem, Status, TraceStep, Verdict } from './types';

// Fixture brands (merek fiktif sesuai NFR-07)
const DEMO_BANK: ClaimedBrand = {
  id: 'bank_nusantara_demo',
  name: 'Bank Nusantara (Contoh)',
  officialDomains: ['bank-nusantara-contoh.id'],
  officialPhones: ['1500000'],
};

const DEMO_TOKO: ClaimedBrand = {
  id: 'toko_nusantara_demo',
  name: 'Toko Nusantara (Contoh)',
  officialDomains: ['tokonusantara-contoh.id'],
  officialPhones: ['0800123456'],
};

const DEMO_KURIR: ClaimedBrand = {
  id: 'kurir_kilat_demo',
  name: 'Kurir Kilat (Contoh)',
  officialDomains: ['kurirkilat-contoh.id'],
  officialPhones: ['1500999'],
};

// Fixture S1 (PRD bagian 3: Login merek fiktif di .my.id, form dikirim ke domain lain)
export const FIXTURE_S1: Verdict = {
  status: 'danger',
  floor: 'danger',
  source: 'rules',
  claimedBrand: DEMO_BANK,
  suspiciousHost: 'login-nusantara-promo.my.id',
  reasons: [
    'Alamat ini meniru identitas Bank Nusantara (Contoh).',
    'Formulir kata sandi diarahkan ke alamat lain yang mencurigakan.',
  ],
  notices: ['rulesOnly'],
  trace: [
    {
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.L0,
      technical: { signal: 'OFFICIAL_MATCH', value: 'tidak cocok' },
    },
    {
      stage: 'L1',
      finding: 'hard',
      summaryKey: copy.trace.L1,
      technical: { signal: 'SUSPICIOUS_TLD', value: 'login-nusantara-promo.my.id' },
    },
    {
      stage: 'L2',
      finding: 'hard',
      summaryKey: copy.trace.L2,
      technical: { signal: 'CROSS_DOMAIN_FORM', value: 'action=https://penampung-data.example' },
    },
    {
      stage: 'L3',
      finding: 'skipped',
      summaryKey: copy.trace.L3,
      skipReasonKey: copy.trace.skippedNoConsent,
    },
    {
      stage: 'L4',
      finding: 'skipped',
      summaryKey: copy.trace.L4,
      skipReasonKey: copy.trace.skippedNoConsent,
    },
  ],
};

// Fixture S2 (PRD bagian 3: Startup sah baru dengan /login tanpa klaim merek)
export const FIXTURE_S2: Verdict = {
  status: 'neutral',
  source: 'rules',
  reasons: [
    'Belum ditemukan tanda bahaya pada alamat situs ini.',
    'Tidak ada klaim identitas merek yang ditiru.',
  ],
  notices: ['rulesOnly'],
  trace: [
    {
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.L0,
    },
    {
      stage: 'L1',
      finding: 'none',
      summaryKey: copy.trace.L1,
    },
    {
      stage: 'L2',
      finding: 'none',
      summaryKey: copy.trace.L2,
    },
    {
      stage: 'L3',
      finding: 'skipped',
      summaryKey: copy.trace.L3,
      skipReasonKey: copy.trace.skippedNoConsent,
    },
    {
      stage: 'L4',
      finding: 'skipped',
      summaryKey: copy.trace.L4,
      skipReasonKey: copy.trace.skippedNoConsent,
    },
  ],
};

// Fixture S3 (PRD bagian 3: Kasus abu-abu, domain baru, mirip, L4 dipanggil)
export const FIXTURE_S3: Verdict = {
  status: 'caution',
  source: 'agent',
  claimedBrand: DEMO_TOKO,
  suspiciousHost: 'toko-nusantara-diskon.id',
  reasons: [
    'Nama situs dibuat mirip dengan Toko Nusantara (Contoh).',
    'Alamat situs baru didaftarkan dan belum memiliki reputasi panjang.',
  ],
  trace: [
    {
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.L0,
    },
    {
      stage: 'L1',
      finding: 'soft',
      summaryKey: copy.trace.L1,
      technical: { signal: 'SIMILAR_DOMAIN', value: 'toko-nusantara-diskon.id' },
    },
    {
      stage: 'L2',
      finding: 'soft',
      summaryKey: copy.trace.L2,
      technical: { signal: 'SIMILAR_LAYOUT' },
    },
    {
      stage: 'L3',
      finding: 'soft',
      summaryKey: copy.trace.L3,
      technical: { signal: 'NEW_DOMAIN', value: 'umur: 3 hari' },
    },
    {
      stage: 'L4',
      finding: 'soft',
      summaryKey: copy.trace.L4,
      technical: { tool: 'page_analysis', signal: 'BRAND_IMPERSONATION' },
    },
  ],
};

// Fixture S4 (PRD bagian 3: Pesan WhatsApp berisi tautan .apk dan nomor telepon)
export const FIXTURE_S4: Verdict = {
  status: 'danger',
  floor: 'danger',
  source: 'agent',
  claimedBrand: DEMO_KURIR,
  reasons: [
    'Pesan berisi berkas aplikasi berbahaya .apk dan alamat situs mencurigakan.',
    'Nomor pengirim tidak terdaftar di kanal resmi.',
  ],
  parsedItems: [
    {
      id: 'item-1',
      type: 'url',
      value: 'undangan-pernikahan-digital.apk',
      status: 'danger',
      finding: 'Berkas aplikasi (.apk) tidak resmi di luar toko aplikasi',
      isApk: true,
    },
    {
      id: 'item-2',
      type: 'url',
      value: 'lacak-paket-kilat.my.id/tagihan',
      status: 'danger',
      finding: 'Alamat tiruan yang mengarah ke formulir tidak resmi',
      isApk: false,
    },
    {
      id: 'item-3',
      type: 'phone',
      value: '+62 812-9999-8888',
      status: 'caution',
      finding: copy.parser.phoneUnknown,
      isApk: false,
    },
    {
      id: 'item-4',
      type: 'url',
      value: 'kurirkilat-contoh.id/bantuan',
      status: 'official',
      finding: 'Terdaftar sebagai kanal resmi',
      isApk: false,
    },
  ],
  rawText:
    'Surat Undangan Pernikahan Putri Kami. Silakan unduh berkas undangan-pernikahan-digital.apk dan konfirmasi kehadiran ke +62 812-9999-8888. Cek tagihan di lacak-paket-kilat.my.id/tagihan atau bantuan resmi di kurirkilat-contoh.id/bantuan.',
  trace: [
    {
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.L0,
    },
    {
      stage: 'L1',
      finding: 'hard',
      summaryKey: copy.trace.L1,
      technical: { signal: 'APK_DOWNLOAD_LINK' },
    },
    {
      stage: 'L2',
      finding: 'hard',
      summaryKey: copy.trace.L2,
      technical: { signal: 'MALICIOUS_MESSAGE_PATTERN' },
    },
    {
      stage: 'L3',
      finding: 'soft',
      summaryKey: copy.trace.L3,
      technical: { signal: 'UNREGISTERED_PHONE' },
    },
    {
      stage: 'L4',
      finding: 'hard',
      summaryKey: copy.trace.L4,
      technical: { tool: 'message_parser', signal: 'SOCIAL_ENGINEERING' },
    },
  ],
};

// Fixture S5 (PRD bagian 3: Prompt injection diabaikan, batas bawah floor aktif)
export const FIXTURE_S5: Verdict = {
  status: 'caution',
  floor: 'caution',
  source: 'agent',
  claimedBrand: DEMO_BANK,
  suspiciousHost: 'nusantara-layanan-update.com',
  reasons: [
    'Laman berisi instruksi tersembunyi yang mencoba memengaruhi pemeriksaan.',
    'Ditemukan indikasi peniruan nama Bank Nusantara (Contoh).',
  ],
  trace: [
    {
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.L0,
    },
    {
      stage: 'L1',
      finding: 'soft',
      summaryKey: copy.trace.L1,
      technical: { signal: 'BRAND_KEYWORD' },
    },
    {
      stage: 'L2',
      finding: 'soft',
      summaryKey: copy.trace.L2,
      technical: { signal: 'SUSPICIOUS_HIDDEN_TEXT' },
    },
    {
      stage: 'L3',
      finding: 'none',
      summaryKey: copy.trace.L3,
    },
    {
      stage: 'L4',
      finding: 'soft',
      summaryKey: copy.trace.injectionIgnored,
      technical: { signal: 'PROMPT_INJECTION', value: 'abaikan instruksi' },
    },
  ],
};

// Fixture S6 (PRD bagian 3: Kanal resmi di basis merek)
export const FIXTURE_S6: Verdict = {
  status: 'official',
  source: 'rules',
  claimedBrand: DEMO_BANK,
  notices: ['rulesOnly'],
  reasons: ['Alamat ini terdaftar sebagai kanal resmi Bank Nusantara (Contoh).'],
  trace: [
    {
      stage: 'L0',
      finding: 'hard',
      summaryKey: copy.trace.L0,
      technical: { signal: 'OFFICIAL_MATCH', value: 'bank-nusantara-contoh.id' },
    },
    {
      stage: 'L1',
      finding: 'none',
      summaryKey: copy.trace.L1,
    },
    {
      stage: 'L2',
      finding: 'none',
      summaryKey: copy.trace.L2,
    },
    {
      stage: 'L3',
      finding: 'none',
      summaryKey: copy.trace.L3,
    },
    {
      stage: 'L4',
      finding: 'none',
      summaryKey: copy.trace.L4,
    },
  ],
};

/**
 * Petakan AnalysisResult dari packages/core ke Verdict (Design.md 6.0).
 */
export function toVerdict(result: AnalysisResult): Verdict {
  const brandId =
    result.flags.claimedBrandIds[0] || result.flags.matchedOfficialBrandIds[0];
  const brand = brandId ? BRANDS.find((b) => b.id === brandId) : undefined;

  const claimedBrand: ClaimedBrand | undefined = brand
    ? {
        id: brand.id,
        name: brand.name,
        officialDomains: brand.officialDomains,
        officialPhones: brand.officialPhones,
      }
    : undefined;

  const stages: Array<'L0' | 'L1' | 'L2' | 'L3' | 'L4'> = [
    'L0',
    'L1',
    'L2',
    'L3',
    'L4',
  ];
  const trace: TraceStep[] = [];

  for (const st of stages) {
    const coreStep = result.trace.find((t) => t.stage === st);
    if (coreStep) {
      const hit = result.signals.find((s) => s.stage === st);
      const finding: 'hard' | 'soft' | 'none' = hit
        ? hit.severity
        : result.status === 'official' && st === 'L0'
          ? 'hard'
          : 'none';

      trace.push({
        stage: st,
        finding,
        summaryKey: coreStep.message,
        technical: coreStep.signal
          ? {
              signal: coreStep.signal,
              value: coreStep.data ? JSON.stringify(coreStep.data) : undefined,
            }
          : undefined,
      });
    } else {
      trace.push({
        stage: st,
        finding: 'skipped',
        summaryKey: copy.trace[st],
        skipReasonKey: copy.trace.skippedNoConsent,
      });
    }
  }

  return {
    status: result.status,
    reasons: result.reasons.slice(0, 3),
    trace,
    floor: result.floor !== 'neutral' ? result.floor : undefined,
    source: result.source,
    claimedBrand,
    suspiciousHost:
      result.status === 'caution' || result.status === 'danger'
        ? result.page.hostname
        : undefined,
    notices: result.source === 'rules' ? ['rulesOnly'] : undefined,
  };
}

/**
 * Ekstraksi token tautan dan nomor telepon dari teks bebas (Message Parser).
 */
export function parseMessageTokens(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const urlRegex =
    /(?:https?:\/\/[^\s<>"'{}|\\^`]+|(?:[a-zA-Z0-9-]+\.)+(?:my\.id|id|com|net|org|co\.id|example|apk)\b[^\s<>"'{}|\\^`]*)/gi;
  const phoneRegex = /(?:\+62|62|08)[0-9\s-]{8,15}/g;

  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const rawVal = urlMatch[0];
    const isApk = /\.apk\b/i.test(rawVal);
    const isOfficial = rawVal.includes('bank-nusantara-contoh.id') || rawVal.includes('kurirkilat-contoh.id');
    const isSuspicious = rawVal.includes('.my.id') || isApk;

    const status: Status = isOfficial
      ? 'official'
      : isSuspicious
        ? 'danger'
        : 'neutral';

    const finding = isApk
      ? 'Berkas instalasi (.apk) di luar jalur resmi'
      : isOfficial
        ? 'Terdaftar sebagai kanal resmi'
        : isSuspicious
          ? 'Alamat menggunakan pola domain mencurigakan'
          : 'Alamat situs belum terdaftar';

    items.push({
      id: `url-${items.length}`,
      type: 'url',
      value: rawVal,
      status,
      finding,
      isApk,
    });
  }

  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    const rawPhone = phoneMatch[0].trim();
    const isOfficialPhone = rawPhone.replace(/\D/g, '') === '1500000';
    items.push({
      id: `phone-${items.length}`,
      type: 'phone',
      value: rawPhone,
      status: isOfficialPhone ? 'official' : 'caution',
      finding: isOfficialPhone
        ? 'Nomor telepon resmi terdaftar'
        : copy.parser.phoneUnknown,
      isApk: false,
    });
  }

  return items;
}

/**
 * Logika mock analisis untuk pengujian dan demo.
 */
async function runMockAnalyze(input: string): Promise<Verdict> {
  const delay = Math.floor(Math.random() * (1200 - 600 + 1)) + 600;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const lower = input.toLowerCase();

  // Teks berisi ".apk" memicu apkWarning dan MessageParserList
  if (lower.includes('.apk')) {
    const parsed = parseMessageTokens(input);
    if (parsed.length === 0) {
      parsed.push({
        id: 'apk-1',
        type: 'url',
        value: input.trim(),
        status: 'danger',
        finding: 'Berkas aplikasi (.apk) di luar toko aplikasi',
        isApk: true,
      });
    }
    return {
      ...FIXTURE_S4,
      parsedItems: parsed,
      rawText: input,
    };
  }

  // Pesan dengan banyak tautan/nomor memicu MessageParserList
  const parsed = parseMessageTokens(input);
  if (parsed.length >= 2) {
    const hasDanger = parsed.some((p) => p.status === 'danger');
    const hasCaution = parsed.some((p) => p.status === 'caution');
    const overallStatus: Status = hasDanger
      ? 'danger'
      : hasCaution
        ? 'caution'
        : 'neutral';

    return {
      status: overallStatus,
      floor: overallStatus === 'danger' ? 'danger' : undefined,
      source: 'agent',
      claimedBrand: DEMO_KURIR,
      reasons: [
        'Pesan memuat beberapa tautan atau nomor kontak yang perlu diperiksa.',
        'Kanal pengirim belum terverifikasi secara resmi.',
      ],
      parsedItems: parsed,
      rawText: input,
      trace: FIXTURE_S4.trace,
    };
  }

  // Skenario S5: Floor aktif + trace.injectionIgnored
  if (lower.includes('injeksi') || lower.includes('abaikan') || lower.includes('prompt')) {
    return FIXTURE_S5;
  }

  // Skenario S1: Merek fiktif di .my.id
  if (lower.includes('my.id') || lower.includes('login-nusantara') || lower.includes('s1')) {
    return FIXTURE_S1;
  }

  // Skenario S2: Startup sah tanpa klaim merek
  if (lower.includes('startup') || lower.includes('kedaikopi') || lower.includes('s2')) {
    return FIXTURE_S2;
  }

  // Skenario S6: Kanal resmi
  if (lower.includes('bank-nusantara-contoh.id') || lower.includes('resmi') || lower.includes('s6')) {
    return FIXTURE_S6;
  }

  // Skenario S4 eksplisit
  if (lower.includes('s4') || lower.includes('undangan')) {
    return FIXTURE_S4;
  }

  // Skenario S3 default (kasus abu-abu)
  return FIXTURE_S3;
}

/**
 * Fallback mode aturan atau pesan DS-74 bila jaringan gagal.
 * Tidak pernah memunculkan galat teknis atau status keliru.
 */
function fallbackRulesOrDs74(input: string): Verdict {
  try {
    let targetUrl = input.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    new URL(targetUrl);

    const result = engine.analyze({
      url: targetUrl,
    });

    const verdict = toVerdict(result);
    verdict.notices = ['rulesOnly'];
    return verdict;
  } catch {
    return {
      status: 'caution',
      reasons: [copy.error.connectionFailed],
      trace: [
        { stage: 'L0', finding: 'none', summaryKey: copy.trace.L0 },
        { stage: 'L1', finding: 'none', summaryKey: copy.trace.L1 },
        {
          stage: 'L2',
          finding: 'skipped',
          summaryKey: copy.trace.L2,
          skipReasonKey: copy.error.rulesFallback,
        },
        {
          stage: 'L3',
          finding: 'skipped',
          summaryKey: copy.trace.L3,
          skipReasonKey: copy.trace.skippedNoConsent,
        },
        {
          stage: 'L4',
          finding: 'skipped',
          summaryKey: copy.trace.L4,
          skipReasonKey: copy.trace.skippedNoConsent,
        },
      ],
      source: 'rules',
      notices: ['rulesOnly'],
    };
  }
}

/**
 * Fungsi analisis tunggal untuk Web Cek (AGENTS.md).
 */
export async function analyze(input: string): Promise<Verdict> {
  const trimmed = input.trim();
  const useMock =
    import.meta.env.VITE_USE_MOCK === 'true' ||
    !import.meta.env.VITE_PROXY_API_URL;

  if (useMock) {
    return runMockAnalyze(trimmed);
  }

  const proxyUrl = String(import.meta.env.VITE_PROXY_API_URL).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${proxyUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: trimmed }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data && typeof data === 'object' && 'status' in data && 'trace' in data) {
      return data as Verdict;
    }
    return toVerdict(data as AnalysisResult);
  } catch {
    clearTimeout(timeoutId);
    return fallbackRulesOrDs74(trimmed);
  }
}
