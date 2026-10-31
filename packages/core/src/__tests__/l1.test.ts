import { describe, expect, it } from 'vitest';
import { buildBrandIndex } from '../brands';
import { DEFAULT_CONFIG } from '../config';
import { analyzeUrlSignals } from '../l1';
import type { SignalId } from '../schemas';
import { parseUrl } from '../url';
import { fixtureBrands } from './fixtures/brands.fixture';

const index = buildBrandIndex(fixtureBrands);

function signals(url: string) {
  return analyzeUrlSignals(parseUrl(url), index, DEFAULT_CONFIG);
}

function ids(url: string): SignalId[] {
  return signals(url).map((signal) => signal.id);
}

const IMITATION: SignalId[] = [
  'TYPOSQUAT',
  'HOMOGLYPH',
  'BRAND_TOKEN_IN_HOST',
  'SAME_LABEL_DIFFERENT_SUFFIX',
];

describe('L1 URL signals', () => {
  it('finds a brand token and a cheap suffix', () => {
    const found = signals('https://bca-login.my.id');
    expect(found).toContainEqual(
      expect.objectContaining({ id: 'BRAND_TOKEN_IN_HOST', brandId: 'bca' }),
    );
    expect(found).toContainEqual(expect.objectContaining({ id: 'CHEAP_TLD' }));
  });

  it('finds the same label with a different suffix', () => {
    expect(ids('https://klikbca.co')).toContain('SAME_LABEL_DIFFERENT_SUFFIX');
  });

  it('finds a typosquat', () => {
    expect(signals('https://bankmandirl.co.id')).toContainEqual(
      expect.objectContaining({ id: 'TYPOSQUAT', brandId: 'mandiri' }),
    );
  });

  it('does not flag bca.com without a context token', () => {
    expect(ids('https://bca.com').filter((id) => IMITATION.includes(id))).toEqual([]);
  });

  it('finds Cyrillic homoglyphs and punycode', () => {
    const found = ids('https://b\u0441a.com/');
    expect(found).toContain('HOMOGLYPH');
    expect(found).toContain('PUNYCODE');
  });

  it('does not flag an ambiguous brand without a context token', () => {
    expect(ids('https://dana.example.com')).toEqual([]);
  });

  it('flags an ambiguous brand with a context token', () => {
    const found = signals('https://dana-login.xyz');
    expect(found).toContainEqual(
      expect.objectContaining({ id: 'BRAND_TOKEN_IN_HOST', brandId: 'dana' }),
    );
    expect(ids('https://dana-login.xyz')).toContain('CHEAP_TLD');
  });

  it('detects URL shorteners, IP hosts, and clean hosts', () => {
    expect(ids('https://bit.ly/abc')).toContain('URL_SHORTENER');
    expect(ids('http://203.0.113.5/bca')).toContain('IP_HOST');
    expect(ids('https://newstartup.io/login')).toEqual([]);
  });
});
