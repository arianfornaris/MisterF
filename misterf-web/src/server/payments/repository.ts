import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
import type { CreditPackageCode } from './packages.js';

type CreditPurchaseRow = {
  created_at: string;
  credited_amount_cents: number;
  customer_amount_cents: number;
  failure_reason: string | null;
  id: string;
  openrouter_key_hash: string | null;
  package_code: CreditPackageCode;
  remaining_after_usd: number | null;
  remaining_before_usd: number | null;
  status: 'failed' | 'fulfilled' | 'pending';
  stripe_checkout_session_id: string;
  stripe_event_id: string | null;
  stripe_payment_intent_id: string | null;
  updated_at: string;
  user_id: string;
};

export type CreditPurchase = {
  createdAt: string;
  creditedAmountCents: number;
  customerAmountCents: number;
  failureReason: string | null;
  id: string;
  openrouterKeyHash: string | null;
  packageCode: CreditPackageCode;
  remainingAfterUsd: number | null;
  remainingBeforeUsd: number | null;
  status: 'failed' | 'fulfilled' | 'pending';
  stripeCheckoutSessionId: string;
  stripeEventId: string | null;
  stripePaymentIntentId: string | null;
  updatedAt: string;
  userId: string;
};

export function createPendingCreditPurchase(input: {
  creditedAmountCents: number;
  customerAmountCents: number;
  packageCode: CreditPackageCode;
  stripeCheckoutSessionId: string;
  userId: string;
}): CreditPurchase {
  getDb()
    .prepare(
      `
        INSERT INTO credit_purchases (
          id,
          user_id,
          stripe_checkout_session_id,
          package_code,
          customer_amount_cents,
          credited_amount_cents,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
        ON CONFLICT(stripe_checkout_session_id) DO NOTHING
      `,
    )
    .run(
      randomUUID(),
      input.userId,
      input.stripeCheckoutSessionId,
      input.packageCode,
      input.customerAmountCents,
      input.creditedAmountCents,
    );

  const purchase = findCreditPurchaseByCheckoutSession(
    input.stripeCheckoutSessionId,
  );
  if (!purchase) {
    throw new Error('Could not load pending credit purchase.');
  }

  return purchase;
}

export function findCreditPurchaseByCheckoutSession(
  stripeCheckoutSessionId: string,
): CreditPurchase | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          stripe_event_id,
          package_code,
          customer_amount_cents,
          credited_amount_cents,
          status,
          openrouter_key_hash,
          remaining_before_usd,
          remaining_after_usd,
          failure_reason,
          created_at,
          updated_at
        FROM credit_purchases
        WHERE stripe_checkout_session_id = ?
      `,
    )
    .get(stripeCheckoutSessionId) as CreditPurchaseRow | undefined;

  return row ? toCreditPurchase(row) : null;
}

export function listCreditPurchasesForUser(userId: string): CreditPurchase[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          user_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          stripe_event_id,
          package_code,
          customer_amount_cents,
          credited_amount_cents,
          status,
          openrouter_key_hash,
          remaining_before_usd,
          remaining_after_usd,
          failure_reason,
          created_at,
          updated_at
        FROM credit_purchases
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 20
      `,
    )
    .all(userId) as CreditPurchaseRow[];

  return rows.map(toCreditPurchase);
}

export function markCreditPurchaseFulfilled(input: {
  openrouterKeyHash: string | null;
  remainingAfterUsd: number | null;
  remainingBeforeUsd: number | null;
  stripeCheckoutSessionId: string;
  stripeEventId: string;
  stripePaymentIntentId: string | null;
}): void {
  getDb()
    .prepare(
      `
        UPDATE credit_purchases
        SET
          stripe_payment_intent_id = ?,
          stripe_event_id = ?,
          status = 'fulfilled',
          openrouter_key_hash = ?,
          remaining_before_usd = ?,
          remaining_after_usd = ?,
          failure_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_checkout_session_id = ?
      `,
    )
    .run(
      input.stripePaymentIntentId,
      input.stripeEventId,
      input.openrouterKeyHash,
      input.remainingBeforeUsd,
      input.remainingAfterUsd,
      input.stripeCheckoutSessionId,
    );
}

export function markCreditPurchaseFailed(input: {
  failureReason: string;
  stripeCheckoutSessionId: string;
  stripeEventId: string;
  stripePaymentIntentId: string | null;
}): void {
  getDb()
    .prepare(
      `
        UPDATE credit_purchases
        SET
          stripe_payment_intent_id = ?,
          stripe_event_id = ?,
          status = 'failed',
          failure_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_checkout_session_id = ?
      `,
    )
    .run(
      input.stripePaymentIntentId,
      input.stripeEventId,
      input.failureReason.slice(0, 1000),
      input.stripeCheckoutSessionId,
    );
}

function toCreditPurchase(row: CreditPurchaseRow): CreditPurchase {
  return {
    createdAt: row.created_at,
    creditedAmountCents: row.credited_amount_cents,
    customerAmountCents: row.customer_amount_cents,
    failureReason: row.failure_reason,
    id: row.id,
    openrouterKeyHash: row.openrouter_key_hash,
    packageCode: row.package_code,
    remainingAfterUsd: row.remaining_after_usd,
    remainingBeforeUsd: row.remaining_before_usd,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripeEventId: row.stripe_event_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}
