// Tipe bersama — salinan Design.md §6.0. Nanti pindah ke packages/shared saat fase 4.
export type Status = 'official' | 'neutral' | 'caution' | 'danger';
export type Surface = 'overlay' | 'popup' | 'web';
export type Source = 'rules' | 'cache' | 'agent';
export type Stage = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface TraceStep {
  stage: Stage;
  finding: 'hard' | 'soft' | 'none' | 'skipped';
  summaryKey: string;
  technical?: { signal?: string; tool?: string; value?: string };
  skipReasonKey?: string;
}

export interface Verdict {
  status: Status;
  reasons: string[];
  trace: TraceStep[];
  floor?: Status;
  source: Source;
  claimedBrand?: { id: string; name: string; officialDomains: string[]; officialPhones: string[] };
  suspiciousHost?: string;
}
