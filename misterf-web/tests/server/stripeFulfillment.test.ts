import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Stripe from 'stripe';
import { afterEach, describe, expect, it, vi } from 'vitest';

const openRouterMocks = vi.hoisted(() => ({
  ensureOpenRouterKeyForUser: vi.fn(),
  getOpenRouterKeyRecordForUser: vi.fn(),
  getOpenRouterRemoteKeyInfoForUser: vi.fn(),
  updateOpenRouterUserKeyLimit: vi.fn(),
}));

vi.mock('../../src/server/services/openRouterUserKeys.js', () => openRouterMocks);

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();
  vi.clearAllMocks();

  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
});

describe('Stripe credit fulfillment', () => {
  it('fulfills checkout.session.completed purchases idempotently', async () => {
    const context = await createPaymentTestContext();
    mockOpenRouterCreditUpdate({
      remainingAfterUsd: 3.25,
      remainingBeforeUsd: 1.25,
      usageUsd: 0.5,
    });
    const session = buildCheckoutSession({
      paymentIntentId: 'pi_completed',
      sessionId: 'cs_completed',
      userId: context.user.id,
    });

    await context.fulfillCheckoutSession({
      eventId: 'evt_checkout_completed',
      session,
    });
    await context.fulfillCheckoutSession({
      eventId: 'evt_checkout_completed_duplicate',
      session,
    });

    const purchase = context.findCreditPurchaseByCheckoutSession('cs_completed');
    expect(openRouterMocks.updateOpenRouterUserKeyLimit).toHaveBeenCalledOnce();
    expect(purchase).toMatchObject({
      creditedAmountCents: 200,
      remainingAfterUsd: 3.25,
      remainingBeforeUsd: 1.25,
      status: 'fulfilled',
      stripeCheckoutSessionId: 'cs_completed',
      stripeEventId: 'evt_checkout_completed',
      stripePaymentIntentId: 'pi_completed',
      userId: context.user.id,
    });
    expect(context.listFulfilledCreditPurchasesForUser(context.user.id)).toHaveLength(1);
  });

  it('marks failed fulfillment without creating a fulfilled ledger entry', async () => {
    const context = await createPaymentTestContext();
    openRouterMocks.ensureOpenRouterKeyForUser.mockResolvedValue(undefined);
    openRouterMocks.getOpenRouterKeyRecordForUser.mockReturnValue({
      keyHash: 'openrouter-key-hash',
      status: 'active',
    });
    openRouterMocks.getOpenRouterRemoteKeyInfoForUser.mockResolvedValue({
      limitRemaining: 1.25,
      usage: 0.5,
    });
    openRouterMocks.updateOpenRouterUserKeyLimit.mockRejectedValue(
      new Error('OpenRouter credit update failed.'),
    );

    await expect(
      context.fulfillCheckoutSession({
        eventId: 'evt_failed',
        session: buildCheckoutSession({
          paymentIntentId: 'pi_failed',
          sessionId: 'cs_failed',
          userId: context.user.id,
        }),
      }),
    ).rejects.toThrow('OpenRouter credit update failed.');

    const purchase = context.findCreditPurchaseByCheckoutSession('cs_failed');
    expect(purchase).toMatchObject({
      failureReason: 'OpenRouter credit update failed.',
      status: 'failed',
      stripeEventId: 'evt_failed',
      stripePaymentIntentId: 'pi_failed',
      userId: context.user.id,
    });
    expect(context.listFulfilledCreditPurchasesForUser(context.user.id)).toEqual([]);
  });
});

async function createPaymentTestContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-stripe-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'stripe.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();

  const { createExternalUser } = await import('../../src/server/auth/repository.js');
  const {
    findCreditPurchaseByCheckoutSession,
    listFulfilledCreditPurchasesForUser,
  } = await import('../../src/server/payments/repository.js');
  const { fulfillCheckoutSession } = await import('../../src/server/payments/credits.js');

  const user = createExternalUser({
    email: 'stripe-test@example.com',
    emailVerified: true,
    fullName: 'Stripe Test',
    provider: 'google',
    providerSubject: 'stripe-test',
  });

  return {
    findCreditPurchaseByCheckoutSession,
    fulfillCheckoutSession,
    listFulfilledCreditPurchasesForUser,
    user,
  };
}

function buildCheckoutSession(input: {
  paymentIntentId: string;
  sessionId: string;
  userId: string;
}): Stripe.Checkout.Session {
  return {
    id: input.sessionId,
    metadata: {
      packageCode: 'credits_200',
      userId: input.userId,
    },
    payment_intent: input.paymentIntentId,
  } as unknown as Stripe.Checkout.Session;
}

function mockOpenRouterCreditUpdate(input: {
  remainingAfterUsd: number;
  remainingBeforeUsd: number;
  usageUsd: number;
}): void {
  openRouterMocks.ensureOpenRouterKeyForUser.mockResolvedValue(undefined);
  openRouterMocks.getOpenRouterKeyRecordForUser.mockReturnValue({
    keyHash: 'openrouter-key-hash',
    status: 'active',
  });
  openRouterMocks.getOpenRouterRemoteKeyInfoForUser.mockResolvedValue({
    limitRemaining: input.remainingBeforeUsd,
    usage: input.usageUsd,
  });
  openRouterMocks.updateOpenRouterUserKeyLimit.mockResolvedValue({
    hash: 'openrouter-key-hash',
    limitRemaining: input.remainingAfterUsd,
  });
}

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
