import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
export function createPendingCreditPurchase(input) {
    getDb()
        .prepare(`
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
      `)
        .run(randomUUID(), input.userId, input.stripeCheckoutSessionId, input.packageCode, input.customerAmountCents, input.creditedAmountCents);
    const purchase = findCreditPurchaseByCheckoutSession(input.stripeCheckoutSessionId);
    if (!purchase) {
        throw new Error('Could not load pending credit purchase.');
    }
    return purchase;
}
export function findCreditPurchaseByCheckoutSession(stripeCheckoutSessionId) {
    const row = getDb()
        .prepare(`
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
      `)
        .get(stripeCheckoutSessionId);
    return row ? toCreditPurchase(row) : null;
}
export function listCreditPurchasesForUser(userId) {
    const rows = getDb()
        .prepare(`
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
      `)
        .all(userId);
    return rows.map(toCreditPurchase);
}
export function markCreditPurchaseFulfilled(input) {
    getDb()
        .prepare(`
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
      `)
        .run(input.stripePaymentIntentId, input.stripeEventId, input.openrouterKeyHash, input.remainingBeforeUsd, input.remainingAfterUsd, input.stripeCheckoutSessionId);
}
export function markCreditPurchaseFailed(input) {
    getDb()
        .prepare(`
        UPDATE credit_purchases
        SET
          stripe_payment_intent_id = ?,
          stripe_event_id = ?,
          status = 'failed',
          failure_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_checkout_session_id = ?
      `)
        .run(input.stripePaymentIntentId, input.stripeEventId, input.failureReason.slice(0, 1000), input.stripeCheckoutSessionId);
}
function toCreditPurchase(row) {
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
//# sourceMappingURL=repository.js.map