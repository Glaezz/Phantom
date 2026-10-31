import { describe, expect, it } from 'vitest';
import { buildBrandIndex } from '../brands';
import { detectBrandClaims } from '../claims';
import { DEFAULT_CONFIG } from '../config';
import { fixtureBrands } from './fixtures/brands.fixture';

const index = buildBrandIndex(fixtureBrands);

function claims(title: string, headings: string[] = [], siteName: string | null = null) {
  return detectBrandClaims({ title, headings, siteName }, index, DEFAULT_CONFIG);
}

describe('brand claims', () => {
  it('detects a strong leading claim', () => {
    expect(claims('Login BCA')).toContainEqual(
      expect.objectContaining({ brandId: 'bca', strength: 'strong' }),
    );
  });

  it('detects a weak claim elsewhere in the title', () => {
    expect(claims('Cara Login KlikBCA di HP – Blogku')).toContainEqual(
      expect.objectContaining({ brandId: 'bca', strength: 'weak' }),
    );
  });

  it('detects an exact ambiguous claim', () => {
    expect(claims('DANA - Dompet Digital Indonesia')).toContainEqual(
      expect.objectContaining({ brandId: 'dana', strength: 'strong' }),
    );
  });

  it('does not treat a common word as an ambiguous claim', () => {
    expect(claims('Dana Pensiun Lembaga Keuangan')).toEqual([]);
  });

  it('detects a siteName claim', () => {
    expect(claims('', [], 'Bank Mandiri')).toContainEqual(
      expect.objectContaining({ brandId: 'mandiri', strength: 'strong' }),
    );
  });

  it('detects a weak in-title token', () => {
    expect(claims('Pay with BCA')).toContainEqual(
      expect.objectContaining({ brandId: 'bca', strength: 'weak' }),
    );
  });
});
