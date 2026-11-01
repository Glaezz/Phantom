import {
  BRANDS,
  RULES_VERSION,
  deriveL4Steps,
  type AnalysisResult,
  type TraceStep as CoreTraceStep,
} from '@phantom/core';
import type { Verdict, TraceStep } from '../ui/types';

export type DeepSkipReason = 'cacheHit' | 'deepCheckDisabled' | 'proxyUnavailable' | 'notNeeded';

// skipReason -> kunci salinan alasan dilewati.
const SKIP_REASON_COPY: Record<DeepSkipReason, string | undefined> = {
  cacheHit: undefined,
  deepCheckDisabled: 'skippedNotNeeded',
  proxyUnavailable: 'skippedUnavailable',
  notNeeded: 'skippedDecidedByRules',
};

// severity dari SignalHit -> finding untuk row styling.
function findingFor(severity: 'hard' | 'soft' | undefined): TraceStep['finding'] {
  if (severity === 'hard') return 'hard';
  if (severity === 'soft') return 'soft';
  return 'none';
}

// stage core (L0..L4, SCORE) -> stage UI (L0..L4). SCORE direpresentasikan sebagai L2.
function stageFor(stage: CoreTraceStep['stage']): TraceStep['stage'] {
  return stage === 'SCORE' ? 'L2' : stage;
}

// Langkah tambahan dari proxy (L3 RDAP, L4 agen AI).
export interface ExtraTrace {
  l3?: CoreTraceStep[];
  l4?: CoreTraceStep[];
}

// AnalysisResult (core) -> Verdict (UI). Tanpa proxy, L3/L4 dilewati.
export function toVerdict(
  result: AnalysisResult,
  extra?: ExtraTrace,
  meta?: {
    status?: Verdict['status'];
    source?: Verdict['source'];
    skipReason?: DeepSkipReason;
  },
): Verdict {
  // Brand diklaim (titipan tidak resmi) diutamakan; status official memakai matchedOfficialBrandIds.
  const brandIds =
    result.flags.claimedBrandIds.length > 0
      ? result.flags.claimedBrandIds
      : result.flags.matchedOfficialBrandIds;
  const claimedBrand = brandIds
    .map((id) => BRANDS.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map((b) => ({
      id: b.id,
      name: b.name,
      officialDomains: b.officialDomains,
      officialPhones: b.officialPhones,
    }))[0];

  const severityBySignal = new Map(
    result.signals.map((s) => [s.id, s.severity] as const),
  );

  const trace: TraceStep[] = result.trace.map((step) => ({
    stage: stageFor(step.stage),
    finding: step.signal ? findingFor(severityBySignal.get(step.signal)) : 'none',
    summaryKey: step.message,
    technical: step.signal
      ? { signal: step.signal }
      : step.data && 'via' in step.data
        ? { value: String(step.data.via) }
        : undefined,
  }));

  trace.push(...deepSteps(extra, meta?.skipReason));

  return {
    status: meta?.status ?? result.status,
    reasons: result.reasons,
    trace,
    floor: result.floor,
    source: meta?.source ?? result.source,
    claimedBrand,
    suspiciousHost: result.page.hostname || undefined,
  };
}

// L3/L4: hasil proxy bila ada, selain itu "dilewati" supaya panel tetap menampilkan L0–L4.
function deepSteps(
  extra?: ExtraTrace,
  skipReason?: keyof typeof SKIP_REASON_COPY,
): TraceStep[] {
  // `notNeeded` = aturan lokal sudah memutuskan; jangan ditampilkan sebagai "dimatikan di pengaturan".
  const l3 = extra?.l3 ?? [];
  // Baris L4 dari proxy dipakai apa adanya: deriveL4Steps(null) selalu mengklaim AI gagal,
  // padahal proxy mungkin memang tidak memanggil agen (CORE-09).
  const proxyL4 = extra?.l4?.[0];
  return [
    l3[0] ? deepStep(l3[0]) : skipped('L3', skipReason),
    proxyL4
      ? skipReason === 'notNeeded' || (skipReason === 'deepCheckDisabled' && proxyL4.data?.available === false)
        ? skipped('L4', skipReason)
        : deepStep(proxyL4)
      : skipped('L4', skipReason),
  ];
}

// Tidak ada izin hanya boleh diklaim bila proxy memang melaporkannya (`deepCheckDisabled`).
// Array kosong berarti pemeriksaan tidak menghasilkan apa pun, bukan consent hilang.
function skipped(stage: 'L3' | 'L4', skipReason?: keyof typeof SKIP_REASON_COPY): TraceStep {
  const reasonKey = skipReason ? SKIP_REASON_COPY[skipReason] : undefined;
  return {
    stage,
    finding: 'skipped',
    summaryKey: stage,
    skipReasonKey: reasonKey ?? 'skippedUnavailable',
  };
}

function deepStep(step: CoreTraceStep): TraceStep {
  const stage = stageFor(step.stage);
  return {
    stage,
    finding: step.data?.available === false ? 'skipped' : 'soft',
    summaryKey: step.message,
    skipReasonKey:
      step.data?.available === false
        ? step.data.skippedBy === 'consent'
          ? 'skippedNotNeeded'
          : 'skippedUnavailable'
        : undefined,
    technical: technicalOf(step),
  };
}

function technicalOf(step: CoreTraceStep): TraceStep['technical'] | undefined {
  const data = step.data;
  if (!data) return undefined;
  const tool = typeof data.tool === 'string' ? data.tool : undefined;
  const value =
    typeof data.ageDays === 'number'
      ? `${data.domain} ${data.ageDays} hari`
      : typeof data.verdict === 'string'
        ? data.verdict
        : typeof data.domain === 'string'
          ? data.domain
          : undefined;
  return tool || value ? { tool, value } : undefined;
}
