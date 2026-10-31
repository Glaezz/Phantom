import type { LlmMessage, LlmProvider, LlmRequest, LlmResponse } from '@phantom/core';
import { isAbortError } from '../util/timeout';
import { LlmInvalidOutputError, LlmProviderError, type LlmFailureOutcome } from './errors';
import { getModelProfile } from './profiles';

function messageContent(message: LlmMessage): Record<string, unknown> | null {
  if (message.role === 'system') return null;
  if (message.role === 'assistant' && message.providerRaw && !Array.isArray(message.providerRaw)) {
    return message.providerRaw as Record<string, unknown>;
  }
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }
  return { role: message.role, content: message.content };
}

function outcomeForStatus(status: number): LlmFailureOutcome {
  if (status === 404) return 'model_not_found';
  if (status === 401 || status === 403) return 'auth';
  return `http_${status}`;
}

export function createGroqProvider(model: string, apiKey: string): LlmProvider {
  const profile = getModelProfile('groq', model);

  return {
    name: `groq:${model}`,
    async generate(req: LlmRequest, { signal }): Promise<LlmResponse> {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: req.system },
          ...req.messages
            .map(messageContent)
            .filter((value): value is Record<string, unknown> => value !== null),
        ],
        max_tokens: req.maxTokens > 0 ? req.maxTokens : profile.maxOutputTokens,
        temperature: req.temperature ?? 0.2,
      };
      if (req.tools.length > 0) {
        body.tools = req.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
        body.tool_choice = 'required';
      }
      if (profile.reasoningEffort) body.reasoning_effort = profile.reasoningEffort;

      const send = () =>
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        });

      let response: Response;
      try {
        response = await send();
        if (response.status === 400 && body.reasoning_effort) {
          delete body.reasoning_effort;
          response = await send();
        }
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw new LlmProviderError('groq', model, 'timeout');
        }
        throw new LlmProviderError('groq', model, 'network');
      }

      if (!response.ok) {
        throw new LlmProviderError('groq', model, outcomeForStatus(response.status), response.status);
      }

      let data: {
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: {
              id?: string;
              function?: { name?: string; arguments?: string };
            }[];
          };
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new LlmInvalidOutputError('groq', model);
      }

      const message = data.choices?.[0]?.message;
      if (!message) throw new LlmInvalidOutputError('groq', model);

      const toolCalls: LlmResponse['toolCalls'] = [];
      for (const [index, call] of (message.tool_calls ?? []).entries()) {
        const name = call.function?.name;
        if (!name) throw new LlmInvalidOutputError('groq', model);

        let args: unknown = {};
        if (call.function?.arguments) {
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            throw new LlmInvalidOutputError('groq', model);
          }
        }
        toolCalls.push({
          id: call.id ?? `groq_call_${index}`,
          name,
          args,
        });
      }

      return {
        toolCalls,
        text: message.content ?? null,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
        providerRaw: message,
      };
    },
  };
}
