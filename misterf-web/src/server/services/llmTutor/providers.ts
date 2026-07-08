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

export function getConfiguredModelId(
  options: LlmRequestOptions = {},
): string {
  if (options.modelId?.trim()) {
    return options.modelId.trim();
  }

  if (options.modelTier === 'max') {
    return env.llmMaxModel;
  }

  if (options.modelTier === 'advanced') {
    return env.llmAdvancedModel;
  }

  if (options.modelTier === 'lite') {
    return env.llmLiteModel;
  }

  return env.llmRegularModel;
}

export function getLanguageModel(
  options: LlmRequestOptions = {},
): LanguageModel {
  const apiKey = options.openRouterApiKey || env.openrouterApiKey;
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

export function getProviderOptions(): ProviderOptions | undefined {
  return {
    openrouter: {
      reasoning: {
        effort:
          env.openrouterReasoningEffort as
            | 'xhigh'
            | 'high'
            | 'medium'
            | 'low'
            | 'minimal'
            | 'none',
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
  const modelSegment = getConfiguredModelId(options).split('/').pop() ?? '';
  return !/^(gpt-5|o[134])/i.test(modelSegment);
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
