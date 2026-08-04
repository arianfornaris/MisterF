import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type {
  FinishReason,
  LanguageModel,
  ProviderMetadata,
} from 'ai';
import { env } from '../../config/env.js';
import { translate, type Locale } from '../../i18n/index.js';
import { MissingLlmApiKeyError } from './errors.js';
import type { LlmRequestOptions } from './types.js';

export type OpenRouterReasoningEffort =
  | 'xhigh'
  | 'high'
  | 'medium'
  | 'low'
  | 'minimal'
  | 'none';

export function getConfiguredModelId(
  options: LlmRequestOptions = {},
): string {
  if (options.modelId?.trim()) {
    return options.modelId.trim();
  }

  if (options.modelTier === 'advanced') {
    return env.llmAdvancedModel;
  }

  if (options.modelTier === 'lite') {
    return env.llmLiteModel;
  }

  if (options.modelTier === 'regular') {
    return env.llmRegularModel;
  }

  return env.llmLiteModel;
}

/**
 * Every user-facing inference runs on that user's own credit-gated key. There
 * is deliberately **no fallback** to the platform key: it used to fall back
 * silently, so a call site that forgot to thread the user's key would still
 * work — and spend from the shared account without touching anyone's credit.
 * Failing loudly is the point.
 */
export function getLanguageModel(
  options: LlmRequestOptions = {},
): LanguageModel {
  const apiKey = options.openRouterApiKey;
  if (!apiKey) {
    throw new MissingLlmApiKeyError('openrouter');
  }

  return createOpenRouter({
    apiKey,
    appName: 'Mister F',
    appUrl: env.appBaseUrl,
    baseURL: env.openrouterBaseUrl,
  }).chat(getConfiguredModelId(options));
}

/**
 * Reasoning effort to request for a call. The lite model gets a lower budget
 * than the global default because a heavy reasoning budget makes it burn its
 * output on hidden thinking and return an empty/degenerate reply. An explicit
 * `reasoningEffort` on the call site still wins.
 */
export function resolveReasoningEffort(
  options: LlmRequestOptions = {},
): OpenRouterReasoningEffort {
  if (getConfiguredModelId(options) === env.llmLiteModel) {
    return env.openrouterLiteReasoningEffort as OpenRouterReasoningEffort;
  }
  return env.openrouterReasoningEffort as OpenRouterReasoningEffort;
}

export function getProviderOptions(options: {
  reasoningEffort?: OpenRouterReasoningEffort;
  llm?: LlmRequestOptions;
} = {}): ProviderOptions | undefined {
  return {
    openrouter: {
      reasoning: {
        effort: options.reasoningEffort ?? resolveReasoningEffort(options.llm),
        exclude: true,
      },
    },
  };
}

export function shouldUseTemperature(
  options: LlmRequestOptions = {},
): boolean {
  // OpenRouter ids are vendor-prefixed (e.g. `openai/gpt-5-mini`); match on
  // the model segment. GPT-5 and o-series models reject a custom temperature.
  // Gemini 3.x reasoning models are optimized for their defaults, while
  // Gemini 3.6 Flash, 3.5 Flash-Lite, and later generations deprecate the
  // sampling parameter entirely.
  const modelSegment = getConfiguredModelId(options).split('/').pop() ?? '';
  return !/^(gemini-3|gpt-5|o[134])/i.test(modelSegment);
}

export function getUserFacingFinishReasonMessage(
  finishReason: FinishReason,
  providerMetadata?: ProviderMetadata,
  locale: Locale = 'es',
): string | null {
  const metadataText = JSON.stringify(providerMetadata ?? {}).toUpperCase();

  if (finishReason === 'length') {
    return translate(locale, 'msg.finishTokenLimit');
  }

  if (finishReason === 'content-filter') {
    return translate(locale, 'msg.finishSafety');
  }

  if (metadataText.includes('RECITATION')) {
    return translate(locale, 'msg.finishRecitation');
  }

  return null;
}
