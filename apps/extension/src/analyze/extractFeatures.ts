import type { PageFeatures } from '@phantom/core';

const SENSITIVE_SELECTOR =
  'input[type="password"], input[autocomplete="one-time-code"], input[autocomplete="current-password"]';

function resourceKind(el: Element): 'script' | 'img' | 'link' | 'iframe' | null {
  switch (el.tagName.toLowerCase()) {
    case 'script':
      return 'script';
    case 'img':
      return 'img';
    case 'link':
      return 'link';
    case 'iframe':
      return 'iframe';
    default:
      return null;
  }
}

function resourceUrl(el: Element): string | null {
  if (el.tagName.toLowerCase() === 'link') return el.getAttribute('href');
  return el.getAttribute('src');
}

// ARC-06: hanya atribut elemen, tidak pernah membaca .value.
function fieldFeature(el: Element): PageFeatures['forms'][number]['fields'][number] {
  return {
    type: (el.getAttribute('type') ?? '').slice(0, 64),
    name: el.getAttribute('name')?.slice(0, 200) ?? null,
    id: el.getAttribute('id')?.slice(0,200) ?? null,
    autocomplete: el.getAttribute('autocomplete')?.slice(0, 200) ?? null,
    placeholder: el.getAttribute('placeholder')?.slice(0, 200) ?? null,
  };
}

// CORE-02/L2 memakai PageFeatures JSON murni (ARC-02). Di sini ekstraksi dari DOM asli.
export function extractFeatures(): PageFeatures {
  const url = location.href.slice(0, 2048);

  const title = document.title.slice(0, 200);

  const headings = Array.from(document.querySelectorAll('h1'))
    .slice(0, 5)
    .map((el) => (el.textContent ?? '').trim().slice(0, 200));

  const siteName =
    (document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ??
      document.querySelector('meta[name="application-name"]')?.getAttribute('content') ??
      null)
      ?.slice(0, 200) ?? null;

  const formEls = Array.from(document.querySelectorAll('form')).slice(0, 10);
  const forms = formEls.map((form) => {
    const inputs = Array.from(form.querySelectorAll('input, select, textarea')).slice(0, 30);
    return {
      action: form.getAttribute('action')?.slice(0, 2048) ?? null,
      method: (form.getAttribute('method') ?? 'get').toLowerCase() === 'post' ? ('post' as const) : ('get' as const),
      fields: inputs.map(fieldFeature),
    };
  });

  const externalResources = Array.from(
    document.querySelectorAll('script[src], img[src], link[href], iframe[src]'),
  )
    .map((el) => {
      const kind = resourceKind(el);
      const url = resourceUrl(el);
      if (!kind || !url) return null;
      return { kind, url: url.slice(0, 2048) };
    })
    .filter((r): r is PageFeatures['externalResources'][number] => r !== null)
    .slice(0, 50);

  return { url, title, headings, siteName, forms, externalResources };
}

export { SENSITIVE_SELECTOR };
