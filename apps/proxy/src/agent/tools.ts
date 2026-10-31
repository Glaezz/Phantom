import {
  BRANDS,
  findBrands,
  isCredentialField,
  parseUrl,
  resolveFormTarget,
  type AnalysisResult,
  type Brand,
  type DomainAgeLookup,
  type LlmToolDef,
  type PageFeatures,
} from '@phantom/core';
import { z } from 'zod';
import { unrollRedirects } from '../net/redirects';
import { stableStringify } from '../util/sanitize';

export const TOOL_RESULT_LIMIT = 1500;

const emptyArgs = z.object({}).strict();
const queryArgs = z.object({ query: z.string().trim().min(1).max(64) }).strict();
const domainArgs = z
  .object({ domain: z.string().trim().min(1).max(253).regex(/^[a-z0-9.-]+$/i) })
  .strict();

export const TOOL_SCHEMAS = {
  brand_lookup: queryArgs,
  list_forms: emptyArgs,
  get_form_target: emptyArgs,
  list_external_resources: emptyArgs,
  domain_age: domainArgs,
  unroll_redirects: emptyArgs,
} satisfies Record<string, z.ZodType>;

export const TOOL_DEFS: LlmToolDef[] = [
  {
    name: 'brand_lookup',
    description: 'Cari merek yang cocok dengan nama atau domain.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', maxLength: 64 } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_forms',
    description: 'Ringkas form pada halaman: jumlah kolom, tipe, kredensial, host tujuan.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_form_target',
    description: 'Tujuan form berkolom kredensial dan apakah tujuannya milik merek yang diklaim.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_external_resources',
    description: 'Sumber daya eksternal dikelompokkan per domain terdaftar.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'domain_age',
    description: 'Umur domain laman dalam hari, bila persetujuan domainAge diberikan.',
    parameters: {
      type: 'object',
      properties: { domain: { type: 'string', maxLength: 253 } },
      required: ['domain'],
      additionalProperties: false,
    },
  },
  {
    name: 'unroll_redirects',
    description: 'Ikuti pengalihan URL laman dan kembalikan rantai host tujuan.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'submit_verdict',
    description: 'Akhiri penyelidikan dengan vonis akhir.',
    parameters: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['neutral', 'caution', 'danger'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasons: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 3 },
        evidenceRefs: { type: 'array', items: { type: 'string', maxLength: 64 }, maxItems: 10 },
      },
      required: ['verdict', 'confidence', 'reasons', 'evidenceRefs'],
      additionalProperties: false,
    },
  },
];

export interface ToolContext {
  result: AnalysisResult;
  features: PageFeatures | null;
  consent: { domainAge: boolean };
  rdap: DomainAgeLookup;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  resultIds: Set<string>;
}

export interface ToolResult {
  id?: string;
  content: string;
}

function targetFor(form: PageFeatures['forms'][number], pageUrl: string) {
  const target = resolveFormTarget(form.action, pageUrl);
  if (target.kind === 'ignored') return { kind: target.kind } as const;

  const fallback = parseUrl(pageUrl);
  return {
    kind: target.kind,
    url: target.url ?? pageUrl,
    host: target.host ?? (fallback.ok ? fallback.hostname : null),
    registeredDomain: target.registeredDomain ?? (fallback.ok ? fallback.registeredDomain : null),
  };
}

function brandOwns(brand: Brand, target: { host?: string | null; registeredDomain?: string | null }) {
  const domain = target.registeredDomain?.toLowerCase();
  const host = target.host?.toLowerCase();
  return (
    (domain !== undefined &&
      domain !== null &&
      brand.officialDomains.some((value) => value.toLowerCase() === domain)) ||
    (host !== undefined && host !== null && brand.exactHosts.some((value) => value.toLowerCase() === host))
  );
}

function officialBrandIdsForDomain(domain: string | null, host: string | null): string[] {
  return BRANDS.filter((brand) => brandOwns(brand, { host, registeredDomain: domain })).map(
    (brand) => brand.id,
  );
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  const pageUrl = context.result.page.url;
  const forms = context.features?.forms ?? [];

  switch (name) {
    case 'brand_lookup': {
      const matches = findBrands(String(args.query), BRANDS, 5).map((brand) => ({
        id: brand.id,
        name: brand.name,
        officialDomains: brand.officialDomains,
        exactHosts: brand.exactHosts,
        officialPhones: brand.officialPhones,
      }));
      return { matches };
    }

    case 'list_forms': {
      return {
        forms: forms.map((form, index) => {
          const target = targetFor(form, pageUrl);
          return {
            index,
            fields: form.fields.length,
            types: [...new Set(form.fields.map((field) => field.type))],
            hasCredential: form.fields.some(isCredentialField),
            method: form.method,
            targetHost: target.kind === 'ignored' ? null : target.host,
          };
        }),
      };
    }

    case 'get_form_target': {
      return {
        forms: forms
          .map((form, index) => ({ form, index }))
          .filter(({ form }) => form.fields.some(isCredentialField))
          .map(({ form, index }) => {
            const target = targetFor(form, pageUrl);
            const claimedBy =
              target.kind === 'ignored'
                ? []
                : context.result.flags.claimedBrandIds.filter((id) => {
                    const brand = BRANDS.find((entry) => entry.id === id);
                    return brand ? brandOwns(brand, target) : false;
                  });
            return {
              index,
              method: form.method,
              target,
              claimedBy,
              targetOwnedByClaimedBrand: claimedBy.length > 0,
            };
          }),
      };
    }

    case 'list_external_resources': {
      const groups = new Map<
        string,
        { domain: string | null; host: string; count: number; kinds: Set<string> }
      >();

      for (const resource of context.features?.externalResources ?? []) {
        const parsed = parseUrl(resource.url);
        const domain = parsed.ok ? parsed.registeredDomain : null;
        const host = parsed.ok ? parsed.hostname : 'unknown';
        const key = domain ?? host;
        const current = groups.get(key) ?? {
          domain,
          host,
          count: 0,
          kinds: new Set<string>(),
        };
        current.count += 1;
        current.kinds.add(resource.kind);
        groups.set(key, current);
      }

      return {
        resources: [...groups.values()]
          .sort((a, b) => b.count - a.count)
          .map((group) => ({
            domain: group.domain,
            host: group.host,
            count: group.count,
            kinds: [...group.kinds],
            officialBrandIds: officialBrandIdsForDomain(group.domain, group.host),
          })),
      };
    }

    case 'domain_age': {
      if (!context.consent.domainAge) return { error: 'consent_required' };
      const pageDomain = context.result.page.registeredDomain;
      const requested = String(args.domain).toLowerCase();
      if (!pageDomain || requested !== pageDomain.toLowerCase()) {
        return { error: 'domain_not_page' };
      }
      const ageDays = await context.rdap.ageDays(pageDomain, { signal: context.signal });
      return ageDays === null
        ? { ageDays: null, reason: 'rdap_unavailable' }
        : { ageDays };
    }

    case 'unroll_redirects': {
      const redirect = await unrollRedirects(pageUrl, {
        fetchImpl: context.fetchImpl,
        signal: context.signal,
      });
      return {
        finalUrl: redirect.finalUrl,
        chain: redirect.chain,
        ...(redirect.error ? { error: redirect.error } : {}),
      };
    }

    default:
      return { error: 'unknown_tool' };
  }
}

export async function runTool(
  name: string,
  rawArgs: unknown,
  context: ToolContext,
  memo: Map<string, ToolResult>,
  nextIndex: Map<string, number>,
): Promise<ToolResult> {
  const schema = TOOL_SCHEMAS[name as keyof typeof TOOL_SCHEMAS];
  if (!schema) return { content: JSON.stringify({ error: 'unknown_tool' }) };

  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) return { content: JSON.stringify({ error: 'invalid_arguments' }) };

  const args = parsed.data as Record<string, unknown>;
  const memoKey = `${name}:${stableStringify(args)}`;
  const cached = memo.get(memoKey);
  if (cached) return cached;

  let output: unknown;
  try {
    output = await executeTool(name, args, context);
  } catch {
    output = { error: 'tool_failed' };
  }

  let content = JSON.stringify(output);
  if (content.length > TOOL_RESULT_LIMIT) content = content.slice(0, TOOL_RESULT_LIMIT);

  const index = (nextIndex.get(name) ?? 0) + 1;
  nextIndex.set(name, index);
  const id = `${name}#${index}`;
  const result: ToolResult = { id, content };

  memo.set(memoKey, result);
  context.resultIds.add(id);
  return result;
}
