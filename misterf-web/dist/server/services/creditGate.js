import { getOpenRouterApiKeyForUser, getOpenRouterRemoteKeyInfoForUser, } from './openRouterUserKeys.js';
import { translate } from '../i18n/index.js';
const minimumLlmCreditUsd = 0.01;
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
export function getCreditExhaustedMessage(locale = 'es') {
    return translate(locale, 'credit.exhaustedFull');
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
        // OpenRouter refuses a request when the key's remaining limit cannot cover
        // the reserved output window: "This request requires more credits, or fewer
        // max_tokens. You requested up to 65536 tokens, but can only afford 29744."
        // The user still has some credit left, but no inference can run until they
        // add more, so it is the same product state.
        text.includes('requires more credits') ||
        text.includes('can only afford') ||
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