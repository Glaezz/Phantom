import { isCredentialField, type PageFeatures } from '@phantom/core';

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

// Field yang tidak pernah menjelaskan tujuan data; disamakan dengan ekstraktor proxy.
const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'checkbox',
  'radio',
  'file',
  'image',
  'reset',
]);

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

function formLabels(): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | null | undefined) => {
    const cleaned = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!cleaned || seen.has(cleaned) || labels.length >= 30) return;
    seen.add(cleaned);
    labels.push(cleaned);
  };

  for (const el of document.querySelectorAll('label, legend, [role="heading"]')) {
    add(el.textContent);
  }
  for (const el of document.querySelectorAll('input[aria-label], select[aria-label], textarea[aria-label]')) {
    add(el.getAttribute('aria-label'));
  }

  return labels;
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
  const forms: PageFeatures['forms'] = formEls.map((form) => {
    const inputs = Array.from(form.querySelectorAll('input, select, textarea')).slice(0, 30);
    return {
      action: form.getAttribute('action')?.slice(0, 2048) ?? null,
      method: (form.getAttribute('method') ?? 'get').toLowerCase() === 'post' ? ('post' as const) : ('get' as const),
      fields: inputs.map(fieldFeature),
    };
  });

  // Login berbasis div + JavaScript tidak punya <form>, jadi kolomnya dulu tidak terlihat.
  // Dikumpulkan sebagai form semu dengan tujuan tidak diketahui (action null → "same"),
  // supaya tidak ada bukti lintas domain yang dikarang (CORE-09).
  if (forms.length < 10) {
    const fields: PageFeatures['forms'][number]['fields'] = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.closest('form')) continue;
      const type = (el.getAttribute('type') ?? '').trim().toLowerCase() || 'text';
      if (IGNORED_INPUT_TYPES.has(type)) continue;
      fields.push(fieldFeature(el));
      if (fields.length >= 30) break;
    }
    const detachedFields = fields.filter((f) => isCredentialField(f));
    if (detachedFields.length > 0) {
      forms.push({ action: null, method: 'post', detached: true, fields: detachedFields });
    }
  }


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

  return { url, title, headings, siteName, formLabels: formLabels(), forms, externalResources };
}

export { SENSITIVE_SELECTOR };
