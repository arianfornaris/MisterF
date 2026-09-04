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

  it('keeps the lite model at its own default reasoning level', () => {
    // `minimal` is Gemini 3.5 Flash-Lite's factory default and the floor for
    // Gemini 3.x, where reasoning cannot be disabled. It ran at `low` — above
    // the model's default — until a tutor turn degenerated into three junk
    // tokens after 628 reasoning tokens. Never `none`: OpenRouter documents
    // that mandatory-reasoning models must not be sent it.
    const liteEffort = getProviderOptions({ llm: { modelTier: 'lite' } });
    const advancedEffort = getProviderOptions({ llm: { modelTier: 'advanced' } });

    expect(liteEffort).toMatchObject({
      openrouter: { reasoning: { effort: 'minimal', exclude: true } },
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
