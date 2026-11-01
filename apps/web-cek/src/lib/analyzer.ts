import type { AnalysisResult, SignalHit } from '@phantom/core';
import { BRANDS, engine } from '@phantom/core';
import { copy } from '../ui/copy.id';
import type {
  ClaimedBrand,
  ParsedItem,
  Source,
  Stage,
  Status,
  TraceStep,
  Verdict,
} from './types';

// ==== Batas dan jenis data dari proxy /api/check ============================

const PROXY_TIMEOUT_MS = 30_000;

/**
 * Pesan tanpa tautan sama sekali tidak bisa diperiksa.
 * Ditangkap CekPage agar tampil sebagai galat isian, bukan hasil analisis.
 */
export class NoUrlFoundError extends Error {
  constructor() {
    super('no_url_found');
    this.name = 'NoUrlFoundError';
  }
}

interface CheckAgent {
  used: boolean;
  provider?: string;
  model?: string;
  steps?: number;
  verdict?: 'neutral' | 'caution' | 'danger';
  confidence?: number;
  reasons?: string[];
  capped?: boolean;
  usage?: { input: number; output: number };
}

interface CheckCache {
  key?: string;
  hit: boolean;
  written: boolean;
  reasons?: string[];
  createdAt?: number;
  expiresAt?: number;
}

interface CheckItem {
  inputUrl: string;
  analyzedUrl: string;
  fetch: { ok: boolean; status?: number; reason?: string };
  result: AnalysisResult;
  final: { status: Status; source: Source; capped: boolean };
  agent?: CheckAgent | null;
  cache?: CheckCache;
  degraded?: string[];
  limitations?: string[];
}

interface LinkCandidate {
  raw: string;
  url: string;
}

interface ItemOutcome {
  raw: string;
  url: string;
  status: Status;
  source: Source;
  result: AnalysisResult;
  floor: 'neutral' | 'caution' | 'danger';
  reasons: string[];
  /** L2 benar-benar dijalankan (isi laman sempat dibaca). */
  contentChecked: boolean;
  agent?: CheckAgent | null;
  cache?: CheckCache;
  degraded: string[];
  deepAttempted: boolean;
}

// ==== Utilitas =============================================================

function absoluteUrl(value: string): string | null {
  const trimmed = value.trim().replace(/[),.;!?]+$/g, '');
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Kunci pembanding yang tahan terhadap www, huruf besar, dan garis miring akhir. */
function keyOf(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const SEVERITY_RANK: Record<Status, number> = {
  danger: 3,
  caution: 2,
  neutral: 1,
  official: 0,
};

function worstStatus(statuses: Status[]): Status {
  if (statuses.length === 0) return 'neutral';

  const nonOfficial = statuses.filter((status) => status !== 'official');
  if (nonOfficial.length === 0) return 'official';

  let worst: 'neutral' | 'caution' | 'danger' = 'neutral';
  for (const status of nonOfficial) {
    if (status === 'neutral') continue;
    if (status === 'caution') worst = 'caution';
    if (status === 'danger') worst = 'danger';
  }
  return worst;
}

function worstFinding(signals: SignalHit[]): TraceStep['finding'] {
  if (signals.some((signal) => signal.severity === 'hard')) return 'hard';
  if (signals.length > 0) return 'soft';
  return 'none';
}

function technicalOf(signal: SignalHit | undefined): TraceStep['technical'] | undefined {
  if (!signal) return undefined;
  return signal.detail
    ? { signal: signal.id, value: signal.detail }
    : { signal: signal.id };
}

function findingFromVerdict(
  verdict: 'neutral' | 'caution' | 'danger' | undefined,
): TraceStep['finding'] {
  if (verdict === 'danger') return 'hard';
  if (verdict === 'caution') return 'soft';
  return 'none';
}

// ==== Message Parser =======================================================

const URL_SOURCE =
  "(?:https?:\\/\\/[^\\s<>\"'{}|\\\\^`]+|(?:[a-z0-9-]+\\.)+(?:my\\.id|co\\.id|go\\.id|ac\\.id|or\\.id|id|com|net|org|info|biz|xyz|top|site|online|shop|store|example|apk)\\b[^\\s<>\"'{}|\\\\^`]*)";
const PHONE_SOURCE = '(?:\\+62|62|08)[0-9\\s-]{8,15}';

interface TextMatch {
  index: number;
  value: string;
  kind: 'url' | 'phone';
}

function collectMatches(text: string): TextMatch[] {
  const matches: TextMatch[] = [];

  const urlRegex = new RegExp(URL_SOURCE, 'gi');
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    matches.push({ index: urlMatch.index, value: urlMatch[0], kind: 'url' });
  }

  const phoneRegex = new RegExp(PHONE_SOURCE, 'g');
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    const insideUrl = matches.some(
      (match) =>
        match.index <= phoneMatch!.index &&
        phoneMatch!.index < match.index + match.value.length,
    );
    if (insideUrl) continue;
    matches.push({ index: phoneMatch.index, value: phoneMatch[0], kind: 'phone' });
  }

  return matches.sort((a, b) => a.index - b.index);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Ekstraksi tautan dan nomor telepon dari teks bebas (Message Parser, WEB-02).
 * Urutan mengikuti posisi di pesan agar sorotan pada salinan pesan tetap rapi.
 */
export function parseMessageTokens(text: string): ParsedItem[] {
  return collectMatches(text).map((match, index) => {
    if (match.kind === 'phone') {
      const digits = digitsOnly(match.value);
      const brand = BRANDS.find((candidate) =>
        candidate.officialPhones.some((phone) => digitsOnly(phone) === digits),
      );

      return {
        id: `phone-${index}`,
        type: 'phone',
        value: match.value.trim(),
        status: brand ? 'official' : 'caution',
        finding: brand
          ? copy.parser.findingPhoneOfficial.replace('{brand}', brand.name)
          : copy.parser.phoneUnknown,
        isApk: false,
        checked: true,
      };
    }

    const value = match.value.replace(/[),.;!?]+$/g, '');
    const isApk = /\.apk(?:$|[?#])/i.test(value);

    if (isApk) {
      return {
        id: `url-${index}`,
        type: 'url' as const,
        value,
        status: 'danger' as const,
        finding: copy.parser.findingApk,
        isApk: true,
        checked: true,
      };
    }

    return {
      id: `url-${index}`,
      type: 'url' as const,
      value,
      status: 'neutral' as const,
      finding: copy.parser.findingUnchecked,
      isApk: false,
      checked: false,
    };
  });
}

// ==== L0/L1 lokal dan L2-L4 lewat proxy ===================================

function localOutcome(candidate: LinkCandidate): ItemOutcome {
  const result = engine.analyze({ url: candidate.url });
  return {
    raw: candidate.raw,
    url: candidate.url,
    status: result.status,
    source: 'rules',
    result,
    floor: result.floor,
    reasons: result.reasons,
    contentChecked: result.stage === 'L2',
    degraded: [],
    deepAttempted: false,
  };
}

const STATUSES: Status[] = ['official', 'neutral', 'caution', 'danger'];
const SOURCES: Source[] = ['rules', 'cache', 'agent'];

function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && STATUSES.includes(value as Status);
}

function isFloor(value: unknown): value is ItemOutcome['floor'] {
  return value === 'neutral' || value === 'caution' || value === 'danger';
}

function isCheckItem(value: unknown): value is CheckItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as CheckItem;
  if (
    typeof item.inputUrl !== 'string' ||
    typeof item.analyzedUrl !== 'string' ||
    typeof item.fetch !== 'object' ||
    item.fetch === null ||
    typeof item.fetch.ok !== 'boolean'
  ) {
    return false;
  }
  if (
    typeof item.result !== 'object' ||
    item.result === null ||
    typeof item.result.page !== 'object' ||
    item.result.page === null ||
    typeof item.result.page.hostname !== 'string' ||
    typeof item.result.flags !== 'object' ||
    item.result.flags === null ||
    !Array.isArray(item.result.flags.claimedBrandIds) ||
    !Array.isArray(item.result.flags.matchedOfficialBrandIds) ||
    !Array.isArray(item.result.signals) ||
    !Array.isArray(item.result.reasons)
  ) {
    return false;
  }
  return (
    typeof item.final === 'object' &&
    item.final !== null &&
    isStatus(item.final.status) &&
    typeof item.final.source === 'string' &&
    SOURCES.includes(item.final.source)
  );
}

async function requestCheck(url: string): Promise<CheckItem[]> {
  const base = String(import.meta.env.VITE_PROXY_API_URL ?? '')
    .trim()
    .replace(/\/+$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Web Cek memakai persetujuan tersirat: klik Periksa = setuju L0-L4.
      body: JSON.stringify({ input: url, noAi: false }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return [];

    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? items.filter(isCheckItem) : [];
  } finally {
    clearTimeout(timer);
  }
}

function reasonsFrom(item: CheckItem, fallback: string[]): string[] {
  if (item.final.source === 'cache' && item.cache?.reasons?.length) {
    return item.cache.reasons;
  }
  if (item.final.source === 'agent' && item.agent?.reasons?.length) {
    return item.agent.reasons;
  }
  return item.result.reasons.length > 0 ? item.result.reasons : fallback;
}

function mergeRemote(local: ItemOutcome, item: CheckItem): ItemOutcome {
  const contentChecked = item.fetch.ok && item.result.stage === 'L2';

  return {
    ...local,
    url: item.analyzedUrl || local.url,
    status: item.final.status,
    source: item.final.source,
    result: item.result,
    floor: isFloor(item.result.floor) ? item.result.floor : local.floor,
    reasons: reasonsFrom(item, local.reasons),
    contentChecked,
    agent: item.agent ?? null,
    cache: item.cache,
    degraded: Array.isArray(item.degraded) ? item.degraded : [],
    deepAttempted: true,
  };
}

// ==== Pemilihan satu tautan paling mencurigakan ===========================

function suspicionScore(outcome: ItemOutcome): number {
  const signals = outcome.result.signals;
  const hard = signals.filter((signal) => signal.severity === 'hard').length;
  const soft = signals.length - hard;
  return SEVERITY_RANK[outcome.status] * 100 + hard * 10 + soft;
}

function selectMostSuspicious(
  candidates: LinkCandidate[],
  outcomeByKey: Map<string, ItemOutcome>,
): LinkCandidate | undefined {
  let selected: LinkCandidate | undefined;
  let best = -1;

  for (const candidate of candidates) {
    const outcome = outcomeByKey.get(keyOf(candidate.url));
    if (!outcome) continue;
    const score = suspicionScore(outcome);
    // Skor sama: tautan yang lebih dulu di pesan menang.
    if (score > best) {
      best = score;
      selected = candidate;
    }
  }

  return selected;
}

// ==== Pemetaan ke Verdict (Design.md 6.0) =================================

function brandOf(result: AnalysisResult): ClaimedBrand | undefined {
  const brandId =
    result.flags.claimedBrandIds[0] || result.flags.matchedOfficialBrandIds[0];
  if (!brandId) return undefined;

  const brand = BRANDS.find((candidate) => candidate.id === brandId);
  if (!brand) return undefined;

  return {
    id: brand.id,
    name: brand.name,
    officialDomains: brand.officialDomains,
    officialPhones: brand.officialPhones,
  };
}

function buildReasons(
  selected: ItemOutcome | undefined,
  overall: Status,
  hasApk: boolean,
): string[] {
  const reasons: string[] = [];
  const seen = new Set<string>();

  const push = (reason: string | undefined) => {
    if (!reason || seen.has(reason) || reasons.length >= 3) return;
    seen.add(reason);
    reasons.push(reason);
  };

  if (hasApk) push(copy.web.reasonApkMessage);
  if (selected) {
    for (const reason of selected.reasons) push(reason);
  }

  if (reasons.length === 0) {
    push(overall === 'official' ? copy.web.reasonOfficial : copy.web.reasonNeutral);
  }

  return reasons;
}

function skippedStage(stage: Stage, skipReasonKey: string): TraceStep {
  return {
    stage,
    finding: 'skipped',
    summaryKey: copy.trace[stage],
    skipReasonKey,
  };
}

function cacheTimeLabel(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;
  try {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return undefined;
  }
}

function buildTrace(selected: ItemOutcome | undefined, hasApk: boolean): TraceStep[] {
  const trace: TraceStep[] = [];
  const signals = selected?.result.signals ?? [];

  // L0: pencocokan kanal resmi.
  if (selected?.status === 'official') {
    trace.push({
      stage: 'L0',
      finding: 'hard',
      summaryKey: copy.trace.l0Match,
      technical: {
        signal: 'OFFICIAL_MATCH',
        value: selected.result.page.hostname,
      },
    });
  } else {
    trace.push({
      stage: 'L0',
      finding: 'none',
      summaryKey: copy.trace.l0NoMatch,
    });
  }

  // L1: ciri pada alamat situs, ditambah aturan pesan berisi .apk.
  const l1Signals = signals.filter((signal) => signal.stage === 'L1');
  if (hasApk) {
    trace.push({
      stage: 'L1',
      finding: 'hard',
      summaryKey: copy.trace.l1Found,
      technical: { signal: 'APK_DOWNLOAD_LINK' },
    });
  } else {
    trace.push({
      stage: 'L1',
      finding: worstFinding(l1Signals),
      summaryKey: l1Signals.length > 0 ? copy.trace.l1Found : copy.trace.l1None,
      technical: technicalOf(l1Signals[0]),
    });
  }

  // L2: ciri pada isi laman. Dilewati bila laman tidak sempat dibaca.
  const l2Signals = signals.filter((signal) => signal.stage === 'L2');
  if (selected?.contentChecked) {
    trace.push({
      stage: 'L2',
      finding: worstFinding(l2Signals),
      summaryKey: l2Signals.length > 0 ? copy.trace.l2Found : copy.trace.l2None,
      technical: technicalOf(l2Signals[0]),
    });
  } else {
    trace.push(
      skippedStage(
        'L2',
        selected?.status === 'official' ? 'skippedOfficial' : 'skippedContent',
      ),
    );
  }

  // L3: umur domain lewat RDAP.
  const l3Signals = signals.filter((signal) => signal.stage === 'L3');
  if (!selected) {
    trace.push(skippedStage('L3', 'skippedNotNeeded'));
  } else if (selected.status === 'official') {
    trace.push(skippedStage('L3', 'skippedOfficial'));
  } else if (selected.cache?.hit) {
    trace.push(skippedStage('L3', 'skippedCache'));
  } else if (l3Signals.length > 0) {
    trace.push({
      stage: 'L3',
      finding: worstFinding(l3Signals),
      summaryKey: copy.trace.l3Found,
      technical: technicalOf(l3Signals[0]),
    });
  } else if (selected.degraded.includes('rdap_unavailable')) {
    trace.push(skippedStage('L3', 'rdapUnavailable'));
  } else if (selected.contentChecked && selected.result.needsAgent) {
    trace.push({
      stage: 'L3',
      finding: 'none',
      summaryKey: copy.trace.l3None,
    });
  } else {
    trace.push(skippedStage('L3', 'skippedNotNeeded'));
  }

  // L4: investigasi agen AI, atau hasil cache bila tersedia.
  if (!selected) {
    trace.push(skippedStage('L4', 'skippedNotNeeded'));
  } else if (selected.status === 'official') {
    trace.push(skippedStage('L4', 'skippedOfficial'));
  } else if (selected.cache?.hit) {
    trace.push({
      stage: 'L4',
      finding: findingFromVerdict(selected.status),
      summaryKey: copy.trace.l4Cache,
      technical: {
        tool: 'cache',
        value: cacheTimeLabel(selected.cache.createdAt),
      },
    });
  } else if (selected.agent?.used) {
    const capped = selected.agent.capped === true;
    trace.push({
      stage: 'L4',
      finding: capped ? 'soft' : findingFromVerdict(selected.agent.verdict),
      summaryKey:
        selected.agent.verdict === 'neutral'
          ? copy.trace.l4None
          : copy.trace.l4Found,
      technical: {
        tool: [selected.agent.provider, selected.agent.model]
          .filter(Boolean)
          .join('/'),
        value:
          typeof selected.agent.steps === 'number'
            ? `${selected.agent.steps} langkah`
            : undefined,
      },
    });
  } else if (selected.degraded.includes('llm_unavailable')) {
    trace.push(skippedStage('L4', 'llmUnavailable'));
  } else if (selected.degraded.includes('agent_timeout')) {
    trace.push(skippedStage('L4', 'agentTimeout'));
  } else if (selected.degraded.includes('no_verdict')) {
    trace.push(skippedStage('L4', 'agentNoVerdict'));
  } else if (!selected.contentChecked) {
    trace.push(skippedStage('L4', 'skippedContent'));
  } else if (!selected.result.needsAgent) {
    trace.push(skippedStage('L4', 'skippedNotNeeded'));
  } else {
    trace.push(skippedStage('L4', 'skippedNotNeeded'));
  }

  return trace;
}

function findingFor(outcome: ItemOutcome, checked: boolean): string {
  if (!checked) return copy.parser.findingNotChecked;
  if (outcome.status === 'official') return copy.parser.findingOfficial;

  const reason = outcome.reasons[0];
  if (reason) return reason;

  if (!outcome.contentChecked) return copy.parser.findingUnchecked;
  if (outcome.status === 'neutral') return copy.parser.findingNeutral;
  return copy.parser.findingCaution;
}

// ==== Fungsi analisis tunggal (AGENTS.md) =================================

/**
 * Analisis satu isian Web Cek. Semua tautan diparse, tetapi hanya satu yang
 * paling mencurigakan menurut L0/L1 lokal yang diperiksa penuh lewat
 * `POST /api/check` dengan `noAi: false` (L2-L4). Bila proxy gagal, hasil
 * L0/L1 lokal tetap ditampilkan dengan pemberitahuan bahwa isi laman belum
 * diperiksa.
 */
export async function analyze(input: string): Promise<Verdict> {
  const trimmed = input.trim();
  const tokens = parseMessageTokens(trimmed);

  const apkTokens = tokens.filter((token) => token.isApk);
  const linkTokens = tokens.filter((token) => token.type === 'url' && !token.isApk);

  if (apkTokens.length === 0 && linkTokens.length === 0) {
    throw new NoUrlFoundError();
  }

  const candidates: LinkCandidate[] = [];
  const seen = new Set<string>();
  for (const token of linkTokens) {
    const url = absoluteUrl(token.value);
    if (!url) continue;
    const key = keyOf(url);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ raw: token.value, url });
  }

  if (candidates.length === 0 && apkTokens.length === 0) {
    throw new NoUrlFoundError();
  }

  const outcomeByKey = new Map<string, ItemOutcome>();
  for (const candidate of candidates) {
    outcomeByKey.set(keyOf(candidate.url), localOutcome(candidate));
  }

  const selectedCandidate = selectMostSuspicious(candidates, outcomeByKey);
  const selectedKey = selectedCandidate ? keyOf(selectedCandidate.url) : null;
  const selectedOutcome = selectedKey ? outcomeByKey.get(selectedKey) : undefined;

  const useMock = import.meta.env.VITE_USE_MOCK === 'true';
  let proxyFailed = false;

  // Kanal resmi berhenti di L0: tidak ada permintaan jaringan.
  if (!useMock && selectedOutcome && selectedOutcome.status !== 'official') {
    try {
      const items = await requestCheck(selectedOutcome.url);
      const item = items[0];
      if (item) {
        outcomeByKey.set(selectedKey!, mergeRemote(selectedOutcome, item));
      }
    } catch {
      proxyFailed = true;
    }
  }

  const selected =
    (selectedKey ? outcomeByKey.get(selectedKey) : undefined) ?? selectedOutcome;

  if (proxyFailed && selected) {
    selected.deepAttempted = true;
    selected.degraded = [...new Set([...selected.degraded, 'proxy_unavailable'])];
  }

  const hasApk = apkTokens.length > 0;
  const overall = worstStatus([
    ...(selected ? [selected.status] : []),
    ...(hasApk ? (['danger'] as Status[]) : []),
  ]);

  const unselectedCount = Math.max(0, candidates.length - (selected ? 1 : 0));
  const notices: NonNullable<Verdict['notices']> = [];
  const agentUsed = Boolean(selected?.agent?.used);
  const cacheHit = Boolean(selected?.cache?.hit);

  if (!agentUsed && !cacheHit) notices.push('rulesOnly');
  if (selected && !selected.contentChecked && selected.status !== 'official') {
    notices.push('contentUnchecked');
  }
  if (
    selected &&
    selected.deepAttempted &&
    !agentUsed &&
    !cacheHit &&
    selected.degraded.some((reason) =>
      ['llm_unavailable', 'agent_timeout', 'no_verdict', 'rdap_unavailable', 'proxy_unavailable'].includes(
        reason,
      ),
    )
  ) {
    notices.push('deepUnavailable');
  }
  if (unselectedCount > 0) notices.push('otherLinksUnchecked');

  const parsedItems: ParsedItem[] = tokens.map((token) => {
    if (token.type === 'phone' || token.isApk) return token;

    const url = absoluteUrl(token.value);
    const outcome = url ? outcomeByKey.get(keyOf(url)) : undefined;
    const checked = Boolean(outcome && selectedKey && keyOf(url!) === selectedKey);

    if (!outcome) {
      return {
        ...token,
        status: 'neutral',
        finding: copy.parser.findingInvalid,
        checked: false,
      };
    }

    return {
      id: token.id,
      type: 'url',
      value: token.value,
      status: outcome.status,
      finding: findingFor(outcome, checked),
      isApk: false,
      checked,
    };
  });

  const floor: Verdict['floor'] =
    hasApk && overall === 'danger'
      ? 'danger'
      : selected && selected.floor !== 'neutral'
        ? selected.floor
        : undefined;

  const claimedBrand = selected ? brandOf(selected.result) : undefined;

  const suspiciousHost =
    selected &&
    selected.status !== 'official' &&
    (overall === 'caution' || overall === 'danger')
      ? selected.result.page.hostname || undefined
      : undefined;

  return {
    status: overall,
    reasons: buildReasons(selected, overall, hasApk),
    trace: buildTrace(selected, hasApk),
    floor,
    source: selected?.source ?? 'rules',
    claimedBrand,
    suspiciousHost,
    notices,
    parsedItems: parsedItems.length > 0 ? parsedItems : undefined,
    rawText: tokens.length > 0 ? trimmed : undefined,
    agentUsed,
    cacheHit,
  };
}
