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
      // AGT-01: penalaran diminimalkan agar respons cepat. Gemini 3.x menolak
      // thinkingBudget 0, jadi tingkat terendah yang didukung dipakai.
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
