import { describe, expect, it, vi } from 'vitest';
import { prepareAnalysis, runPreparedAgent, traceRows, type PipelineDeps } from '../src/analysis';
import { parseConfig } from '../src/env';
import { LlmProviderError } from '../src/llm/errors';
import { pageFeatures, passwordForm } from './helpers';

function setup(host = 'tenant.vercel.app') {
  const features = pageFeatures({ url: `https://${host}/login`, forms: [passwordForm('https://collector.example.net/post')] });
  const input = { url: features.url, features, consent: { cloud: true, domainAge: true } };
  const attempt = vi.fn(async () => ({ text: JSON.stringify({ verdict: 'caution', confidence: 0.8, reasons: ['Bukti belum cukup.'], evidenceRefs: [] }), toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }));
  const ageDays = vi.fn(async (): Promise<number | null> => 120);
  const deps: PipelineDeps = {
    config: parseConfig({} as Env),
    cache: { get: vi.fn(async () => null), set: vi.fn(async () => {}) },
    rdap: { ageDays },
    chain: { name: 'fake', entries: [{ provider: 'gemini', model: 'test' }], available: () => true, attempt, generate: attempt },
  };
  return { input, deps, attempt, ageDays };
}

async function run(fixture: ReturnType<typeof setup>) {
  return runPreparedAgent(await prepareAnalysis(fixture.input, fixture.deps), fixture.input, fixture.deps);
}

describe('L3/L4 pipeline regression', () => {
  it('skips PRIVATE tenant RDAP without skipping L4', async () => {
    const fixture = setup();
    const result = await run(fixture);
    expect(fixture.ageDays).not.toHaveBeenCalled();
    expect(fixture.attempt).toHaveBeenCalled();
    expect(traceRows(result).l3[0].message).toBe('Umur situs tidak tersedia untuk subdomain hosting ini.');
    expect(traceRows(result).l3[0].data?.reason).toBe('private_hosting');
  });

  it('preserves registry age in traces', async () => {
    const fixture = setup('login-xyz.top');
    const result = await run(fixture);
    expect(result.l3).toEqual([{ domain: 'login-xyz.top', ageDays: 120 }]);
    expect(traceRows(result).l3[0].data?.ageDays).toBe(120);
  });

  it('continues L4 after RDAP failure', async () => {
    const fixture = setup('login-xyz.top');
    fixture.ageDays.mockRejectedValue(new Error('network'));
    const result = await run(fixture);
    expect(fixture.attempt).toHaveBeenCalled();
    expect(result.degraded).toContain('rdap_unavailable');
    expect(result.agent?.used).toBe(true);
  });

  it.each([
    [429, 'http_429', 'llm_quota'],
    [404, 'model_not_found', 'llm_model_unavailable'],
    [undefined, 'invalid_output', 'llm_invalid_response'],
    [undefined, 'timeout', 'agent_timeout'],
  ] as const)('reports safe provider failure %s/%s', async (status, outcome, reason) => {
    const fixture = setup();
    fixture.attempt.mockRejectedValue(new LlmProviderError('gemini', 'test', outcome, status));
    const result = await run(fixture);
    expect(result.degraded).toContain(reason);
    expect(traceRows(result).l4[0].data?.reason).toBe(reason);
    expect(JSON.stringify(traceRows(result))).not.toContain('llm:gemini');
  });

  it('does not call RDAP or agent without cloud consent', async () => {
    const fixture = setup();
    fixture.input.consent.cloud = false;
    await run(fixture);
    expect(fixture.ageDays).not.toHaveBeenCalled();
    expect(fixture.attempt).not.toHaveBeenCalled();
  });

  it('runs L4 without domain-age consent', async () => {
    const fixture = setup();
    fixture.input.consent.domainAge = false;
    await run(fixture);
    expect(fixture.ageDays).not.toHaveBeenCalled();
    expect(fixture.attempt).toHaveBeenCalled();
  });

  it('routes a shared Google Form credential label to L4', async () => {
    const url =
      'https://docs.google.com/forms/d/e/1FAIpQLSfUurZ18mOExxQmXffCi3taX4osGHHCC0RIXkQ-O214S-XWZA/viewform';
    const features = pageFeatures({
      url,
      title: 'Bagi-Bagi Diamond',
      formLabels: ['Password', 'Nama akun'],
      forms: [],
    });
    const input = { url, features, consent: { cloud: true, domainAge: true } };
    const attempt = vi.fn(async () => ({
      text: JSON.stringify({
        verdict: 'caution',
        confidence: 0.7,
        reasons: ['Formulir bersama meminta sandi.'],
        evidenceRefs: [],
      }),
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const deps: PipelineDeps = {
      config: parseConfig({} as Env),
      cache: { get: vi.fn(async () => null), set: vi.fn(async () => {}) },
      rdap: { ageDays: vi.fn(async () => 120) },
      chain: {
        name: 'fake',
        entries: [{ provider: 'gemini', model: 'test' }],
        available: () => true,
        attempt,
        generate: attempt,
      },
    };

    const prepared = await prepareAnalysis(input, deps);
    expect(prepared.result.status).toBe('caution');
    expect(prepared.result.needsAgent).toBe(true);
    expect(prepared.result.signals.map((signal) => signal.id)).toContain('CREDENTIAL_TEXT');

    const result = await runPreparedAgent(prepared, input, deps);
    expect(attempt).toHaveBeenCalled();
    expect(result.agent?.used).toBe(true);
  });

  it('does not cache a neutral agent verdict', async () => {
    const fixture = setup();
    fixture.attempt.mockResolvedValue({
      text: JSON.stringify({
        verdict: 'neutral',
        confidence: 0.6,
        reasons: ['Tidak ada bukti penipuan.'],
        evidenceRefs: [],
      }),
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await run(fixture);
    expect(result.final.status).toBe('neutral');
    expect(result.cache.written).toBe(false);
    expect(fixture.deps.cache.set).not.toHaveBeenCalled();
  });
});
