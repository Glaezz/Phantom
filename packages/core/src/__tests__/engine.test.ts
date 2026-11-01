import { describe, expect, it } from 'vitest';
import { createEngine } from '../engine';
import { matchOfficial } from '../l0';
import { buildBrandIndex } from '../brands';
import { AnalysisResultSchema, type PageFeatures } from '../schemas';
import { fixtureBrands } from './fixtures/brands.fixture';
import { features, passwordForm } from './fixtures/page.fixture';

const engine = createEngine(fixtureBrands, { validateOutput: true });
const index = buildBrandIndex(fixtureBrands);

describe('engine end-to-end', () => {
  it('returns danger for a brand claim plus credential field', () => {
    const result = engine.analyze({
      url: 'https://bca-secure.my.id',
      features: features({
        title: 'Login BCA',
        forms: [passwordForm()],
      }),
    });
    expect(result.status).toBe('danger');
    expect(result.floor).toBe('danger');
    expect(result.needsAgent).toBe(false);
    expect(result.reasons.join(' ')).toContain('BCA');
  });

  it('keeps a lookalike blog neutral', () => {
    const result = engine.analyze({
      url: 'https://blog.example',
      features: features({ title: 'Cara Login KlikBCA di HP – Blogku' }),
    });
    expect(result.status).toBe('neutral');
  });

  it('keeps a portfolio on free hosting neutral without a brand claim', () => {
    const result = engine.analyze({
      url: 'https://portfolio.vercel.app',
      features: features({
        title: 'Portfolio Desainer',
        externalResources: [{ kind: 'img', url: 'https://www.bca.co.id/logo.png' }],
      }),
    });
    expect(result.status).toBe('neutral');
    expect(result.needsAgent).toBe(false);
  });

  it('keeps a brand claim on free hosting at caution without paging the agent', () => {
    const result = engine.analyze({
      url: 'https://blog.vercel.app',
      features: features({ title: 'BCA | Studi Kasus' }),
    });
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(false);
  });

  it('does not escalate a weak claim with a credential field alone', () => {
    const result = engine.analyze({
      url: 'https://blog.example',
      features: features({
        title: 'Cara Login KlikBCA di HP – Blogku',
        forms: [passwordForm()],
      }),
    });
    expect(result.status).toBe('neutral');
  });

  it('keeps a legitimate new startup neutral', () => {
    const result = engine.analyze({
      url: 'https://newstartup.io/login',
      features: features({ title: 'Masuk – NewStartup', forms: [passwordForm()] }),
    });
    expect(result.status).toBe('neutral');
  });

  it('returns caution for credentials posted to another domain', () => {
    const result = engine.analyze({
      url: 'https://login-xyz.top',
      features: features({
        title: 'Halaman Masuk',
        forms: [passwordForm('https://collector.biz.id/post')],
      }),
    });
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(true);
    expect(result.floor).toBe('neutral');
  });

  it('exempts a trusted OAuth form target', () => {
    const result = engine.analyze({
      url: 'https://shop.example',
      features: features({
        title: 'Masuk',
        forms: [passwordForm('https://accounts.google.com/o/oauth2/auth')],
      }),
    });
    expect(result.status).toBe('neutral');
  });

  it('does not treat common words as claims', () => {
    const result = engine.analyze({
      url: 'https://danapensiun.example',
      features: features({ title: 'Dana Pensiun Lembaga Keuangan', forms: [passwordForm()] }),
    });
    expect(result.status).toBe('neutral');
  });

  it('returns danger for an ambiguous brand with a context host', () => {
    const result = engine.analyze({
      url: 'https://dana-verif.xyz',
      features: features({
        title: 'DANA - Dompet Digital Indonesia',
        forms: [passwordForm()],
      }),
    });
    expect(result.status).toBe('danger');
  });

  it('detects hotlinked official assets', () => {
    const result = engine.analyze({
      url: 'https://shop.example',
      features: features({
        externalResources: [{ kind: 'img', url: 'https://www.bca.co.id/logo.png' }],
      }),
    });
    expect(result.signals).toContainEqual(
      expect.objectContaining({ id: 'HOTLINKS_OFFICIAL_ASSETS', brandId: 'bca' }),
    );
    expect(result.status).toBe('neutral');
  });

  it('returns L1-only caution without paging the agent', () => {
    const result = engine.analyze({ url: 'https://bca-login.my.id' });
    expect(result.status).toBe('caution');
    expect(result.stage).toBe('L1');
    expect(result.needsAgent).toBe(false);
  });

  it('returns official at L0', () => {
    const result = engine.analyze({ url: 'https://www.bca.co.id/id' });
    expect(result.status).toBe('official');
    expect(result.stage).toBe('L0');
    expect(result.flags.matchedOfficialBrandIds).toContain('bca');
  });

  it('adds NEW_DOMAIN to a C2 caution', () => {
    const result = engine.analyze({
      url: 'https://bca-login.my.id',
      features: features({ title: 'Halaman Masuk', forms: [passwordForm()] }),
      context: { domainAgeDays: 5 },
    });
    expect(result.status).toBe('caution');
    expect(result.signals).toContainEqual(expect.objectContaining({ id: 'NEW_DOMAIN' }));
  });

  it('rejects invalid features without throwing', () => {
    const invalid = {
      url: 'https://newstartup.io/login',
      title: 'Masuk',
      headings: [],
      siteName: null,
      forms: [{ action: null, method: 'get', fields: [{ type: 'password' }] }],
      externalResources: [],
    } as unknown as PageFeatures;

    const result = engine.analyze({ url: 'https://newstartup.io/login', features: invalid });
    expect(result.status).toBe('neutral');
    expect(result.trace.some((step) => step.message === 'fitur laman tidak valid')).toBe(true);
  });

  it('handles invalid URLs without throwing', () => {
    const result = engine.analyze({ url: 'not a url' });
    expect(result.status).toBe('neutral');
    expect(result.trace.some((step) => step.message === 'URL tidak dapat diperiksa')).toBe(true);
  });

  it('is deterministic', () => {
    const input = {
      url: 'https://bca-secure.my.id',
      features: features({ title: 'Login BCA', forms: [passwordForm()] }),
    };
    expect(engine.analyze(input)).toEqual(engine.analyze(input));
  });

  it('works when fetch throws', () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('network disabled');
    }) as typeof fetch;
    try {
      const result = engine.analyze({
        url: 'https://bca-secure.my.id',
        features: features({ title: 'Login BCA', forms: [passwordForm()] }),
      });
      expect(result.status).toBe('danger');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('validates every E2E result against the schema', () => {
    const cases = [
      { url: 'https://bca-secure.my.id', features: features({ title: 'Login BCA', forms: [passwordForm()] }) },
      { url: 'https://newstartup.io/login', features: features({ forms: [passwordForm()] }) },
      { url: 'https://www.bca.co.id' },
      { url: 'https://bca-login.my.id' },
    ];
    for (const input of cases) {
      expect(AnalysisResultSchema.safeParse(engine.analyze(input)).success).toBe(true);
    }
  });

  it('measures 1.000 analyses informally', () => {
    const perf = createEngine(fixtureBrands);
    const input = {
      url: 'https://bca-secure.my.id',
      features: features({ title: 'Login BCA', forms: [passwordForm()] }),
    };
    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) perf.analyze(input);
    const average = (performance.now() - start) / 1000;
    console.log(`rata-rata analyze L0-L2: ${average.toFixed(3)} ms`);
    expect(average).toBeLessThan(5);
  });
});

describe('matchOfficial', () => {
  it('matches registered domains and exact hosts', () => {
    expect(matchOfficial('https://www.bca.co.id/id', index)).toEqual(
      expect.objectContaining({ matched: true, brandIds: ['bca'], via: 'registered' }),
    );
    expect(matchOfficial('https://accounts.google.com/x', index)).toEqual(
      expect.objectContaining({ matched: true, brandIds: ['google_oauth'], via: 'registered' }),
    );
  });

  it('does not match lookalikes or shared content paths', () => {
    expect(matchOfficial('https://bca.co.id.evil.com', index).matched).toBe(false);
    expect(matchOfficial('https://sites.google.com/site/x', index).matched).toBe(false);
    expect(matchOfficial('https://docs.google.com/forms/d/e/x/viewform', index).matched).toBe(false);
  });

  it('returns every brand that owns a shared domain', () => {
    const match = matchOfficial('https://shopee.co.id', index);
    expect(match.brandIds).toEqual(expect.arrayContaining(['shopee', 'shopeepay']));
  });
});
