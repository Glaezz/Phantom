import { analyze, type AnalysisResult } from '@phantom/core';
import { extractFeatures } from './extractFeatures';

export function analyzeCurrentPage(): AnalysisResult {
  // L0–L2 murni dan deterministik (ARC-03); aman dijalankan langsung di content script tanpa jaringan.
  // PageFeatures diekstrak dari DOM (ARC-02) dan divalidasi ulang oleh core (PageFeaturesSchema).
  return analyze({ url: location.href, features: extractFeatures() });
}

