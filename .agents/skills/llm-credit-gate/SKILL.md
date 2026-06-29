---
name: llm-credit-gate
description: Use when adding, editing, or reviewing any Mister F server flow that invokes an LLM, OpenRouter, `generateText`, tutor report generation, quiz evaluation, translator inference, resource generation, practice-guide generation, or chat socket assistant streaming. Ensure credit is checked and insufficient-credit errors show product UI, not raw stack traces.
---

# LLM Credit Gate

Every model inference path must validate user credit and handle credit exhaustion
as a normal product state.

## Rules

- Before user-scoped LLM inference, call `getCreditCheckedOpenRouterApiKeyForUser(user.id)` or an equivalent shared credit gate.
- Do not call model providers directly in user flows without a credit gate.
- Catch `CreditExhaustedError` or use `isCreditExhaustedError(error)` at HTTP boundaries.
- Never let insufficient credit render an Express stack trace or generic error page.
- Socket flows should emit `llm:credit_exhausted` so the chat client can show the credits modal.
- HTTP form flows should redirect back to the relevant product page with enough query state for the UI to show the credits modal or a clear Bootstrap alert.
- Preserve return paths to `/credits?returnTo=...` so successful purchase returns the learner to the original task.
- Keep the user-facing message warm and actionable: explain that credits are insufficient and show `Comprar créditos`.

## Review Checklist

- The LLM call path has an explicit credit check.
- `CreditExhaustedError` is handled before any generic error handler.
- The failure UI is Bootstrap/product UI, not raw technical output.
- The credits CTA includes a return path to the current conversation or page.
- Non-credit model errors can still bubble to normal error handling or a specific feature error UI.
