import { buildBrandIndex, type BrandIndex } from './brands';
import { detectBrandClaims } from './claims';
import { DEFAULT_CONFIG, type Config } from './config';
import { analyzePageSignals } from './l2';
import { analyzeUrlSignals } from './l1';
import { matchParsedUrl, matchOfficial, type OfficialMatch } from './l0';
import { buildReasons } from './reasons';
import { scoreSignals } from './scoring';
import {
  AnalysisResultSchema,
  PageFeaturesSchema,
  type AnalysisResult,
  type Brand,
  type PageFeatures,
  type SignalHit,
  type TraceStep,
} from './schemas';
import { parseUrl } from './url';

export interface AnalyzeInput {
  url: string;
  features?: PageFeatures;
  context?: { domainAgeDays?: number | null };
}

export interface Engine {
  analyze(input: AnalyzeInput): AnalysisResult;
  matchOfficial(url: string): OfficialMatch;
}

function signalTrace(signal: SignalHit): TraceStep {
  const detail = signal.detail ? ` (${signal.detail})` : '';
  return {
    stage: signal.stage,
    signal: signal.id,
    message: `Sinyal ${signal.id} terdeteksi${detail}.`,
    data: signal.brandId ? { brandId: signal.brandId } : undefined,
  };
}

export function createEngine(brands: Brand[], config?: Partial<Config>): Engine {
  const resolved: Config = { ...DEFAULT_CONFIG, ...config };
  const index: BrandIndex = buildBrandIndex(brands);

  function analyze(input: AnalyzeInput): AnalysisResult {
    const parsed = parseUrl(input.url);

    if (!parsed.ok) {
      const result: AnalysisResult = {
        status: 'neutral',
        floor: 'neutral',
        stage: 'L1',
        needsAgent: false,
        source: 'rules',
        flags: {
          hasCredentialField: false,
          claimedBrandIds: [],
          matchedOfficialBrandIds: [],
        },
        signals: [],
        reasons: [],
        trace: [{ stage: 'L1', message: 'URL tidak dapat diperiksa' }],
        page: { url: input.url, hostname: '', registeredDomain: null },
        rulesVersion: resolved.rulesVersion,
      };
      return resolved.validateOutput ? AnalysisResultSchema.parse(result) : result;
    }

    const page = {
      url: parsed.href,
      hostname: parsed.hostname,
      registeredDomain: parsed.registeredDomain,
    };

    const official = matchParsedUrl(parsed, index);
    if (official.matched) {
      const result: AnalysisResult = {
        status: 'official',
        floor: 'neutral',
        stage: 'L0',
        needsAgent: false,
        source: 'rules',
        flags: {
          hasCredentialField: false,
          claimedBrandIds: [],
          matchedOfficialBrandIds: official.brandIds,
        },
        signals: [],
        reasons: buildReasons(
          {
            status: 'official',
            signals: [],
            matchedOfficialBrandIds: official.brandIds,
            page,
          },
          brands,
        ),
        trace: [
          {
            stage: 'L0',
            message: 'Domain cocok dengan alamat resmi terverifikasi.',
            data: { via: official.via ?? 'registered' },
          },
        ],
        page,
        rulesVersion: resolved.rulesVersion,
      };
      return resolved.validateOutput ? AnalysisResultSchema.parse(result) : result;
    }

    const l1Signals = analyzeUrlSignals(parsed, index, resolved);
    let signals = l1Signals;
    let stage: AnalysisResult['stage'] = 'L1';
    let claimedBrandIds: string[] = [];
    const trace: TraceStep[] = l1Signals.map(signalTrace);

    if (input.features) {
      const parsedFeatures = PageFeaturesSchema.safeParse(input.features);
      if (!parsedFeatures.success) {
        trace.push({ stage: 'L2', message: 'fitur laman tidak valid' });
      } else {
        const features = parsedFeatures.data;
        const claims = detectBrandClaims(
          {
            title: features.title,
            headings: features.headings,
            siteName: features.siteName,
          },
          index,
          resolved,
        );
        claimedBrandIds = claims.map((claim) => claim.brandId);
        const l2Signals = analyzePageSignals({
          parsed,
          features,
          claims,
          l1Signals,
          index,
          config: resolved,
          domainAgeDays: input.context?.domainAgeDays,
        });
        signals = [...l1Signals, ...l2Signals];
        trace.push(...l2Signals.map(signalTrace));
        stage = 'L2';
      }
    }

    const score = scoreSignals(signals);
    trace.push(...score.trace);

    const hasCredentialField = signals.some((signal) => signal.id === 'CREDENTIAL_FIELD');
    const result: AnalysisResult = {
      status: score.status,
      floor: score.floor,
      stage,
      needsAgent: score.needsAgent,
      source: 'rules',
      flags: {
        hasCredentialField,
        claimedBrandIds,
        matchedOfficialBrandIds: [],
      },
      signals,
      reasons: buildReasons(
        {
          status: score.status,
          signals,
          matchedOfficialBrandIds: [],
          page,
        },
        brands,
      ),
      trace,
      page,
      rulesVersion: resolved.rulesVersion,
    };

    return resolved.validateOutput ? AnalysisResultSchema.parse(result) : result;
  }

  return {
    analyze,
    matchOfficial: (url: string) => matchOfficial(url, index),
  };
}
