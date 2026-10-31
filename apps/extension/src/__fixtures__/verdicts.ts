// Fixture Verdict untuk dev harness — bentuk sesuai Design.md §6.0, skenario §7.1.
import type { Verdict } from '../ui/types';

export const fixtureS1Danger: Verdict = {
  status: 'danger',
  reasons: [
    'Laman ini meniru BCA tapi alamatnya bukan milik BCA.',
    'Formulir dikirim ke situs lain yang tidak dikenal.',
  ],
  trace: [
    { stage: 'L0', finding: 'none', summaryKey: 'trace.L0' },
    {
      stage: 'L1',
      finding: 'soft',
      summaryKey: 'Nama dibuat mirip: "bca" di alamat bukan domain resmi.',
      technical: { signal: 'H1', value: 'bca-secure-login.my.id' },
    },
    {
      stage: 'L2',
      finding: 'hard',
      summaryKey: 'Formulir dikirim ke situs lain.',
      technical: { signal: 'H2', value: 'action=https://collect-data.example.net' },
    },
    { stage: 'L3', finding: 'skipped', summaryKey: 'trace.L3', skipReasonKey: 'trace.skippedNoConsent' },
    { stage: 'L4', finding: 'skipped', summaryKey: 'trace.L4', skipReasonKey: 'trace.skippedNoConsent' },
  ],
  source: 'rules',
  claimedBrand: {
    id: 'bca',
    name: 'BCA',
    officialDomains: ['bca.co.id'],
    officialPhones: ['1500888'],
  },
  suspiciousHost: 'bca-secure-login.my.id',
};

export const fixtureS2Neutral: Verdict = {
  status: 'neutral',
  reasons: ['Tetap waspada. Periksa kembali alamat sebelum mengisi data.'],
  trace: [
    { stage: 'L0', finding: 'none', summaryKey: 'trace.L0' },
    { stage: 'L1', finding: 'none', summaryKey: 'Alamat tidak meniru merek mana pun.' },
    { stage: 'L2', finding: 'none', summaryKey: 'Tidak ada tanda mencurigakan di isi halaman.' },
    { stage: 'L3', finding: 'skipped', summaryKey: 'trace.L3', skipReasonKey: 'trace.skippedNoConsent' },
    { stage: 'L4', finding: 'skipped', summaryKey: 'trace.L4', skipReasonKey: 'trace.skippedNoConsent' },
  ],
  source: 'rules',
};

export const fixtureS3CautionL4Pending: Verdict = {
  status: 'caution',
  reasons: ['Ada tanda janggal di isi halaman. Pemeriksaan AI belum selesai.'],
  trace: [
    { stage: 'L0', finding: 'none', summaryKey: 'trace.L0' },
    { stage: 'L1', finding: 'none', summaryKey: 'Alamat tidak meniru merek mana pun.' },
    {
      stage: 'L2',
      finding: 'soft',
      summaryKey: 'Halaman meminta kode OTP di luar alur resmi.',
      technical: { signal: 'H3', value: 'input[autocomplete=one-time-code]' },
    },
    { stage: 'L3', finding: 'skipped', summaryKey: 'trace.L3', skipReasonKey: 'trace.skippedNoConsent' },
    { stage: 'L4', finding: 'none', summaryKey: 'Menunggu hasil pemeriksaan AI…' },
  ],
  source: 'rules',
};

export const fixtureS5FloorInjection: Verdict = {
  status: 'danger',
  reasons: [
    'Bukti keras dari isi halaman menandai laman ini berbahaya.',
    'Tulisan di laman mencoba memengaruhi penilaian AI dan diabaikan.',
  ],
  trace: [
    { stage: 'L0', finding: 'none', summaryKey: 'trace.L0' },
    { stage: 'L1', finding: 'soft', summaryKey: 'Nama dibuat mirip merek resmi.' },
    {
      stage: 'L2',
      finding: 'hard',
      summaryKey: 'Formulir dikirim ke situs lain.',
      technical: { signal: 'H2', value: 'action=https://evil.example.net' },
    },
    {
      stage: 'L3',
      finding: 'soft',
      summaryKey: 'Umur situs baru 4 hari.',
      technical: { tool: 'rdap', value: 'created 2026-10-27' },
    },
    {
      stage: 'L4',
      finding: 'soft',
      summaryKey: 'trace.injectionIgnored',
      technical: { signal: 'prompt-injection', tool: 'gemini' },
    },
  ],
  floor: 'danger',
  source: 'agent',
  suspiciousHost: 'bri-promo-palu.my.id',
};

export const fixtureS6Official: Verdict = {
  status: 'official',
  reasons: ['Alamat ini terdaftar sebagai kanal resmi BCA.'],
  trace: [
    { stage: 'L0', finding: 'hard', summaryKey: 'Alamat cocok dengan daftar kanal resmi.', technical: { value: 'bca.co.id' } },
    { stage: 'L1', finding: 'skipped', summaryKey: 'trace.L1', skipReasonKey: 'Tidak diperlukan untuk kanal resmi.' },
    { stage: 'L2', finding: 'skipped', summaryKey: 'trace.L2', skipReasonKey: 'Tidak diperlukan untuk kanal resmi.' },
    { stage: 'L3', finding: 'skipped', summaryKey: 'trace.L3', skipReasonKey: 'Tidak diperlukan untuk kanal resmi.' },
    { stage: 'L4', finding: 'skipped', summaryKey: 'trace.L4', skipReasonKey: 'Tidak diperlukan untuk kanal resmi.' },
  ],
  source: 'rules',
  claimedBrand: {
    id: 'bca',
    name: 'BCA',
    officialDomains: ['bca.co.id'],
    officialPhones: ['1500888'],
  },
};

export const fixtures = {
  S1: fixtureS1Danger,
  S2: fixtureS2Neutral,
  S3: fixtureS3CautionL4Pending,
  S5: fixtureS5FloorInjection,
  S6: fixtureS6Official,
} as const;

export type FixtureKey = keyof typeof fixtures;
