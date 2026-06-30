---
name: testing-conventions
description: Use when adding, editing, reviewing, or running Mister F tests, when deciding whether a change warrants a test and what it should assert, or when deciding how to verify a change. Covers the criterion for when to write a test, the Vitest layout under `tests/`, the three verification commands, route/render smoke tests that boot the real server, repository/migration tests against a fresh SQLite database, how to avoid real LLM inference in tests, and the architecture guard tests that must be updated when the code they inventory changes.
---

# Testing Conventions

Mister F uses Vitest. Tests live under `misterf-web/tests/`. Pair this skill
with `database-migration-safety` for persisted-data changes, `llm-credit-gate`
for LLM flows, `project-language-conventions` for test language, and
`restart-local-server` after server/view changes.

## Verification Commands

Run all three from `misterf-web/` before finishing a change that touches code,
views, prompts, or tests:

- `npm run typecheck` — `tsc --noEmit` over the app.
- `npm run test:typecheck` — `tsc -p tsconfig.test.json --noEmit` over the tests.
- `npm test` — `vitest run` (one-shot, not watch).

Run a single file while iterating with `npx vitest run tests/<path>.test.ts`.

## Test Layout

- `tests/db/` — repository and migration tests against a fresh temp SQLite
  database. Set `DATABASE_PATH` to a `mkdtemp` file in `beforeEach`, run
  `migrate()`, and in `afterEach` call `closeDb()` then `vi.resetModules()` and
  restore env. Import repository functions with dynamic `await import(...)` after
  resetting modules.
- `tests/server/` — route/render smoke tests that boot the real Express server,
  plus architecture guard tests (see below).
- `tests/llmTutor/` — prompt-contract, schema, and validation tests. These never
  run live inference.

## Route And Render Tests

`tests/server/routes.test.ts` is the reference pattern:

- Boot the real server by importing `../../src/server/server.js` in `beforeAll`
  with test env: `APP_BASE_URL`, `APP_SESSION_SECRET` (>= 32 chars),
  `DATABASE_PATH` to a temp file, `ENV_FILE=/dev/null`, `NODE_ENV=test`. Listen
  on port `0` and read the assigned port. Close the server and `closeDb()` in
  `afterAll`.
- Drive behavior with real HTTP (`fetch`, `redirect: 'manual'`) and assert on
  status, `location`, and rendered HTML substrings.
- Set up state with repository factories (`createExternalUser`, `createProfile`,
  `createConversation`, `createQuiz`, `createPracticeGuide`,
  `createRoleplay`, `createResourceFolder`, `createQuizAttempt`,
  `submitQuizAttempt`, `saveQuizAttemptResult`, ...). Do not drive the
  UI to create fixtures.
- Use the shared helpers in that file: `createAuthenticatedCookie(userId,
  profileId)`, `postForm(route, body, cookie)`, and `extractCsrfToken(html)`.
  The CSRF token is stateless and signed, so one token can be reused across
  several POSTs in the same test.

## Do Not Run Real LLM Inference

Tests must never call OpenRouter or perform real `generateText` inference.

- For a route that calls a draft generator or `generateText` behind the credit
  gate, test the guard paths that return **before** inference: auth redirect,
  missing or non-owned resource, invalid input or `type`, empty data. These give
  real route coverage without inference.
- When you must exercise logic downstream of inference, `vi.mock` the service
  module (for example `../../src/server/services/tutorReports.js` or
  `resourceDrafts.js`) with `vi.hoisted` mock functions.

## Architecture Guard Tests

`tests/server/` contains guard tests that inventory the codebase. When you change
the code they track, update the test in the same change:

- `llmCreditGateArchitecture.test.ts` — holds an expected map of `generateText`
  call counts per service file and asserts route/socket entrypoints never call
  `generateText` directly (always gate it behind a service). If you add or remove
  a server-side `generateText` call, update the count map.
- `routeArchitecture.test.ts` — asserts removed routers/imports stay removed and
  entrypoint conventions hold.
- `uiClassArchitecture.test.ts` — asserts UI class conventions.

A failing guard test usually means an inventory needs updating, not that the
assertion is wrong — confirm the code change is intended, then update the
inventory.

## When To Write A Test

Add or update a test when a change falls into one of these buckets. Pick the
highest layer that proves the behavior cheaply.

- **Persisted data or repository behavior** — always add/update a `tests/db/`
  test: schema shape, membership/ordering, snapshots, progress events, share
  grants. New migrations get fresh-database and, when relevant, upgrade-path
  tests.
- **New or changed route, redirect, or rendered output** — add a
  `tests/server/` route/render test asserting observable behavior: HTTP status,
  `location` on redirects, and rendered labels/sections the user relies on.
- **Guard or branch logic that returns before an external call** — test the
  guards (auth/login redirect, missing or non-owned resource, invalid input or
  `type`, empty data). These are high-value and cheap, and they cover routes
  whose success path calls the LLM without running inference.
- **Protocol, schema, or prompt-contract change** — add/adjust a
  `tests/llmTutor/` schema or prompt-contract test.
- **A repo-wide invariant you want to keep holding** — encode it as an
  architecture guard test (see above) and update its inventory when the tracked
  code changes.

A good test asserts observable behavior — status, redirect target, persisted
state read back through the repository, rendered substrings — not internal
implementation details. Prefer one test at the layer that proves the behavior
over duplicating the same assertion at several layers.

Do not write a test that needs real LLM inference or a live external service,
and do not test trivial pass-through or framework behavior that has no logic of
its own.

Write tests, test names, and fixtures in English. Spanish is only for fixtures
that intentionally assert learner-facing product copy.
