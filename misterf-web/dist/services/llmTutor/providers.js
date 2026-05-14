import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '../../config/env.js';
import { MissingLlmApiKeyError } from './errors.js';
export function getConfiguredModelId(options = {}) {
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
export function getLanguageModel(options = {}) {
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
export function getProviderOptions() {
    return {
        openrouter: {
            reasoning: {
                effort: env.openrouterReasoningEffort,
                exclude: true,
            },
        },
    };
}
export function shouldUseTemperature(options = {}) {
    return !/^(gpt-5|o[134]|o4)/i.test(getConfiguredModelId(options));
}
export function getUserFacingFinishReasonMessage(finishReason, rawFinishReason, providerMetadata) {
    const normalizedRawFinishReason = rawFinishReason?.toUpperCase() ?? '';
    const metadataText = JSON.stringify(providerMetadata ?? {}).toUpperCase();
    if (finishReason === 'length' || normalizedRawFinishReason === 'MAX_TOKENS') {
        return 'La respuesta del modelo se cortó porque alcanzó el límite máximo de tokens. Intenta enviar un mensaje más corto o vuelve a pedirlo en partes.';
    }
    if (finishReason === 'content-filter' ||
        normalizedRawFinishReason === 'SAFETY') {
        return 'El modelo detuvo la respuesta por sus filtros de seguridad. Prueba reformulando tu mensaje con un contexto más claro y neutral.';
    }
    if (normalizedRawFinishReason === 'RECITATION' ||
        metadataText.includes('RECITATION')) {
        return 'El modelo detuvo la respuesta porque detectó una posible recitación de contenido protegido. Intenta pedir una explicación o una versión original en vez de una reproducción exacta.';
    }
    return null;
}
//# sourceMappingURL=providers.js.map