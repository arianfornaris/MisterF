import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '../../config/env.js';
import { translate } from '../../i18n/index.js';
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
    if (options.modelTier === 'lite') {
        return env.llmLiteModel;
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
    // OpenRouter ids are vendor-prefixed (e.g. `openai/gpt-5-mini`); match on
    // the model segment. GPT-5 and o-series models reject a custom temperature.
    const modelSegment = getConfiguredModelId(options).split('/').pop() ?? '';
    return !/^(gpt-5|o[134])/i.test(modelSegment);
}
export function getUserFacingFinishReasonMessage(finishReason, providerMetadata, locale = 'es') {
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
//# sourceMappingURL=providers.js.map