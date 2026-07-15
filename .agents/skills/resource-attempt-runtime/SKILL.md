---
name: resource-attempt-runtime
description: Use when adding, editing, or reviewing Mister F resource attempt flows, including quiz attempts, roleplay attempts, attempt snapshots, attempt statuses, evaluation runs, result pages, guest/claim tokens, or teacher test attempts.
---

# Resource Attempt Runtime

Use this skill with `learner-progress-events` for evaluated results,
`llm-credit-gate` for evaluation calls, and `database-migration-safety` for
persisted attempt data.

## Core Rules

- The attempt lifecycle is start -> freeze -> run -> finish -> evaluate ->
  result -> optional follow-up. Keep new attempt-like features on this shape.
- Freeze at start: every attempt stores a content snapshot (for example
  `quiz_attempts.snapshot_json`) so later edits to the resource never change a
  running or finished attempt.
- Attempt status progresses `draft -> submitted -> evaluating -> evaluated`
  with `failed` as the error state. Result pages render from the stored
  result, never by re-running evaluation.
- Evaluation always runs on the attempting user's own credit-gated key. There
  is no platform-funded evaluation key.
- Anonymous quiz attempts use a `guest_token` (access) and `claim_token`
  (ownership transfer after signup); claiming attaches user and profile before
  evaluating. Guest attempt creation is rate limited per IP.
- Teacher/owner "test" attempts are normal attempt rows started from the
  detail page (`/quizzes/:quizId/test-attempts`) using the student-facing UI.
  Do not introduce a separate persisted preview/test attempt mode.
- Roleplay attempts generate the AI character's first line dynamically at
  start and evaluate only after the learner explicitly finishes the exchange.
- Authenticated evaluated attempts record learner progress events with
  `details.resourceId` and `details.resourceType`; guest attempts record
  progress only after being claimed.
- Log attempt lifecycle events (`*_attempt_started`, evaluation outcomes) with
  `resourceId` and `resourceType`.

## Checks Before Finishing

- Verify the snapshot is read from the attempt, not the live resource, on
  attempt and result pages.
- Verify insufficient credit surfaces as product UI (buy-credits link on the
  attempt page), not a raw evaluation error.
- Add repository/route tests for new lifecycle transitions; LLM evaluation
  itself is not tested (no live inference in tests).
- Run typecheck/tests and restart the local server when server or view code
  changed.
