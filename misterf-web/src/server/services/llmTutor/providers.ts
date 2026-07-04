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
  return !/^(gpt-5|o[134]|o4)/i.test(getConfiguredModelId(options));
}

export function getUserFacingFinishReasonMessage(
  finishReason: FinishReason,
  rawFinishReason?: string,
  providerMetadata?: ProviderMetadata,
  locale: Locale = 'es',
): string | null {
  const normalizedRawFinishReason = rawFinishReason?.toUpperCase() ?? '';
  const metadataText = JSON.stringify(providerMetadata ?? {}).toUpperCase();

  if (finishReason === 'length' || normalizedRawFinishReason === 'MAX_TOKENS') {
    return translate(locale, 'msg.finishTokenLimit');
  }

  if (
    finishReason === 'content-filter' ||
    normalizedRawFinishReason === 'SAFETY'
  ) {
    return translate(locale, 'msg.finishSafety');
  }

  if (
    normalizedRawFinishReason === 'RECITATION' ||
    metadataText.includes('RECITATION')
  ) {
    return translate(locale, 'msg.finishRecitation');
  }

  return null;
}
