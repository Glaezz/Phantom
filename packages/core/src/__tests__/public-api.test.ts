import { describe, expect, it } from 'vitest';
import {
  BRANDS,
  AgentVerdictSchema,
  AnalysisResultSchema,
  PageFeaturesSchema,
  analyze,
  cacheKey,
  engine,
  mergeVerdict,
  validateBrandDb,
} from '../index';
import { passwordForm, features } from './fixtures/page.fixture';

describe('public API', () => {
  it('loads the shipped brand database through the default engine', () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(55);
    expect(validateBrandDb(BRANDS)).toEqual([]);

    const result = analyze({
      url: 'https://bca-secure.my.id',
      features: features({ title: 'Login BCA', forms: [passwordForm()] }),
    });
    expect(result.status).toBe('danger');
    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
    expect(engine.matchOfficial('https://www.bca.co.id').matched).toBe(true);
    expect(AgentVerdictSchema.safeParse({ verdict: 'official' }).success).toBe(false);
    expect(
      PageFeaturesSchema.safeParse({
        url: 'https://x.test/',
        title: '',
        headings: [],
        siteName: null,
        forms: [],
        externalResources: [],
      }).success,
    ).toBe(true);
  });

  it('exposes cache and verdict helpers', async () => {
    expect(await cacheKey('https://example.com/a')).toMatch(/^[0-9a-f]{64}$/);
    expect(
      mergeVerdict(
        analyze({ url: 'https://newstartup.io/login' }),
        null,
      ),
    ).toEqual({ status: 'neutral', source: 'rules', capped: false });
  });
});
