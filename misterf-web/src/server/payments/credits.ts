import Stripe from 'stripe';
import { env } from '../config/env.js';
import {
  ensureOpenRouterKeyForUser,
  getOpenRouterKeyRecordForUser,
  getOpenRouterRemoteKeyInfoForUser,
  updateOpenRouterUserKeyLimit,
} from '../services/openRouterUserKeys.js';
import { buildAbsoluteAppUrl } from '../pages/shell.js';
import {
  createPendingCreditPurchase,
  findCreditPurchaseByCheckoutSession,
  markCreditPurchaseFailed,
  markCreditPurchaseFulfilled,
} from './repository.js';
import { defaultCreditPackage, findCreditPackage } from './packages.js';
import type { AuthUser } from '../auth/repository.js';
import type { CreditPackage } from './packages.js';

let stripeClient: Stripe | null = null;

export type CreditBalance = {
  availableCredits: number | null;
  error: string;
  keyStatus: string;
  remainingUsd: number | null;
};

export function getStripeConfigurationError(): string {
  if (!env.stripeSecretKey) {
    return 'Falta configurar STRIPE_SECRET_KEY.';
  }

  return '';
}

export function getWebhookConfigurationError(): string {
  if (!env.stripeWebhookSecret) {
    return 'Falta configurar STRIPE_WEBHOOK_SECRET.';
  }

  return '';
}

export async function getCreditBalanceForUser(
  userId: string,
): Promise<CreditBalance> {
  try {
    await ensureOpenRouterKeyForUser(userId);
    const keyRecord = getOpenRouterKeyRecordForUser(userId);
    const remoteInfo = await getOpenRouterRemoteKeyInfoForUser(userId);
    const remainingUsd =
      typeof remoteInfo?.limitRemaining === 'number'
        ? remoteInfo.limitRemaining
        : null;

    return {
      availableCredits:
        remainingUsd === null ? null : Math.round(remainingUsd * 100),
      error: '',
      keyStatus: keyRecord?.status ?? 'pending',
      remainingUsd,
    };
  } catch (error) {
    const keyRecord = getOpenRouterKeyRecordForUser(userId);
    return {
      availableCredits: null,
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo consultar el saldo de créditos.',
      keyStatus: keyRecord?.status ?? 'error',
      remainingUsd: null,
    };
  }
}

export async function createCreditsCheckoutSession(input: {
  packageToBuy?: CreditPackage;
  user: AuthUser;
}): Promise<Stripe.Checkout.Session> {
  const configurationError = getStripeConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  const packageToBuy = input.packageToBuy ?? defaultCreditPackage;
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    cancel_url: buildAbsoluteAppUrl('/credits?checkout=cancelled'),
    customer_email: input.user.email,
    line_items: [
      {
        price_data: {
          currency: packageToBuy.currency,
          product_data: {
            description: packageToBuy.description,
            name: `${packageToBuy.label} para Mister F`,
          },
          unit_amount: packageToBuy.customerAmountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      packageCode: packageToBuy.code,
      userId: input.user.id,
    },
    mode: 'payment',
    payment_intent_data: {
      metadata: {
        packageCode: packageToBuy.code,
        userId: input.user.id,
      },
      receipt_email: input.user.email,
    },
    success_url: buildAbsoluteAppUrl(
      '/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    ),
  });

  createPendingCreditPurchase({
    creditedAmountCents: packageToBuy.creditedAmountCents,
    customerAmountCents: packageToBuy.customerAmountCents,
    packageCode: packageToBuy.code,
    stripeCheckoutSessionId: session.id,
    userId: input.user.id,
  });

  return session;
}

export async function constructStripeWebhookEvent(input: {
  body: Buffer;
  signature: string | string[] | undefined;
}): Promise<Stripe.Event> {
  const configurationError = getWebhookConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  if (typeof input.signature !== 'string') {
    throw new Error('Stripe webhook signature is missing.');
  }

  return getStripeClient().webhooks.constructEvent(
    input.body,
    input.signature,
    env.stripeWebhookSecret,
  );
}

export async function fulfillCheckoutSession(input: {
  eventId: string;
  session: Stripe.Checkout.Session;
}): Promise<void> {
  const sessionId = input.session.id;
  const existingPurchase = findCreditPurchaseByCheckoutSession(sessionId);
  if (existingPurchase?.status === 'fulfilled') {
    return;
  }

  const packageToBuy = findCreditPackage(input.session.metadata?.packageCode);
  const userId = input.session.metadata?.userId;
  const paymentIntentId = readStripeId(input.session.payment_intent);

  if (!packageToBuy || !userId) {
    throw new Error('Stripe session metadata is missing packageCode or userId.');
  }

  const purchase =
    existingPurchase ??
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
  } catch (error) {
    markCreditPurchaseFailed({
      failureReason:
        error instanceof Error ? error.message : 'Unknown fulfillment error.',
      stripeCheckoutSessionId: sessionId,
      stripeEventId: input.eventId,
      stripePaymentIntentId: paymentIntentId,
    });
    throw error;
  }
}

async function addOpenRouterCreditToUser(input: {
  creditUsd: number;
  userId: string;
}): Promise<{
  openrouterKeyHash: string | null;
  remainingAfterUsd: number | null;
  remainingBeforeUsd: number | null;
}> {
  await ensureOpenRouterKeyForUser(input.userId);

  const remoteInfo = await getOpenRouterRemoteKeyInfoForUser(input.userId);
  const remainingBeforeUsd =
    typeof remoteInfo?.limitRemaining === 'number'
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
    remainingAfterUsd:
      typeof updatedInfo.limitRemaining === 'number'
        ? updatedInfo.limitRemaining
        : nextRemainingUsd,
    remainingBeforeUsd,
  };
}

function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
}

function readStripeId(value: string | Stripe.PaymentIntent | null): string | null {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? value : value.id;
}

function resolveOpenRouterUsageUsd(
  remoteInfo: Awaited<ReturnType<typeof getOpenRouterRemoteKeyInfoForUser>>,
): number {
  if (!remoteInfo) {
    return 0;
  }

  if (typeof remoteInfo.usage === 'number') {
    return remoteInfo.usage;
  }

  if (
    typeof remoteInfo.limit === 'number' &&
    typeof remoteInfo.limitRemaining === 'number'
  ) {
    return Math.max(0, remoteInfo.limit - remoteInfo.limitRemaining);
  }

  return 0;
}

function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}
