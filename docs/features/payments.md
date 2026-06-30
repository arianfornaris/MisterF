# Payments and Credits Design

## Goal

Integrate Mister F with Stripe Checkout so authenticated users can buy credits for AI usage.

The first purchasable package is:

- price charged to the customer: `$5.00`
- OpenRouter credit added to the user's account: `$2.00`
- displayed app credits granted: `200 credits`

## Credit Model

### Unit definition

Credits are a user-facing abstraction over the OpenRouter balance.

Internal rule:

- `1 credit = 1 US cent = $0.01`

Examples:

- `$0.10` = `10 credits`
- `$2.00` = `200 credits`
- `$2.37` = `237 credits`

This conversion is an internal product/accounting rule. The customer-facing UI
should generally show credits as credits and should not explain or expose the
underlying OpenRouter dollar conversion unless an admin, support, or finance
workflow specifically needs it.

### Feature usage policy

The current standard policy is:

- tutor chat and follow-up tutor conversations consume the authenticated user's
  credits
- AI-assisted practice guide authoring consumes creator credits
- AI-assisted quiz authoring consumes creator credits
- quiz evaluation for shared students remains product-funded/free to the
  student when that special public flow is available
- Roleplay AI draft generation, AI revision, fictional character turns,
  evaluation, and follow-up tutor practice consume the authenticated user's
  credits

Future public/free Roleplay attempts may become an acquisition path, but that
requires an explicit policy, rate limiting, and abuse controls before launch.

### Source of truth

The real source of truth for available credit is the remaining monetary balance of the user's OpenRouter key.

That means the app should derive credits from:

- OpenRouter key `limit_remaining`

The app should not treat its own ledger as the authoritative balance for usage. The ledger exists for auditability and reconciliation, not as the balance engine.

### Display rule

For UI display:

- `displayCredits = Math.round(limitRemainingUsd * 100)`

Examples:

- `1.994` USD remaining -> `199` credits
- `1.995` USD remaining -> `200` credits

### Internal rule

For authorization and accounting logic:

- keep the exact decimal USD balance from OpenRouter
- do not make internal allow/deny decisions from the rounded UI number alone

## OpenRouter Key Strategy

### One key per user

Each user account should have exactly one managed OpenRouter key for app-funded usage.

This is already aligned with the current system direction:

- OpenRouter key ownership is account-level
- usage is shared across all profiles belonging to that account

### Free starter balance

When a user account is created, Mister F should provision an OpenRouter key with:

- `$0.10` limit
- `10 credits` shown in the app

This provides a small free starter balance.

### Purchases

When a user buys the `$5.00` package:

- the system does **not** create a second user-funded usage key
- instead, it updates the limit of the user's existing managed OpenRouter key

The effective increase is:

- `+ $2.00`

### Top-up calculation

If the user already has an OpenRouter key, the system should:

1. read the current key state
2. determine current remaining balance
3. update the key limit so that the new available remaining balance becomes:

```text
newRemainingUsd = currentRemainingUsd + purchasedUsd
```

Where:

- `purchasedUsd = 2.00`

The exact OpenRouter API update details may depend on how the provider exposes key updates, but the business rule is that the user keeps the remainder and receives an additional `$2.00`.

### Missing key recovery

If the user somehow has no managed OpenRouter key at purchase fulfillment time:

- create a new one
- initialize it with the purchased balance
- persist it in the local database

This is a recovery path, not the normal path.

## Stripe Integration

### Checkout product

The first Stripe Checkout product is a fixed package:

- customer-facing product: `200 credits`
- Stripe price: `$5.00`

This should be modeled as a server-created or dashboard-created Stripe Price used by Checkout Sessions.

### Checkout mode

Use:

- Stripe Checkout
- hosted payment page
- one-time payment mode

### Success flow

The browser redirect after payment is useful for UX, but it must not be the authoritative fulfillment signal.

The authoritative fulfillment signal must be:

- Stripe webhook

Primary event:

- `checkout.session.completed`

If asynchronous payment methods are later enabled, also consider:

- `checkout.session.async_payment_succeeded`

## Fulfillment Flow

### High-level flow

1. Authenticated user clicks a buy-credits CTA.
2. Server creates a Stripe Checkout Session.
3. Session metadata includes the internal user id and package code.
4. User completes payment on Stripe Checkout.
5. Stripe sends webhook event to Mister F.
6. Mister F verifies the webhook signature.
7. Mister F checks whether the Checkout Session has already been fulfilled.
8. Mister F reads the user's current managed OpenRouter key state.
9. Mister F increments the effective remaining balance by `$2.00`.
10. Mister F records the fulfillment in its own ledger.
11. User later sees updated credits in the UI.

### Idempotency

Fulfillment must be idempotent.

That means:

- the same Stripe Checkout Session must never grant credits twice
- the same Stripe webhook event must never grant credits twice

Practical rule:

- store a fulfillment record keyed by Stripe Checkout Session id
- optionally also store Stripe event id for diagnostics

If the session was already fulfilled:

- return success from the webhook handler
- do not grant more balance

### Failure handling

If the payment succeeds but OpenRouter update fails:

- do not silently ignore it
- record fulfillment as failed or pending remediation
- preserve enough metadata to retry safely

Recommended states:

- `pending`
- `fulfilled`
- `failed`

## Internal Ledger

Even though OpenRouter is the balance source of truth, Mister F should maintain an internal payments and credits ledger.

### Purpose

The ledger is for:

- auditability
- support/debugging
- reconciliation
- idempotency
- future refunds and adjustments

### Recommended records

At minimum, track:

- internal record id
- `user_id`
- `stripe_checkout_session_id`
- `stripe_payment_intent_id` if available
- `stripe_event_id`
- package code
- amount paid by customer in cents
- amount credited to OpenRouter in USD cents
- status
- OpenRouter key identifier affected
- old remaining balance snapshot
- new remaining balance snapshot
- creation and update timestamps

### Recommended tables

Possible table structure:

#### `credit_purchases`

- `id`
- `user_id`
- `stripe_checkout_session_id`
- `stripe_payment_intent_id`
- `stripe_event_id`
- `package_code`
- `customer_amount_cents`
- `credited_amount_cents`
- `status`
- `openrouter_key_label`
- `openrouter_key_hash`
- `remaining_before_usd`
- `remaining_after_usd`
- `failure_reason`
- `created_at`
- `updated_at`

#### `credit_adjustments`

Optional future table for manual corrections, refunds, grants, or admin actions.

## User Experience

### Where credits belong

Credits belong to the account, not to a profile.

This means:

- one user sees one shared credit balance
- all profiles draw from the same funded OpenRouter key

### What to show in the UI

Recommended visible information:

- current credits
- buy credits CTA
- recent fulfilled purchase history

Optional later additions:

- last top-up date
- admin/support views for pending or failed fulfillments

### Display wording

Recommended wording:

- `200 credits`
- `Credits are shared across all profiles in this account`

Avoid user-facing wording that explains credits as a direct OpenRouter dollar
conversion. Users buy and spend Mister F credits; OpenRouter balance details are
an implementation detail.

## Feature-Specific Credit Policies

### Quizzes

`Quizzes` are a teacher-assigned practice feature and an acquisition
path.

Credit policy:

- creating a Quiz requires an authenticated teacher account
- the Quiz authoring flow is credit-gated for the teacher
- AI draft generation, single-block generation from the add-block modal,
  and AI-assisted revisions are teacher-paid authoring usage
- manual edits inside the authoring workspace do not consume LLM credits unless
  they trigger AI validation or evaluation
- starting a Quiz attempt with `Probar` does not consume LLM credits
- submitting a Quiz attempt uses the same product-funded evaluation policy as
  student Quiz attempts
- current generic resource sharing requires the student to create an account or
  log in before using a shared Quiz
- a future quiz-specific public flow should allow a shared Quiz to be
  completed by a student without an account
- the AI evaluation after that future public shared-Quiz submission should be
  free to the student
- free shared-Quiz evaluation should be product-funded acquisition usage, not
  usage charged to an anonymous student and not a hidden post-share charge to
  the teacher
- after seeing the result in that future public flow, follow-up practice with
  Mr. F should require the student to create an account or log in
- follow-up tutor conversations use the standard account credit policy

Operational requirements:

- the UI should distinguish teacher-paid authoring usage from free student
  evaluation
- free guest evaluations must be rate-limited and abuse-resistant
- production logs should record `resourceId`, `resourceType`, quiz ids,
  attempt ids, and status metadata without storing full learner answers unless
  full LLM tracing is explicitly enabled
- if a guest creates an account after evaluation, the app may attach the result
  to the new profile and then record progress
- teacher-funded or organization-funded student follow-up can be explored later,
  but it should be explicit billing functionality rather than an exception to
  normal user credit behavior

## Security and Operational Considerations

### Webhook verification

Always verify Stripe webhook signatures with the configured webhook secret.

### Server-side ownership

Never trust user-provided price or credit amounts from the browser.

The server should own:

- which package is being sold
- how much it costs in Stripe
- how much OpenRouter value it grants

### Metadata

Stripe Checkout Session metadata should include at least:

- `userId`
- `packageCode`

This avoids guessing who should receive the credits during webhook fulfillment.

### Concurrency

Two top-ups arriving close together should not overwrite each other.

The update logic should be written so that:

- remaining balance is read safely
- the resulting OpenRouter limit update is derived deterministically
- ledger writes and fulfillment marking are consistent

### Refunds

This first version does not need automatic refund handling, but the ledger should make it possible later.

Possible future policy choices:

- Stripe refund does not automatically claw back credits already used
- Stripe refund creates a manual review case
- Stripe refund subtracts remaining unused purchased balance if available

## Implementation Phases

### Phase 1

- add payment and credit ledger tables
- add Stripe Checkout session creation endpoint
- add Stripe webhook endpoint
- provision free starter key with `$0.10` on user creation
- top up existing managed OpenRouter key by `$2.00` on successful package purchase
- expose current account credit balance in the UI
- show recent fulfilled purchases in the credits page

### Phase 2

- add admin visibility into payment and fulfillment state
- add operational retry tooling for failed fulfillments

### Phase 3

- support more packages
- support promo grants
- support refund-aware balance adjustments

## Final Business Rules

The agreed rules for the first implementation are:

- each user has one managed OpenRouter key
- that key is shared across all profiles
- new users receive `10 free credits`
- the first paid package costs `$5.00`
- that package grants `$2.00` of OpenRouter-funded usage
- credits shown in the app are derived from OpenRouter remaining balance
- `1 credit = $0.01`
- displayed credits are rounded from remaining USD balance
- payment fulfillment is driven by Stripe webhook
- Mister F keeps an internal ledger for purchases and fulfillment
- creating a Quiz is an authenticated, credit-gated teacher authoring workflow
- AI-assisted Quiz draft generation, single-block generation, and revision are
  teacher-paid usage
- generic shared Quiz usage currently requires an account
- future public shared Quiz completion can be free for students without
  accounts through a product-funded evaluation policy
- post-result follow-up tutoring from a Quiz uses the student's standard
  account and credit policy
