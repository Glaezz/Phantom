import type { SignalHit, Status, TraceStep } from './schemas';

const IMITATION_SIGNALS = [
  'TYPOSQUAT',
  'HOMOGLYPH',
  'BRAND_TOKEN_IN_HOST',
  'SAME_LABEL_DIFFERENT_SUFFIX',
] as const;

export interface ScoreResult {
  status: Exclude<Status, 'official'>;
  floor: 'neutral' | 'caution' | 'danger';
  needsAgent: boolean;
  trace: TraceStep[];
}

export function scoreSignals(signals: SignalHit[]): ScoreResult {
  const ids = new Set(signals.map((signal) => signal.id));
  const softIds = new Set(
    signals.filter((signal) => signal.severity === 'soft').map((signal) => signal.id),
  );

  const hasH1 = ids.has('BRAND_CLAIM_UNOFFICIAL_DOMAIN');
  const hasH2 = ids.has('CREDENTIAL_FIELD');
  const hasH3 = ids.has('FORM_CROSS_DOMAIN');
  const hasImitation = IMITATION_SIGNALS.some((id) => ids.has(id));

  const trace: TraceStep[] = [];
  let status: ScoreResult['status'] = 'neutral';
  let floor: ScoreResult['floor'] = 'neutral';

  if (hasH1 && hasH2) {
    status = 'danger';
    floor = 'danger';
    trace.push({
      stage: 'SCORE',
      message: 'Bukti keras H1 dan H2 menghasilkan status Bahaya.',
      data: { rule: 'danger', h1: hasH1, h2: hasH2 },
    });
  } else if (hasH2 && hasH3) {
    status = 'caution';
    trace.push({
      stage: 'SCORE',
      message: 'Kolom kredensial dan form lintas domain menghasilkan status Hati-hati.',
      data: { rule: 'C1', softSignals: softIds.size },
    });
  } else if (hasH2 && softIds.size >= 2) {
    status = 'caution';
    trace.push({
      stage: 'SCORE',
      message: 'Kolom kredensial disertai dua sinyal lunak menghasilkan status Hati-hati.',
      data: { rule: 'C2', softSignals: softIds.size },
    });
  } else if (hasImitation) {
    status = 'caution';
    trace.push({
      stage: 'SCORE',
      message: 'Kemiripan alamat dengan merek resmi menghasilkan status Hati-hati.',
      data: { rule: 'C3', softSignals: softIds.size },
    });
  } else {
    trace.push({
      stage: 'SCORE',
      message: 'Tidak ada bukti keras atau pola peniruan yang cukup.',
      data: { rule: 'neutral', softSignals: softIds.size },
    });
  }

  const needsAgent = status === 'caution' && hasH2;

  return { status, floor, needsAgent, trace };
}
