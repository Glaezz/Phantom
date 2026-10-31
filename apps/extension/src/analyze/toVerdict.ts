import { BRANDS, type AnalysisResult } from '@phantom/core';
import type { Verdict, TraceStep } from '../ui/types';

// severity dari SignalHit -> finding untuk row styling.
function findingFor(severity: 'hard' | 'soft' | undefined): TraceStep['finding'] {
  if (severity === 'hard') return 'hard';
  if (severity === 'soft') return 'soft';
  return 'none';
}

// stage core (L0..L3, SCORE) -> stage UI (L0..L4). SCORE direpresentasikan sebagai L2.
function stageFor(stage: AnalysisResult['trace'][number]['stage']): TraceStep['stage'] {
  return stage === 'SCORE' ? 'L2' : stage;
}

// AnalysisResult (core) -> Verdict (UI). L3/L4 belum ada di ekstensi (tanpa proxy).
export function toVerdict(result: AnalysisResult): Verdict {
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

  return {
    status: result.status,
    reasons: result.reasons,
    trace,
    floor: result.floor,
    source: result.source,
    claimedBrand,
    suspiciousHost: result.page.hostname || undefined,
  };
}
