import type { LlmMessage, LlmProvider, LlmRequest, LlmResponse } from '@phantom/core';
import { isAbortError } from '../util/timeout';
import { LlmInvalidOutputError, LlmProviderError, type LlmFailureOutcome } from './errors';
import { getModelProfile } from './profiles';

interface GeminiPart {
  text?: string;
  functionCall?: { id?: string; name?: string; args?: unknown };
  functionResponse?: { id?: string; name?: string; response?: unknown };
  [key: string]: unknown;
}

function messageContent(message: LlmMessage): Record<string, unknown> | null {
  if (message.role === 'system') return null;
  if (message.role === 'assistant' && Array.isArray(message.providerRaw)) {
    return { role: 'model', parts: message.providerRaw };
  }
  if (message.role === 'tool') {
    return {
      role: 'user',
      parts: [
        {
          functionResponse: {
            id: message.toolCallId,
            name: message.name,
            response: { content: message.content },
          },
        },
      ],
    };
  }
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  };
}

function outcomeForStatus(status: number): LlmFailureOutcome {
  if (status === 404) return 'model_not_found';
  if (status === 401 || status === 403) return 'auth';
  return `http_${status}`;
}

// Gemini's functionDeclarations.parameters is an OpenAPI subset, not full JSON Schema.
// Unknown keywords such as additionalProperties make the whole request fail with 400.
const UNSUPPORTED_SCHEMA_KEYS = new Set(['$schema', 'additionalProperties', 'unevaluatedProperties']);

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (value === null || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
    result[key] = toGeminiSchema(child);
  }
  return result;
}

export function createGeminiProvider(model: string, apiKey: string): LlmProvider {
  const profile = getModelProfile('gemini', model);

  return {
    name: `gemini:${model}`,
    async generate(req: LlmRequest, { signal }): Promise<LlmResponse> {
      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: req.maxTokens > 0 ? req.maxTokens : profile.maxOutputTokens,
      };
      if (profile.thinkingLevel) {
        generationConfig.thinkingConfig = { thinkingLevel: profile.thinkingLevel };
      }

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages
          .map(messageContent)
          .filter((value): value is Record<string, unknown> => value !== null),
        generationConfig,
      };
      if (req.tools.length > 0) {
        body.tools = [
          {
            functionDeclarations: req.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: toGeminiSchema(tool.parameters),
            })),
          },
        ];
        body.toolConfig = { functionCallingConfig: { mode: 'ANY' } };
      }

      const send = () =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(body),
            signal,
          },
        );

      let response: Response;
      try {
        response = await send();
        if (response.status === 400 && generationConfig.thinkingConfig) {
          delete generationConfig.thinkingConfig;
          body.generationConfig = generationConfig;
          response = await send();
        }
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw new LlmProviderError('gemini', model, 'timeout');
        }
        throw new LlmProviderError('gemini', model, 'network');
      }

      if (!response.ok) {
        throw new LlmProviderError(
          'gemini',
          model,
          outcomeForStatus(response.status),
          response.status,
        );
      }

      let data: {
        candidates?: { content?: { parts?: GeminiPart[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new LlmInvalidOutputError('gemini', model);
      }

      const parts = data.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new LlmInvalidOutputError('gemini', model);
      }

      const toolCalls: LlmResponse['toolCalls'] = [];
      const textParts: string[] = [];
      let index = 0;

      for (const part of parts) {
        if (typeof part.text === 'string') textParts.push(part.text);
        const call = part.functionCall;
        if (!call || typeof call.name !== 'string') continue;
        toolCalls.push({
          id: typeof call.id === 'string' && call.id ? call.id : `gemini_call_${index}`,
          name: call.name,
          args: call.args ?? {},
        });
        index += 1;
      }

      return {
        toolCalls,
        text: textParts.length > 0 ? textParts.join('') : null,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
        providerRaw: parts,
      };
    },
  };
}
