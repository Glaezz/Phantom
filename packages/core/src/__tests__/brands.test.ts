import { describe, expect, it } from 'vitest';
import brandsData from '../data/brands.json';
import { loadBrands, validateBrandDb } from '../brands';
import { fixtureBrands } from './fixtures/brands.fixture';

describe('brand database', () => {
  it('loads and validates the shipped brands.json', () => {
    const brands = loadBrands(brandsData);
    expect(brands.length).toBeGreaterThanOrEqual(54);
    expect(validateBrandDb(brands)).toEqual([]);
    expect(brands.some((brand) => brand.demo)).toBe(true);
  });

  it('loads and validates the test fixture', () => {
    expect(validateBrandDb(fixtureBrands)).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const brands = loadBrands([
      ...brandsData,
      (brandsData as { id: string }[])[0],
    ]);
    expect(validateBrandDb(brands).some((issue) => issue.includes('duplicate brand id'))).toBe(
      true,
    );
  });

  it('reports shared content platforms in officialDomains', () => {
    const brands = loadBrands([
      {
        ...fixtureBrands[0],
        id: 'bad_google',
        officialDomains: ['google.com'],
      },
    ]);
    expect(validateBrandDb(brands).some((issue) => issue.includes('shared content platform'))).toBe(
      true,
    );
  });
});
