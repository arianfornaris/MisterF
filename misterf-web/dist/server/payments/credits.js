import Stripe from 'stripe';
import { env } from '../config/env.js';
import { ensureOpenRouterKeyForUser, getOpenRouterKeyRecordForUser, getOpenRouterRemoteKeyInfoForUser, updateOpenRouterUserKeyLimit, } from '../services/openRouterUserKeys.js';
import { buildAbsoluteAppUrl } from '../pages/shell.js';
import { createPendingCreditPurchase, findCreditPurchaseByCheckoutSession, markCreditPurchaseFailed, markCreditPurchaseFulfilled, } from './repository.js';
import { logger } from '../services/logger.js';
import { defaultCreditPackage, findCreditPackage } from './packages.js';
let stripeClient = null;
export function getStripeConfigurationError() {
    if (!env.stripeSecretKey) {
        return 'Falta configurar STRIPE_SECRET_KEY.';
    }
    if (!env.stripeCredits200PriceId) {
        return 'Falta configurar STRIPE_CREDITS_200_PRICE_ID.';
    }
    return '';
}
export function getWebhookConfigurationError() {
    if (!env.stripeWebhookSecret) {
        return 'Falta configurar STRIPE_WEBHOOK_SECRET.';
    }
    return '';
}
export async function getCreditBalanceForUser(userId) {
    try {
        await ensureOpenRouterKeyForUser(userId);
        const keyRecord = getOpenRouterKeyRecordForUser(userId);
        const remoteInfo = await getOpenRouterRemoteKeyInfoForUser(userId);
        const remainingUsd = typeof remoteInfo?.limitRemaining === 'number'
            ? remoteInfo.limitRemaining
            : null;
        return {
            availableCredits: remainingUsd === null ? null : Math.round(remainingUsd * 100),
            error: '',
            keyStatus: keyRecord?.status ?? 'pending',
            remainingUsd,
        };
    }
    catch (error) {
        const keyRecord = getOpenRouterKeyRecordForUser(userId);
        return {
            availableCredits: null,
            error: error instanceof Error
                ? error.message
                : 'No se pudo consultar el saldo de créditos.',
            keyStatus: keyRecord?.status ?? 'error',
            remainingUsd: null,
        };
    }
}
export async function createCreditsCheckoutSession(input) {
    const configurationError = getStripeConfigurationError();
    if (configurationError) {
        throw new Error(configurationError);
    }
    const packageToBuy = input.packageToBuy ?? defaultCreditPackage;
    const returnTo = input.returnTo || '/credits';
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
        cancel_url: buildAbsoluteAppUrl(appendQueryString('/credits', {
            checkout: 'cancelled',
            returnTo,
        })),
        customer_email: input.user.email,
        line_items: [
            {
                price: env.stripeCredits200PriceId,
                quantity: 1,
            },
        ],
        metadata: {
            packageCode: packageToBuy.code,
            returnTo,
            userId: input.user.id,
        },
        mode: 'payment',
        payment_intent_data: {
            metadata: {
                packageCode: packageToBuy.code,
                returnTo,
                userId: input.user.id,
            },
            receipt_email: input.user.email,
        },
        success_url: buildAbsoluteAppUrl(appendRawQueryString(returnTo, 'credits=success&session_id={CHECKOUT_SESSION_ID}')),
    });
    createPendingCreditPurchase({
        creditedAmountCents: packageToBuy.creditedAmountCents,
        customerAmountCents: packageToBuy.customerAmountCents,
        packageCode: packageToBuy.code,
        stripeCheckoutSessionId: session.id,
        userId: input.user.id,
    });
    logger.info('credit_checkout_session_created', {
        creditedAmountCents: packageToBuy.creditedAmountCents,
        customerAmountCents: packageToBuy.customerAmountCents,
        packageCode: packageToBuy.code,
        returnTo,
        stripeCheckoutSessionId: session.id,
        userId: input.user.id,
    });
    return session;
}
export async function constructStripeWebhookEvent(input) {
    const configurationError = getWebhookConfigurationError();
    if (configurationError) {
        throw new Error(configurationError);
    }
    if (typeof input.signature !== 'string') {
        throw new Error('Stripe webhook signature is missing.');
    }
    return getStripeClient().webhooks.constructEvent(input.body, input.signature, env.stripeWebhookSecret);
}
export async function fulfillCheckoutSession(input) {
    const sessionId = input.session.id;
    const existingPurchase = findCreditPurchaseByCheckoutSession(sessionId);
    if (existingPurchase?.status === 'fulfilled') {
        logger.info('credit_fulfillment_duplicate_ignored', {
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
            userId: existingPurchase.userId,
        });
        return;
    }
    const packageToBuy = findCreditPackage(input.session.metadata?.packageCode);
    const userId = input.session.metadata?.userId;
    const paymentIntentId = readStripeId(input.session.payment_intent);
    if (!packageToBuy || !userId) {
        logger.error('credit_fulfillment_metadata_missing', {
            hasPackageCode: Boolean(input.session.metadata?.packageCode),
            hasUserId: Boolean(userId),
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
        });
        throw new Error('Stripe session metadata is missing packageCode or userId.');
    }
    const purchase = existingPurchase ??
        createPendingCreditPurchase({
            creditedAmountCents: packageToBuy.creditedAmountCents,
            customerAmountCents: packageToBuy.customerAmountCents,
            packageCode: packageToBuy.code,
            stripeCheckoutSessionId: sessionId,
            userId,
        });
    try {
        const result = await addOpenRouterCreditToUser({
            creditUsd: purchase.creditedAmountCents / 100,
            userId: purchase.userId,
        });
        markCreditPurchaseFulfilled({
            openrouterKeyHash: result.openrouterKeyHash,
            remainingAfterUsd: result.remainingAfterUsd,
            remainingBeforeUsd: result.remainingBeforeUsd,
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
            stripePaymentIntentId: paymentIntentId,
        });
        logger.info('credit_fulfillment_succeeded', {
            creditedAmountCents: purchase.creditedAmountCents,
            packageCode: purchase.packageCode,
            remainingAfterUsd: result.remainingAfterUsd,
            remainingBeforeUsd: result.remainingBeforeUsd,
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
            stripePaymentIntentId: paymentIntentId,
            userId: purchase.userId,
        });
    }
    catch (error) {
        markCreditPurchaseFailed({
            failureReason: error instanceof Error ? error.message : 'Unknown fulfillment error.',
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
            stripePaymentIntentId: paymentIntentId,
        });
        logger.error('credit_fulfillment_failed', {
            error,
            packageCode: purchase.packageCode,
            stripeCheckoutSessionId: sessionId,
            stripeEventId: input.eventId,
            stripePaymentIntentId: paymentIntentId,
            userId: purchase.userId,
        });
        throw error;
    }
}
async function addOpenRouterCreditToUser(input) {
    await ensureOpenRouterKeyForUser(input.userId);
    const remoteInfo = await getOpenRouterRemoteKeyInfoForUser(input.userId);
    const remainingBeforeUsd = typeof remoteInfo?.limitRemaining === 'number'
        ? remoteInfo.limitRemaining
        : null;
    const usageUsd = resolveOpenRouterUsageUsd(remoteInfo);
    const nextRemainingUsd = (remainingBeforeUsd ?? 0) + input.creditUsd;
    const nextLimitUsd = roundUsd(usageUsd + nextRemainingUsd);
    const updatedInfo = await updateOpenRouterUserKeyLimit({
        disabled: false,
        limitReset: remoteInfo?.limitReset ?? null,
        limitUsd: nextLimitUsd,
        userId: input.userId,
    });
    const keyRecord = getOpenRouterKeyRecordForUser(input.userId);
    return {
        openrouterKeyHash: keyRecord?.keyHash ?? updatedInfo.hash ?? null,
        remainingAfterUsd: typeof updatedInfo.limitRemaining === 'number'
            ? updatedInfo.limitRemaining
            : nextRemainingUsd,
        remainingBeforeUsd,
    };
}
function getStripeClient() {
    if (!stripeClient) {
        stripeClient = new Stripe(env.stripeSecretKey);
    }
    return stripeClient;
}
function readStripeId(value) {
    if (!value) {
        return null;
    }
    return typeof value === 'string' ? value : value.id;
}
function resolveOpenRouterUsageUsd(remoteInfo) {
    if (!remoteInfo) {
        return 0;
    }
    if (typeof remoteInfo.usage === 'number') {
        return remoteInfo.usage;
    }
    if (typeof remoteInfo.limit === 'number' &&
        typeof remoteInfo.limitRemaining === 'number') {
        return Math.max(0, remoteInfo.limit - remoteInfo.limitRemaining);
    }
    return 0;
}
function roundUsd(value) {
    return Math.round(value * 10000) / 10000;
}
function appendQueryString(path, params) {
    const query = new URLSearchParams(params).toString();
    return appendRawQueryString(path, query);
}
function appendRawQueryString(path, query) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${query}`;
}
//# sourceMappingURL=credits.js.map