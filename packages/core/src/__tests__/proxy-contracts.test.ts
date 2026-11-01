import { describe, expect, it } from 'vitest';
import { createEngine } from '../engine';
import { AnalyzeResponseSchema, deriveL3Steps, deriveL4Steps, mergeProxyResult, needsDeepCheck } from '../proxy-contracts';
import type { AnalysisResult } from '../schemas';
import { fixtureBrands } from './fixtures/brands.fixture';
import { features, passwordForm } from './fixtures/page.fixture';

const engine = createEngine(fixtureBrands);

function analysis(url: string, page = features({ url })): AnalysisResult {
  return engine.analyze({ url, features: page });
}

describe('proxy contracts', () => {
  it('validates the proxy L3 trace contract, not raw RDAP entries', () => {
    const result = analysis('https://example.test/');
    const response = { result, final: { status: result.status, source: 'rules', capped: false } };
    const l3 = deriveL3Steps([{ domain: 'example.test', ageDays: 4 }]);
    expect(AnalyzeResponseSchema.parse({ ...response, l3 }).l3).toEqual(l3);
    expect(AnalyzeResponseSchema.safeParse({ ...response, l3: [{ domain: 'example.test', ageDays: 4 }] }).success).toBe(false);
  });
  it('keeps the worse of local floor and remote verdict', () => {
    const local = analysis(
      'https://login-xyz.my.id/',
      features({
        url: 'https://login-xyz.my.id/',
        title: 'Login BCA',
        forms: [passwordForm('https://collector.biz.id/post')],
      }),
    );
    expect(local.status).toBe('danger');
    expect(local.floor).toBe('danger');

    const lowered = mergeProxyResult(local, { final: { status: 'neutral', source: 'agent', capped: false } });
    expect(lowered).toBe('danger');

    const caution = analysis(
      'https://login-xyz.my.id/',
      features({ url: 'https://login-xyz.my.id/', forms: [passwordForm()] }),
    );
    expect(caution.status).toBe('caution');
    expect(caution.floor).toBe('neutral');
    expect(
      mergeProxyResult(caution, { final: { status: 'danger', source: 'agent', capped: false } }),
    ).toBe('danger');
  });

  it('never downgrades an official page', () => {
    const official = analysis('https://bca.co.id/', features({ url: 'https://bca.co.id/' }));
    expect(official.status).toBe('official');
    expect(
      mergeProxyResult(official, { final: { status: 'danger', source: 'agent', capped: false } }),
    ).toBe('official');
  });

  it('asks the proxy for caution pages needing investigation', () => {
    expect(needsDeepCheck(analysis('https://example.test/', features({ url: 'https://example.test/' })))).toBe(
      false,
    );
    const risky = analysis(
      'https://login-xyz.my.id/',
      features({
        url: 'https://login-xyz.my.id/',
        forms: [passwordForm('https://collector.biz.id/post')],
      }),
    );
    expect(risky.status).toBe('caution');
    expect(needsDeepCheck(risky)).toBe(true);
    const imitation = analysis(
      'https://help.vercel.app/',
      features({
        title: 'BCA | Konfirmasi',
        externalResources: [{ kind: 'img', url: 'https://www.bca.co.id/logo.png' }],
      }),
    );
    expect(imitation.status).toBe('caution');
    expect(needsDeepCheck(imitation)).toBe(true);
  });

  it('derives L3 and L4 rows, including the cache skip', () => {
    const l3 = deriveL3Steps([{ domain: 'login-xyz.test', ageDays: 4 }, { domain: 'x.test', ageDays: null }]);
    expect(l3).toHaveLength(2);
    expect(l3[0]).toMatchObject({ stage: 'L3', data: { ageDays: 4 } });
    expect(l3[1]).toMatchObject({ stage: 'L3', data: { available: false } });

    const cached = deriveL4Steps(null, 'cacheHit');
    expect(cached[0]).toMatchObject({ stage: 'L4', data: { tool: 'cache' } });

    const ran = deriveL4Steps({ used: true, provider: 'gemini', model: 'g', verdict: 'danger' });
    expect(ran[0]).toMatchObject({ stage: 'L4', data: { verdict: 'danger' } });
  });
});
