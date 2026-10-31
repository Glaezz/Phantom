import brandsData from './data/brands.json';
import { loadBrands, validateBrandDb } from './brands';
import { createEngine, type AnalyzeInput, type Engine } from './engine';
import type { AnalysisResult, Brand } from './schemas';

export {
  AgentVerdictSchema,
  AnalysisResultSchema,
  BrandSchema,
  PageFeaturesSchema,
} from './schemas';
export type {
  AgentVerdict,
  AnalysisResult,
  Brand,
  FieldFeature,
  FormFeature,
  PageFeatures,
  SignalHit,
  SignalId,
  Status,
  TraceStep,
} from './schemas';

export { loadBrands, validateBrandDb };
export { createEngine };
export type { AnalyzeInput, Engine };

export { normalizeUrlForCache, cacheKey } from './cache-key';
export { mergeVerdict } from './verdict';
export type { MergedVerdict } from './verdict';
export type { OfficialMatch } from './l0';

export type {
  CacheRecord,
  CacheStore,
  DomainAgeLookup,
  LlmMessage,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmToolDef,
  PageFetcher,
} from './interfaces';

export * from './config';

export const BRANDS: Brand[] = loadBrands(brandsData);
export const engine: Engine = createEngine(BRANDS);

export function analyze(input: AnalyzeInput): AnalysisResult {
  return engine.analyze(input);
}
