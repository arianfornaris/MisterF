import { env } from '../config/env.js';
import { getOpenRouterApiKeyForUser, getOpenRouterRemoteKeyInfoForUser, } from './openRouterUserKeys.js';
const minimumLlmCreditUsd = 0.01;
/**
 * Platform-funded OpenRouter key for free public resources (e.g. anonymous quiz
 * attempts). Falls back to the general OPENROUTER_API_KEY when a dedicated free
 * key is not configured. Returns null when no key is available, in which case
 * the free flow must be disabled.
 */
export function getFreeResourceOpenRouterApiKey() {
    return env.openrouterFreeResourceApiKey || null;
}
export class CreditExhaustedError extends Error {
    constructor(message = getCreditExhaustedMessage()) {
        super(message);
        this.name = 'CreditExhaustedError';
    }
}
export async function getCreditCheckedOpenRouterApiKeyForUser(userId) {
    const apiKey = await getOpenRouterApiKeyForUser(userId);
    await assertUserHasLlmCredit(userId);
    return apiKey;
}
export async function assertUserHasLlmCredit(userId) {
    const remoteInfo = await getOpenRouterRemoteKeyInfoForUser(userId);
    const remainingUsd = remoteInfo?.limitRemaining;
    if (typeof remainingUsd === 'number' && remainingUsd < minimumLlmCreditUsd) {
        throw new CreditExhaustedError();
    }
}
export function getCreditExhaustedMessage() {
    return 'No tienes créditos suficientes para continuar esta práctica. Compra créditos para seguir usando Mr. F.';
}
export function isCreditExhaustedError(error) {
    if (error instanceof CreditExhaustedError) {
        return true;
    }
    const text = JSON.stringify(serializeError(error)).toLowerCase();
    return (text.includes('insufficient credit') ||
        text.includes('insufficient credits') ||
        text.includes('out of credits') ||
        text.includes('not enough credits') ||
        text.includes('credit limit') ||
        text.includes('credits exhausted') ||
        (text.includes('balance') && text.includes('credit')) ||
        (text.includes('402') && text.includes('credit')));
}
function serializeError(error) {
    if (error instanceof Error) {
        return {
            cause: serializeError(error.cause),
            message: error.message,
            name: error.name,
        };
    }
    return error;
}
//# sourceMappingURL=creditGate.js.map