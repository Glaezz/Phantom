import { describe, expect, it } from 'vitest';
import brandsData from '../data/brands.json';
import { loadBrands } from '../brands';
import { createEngine } from '../engine';
import { deriveL3Steps, deriveL4Steps } from '../proxy-contracts';
import { features, passwordForm } from './fixtures/page.fixture';

// Regresi dari laporan: halaman phishing Roblox lolos sebagai Netral karena
// Roblox belum ada di brands.json, dan kolom sandi di luar <form> tidak terbaca.
const engine = createEngine(loadBrands(brandsData), { validateOutput: true });

describe('shipped brands', () => {
  it('marks the official Roblox domain official', () => {
    const result = engine.analyze({ url: 'https://www.roblox.com/login' });
    expect(result.status).toBe('official');
  });

  it('marks a Roblox lookalike with a password field dangerous', () => {
    const result = engine.analyze({
      url: 'https://www.roblox.com.et/users/1413971851/profile',
      features: features({
        url: 'https://www.roblox.com.et/users/1413971851/profile',
        title: 'Login to Roblox',
        headings: ['Login to Roblox'],
        forms: [passwordForm()],
      }),
    });
    expect(result.status).toBe('danger');
    expect(result.needsAgent).toBe(false);
  });

  it('keeps a Roblox page without credentials neutral', () => {
    const result = engine.analyze({
      url: 'https://www.roblox.com.et/users/1413971851/profile',
      features: features({ title: 'Login to Roblox', headings: ['Login to Roblox'] }),
    });
    expect(result.status).toBe('caution');
    expect(result.needsAgent).toBe(false);
  });
});

describe('credentials outside a form', () => {
  it('flags a detached password field without inventing a cross-domain target', () => {
    const result = engine.analyze({
      url: 'https://login-xyz.top',
      features: features({
        url: 'https://login-xyz.top',
        forms: [{ action: null, method: 'post', detached: true, fields: passwordForm().fields }],
      }),
    });
    expect(result.flags.hasCredentialField).toBe(true);
    expect(result.signals.map((signal) => signal.id)).toContain('CREDENTIAL_FIELD');
    expect(result.signals.map((signal) => signal.id)).not.toContain('FORM_CROSS_DOMAIN');
  });
});

describe('deep check disabled', () => {
  it('explains the skip instead of claiming the check was unavailable', () => {
    for (const step of [
      deriveL3Steps([], 'deepCheckDisabled')[0],
      deriveL4Steps(null, 'deepCheckDisabled')[0],
    ]) {
      expect(step?.data).toMatchObject({ available: false, skippedBy: 'consent' });
    }
    expect(deriveL3Steps([], 'deepCheckDisabled')[0]?.stage).toBe('L3');
    expect(deriveL4Steps(null, 'deepCheckDisabled')[0]?.stage).toBe('L4');
  });
});
