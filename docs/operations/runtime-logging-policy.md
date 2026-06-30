# Runtime Logging Policy

Mister F writes structured JSON logs through the server logger in
`src/server/services/logger.ts`. Runtime code should not write directly to
`console.*` except through that logger. CLI scripts may still print short
operator-facing messages.

## Environment Controls

`LOG_LEVEL` controls which events are emitted:

- `debug`: full diagnostic stream for local development and temporary
  production investigations.
- `info`: normal production default. Emits startup, business events, LLM repair
  events, credit events, and warnings/errors.
- `warn`: warnings and errors only.
- `error`: errors only.

Production defaults to `LOG_LEVEL=info`. Development defaults to
`LOG_LEVEL=debug`.

`LLM_TRACE_MODE` controls how much LLM payload detail is allowed:

- `metadata`: no learner text, prompt text, raw model output, or tool payloads
  in normal LLM request/response logs.
- `full`: includes prompts, messages, raw model output, and tool payloads. Use
  only for local development or a short, deliberate investigation.
- `off`: disables LLM trace request/response/tool logs.

Production defaults to `LLM_TRACE_MODE=metadata`. Development defaults to
`LLM_TRACE_MODE=full`.

Full tracing can be targeted while keeping the default mode at `metadata`:

```bash
LOG_LEVEL=debug \
LLM_TRACE_MODE=metadata \
LLM_TRACE_FULL_USER_IDS=user_123 \
LLM_TRACE_FULL_CONVERSATION_IDS=conversation_abc
```

`LOG_LEVEL` still controls whether debug trace events are emitted. For a
conversation investigation in production, use `LOG_LEVEL=debug` temporarily and
target a specific user or conversation.

## Production Events

Production logs should be enough to reconstruct important failures and business
events without dumping learner conversations:

- `http_request_error`: unhandled Express route errors with stack traces.
- `csrf_validation_failed`: rejected unsafe form submissions or same-origin
  checks with non-sensitive request metadata.
- `frontend_error`: critical browser errors reported by the client telemetry
  endpoint after client/server deduplication and rate limiting.
- `credit_checkout_session_created`: a user started a Stripe checkout.
- `credit_fulfillment_succeeded`: Stripe fulfillment credited the user.
- `credit_fulfillment_failed`: Stripe fulfillment failed after webhook receipt.
- `credit_fulfillment_duplicate_ignored`: duplicate Stripe fulfillment was
  safely ignored.
- `credit_exhausted_http_redirect`, `credit_exhausted_socket_emit`,
  `credit_exhausted_room_emit`: a user exhausted credits and saw product UI.
- `llm_invalid_raw_response`: a model returned malformed raw text.
- `llm_response_validation_failed`: parsed LLM output did not match the tutor
  protocol.
- `llm_structured_correction_requested`: the tutor asked the model to repair a
  malformed structured response.
- `llm_block_repair_attempt` and `llm_response_repaired`: post-processing found
  and repaired block leakage.
- `resource_share_link_accepted`, `resource_shared_with_profile`,
  `resource_folder_created`, `resource_folder_updated`, `resource_archived`,
  `resource_restored`, `resource_moved_to_folder`, and
  `resource_removed_from_folder`: resource catalog actions with resource
  identifiers and type metadata.
- `quiz_attempt_started`, `quiz_attempt_submitted`,
  `quiz_attempt_evaluated`, `quiz_attempt_evaluation_failed`, and
  `quiz_follow_up_conversation_created`: quiz runtime events with
  quiz ids plus resource identifiers.
- `practice_guide_created`, `practice_guide_created_from_prompt`,
  `practice_guide_updated`, `practice_guide_revised`, and
  `practice_guide_conversation_created`: practice-guide resource lifecycle
  events.

Normal LLM request, response, and tool-call events are `debug` level:

- `llm_request`
- `llm_response`
- `llm_tool_calls`
- `llm_translator_response`
- Chatroom and tutor-report start/success events

## Redaction

The logger redacts known secret fields by key name, including API keys, cookies,
authorization headers, passwords, secrets, session tokens, CSRF tokens, and
refresh tokens.

Production metadata LLM logs do not include:

- learner message text
- system prompts
- raw model text
- tool inputs and outputs
- generated correction payloads

Identifiers that are useful for support remain visible, such as user IDs,
conversation IDs, resource IDs, resource types, Stripe checkout session IDs,
payment intent IDs, model IDs, token counts, and event names.

When a log event relates to a platform resource, include:

- `resourceId`
- `resourceType`
- `profileId` when the active profile is known
- owner ids such as `ownerUserId` or `ownerProfileId` only when useful for
  shared-resource diagnostics

Do not put resource descriptions, tutor instructions, quiz responses, or
other long learner-authored content in production-level logs. Full LLM tracing
is the opt-in path for content-level investigations.

## Performance

The logger writes one JSON line to stdout/stderr and does not write to the
database. Metadata logging is cheap. Full LLM tracing can produce large logs and
should be used narrowly because it increases stdout volume, PM2 log size, and
JSON serialization work.

## Browser Error Safety

Browser critical errors are sent to `/telemetry/client-error`. The client
deduplicates repeated failures, caps reports per route/fingerprint, and batches
repeat counts. The server also checks same-origin requests, limits payload size,
and rate-limits each session or IP window. See
`docs/operations/client-error-telemetry.md`.

## Verification

Useful checks:

```bash
npm test -- tests/server/logger.test.ts
npm run typecheck
rg "console\\." src/server src/client/chat/app/ChatRuntime.js
```

Expected `console.*` matches are limited to the central logger, the database
migration CLI success message, and the browser token debug log guarded by
`window.MisterFDebug.logLlmTokens === true`.
