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

export function shouldUseTemperature(): boolean {
  return !/^(gpt-5|o[134]|o4)/i.test(env.llmModel);
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
