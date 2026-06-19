# V1 LLM, Credit, And Payment Guardrails

Created: 2026-06-18

This document inventories server-side LLM calls and the guardrails added for
credit exhaustion and Stripe fulfillment before the first production version.

## LLM Call Inventory

Every direct `generateText` call is kept inside `src/server/services/**`.
HTTP handlers, socket handlers, and LLM tools must obtain an OpenRouter API key
through `getCreditCheckedOpenRouterApiKeyForUser(userId)` before invoking these
services.

| File | Calls | Service surface | Credit gate |
| --- | ---: | --- | --- |
| `src/server/services/resourceDrafts.ts` | 1 | Practice module and chat room draft generation | `practiceModules/handlers.ts` and `chatrooms/handlers.ts` call `getCreditCheckedOpenRouterApiKeyForUser` before passing `openRouterApiKey`. |
| `src/server/services/chatrooms.ts` | 4 | Chat room turn generation, user-message evaluation, conversation report generation, report-to-practice-module generation | `chatrooms/handlers.ts` gates HTTP flows before calling the service. |
| `src/server/services/tutorReports.ts` | 2 | Tutor conversation report generation and tutor-report-to-practice-module generation | `chat/handlers.ts` gates report and module creation flows before calling the service. |
| `src/server/services/llmTutor/index.ts` | 4 | Tutor agent loop, internal tool continuation, translator, quiz result evaluation | `socket/chatSocket.ts` builds `LlmRequestOptions` with `getCreditCheckedOpenRouterApiKeyForUser`. |
| `src/server/services/llmTutor/blockRepair.ts` | 1 | Tutor block repair after a gated tutor agent call | Inherits the same `llm` options from `runTutorAgentLoop`; it is not a standalone user entrypoint. |

The static architecture test
`tests/server/llmCreditGateArchitecture.test.ts` now fails if a new
server-side `generateText` call is added without updating this inventory and
without keeping the call in the service layer.

## Credit Exhaustion Coverage

Credit exhaustion should be a product state, not an Express or socket error.

Covered behavior:

- Tutor report generation redirects back to the conversation with
  `credit=exhausted` and `creditMessage`.
- Chat room report-to-practice-module generation redirects back to the report
  view with `credit=exhausted` and `creditMessage`.
- Socket flows emit `llm:credit_exhausted` with the shared user-facing credit
  message.
- Non-credit errors do not emit `llm:credit_exhausted`.

The socket credit event helpers now live in
`src/server/socket/creditExhaustion.ts`, which keeps the behavior directly
testable without booting Socket.IO.

## Stripe Fulfillment Coverage

Stripe webhook and fulfillment coverage now verifies:

- `checkout.session.completed` events call `fulfillCheckoutSession`.
- A fulfilled checkout session does not credit OpenRouter more than once when
  the same session is delivered again.
- The `credit_purchases` ledger stores the original fulfillment event,
  payment intent, credited amount, and remaining-balance snapshots.
- Failed OpenRouter fulfillment marks the purchase `failed`, records the
  failure reason, and does not create a fulfilled purchase entry.

No database migration was required for this phase. The existing
`credit_purchases.stripe_checkout_session_id` unique constraint and fulfillment
status fields are sufficient for the tested idempotency behavior.
