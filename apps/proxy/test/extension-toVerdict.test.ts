import { describe, expect, it } from 'vitest';
import { analyze, type PageFeatures } from '@phantom/core';
import { toVerdict } from '../../extension/src/analyze/toVerdict';

const URL_ = 'https://www.roblox.com.kz/login';

const features: PageFeatures = {
  url: URL_,
  title: 'Roblox Login',
  headings: ['Login'],
  siteName: null,
  externalResources: [],
  forms: [
    {
      action: null,
      method: 'post',
      fields: [
        { type: 'text', name: 'username', id: 'u', autocomplete: 'username', placeholder: null },
        { type: 'password', name: 'password', id: 'p', autocomplete: 'current-password', placeholder: null },
      ],
    },
  ],
} as PageFeatures;

// Baris L4 yang dikirim proxy saat aturan lokal sudah memutuskan (CORE-09).
const proxyL4 = [
  { stage: 'L4' as const, message: 'Pemeriksaan AI tidak tersedia.', data: { tool: 'agent', available: false } },
];

const local = analyze({ url: URL_, features });

function deepRows(verdict: ReturnType<typeof toVerdict>) {
  return verdict.trace
    .filter((step) => step.stage === 'L3' || step.stage === 'L4')
    .map((step) => `${step.stage}:${step.skipReasonKey ?? 'ran'}`);
}

describe('deep check reporting', () => {
  it('blames the local rules, not a broken check, when the proxy skipped L3/L4', () => {
    const verdict = toVerdict(local, { l3: [], l4: proxyL4 }, { skipReason: 'notNeeded' });
    expect(deepRows(verdict)).toEqual(['L3:skippedDecidedByRules', 'L4:skippedDecidedByRules']);
  });

  it('keeps the settings wording when the user turned the deep check off', () => {
    const verdict = toVerdict(local, { l3: [], l4: proxyL4 }, { skipReason: 'deepCheckDisabled' });
    expect(deepRows(verdict)).toEqual(['L3:skippedNotNeeded', 'L4:skippedNotNeeded']);
  });

  it('shows real L3/L4 results when the deep check ran', () => {
    const verdict = toVerdict(
      local,
      {
        l3: [{ domain: 'roblox.com.kz', ageDays: 340 }],
        l4: [{ stage: 'L4', message: 'Pemeriksaan AI selesai.', data: { tool: 'agent', verdict: 'danger' } }],
      },
      {},
    );
    expect(deepRows(verdict)).toEqual(['L3:ran', 'L4:ran']);
  });

  it('never claims missing consent when the proxy did not report it', () => {
    const verdict = toVerdict(local, { l3: [], l4: [] }, {});
    expect(deepRows(verdict)).toEqual(['L3:skippedUnavailable', 'L4:skippedUnavailable']);
  });
});
