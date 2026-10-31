import { z } from 'zod';

export const BrandSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  category: z.string().min(1),
  officialDomains: z.array(z.string().min(1)).default([]),
  exactHosts: z.array(z.string().min(1)).default([]),
  officialPhones: z.array(z.string()).default([]),
  keywords: z.array(z.string().min(1)).min(1),
  ambiguousToken: z.boolean().default(false),
  sources: z.array(z.string().url()).min(1),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedBy: z.string().min(1),
  demo: z.boolean().default(false),
});

export const FieldFeatureSchema = z.object({
  type: z.string().max(64),
  name: z.string().max(200).nullable(),
  id: z.string().max(200).nullable(),
  autocomplete: z.string().max(200).nullable(),
  placeholder: z.string().max(200).nullable(),
});

export const FormFeatureSchema = z.object({
  action: z.string().max(2048).nullable(),
  method: z.enum(['get', 'post']),
  // true bila kredensial di luar <form> (div/JS) digabung ke form semu ini.
  detached: z.boolean().optional(),
  fields: z.array(FieldFeatureSchema).max(30),
});

export const ExternalResourceSchema = z.object({
  kind: z.enum(['script', 'img', 'link', 'iframe']),
  url: z.string().max(2048),
});

export const PageFeaturesSchema = z.object({
  url: z.string().max(2048),
  title: z.string().max(200),
  headings: z.array(z.string().max(200)).max(5),
  siteName: z.string().max(200).nullable(),
  forms: z.array(FormFeatureSchema).max(10),
  externalResources: z.array(ExternalResourceSchema).max(50),
});

export const SignalIdSchema = z.enum([
  'CHEAP_TLD',
  'FREE_SUBDOMAIN_PLATFORM',
  'URL_SHORTENER',
  'IP_HOST',
  'USERINFO_IN_URL',
  'PUNYCODE',
  'HOMOGLYPH',
  'TYPOSQUAT',
  'SAME_LABEL_DIFFERENT_SUFFIX',
  'BRAND_TOKEN_IN_HOST',
  'CREDENTIAL_FIELD',
  'BRAND_CLAIM_UNOFFICIAL_DOMAIN',
  'FORM_CROSS_DOMAIN',
  'HOTLINKS_OFFICIAL_ASSETS',
  'INSECURE_CREDENTIAL_FORM',
  'NEW_DOMAIN',
]);

export const SignalHitSchema = z.object({
  id: SignalIdSchema,
  severity: z.enum(['hard', 'soft']),
  stage: z.enum(['L0', 'L1', 'L2', 'L3']),
  brandId: z.string().optional(),
  detail: z.string().optional(),
});

export const TraceStepSchema = z.object({
  stage: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'SCORE']),
  signal: SignalIdSchema.optional(),
  message: z.string(),
  data: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export const StatusSchema = z.enum(['official', 'neutral', 'caution', 'danger']);

export const AnalysisResultSchema = z.object({
  status: StatusSchema,
  floor: z.enum(['neutral', 'caution', 'danger']),
  stage: z.enum(['L0', 'L1', 'L2']),
  needsAgent: z.boolean(),
  source: z.literal('rules'),
  flags: z.object({
    hasCredentialField: z.boolean(),
    claimedBrandIds: z.array(z.string()),
    matchedOfficialBrandIds: z.array(z.string()),
  }),
  signals: z.array(SignalHitSchema),
  reasons: z.array(z.string()).max(3),
  trace: z.array(TraceStepSchema),
  page: z.object({
    url: z.string(),
    hostname: z.string(),
    registeredDomain: z.string().nullable(),
  }),
  rulesVersion: z.string(),
});

export const AgentVerdictSchema = z.object({
  verdict: z.enum(['neutral', 'caution', 'danger']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().max(160)).max(3),
  evidenceRefs: z.array(z.string().max(64)).max(10),
});

export type Brand = z.infer<typeof BrandSchema>;
export type PageFeatures = z.infer<typeof PageFeaturesSchema>;
export type FormFeature = z.infer<typeof FormFeatureSchema>;
export type FieldFeature = z.infer<typeof FieldFeatureSchema>;
export type SignalId = z.infer<typeof SignalIdSchema>;
export type SignalHit = z.infer<typeof SignalHitSchema>;
export type TraceStep = z.infer<typeof TraceStepSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AgentVerdict = z.infer<typeof AgentVerdictSchema>;
