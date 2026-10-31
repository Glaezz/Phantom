import type { FieldFeature, PageFeatures } from '../../schemas';

export function field(overrides: Partial<FieldFeature> = {}): FieldFeature {
  return {
    type: 'text',
    name: null,
    id: null,
    autocomplete: null,
    placeholder: null,
    ...overrides,
  };
}

export function passwordField(): FieldFeature {
  return field({ type: 'password', name: 'password' });
}

export function features(overrides: Partial<PageFeatures> = {}): PageFeatures {
  return {
    url: 'https://example.test/',
    title: '',
    headings: [],
    siteName: null,
    forms: [],
    externalResources: [],
    ...overrides,
  };
}

export function passwordForm(action: string | null = null) {
  return {
    action,
    method: 'post' as const,
    fields: [passwordField()],
  };
}
