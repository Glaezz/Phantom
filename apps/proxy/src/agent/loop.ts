import {
  AgentVerdictSchema,
  parseUrl,
  type AgentVerdict,
  type AnalysisResult,
  type DomainAgeLookup,
  type LlmMessage,
  type LlmResponse,
  type PageFeatures,
} from '@phantom/core';
import type { LlmChain } from '../llm/chain';
import { AgentDeadlineError } from '../llm/errors';
import { cleanText } from '../util/sanitize';
import { truncate } from '../util/truncate';
import { timeoutSignal } from '../util/timeout';
import type { AgentRunResult, AgentTraceStep } from './schemas';
import { SYSTEM_PROMPT } from './prompt';
import { TOOL_DEFS, runTool, type ToolContext, type ToolResult } from './tools';

const MAX_TOTAL_LLM_CALLS = 8;
const CONTEXT_LIMIT = 6000;

export interface AgentInput {
  result: AnalysisResult;
  features: PageFeatures | null;
  consent: { cloud: boolean; domainAge: boolean };
  rdap: DomainAgeLookup;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  maxSteps: number;
  deadlineMs: number;
}

function buildContext(input: AgentInput): string {
  const features = input.features;
  const page = parseUrl(input.result.page.url);
  const external = new Map<string, { domain: string | null; host: string; count: number }>();

  for (const resource of features?.externalResources ?? []) {
    const parsed = parseUrl(resource.url);
    const domain = parsed.ok ? parsed.registeredDomain : null;
    const host = parsed.ok ? parsed.hostname : 'unknown';
    const key = domain ?? host;
    const current = external.get(key) ?? { domain, host, count: 0 };
    current.count += 1;
    external.set(key, current);
  }

  const context = {
    url: input.result.page.url,
    host: page.ok ? page.hostname : input.result.page.hostname,
    status: input.result.status,
    floor: input.result.floor,
    signals: input.result.signals.map((signal) => ({
      id: signal.id,
      severity: signal.severity,
      brandId: signal.brandId,
    })),
    flags: input.result.flags,
    title: cleanText(features?.title ?? '', 200),
    headings: (features?.headings ?? []).slice(0, 5).map((heading) => cleanText(heading, 200)),
    siteName: features?.siteName ? cleanText(features.siteName, 200) : null,
    forms: (features?.forms ?? []).map((form) => ({
      fields: form.fields.length,
      types: [...new Set(form.fields.map((field) => field.type))],
      method: form.method,
    })),
    externalResources: [...external.values()].slice(0, 20),
  };

  return truncate(JSON.stringify(context), CONTEXT_LIMIT);
}

function verdictFromArgs(args: unknown, resultIds: Set<string>): AgentVerdict | null {
  const parsed = AgentVerdictSchema.safeParse(args);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    evidenceRefs: parsed.data.evidenceRefs.filter((ref) => resultIds.has(ref)),
  };
}

function verdictFromText(text: string | null, resultIds: Set<string>): AgentVerdict | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return verdictFromArgs(JSON.parse(cleaned.slice(start, end + 1)), resultIds);
  } catch {
    return null;
  }
}

function toolCallArgs(args: unknown): Record<string, unknown> {
  return args !== null && typeof args === 'object' ? (args as Record<string, unknown>) : {};
}

export async function runAgent(chain: LlmChain, input: AgentInput): Promise<AgentRunResult> {
  const timeout = timeoutSignal(input.deadlineMs, input.signal);
  const memo = new Map<string, ToolResult>();
  const nextIndex = new Map<string, number>();
  const resultIds = new Set<string>();
  const trace: AgentTraceStep[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let totalCalls = 0;

  const context: ToolContext = {
    result: input.result,
    features: input.features,
    consent: input.consent,
    rdap: input.rdap,
    signal: timeout.signal,
    fetchImpl: input.fetchImpl,
    resultIds,
  };

  const failure = (reason: 'llm_unavailable' | 'agent_timeout' | 'no_verdict') =>
    ({ ok: false as const, reason, trace, usage });

  try {
    for (let entryIndex = 0; entryIndex < chain.entries.length; entryIndex += 1) {
      if (!chain.available(entryIndex)) continue;
      const entry = chain.entries[entryIndex];

      const conversation: LlmMessage[] = [
        { role: 'user', content: `Data halaman (JSON):\n${buildContext(input)}` },
      ];
      let steps = 0;
      let entryFailed = false;
      let textParseTried = false;
      let nudgeSent = false;

      while (steps < input.maxSteps) {
        if (timeout.signal.aborted) return failure('agent_timeout');
        if (totalCalls >= MAX_TOTAL_LLM_CALLS) return failure('no_verdict');

        // Langkah terakhir dipakai untuk memaksa vonis, bukan menambah alat lagi.
        if (!nudgeSent && steps === input.maxSteps - 1) {
          nudgeSent = true;
          conversation.push({
            role: 'user',
            content:
              'Langkah terakhir. Jangan memanggil alat lain lagi; panggil submit_verdict sekarang dengan bukti yang sudah Anda kumpulkan.',
          });
        }

        let response: LlmResponse;
        try {
          response = await chain.attempt(
            entryIndex,
            {
              system: SYSTEM_PROMPT,
              messages: conversation,
              tools: TOOL_DEFS,
              temperature: 0.2,
              maxTokens: 512,
            },
            { signal: timeout.signal },
          );
        } catch (error) {
          if (error instanceof AgentDeadlineError || timeout.signal.aborted) {
            return failure('agent_timeout');
          }
          entryFailed = true;
          break;
        }

        totalCalls += 1;
        steps += 1;
        usage.inputTokens += response.usage.inputTokens;
        usage.outputTokens += response.usage.outputTokens;

        const assistant: LlmMessage = {
          role: 'assistant',
          content: response.text ?? '',
          providerRaw: response.providerRaw,
        };

        if (response.toolCalls.length === 0) {
          const parsed = textParseTried ? null : verdictFromText(response.text, resultIds);
          trace.push({
            step: trace.length + 1,
            provider: entry.provider,
            model: entry.model,
            toolCalls: [],
            ...(response.text ? { text: truncate(response.text, 200) } : {}),
          });
          if (parsed) {
            return {
              ok: true,
              verdict: parsed,
              provider: entry.provider,
              model: entry.model,
              steps,
              trace,
              usage,
            };
          }
          textParseTried = true;
          conversation.push(assistant);
          conversation.push({
            role: 'user',
            content:
              'Balasan tidak berisi pemanggilan alat yang sah. Gunakan alat yang tersedia lalu akhiri dengan submit_verdict.',
          });
          continue;
        }

        conversation.push(assistant);

        const submit = response.toolCalls.find((call) => call.name === 'submit_verdict');
        if (submit) {
          const verdict = verdictFromArgs(submit.args, resultIds);
          if (verdict) {
            trace.push({
              step: trace.length + 1,
              provider: entry.provider,
              model: entry.model,
              toolCalls: response.toolCalls.map((call) => ({
                name: call.name,
                args: toolCallArgs(call.args),
              })),
              ...(response.text ? { text: truncate(response.text, 200) } : {}),
            });
            return {
              ok: true,
              verdict,
              provider: entry.provider,
              model: entry.model,
              steps,
              trace,
              usage,
            };
          }
        }

        const traceCalls: AgentTraceStep['toolCalls'] = [];

        for (const call of response.toolCalls) {
          if (call.name === 'submit_verdict') {
            const content = JSON.stringify({ error: 'invalid_verdict' });
            conversation.push({
              role: 'tool',
              content,
              name: call.name,
              toolCallId: call.id,
            });
            traceCalls.push({ name: call.name, args: toolCallArgs(call.args) });
            continue;
          }

          const result = await runTool(call.name, call.args, context, memo, nextIndex);
          conversation.push({
            role: 'tool',
            content: result.content,
            name: call.name,
            toolCallId: call.id,
          });
          traceCalls.push({
            name: call.name,
            args: toolCallArgs(call.args),
            ...(result.id ? { resultRef: result.id } : {}),
          });
        }

        trace.push({
          step: trace.length + 1,
          provider: entry.provider,
          model: entry.model,
          toolCalls: traceCalls,
          ...(response.text ? { text: truncate(response.text, 200) } : {}),
        });
      }

      if (entryFailed) continue;
      return failure('no_verdict');
    }

    return failure('llm_unavailable');
  } finally {
    timeout.cleanup();
  }
}
