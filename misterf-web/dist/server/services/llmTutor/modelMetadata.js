import { env } from '../../config/env.js';
import { logger } from '../logger.js';
const OPENROUTER_MODELS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
let cachedModelsAt = 0;
let cachedModelContexts = new Map();
let pendingModelsRequest = null;
async function fetchOpenRouterModelContexts() {
    const apiKey = env.openrouterApiKey;
    if (!apiKey) {
        return new Map();
    }
    const response = await fetch(`${env.openrouterBaseUrl}/models`, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });
    if (!response.ok) {
        throw new Error(`OpenRouter models request failed with ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json());
    const nextCache = new Map();
    for (const model of payload.data ?? []) {
        const modelId = model.id?.trim();
        const contextLength = model.top_provider?.context_length ?? model.context_length;
        if (!modelId || !Number.isFinite(contextLength) || !contextLength) {
            continue;
        }
        nextCache.set(modelId, contextLength);
    }
    return nextCache;
}
async function getOpenRouterModelContexts() {
    const now = Date.now();
    if (cachedModelContexts.size > 0 &&
        now - cachedModelsAt < OPENROUTER_MODELS_CACHE_TTL_MS) {
        return cachedModelContexts;
    }
    if (!pendingModelsRequest) {
        pendingModelsRequest = fetchOpenRouterModelContexts()
            .then((contexts) => {
            cachedModelContexts = contexts;
            cachedModelsAt = Date.now();
            return contexts;
        })
            .finally(() => {
            pendingModelsRequest = null;
        });
    }
    return pendingModelsRequest;
}
export async function resolveContextWindowTokens(modelId) {
    try {
        const contexts = await getOpenRouterModelContexts();
        const resolved = contexts.get(modelId);
        return Math.max(1, resolved ?? env.llmContextWindow);
    }
    catch (error) {
        logger.warn('openrouter_model_metadata_fallback', {
            error,
            fallbackContextWindowTokens: env.llmContextWindow,
            model: modelId,
        });
        return Math.max(1, env.llmContextWindow);
    }
}
//# sourceMappingURL=modelMetadata.js.map