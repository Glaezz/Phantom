export interface ModelProfile {
  provider: 'gemini' | 'groq';
  model: string;
  maxOutputTokens: number;
  thinkingLevel?: string;
  reasoningEffort?: string;
}

export function getModelProfile(provider: 'gemini' | 'groq', model: string): ModelProfile {
  if (provider === 'gemini') {
    return {
      provider,
      model,
      maxOutputTokens: 512,
      // Gemini 3.x supports thinking levels; a 400 response retries without this field.
      thinkingLevel: 'minimal',
    };
  }

  return {
    provider,
    model,
    maxOutputTokens: 512,
    reasoningEffort: model.toLowerCase().includes('qwen') ? 'low' : undefined,
  };
}
