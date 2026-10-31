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
});

export const AnalyzeResponseSchema = z.object({
  result: AnalysisResultSchema,
  final: FinalVerdictSchema,
  l3: z.array(L3EntrySchema).optional(),
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
/** L3 is only worth a network round trip when the page asks for credentials. */
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
          message: 'Umur domain tidak dapat diperiksa.',
          data: { tool: 'rdap', domain: entry.domain, available: false },
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
  skipReason?: 'cacheHit' | 'deepCheckDisabled',
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

  if (!agent || !agent.used) {
    return [
      {
        stage: 'L4',
        message: 'Pemeriksaan AI tidak tersedia.',
        data: { tool: 'agent', available: false },
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
