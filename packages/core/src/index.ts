import brandsData from './data/brands.json';

export interface Brand {
  id: string;
  name: string;
  category: string;
  officialDomains: string[];
  officialPhones: string[];
  keywords: string[];
  ambiguousToken: boolean;
}

export const BRANDS: Brand[] = brandsData as Brand[];

export function isOfficialDomain(hostname: string): boolean {
  return BRANDS.some(brand => 
    brand.officialDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  );
}