import { describe, expect, it } from 'vitest';
import brandsData from '../data/brands.json';
import { loadBrands } from '../brands';
import { createEngine } from '../engine';
import { features, passwordForm } from './fixtures/page.fixture';

const engine = createEngine(loadBrands(brandsData), { validateOutput: true });

const GOOGLE_FORM =
  'https://docs.google.com/forms/d/e/1FAIpQLSfUurZ18mOExxQmXffCi3taX4osGHHCC0RIXkQ-O214S-XWZA/viewform';

function form(url = GOOGLE_FORM) {
  return features({
    url,
    title: 'Formulir Pendaftaran',
    formLabels: ['Nama lengkap', 'Email'],
  });
}

describe('Google shared content', () => {
  it.each([
    'https://www.google.com/search?q=phantom',
    'https://gemini.google.com/app',
    'https://accounts.google.com/v3/signin',
    'https://docs.google.com/document/d/abc/edit',
  ])('keeps %s official', (url) => {
    expect(engine.analyze({ url }).status).toBe('official');
  });

  it('does not treat a Google Form as an official Google page', () => {
    const url = GOOGLE_FORM;
    expect(engine.analyze({ url }).status).not.toBe('official');
    expect(engine.analyze({ url }).signals.map((signal) => signal.id)).toContain(
      'SHARED_CONTENT_FORM',
    );
  });

  it('routes a Google Form with a password label to the agent', () => {
    const url = GOOGLE_FORM;
    const result = engine.analyze({
      url,
      features: features({
        url,
        title: 'Bagi-Bagi Diamond',
        formLabels: ['Password', 'Nama akun'],
      }),
    });
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(true);
    expect(result.signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(['SHARED_CONTENT_FORM', 'CREDENTIAL_TEXT']),
    );
  });

  it('keeps a Google Form without credential labels neutral', () => {
    expect(engine.analyze({ url: form().url, features: form() }).status).toBe('neutral');
  });

  it('handles a forms.gle link without treating it as official', () => {
    const url = 'https://forms.gle/abc123';
    const result = engine.analyze({
      url,
      features: features({
        url,
        title: 'Formulir',
        formLabels: ['Kata sandi'],
      }),
    });
    expect(engine.analyze({ url }).status).not.toBe('official');
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(true);
  });

  it('keeps a Google Site without credential labels neutral', () => {
    const url = 'https://sites.google.com/site/contoh';
    expect(engine.analyze({ url }).status).toBe('neutral');
    expect(engine.analyze({ url }).status).not.toBe('official');
  });
});

describe('startup policy', () => {
  it('keeps a same-domain credential form neutral', () => {
    const result = engine.analyze({
      url: 'https://newstartup.io/login',
      features: features({
        url: 'https://newstartup.io/login',
        title: 'Masuk - NewStartup',
        forms: [passwordForm()],
      }),
    });
    expect(result.status).toBe('neutral');
    expect(result.needsAgent).toBe(false);
  });

  it('does not treat a generic host label as an unknown brand claim', () => {
    const result = engine.analyze({
      url: 'https://mail.acme.co.uk/login',
      features: features({ title: 'Mail', headings: ['Mail'] }),
    });
    expect(result.status).toBe('neutral');
  });

  it('does not use a new-domain signal to page the agent by itself', () => {
    const result = engine.analyze({
      url: 'https://newstartup.io/login',
      features: features({ forms: [passwordForm()] }),
      context: { domainAgeDays: 2 },
    });
    expect(result.status).toBe('neutral');
    expect(result.needsAgent).toBe(false);
  });
});
