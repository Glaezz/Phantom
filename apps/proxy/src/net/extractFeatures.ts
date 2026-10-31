import { PageFeaturesSchema, parseUrl, type PageFeatures } from '@phantom/core';
import { cleanText } from '../util/sanitize';

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

type FormDraft = PageFeatures['forms'][number];

function attr(element: Element, name: string, maxLength: number): string | null {
  const value = element.getAttribute(name);
  if (value === null) return null;
  return cleanText(value, maxLength) || null;
}

export async function extractFeatures(html: string, pageUrl: string): Promise<PageFeatures> {
  let title = '';
  let siteName: string | null = null;
  const headings: string[] = [];
  const forms: FormDraft[] = [];
  const resources: PageFeatures['externalResources'] = [];

  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return {
      url: pageUrl.slice(0, 2048),
      title: '',
      headings: [],
      siteName: null,
      forms: [],
      externalResources: [],
    };
  }

  const pageParsed = parseUrl(page.href);
  const pageRegisteredDomain = pageParsed.ok ? pageParsed.registeredDomain : null;
  const formStack: FormDraft[] = [];
  let pseudoForm: FormDraft | null = null;

  const addResource = (kind: PageFeatures['externalResources'][number]['kind'], raw: string | null) => {
    if (!raw || resources.length >= 50) return;
    let absolute: URL;
    try {
      absolute = new URL(raw, page);
    } catch {
      return;
    }
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return;

    const parsed = parseUrl(absolute.href);
    if (!parsed.ok) return;
    const sameDomain =
      pageRegisteredDomain !== null
        ? parsed.registeredDomain === pageRegisteredDomain
        : parsed.registeredDomain === null && parsed.hostname === page.hostname.toLowerCase();
    if (sameDomain) return;

    const href = absolute.href;
    if (resources.some((resource) => resource.url === href)) return;
    resources.push({ kind, url: href.slice(0, 2048) });
  };

  let currentHeading: string | null = null;

  try {
    await new HTMLRewriter()
      .on('title', {
        text(text) {
          if (title.length < 400) title += text.text;
        },
      })
      .on('meta', {
        element(element) {
          const property = element.getAttribute('property');
          if (property?.toLowerCase() === 'og:site_name') {
            siteName = attr(element, 'content', 200);
          }
        },
      })
      .on('h1', {
        element(element) {
          currentHeading = '';
          element.onEndTag(() => {
            const value = cleanText(currentHeading ?? '', 200);
            if (value && headings.length < 5) headings.push(value);
            currentHeading = null;
          });
        },
        text(text) {
          if (currentHeading !== null) currentHeading += text.text;
        },
      })
      .on('form', {
        element(element) {
          const action = element.getAttribute('action');
          const method = (element.getAttribute('method') ?? 'get').toLowerCase() === 'post' ? 'post' : 'get';
          const form: FormDraft = {
            action: action === null ? null : action.slice(0, 2048),
            method,
            fields: [],
          };
          if (forms.length < 10) forms.push(form);
          formStack.push(form);
          element.onEndTag(() => {
            formStack.pop();
          });
        },
      })
      .on('input', {
        element(element) {
          const type = (element.getAttribute('type') ?? 'text').trim().toLowerCase() || 'text';
          if (IGNORED_INPUT_TYPES.has(type)) return;

          const form = formStack.at(-1);
          let target = form ?? pseudoForm;
          if (!target) {
            target = { action: null, method: 'get', fields: [] };
            pseudoForm = target;
            if (forms.length < 10) forms.push(target);
          }
          if (target.fields.length >= 30) return;

          target.fields.push({
            type: cleanText(type, 64) || 'text',
            name: attr(element, 'name', 200),
            id: attr(element, 'id', 200),
            autocomplete: attr(element, 'autocomplete', 200),
            placeholder: attr(element, 'placeholder', 200),
          });
        },
      })
      .on('script[src]', {
        element(element) {
          addResource('script', element.getAttribute('src'));
        },
      })
      .on('img[src]', {
        element(element) {
          addResource('img', element.getAttribute('src'));
        },
      })
      .on('iframe[src]', {
        element(element) {
          addResource('iframe', element.getAttribute('src'));
        },
      })
      .on('link[href]', {
        element(element) {
          const rel = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
          if (!rel.includes('stylesheet') && !rel.includes('icon')) return;
          addResource('link', element.getAttribute('href'));
        },
      })
      .transform(new Response(html))
      .text();
  } catch {
    // Broken or unparseable HTML: return whatever could be collected.
  }

  const candidate: PageFeatures = {
    url: page.href.slice(0, 2048),
    title: cleanText(title, 200),
    headings: headings.slice(0, 5),
    siteName,
    forms: forms.slice(0, 10),
    externalResources: resources.slice(0, 50),
  };

  const parsed = PageFeaturesSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  return {
    url: page.href.slice(0, 2048),
    title: cleanText(title, 200),
    headings: [],
    siteName: null,
    forms: [],
    externalResources: [],
  };
}
