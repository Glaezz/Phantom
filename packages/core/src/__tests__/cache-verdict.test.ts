import { describe, expect, it } from 'vitest';
import { cacheKey, normalizeUrlForCache } from '../cache-key';
import { mergeVerdict } from '../verdict';
import type { AgentVerdict, AnalysisResult } from '../schemas';

describe('cache key normalization', () => {
  it('lowercases the host, preserves path case, and keeps the full path and query', () => {
    expect(normalizeUrlForCache('https://Bank-X.my.id/Login/verify/abc?token=1#x')).toBe(
      'bank-x.my.id/Login/verify/abc?token=1',
    );
  });

  it('keeps every path segment and strips www', () => {
    expect(normalizeUrlForCache('https://www.example.com/a/b/c/d')).toBe('example.com/a/b/c/d');
  });

  it('keeps long opaque segments instead of masking them', () => {
    expect(normalizeUrlForCache('https://example.com/reset/1234567890abcdef1234')).toBe(
      'example.com/reset/1234567890abcdef1234',
    );
  });

  it('sorts query parameters without dropping them', () => {
    expect(normalizeUrlForCache('https://example.com/a?b=2&a=1')).toBe(
      'example.com/a?a=1&b=2',
    );
  });

  it('treats root and empty paths the same', () => {
    expect(normalizeUrlForCache('https://example.com')).toBe('example.com/');
    expect(normalizeUrlForCache('https://example.com/')).toBe('example.com/');
  });

  it('returns an empty string for invalid URLs', () => {
    expect(normalizeUrlForCache('not a url')).toBe('');
  });
});

describe('cacheKey', () => {
  it('hashes normalized URLs to lowercase hex and keeps query differences', async () => {
    const a = await cacheKey('https://example.com/a?x=1');
    const b = await cacheKey('https://example.com/a?x=2');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats reordered query parameters as the same key', async () => {
    const a = await cacheKey('https://example.com/a?b=2&a=1');
    const b = await cacheKey('https://example.com/a?a=1&b=2');
    expect(a).toBe(b);
  });

  it('rejects invalid URLs', async () => {
    await expect(cacheKey('not a url')).rejects.toThrow('invalid-url');
  });
});

function rule(status: AnalysisResult['status'], floor: AnalysisResult['floor']): AnalysisResult {
  return {
    status,
    floor,
    stage: 'L2',
    needsAgent: false,
    source: 'rules',
    flags: { hasCredentialField: true, claimedBrandIds: [], matchedOfficialBrandIds: [] },
    signals: [],
    reasons: [],
    trace: [],
    page: { url: 'https://example.test/', hostname: 'example.test', registeredDomain: 'example.test' },
    rulesVersion: '1.0.0',
  };
}

function agent(
  verdict: AgentVerdict['verdict'],
  evidenceRefs: string[] = [],
): AgentVerdict {
  return { verdict, confidence: 0.8, reasons: [], evidenceRefs };
}

describe('mergeVerdict', () => {
  it('never lowers a danger floor', () => {
    expect(mergeVerdict(rule('danger', 'danger'), agent('neutral'))).toEqual({
      status: 'danger',
      source: 'rules',
      capped: false,
    });
  });

  it('lets the agent lower a caution with a neutral floor', () => {
    expect(mergeVerdict(rule('caution', 'neutral'), agent('neutral'))).toEqual({
      status: 'neutral',
      source: 'agent',
      capped: false,
    });
  });

  it('caps danger without evidence', () => {
    expect(mergeVerdict(rule('caution', 'neutral'), agent('danger', []))).toEqual({
      status: 'caution',
      source: 'rules',
      capped: true,
    });
  });

  it('accepts danger with evidence', () => {
    expect(mergeVerdict(rule('caution', 'neutral'), agent('danger', ['form_target']))).toEqual({
      status: 'danger',
      source: 'agent',
      capped: false,
    });
  });

  it('keeps official verdicts', () => {
    expect(mergeVerdict(rule('official', 'neutral'), agent('danger', ['x']))).toEqual({
      status: 'official',
      source: 'rules',
      capped: false,
    });
  });

  it('returns the rule verdict when the agent is null', () => {
    expect(mergeVerdict(rule('caution', 'neutral'), null)).toEqual({
      status: 'caution',
      source: 'rules',
      capped: false,
    });
  });
});
