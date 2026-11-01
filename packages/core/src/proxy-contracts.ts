import { z } from 'zod';
import {
  AnalysisResultSchema,
  PageFeaturesSchema,
  TraceStepSchema,
  type AnalysisResult,
  type Status,
  type TraceStep,
} from './schemas';

// ARC-08: request/response of POST /api/analyze defined once, here.

export const AnalyzeRequestSchema = z.object({
  url: z.string().min(1).max(2048),
  features: PageFeaturesSchema,
  consent: z.object({ cloud: z.boolean(), domainAge: z.boolean() }),
});

export const FinalVerdictSchema = z.object({
  status: z.enum(['official', 'neutral', 'caution', 'danger']),
  source: z.enum(['rules', 'cache', 'agent']),
  capped: z.boolean(),
  // `deepCheckDisabled`: L3/L4 tidak dijalankan karena pengguna mematikan pemeriksaan lanjutan.
  skipReason: z.enum(['cacheHit', 'deepCheckDisabled']).optional(),
});

export const L3EntrySchema = z.object({
  domain: z.string().max(253),
  ageDays: z.number().int().nonnegative().nullable(),
  reason: z.enum(['private_hosting']).optional(),
});

export const AnalyzeResponseSchema = z.object({
  result: AnalysisResultSchema,
  final: FinalVerdictSchema,
  l3: z.array(TraceStepSchema).optional(),
  l4: z.array(TraceStepSchema).optional(),
  degraded: z.array(z.string()).optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeL3Entry = z.infer<typeof L3EntrySchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export interface AgentSummaryForTrace {
  used: boolean;
  provider?: string;
  model?: string;
  verdict: 'neutral' | 'caution' | 'danger';
}

const RANK: Record<'neutral' | 'caution' | 'danger', number> = {
  neutral: 0,
  caution: 1,
  danger: 2,
};

/** Local rules and the proxy verdict combine by keeping whichever is worse (CORE-09). */
export function mergeProxyResult(
  local: AnalysisResult,
  remote: Pick<AnalyzeResponse, 'final' | 'degraded'>,
): Status {
  if (local.status === 'official') return 'official';
  if (remote.final.status === 'official') return 'official';
  const floor = local.floor;
  return RANK[remote.final.status] >= RANK[floor] ? remote.final.status : floor;
}
/** Deep checks run for ambiguous credential pages or C4 impersonation evidence. */
export function needsDeepCheck(result: AnalysisResult): boolean {
  return result.status !== 'official' && result.needsAgent;
}


export function deriveL3Steps(
  entries: AnalyzeL3Entry[],
  skipReason?: 'deepCheckDisabled',
): TraceStep[] {
  if (skipReason === 'deepCheckDisabled') {
    return [
      {
        stage: 'L3',
        message: 'Pemeriksaan umur situs dimatikan di pengaturan.',
        data: { tool: 'rdap', available: false, skippedBy: 'consent' },
      } satisfies TraceStep,
    ];
  }

  return entries.map((entry): TraceStep =>
    entry.ageDays === null
      ? {
          stage: 'L3',
          message: entry.reason === 'private_hosting'
            ? 'Umur situs tidak tersedia untuk subdomain hosting ini.'
            : 'Umur domain tidak dapat diperiksa.',
          data: { tool: 'rdap', domain: entry.domain, available: false, ...(entry.reason ? { reason: entry.reason } : {}) },
        }
      : {
          stage: 'L3',
          message: `Umur domain ${entry.domain} ${entry.ageDays} hari.`,
          data: { tool: 'rdap', domain: entry.domain, ageDays: entry.ageDays },
        },
  );
}

export function deriveL4Steps(
  agent: AgentSummaryForTrace | null,
  skipReason?: 'cacheHit' | 'deepCheckDisabled' | 'notNeeded',
  failureReason?: string,
): TraceStep[] {
  if (skipReason === 'deepCheckDisabled') {
    return [
      {
        stage: 'L4',
        message: 'Pemeriksaan lanjutan dimatikan di pengaturan.',
        data: { tool: 'agent', available: false, skippedBy: 'consent' },
      } satisfies TraceStep,
    ];
  }

  if (skipReason === 'cacheHit') {
    return [
      {
        stage: 'L4',
        message: 'Hasil pemeriksaan AI sebelumnya dipakai ulang.',
        data: { tool: 'cache' },
      } satisfies TraceStep,
    ];
  }

  if (skipReason === 'notNeeded') {
    return [{ stage: 'L4', message: 'Pemeriksaan AI tidak diperlukan berdasarkan hasil aturan.', data: { tool: 'agent', skippedBy: 'rules' } }];
  }

  if (!agent || !agent.used) {
    return [
      {
        stage: 'L4',
        message: failureReason === 'agent_timeout' ? 'Pemeriksaan AI melewati batas waktu.'
          : failureReason === 'llm_model_unavailable' ? 'Model layanan AI tidak tersedia; hasil aturan tetap dipakai.'
          : failureReason === 'llm_quota' ? 'Kuota layanan AI sedang tidak tersedia.'
          : failureReason === 'no_verdict' || failureReason === 'llm_invalid_response' ? 'Hasil pemeriksaan AI tidak valid; hasil aturan tetap dipakai.'
          : 'Pemeriksaan AI tidak tersedia.',
        data: { tool: 'agent', available: false, ...(failureReason ? { reason: failureReason } : {}) },
      } satisfies TraceStep,
    ];
  }

  return [
    {
      stage: 'L4',
      message: 'Pemeriksaan AI selesai.',
      data: {
        tool: 'agent',
        provider: agent.provider ?? 'unknown',
        model: agent.model ?? 'unknown',
        verdict: agent.verdict,
      },
    } satisfies TraceStep,
  ];
}
