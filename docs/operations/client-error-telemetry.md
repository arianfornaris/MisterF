# Client Error Telemetry

Created: 2026-06-18

Mister F reports critical browser-side errors to the server so production
failures that only happen in the client can be investigated from server logs.
This is intentionally narrow telemetry, not full frontend session recording.

## What Gets Reported

The browser reporter listens for:

- `window.error`
- `window.unhandledrejection`
- explicit calls to `window.MisterFClientTelemetry.reportError(...)`

The payload is small and sanitized before it is logged:

- event type
- level (`error` or `warning`)
- message
- truncated stack
- source file
- line and column
- route path
- conversation id inferred from `/c/:id`
- browser user agent
- fingerprint
- timestamp

The server enriches the event with:

- authenticated `userId`, when the session cookie can be resolved
- request IP

## What Must Not Be Reported

The client reporter must not send:

- learner message text
- full conversation content
- model responses
- cookies
- local storage contents
- DOM snapshots
- form field values
- API keys, session tokens, CSRF tokens, or Stripe secrets

The route is designed for critical diagnostics only.

## Anti-Spam Controls

The client applies all of these controls before sending:

- maximum 5 reports per page load
- maximum 3 reports per minute
- exact deduplication by `fingerprint`
- no retry loop
- `sendBeacon` first, `fetch(..., keepalive: true)` fallback
- reporter failures are swallowed

The server applies a second layer:

- `POST /telemetry/client-error`
- accepts only `application/json`
- maximum payload size: 16 KB
- same-origin check when the `Origin` header is present
- in-memory rate limit: 20 reports per session/IP per minute
- all accepted reports return `204`
- excessive, invalid, or oversized reports are dropped without expensive work

## Log Format

Accepted reports are written as structured log lines:

```text
[client-telemetry] {"event":"frontend_error","userId":"...","conversationId":"..."}
```

Rate-limited clients produce at most one structured warning per rate-limit
window:

```text
[client-telemetry] {"event":"frontend_error_rate_limited","userId":"..."}
```

## Operational Notes

Client telemetry is best-effort. It must never block the learner experience and
must never cause a secondary error loop. If telemetry fails, the page keeps
running normally.

This feature is complementary to LLM tracing. Client telemetry helps determine
whether a problem was caused by browser rendering, socket handling, or malformed
client payloads. It does not reconstruct the model prompt, model response, or
tool execution path.
