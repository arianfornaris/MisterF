import { describe, expect, it } from 'vitest';
import { shouldUseTemperature } from '../../src/server/services/llmTutor/providers.js';

describe('shouldUseTemperature', () => {
  it('excludes GPT-5 and o-series models despite the OpenRouter vendor prefix', () => {
    expect(shouldUseTemperature({ modelId: 'openai/gpt-5' })).toBe(false);
    expect(shouldUseTemperature({ modelId: 'openai/gpt-5-mini' })).toBe(false);
    expect(shouldUseTemperature({ modelId: 'openai/o1' })).toBe(false);
    expect(shouldUseTemperature({ modelId: 'openai/o3' })).toBe(false);
    expect(shouldUseTemperature({ modelId: 'openai/o4-mini' })).toBe(false);
  });

  it('excludes the same models when the id has no vendor prefix', () => {
    expect(shouldUseTemperature({ modelId: 'gpt-5-mini' })).toBe(false);
    expect(shouldUseTemperature({ modelId: 'o3' })).toBe(false);
  });

  it('keeps temperature for models that support it', () => {
    expect(shouldUseTemperature({ modelId: 'anthropic/claude-sonnet-5' })).toBe(true);
    expect(shouldUseTemperature({ modelId: 'openai/gpt-4o-mini' })).toBe(true);
    expect(shouldUseTemperature({ modelId: 'google/gemini-2.5-flash' })).toBe(true);
    expect(shouldUseTemperature({ modelId: 'mistralai/mistral-large' })).toBe(true);
  });
});
