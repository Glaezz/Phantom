// Tipe bersama dari Design.md 6.0.
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

export interface ClaimedBrand {
  id: string;
  name: string;
  officialDomains: string[];
  officialPhones: string[];
}

export interface ParsedItem {
  id?: string;
  type: 'url' | 'phone';
  value: string;
  status: Status;
  finding: string;
  isApk?: boolean;
  /** Hanya satu tautan per pesan yang diperiksa penuh. */
  checked?: boolean;
}

export interface Verdict {
  status: Status;
  reasons: string[];
  trace: TraceStep[];
  floor?: Status;
  source: Source;
  claimedBrand?: ClaimedBrand;
  suspiciousHost?: string;
  notices?: Array<
    | 'rulesOnly'
    | 'spaLimit'
    | 'budgetLimited'
    | 'contentUnchecked'
    | 'deepUnavailable'
    | 'otherLinksUnchecked'
  >;
  parsedItems?: ParsedItem[];
  rawText?: string;
  /** L4 benar-benar dipakai (agen berjalan atau hasil cache). */
  agentUsed?: boolean;
  cacheHit?: boolean;
}
