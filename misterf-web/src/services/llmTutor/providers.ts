import {
  createGoogleGenerativeAI,
} from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type {
  FinishReason,
  LanguageModel,
  ProviderMetadata,
} from 'ai';
import { env } from '../../config/env.js';
import { MissingLlmApiKeyError } from './errors.js';
import type { LlmRequestOptions } from './types.js';

export function getLanguageModel(
  options: LlmRequestOptions = {},
): LanguageModel {
  switch (env.llmProvider) {
    case 'openai':
      if (!env.openaiApiKey) {
        throw new MissingLlmApiKeyError('openai');
      }
      return createOpenAI({ apiKey: env.openaiApiKey })(env.llmModel);

    case 'openrouter': {
      const apiKey = options.openRouterApiKey || env.openrouterApiKey;
      if (!apiKey) {
        throw new MissingLlmApiKeyError('openrouter');
      }
      return createOpenRouter({
        apiKey,
        appName: 'Mister F',
        appUrl: env.appBaseUrl,
        baseURL: env.openrouterBaseUrl,
      }).chat(env.llmModel);
    }

    case 'anthropic':
      if (!env.anthropicApiKey) {
        throw new MissingLlmApiKeyError('anthropic');
      }
      return createAnthropic({ apiKey: env.anthropicApiKey })(env.llmModel);

    case 'gemini':
    case 'google':
      if (
        !env.geminiApiKey ||
        env.geminiApiKey === 'replace_with_your_gemini_api_key'
      ) {
        throw new MissingLlmApiKeyError('google');
      }
      return createGoogleGenerativeAI({ apiKey: env.geminiApiKey })(
        env.llmModel,
      );

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${env.llmProvider}". Use google, openai, openrouter, or anthropic.`,
      );
  }
}

export function getProviderOptions(): ProviderOptions | undefined {
  if (env.llmProvider === 'google' || env.llmProvider === 'gemini') {
    return {
      google: {
        thinkingConfig: {
          includeThoughts: false,
          thinkingBudget: env.geminiThinkingBudget,
        },
      },
    };
  }

  if (env.llmProvider === 'openai') {
    return {
      openai: {
        reasoningEffort: env.openaiReasoningEffort,
        textVerbosity: 'medium',
      },
    };
  }

  if (env.llmProvider === 'openrouter') {
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

  return undefined;
}

export function shouldUseTemperature(): boolean {
  return !(
    (env.llmProvider === 'openai' || env.llmProvider === 'openrouter') &&
    /^(gpt-5|o[134]|o4)/i.test(env.llmModel)
  );
}

export function getUserFacingFinishReasonMessage(
  finishReason: FinishReason,
  rawFinishReason?: string,
  providerMetadata?: ProviderMetadata,
): string | null {
  const normalizedRawFinishReason = rawFinishReason?.toUpperCase() ?? '';
  const metadataText = JSON.stringify(providerMetadata ?? {}).toUpperCase();

  if (finishReason === 'length' || normalizedRawFinishReason === 'MAX_TOKENS') {
    return 'La respuesta del modelo se cortó porque alcanzó el límite máximo de tokens. Intenta enviar un mensaje más corto o vuelve a pedirlo en partes.';
  }

  if (
    finishReason === 'content-filter' ||
    normalizedRawFinishReason === 'SAFETY'
  ) {
    return 'El modelo detuvo la respuesta por sus filtros de seguridad. Prueba reformulando tu mensaje con un contexto más claro y neutral.';
  }

  if (
    normalizedRawFinishReason === 'RECITATION' ||
    metadataText.includes('RECITATION')
  ) {
    return 'El modelo detuvo la respuesta porque detectó una posible recitación de contenido protegido. Intenta pedir una explicación o una versión original en vez de una reproducción exacta.';
  }

  return null;
}
