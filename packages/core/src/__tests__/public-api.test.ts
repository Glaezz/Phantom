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

  it('recognizes Meta impersonation without assets as caution', () => {
    const result = analyze({
      url: 'https://secureprofiles2026-indol.vercel.app/required.html',
      features: features({ title: 'Meta | Community Standards' }),
    });
    expect(result.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'BRAND_CLAIM_UNOFFICIAL_DOMAIN', brandId: 'meta' }),
    ]));
    expect(result.status).toBe('caution');
    expect(engine.matchOfficial('https://www.meta.com').matched).toBe(true);
    expect(engine.matchOfficial('https://www.facebook.com').matched).toBe(true);
    expect(engine.matchOfficial('https://someone.facebook.com').matched).toBe(false);
  });

  it('flags a Meta claim on free hosting with official hotlinked assets', () => {
    const result = analyze({
      url: 'https://secureprofiles2026-indol.vercel.app/careers.html',
      features: features({
        title: 'Meta | Request Review',
        externalResources: [{ kind: 'img', url: 'https://www.google.com/logo.png' }],
      }),
    });
    expect(result.signals.map((signal) => signal.id)).toEqual(expect.arrayContaining([
      'BRAND_CLAIM_UNOFFICIAL_DOMAIN', 'FREE_SUBDOMAIN_PLATFORM', 'HOTLINKS_OFFICIAL_ASSETS',
    ]));
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(true);
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
