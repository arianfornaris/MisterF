import { describe, expect, it } from 'vitest';
import {
  getProviderOptions,
  shouldUseTemperature,
} from '../../src/server/services/llmTutor/providers.js';

describe('getProviderOptions', () => {
  it('allows a call site to override the default reasoning effort', () => {
    expect(getProviderOptions({ reasoningEffort: 'minimal' })).toMatchObject({
      openrouter: {
        reasoning: {
          effort: 'minimal',
          exclude: true,
        },
      },
    });
  });

  it('caps reasoning effort for the lite model so it does not burn output on thinking', () => {
    // The lite model runs at a lower reasoning budget than the regular/advanced
    // tiers, which use the global default.
    const liteEffort = getProviderOptions({ llm: { modelTier: 'lite' } });
    const advancedEffort = getProviderOptions({ llm: { modelTier: 'advanced' } });

    expect(liteEffort).toMatchObject({
      openrouter: { reasoning: { effort: 'low', exclude: true } },
    });
    expect(advancedEffort).toMatchObject({
      openrouter: { reasoning: { effort: 'medium', exclude: true } },
    });
  });
});

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
