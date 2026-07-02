# Roadmap V1

Date: 2026-07-02 (last updated: 2026-07-02)

This is the single planning document for the first production version of
Mister F. It records both the work already completed on the road to V1 and the
work that remains, so the whole release can be understood from one place.

The per-initiative implementation trackers that previously lived under
[issues/](./issues/) were retired on 2026-07-02 once their content was
consolidated here; their full task-level history remains available in git.
The documents still under `issues/` hold living design or behavior detail
(future features, current-state analyses, and the idea inbox) and are
referenced from here where relevant.

How to use this document:

- Remaining V1 work is tracked directly in Part 2. Check items here as they
  land.
- New loose ends get captured here first, then moved into
  [issues/incomming.md](./issues/incomming.md) or a dedicated design document
  when they grow details.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Completed Work

The initiatives below are done. Their retired trackers (task-level history)
are listed by their former path; see git history for the full detail.

## 1.1 Project Stabilization And Cleanup

Retired tracker: `docs/issues/v1-project-cleanup-tracker.md`
(source audit: `docs/issues/v1-project-cleanup-audit.md`)

- [x] Phase 0 — Stabilization guardrails: fresh-migration test coverage, main
  route smoke coverage, runtime environment documentation, and a
  production-to-development sync workflow for migration rehearsal.
- [x] Phase 1 — Blocking cleanup: repaired migration history, removed tracked
  databases and temporary artifacts, tightened ignore rules, and defined the
  build artifact policy.
- [x] Phase 2 — Route and handler architecture: moved practice-guide and
  profile actions out of auth, reduced `auth/forms.ts` to auth concerns, and
  split domain routers.
- [x] Phase 3 — UI and styling cleanup: replaced misleading shared class
  names, organized CSS by responsibility, and aligned custom styling with the
  Bootswatch Flatly theme.
- [x] Phase 4 — LLM, credit, and payment guardrails: credit gate coverage,
  credit exhaustion UI coverage, Stripe webhook idempotency tests, and the
  runtime logging policy. Inventory:
  [V1 LLM, Credit, And Payment Guardrails](./issues/v1-llm-credit-payment-guardrails.md).
- [x] Phase 5 — Documentation and release readiness: README updated for V1 and
  the final V1 checklist executed (2026-06-19: fresh install, migration,
  typecheck, tests, build, and smoke all passed).
- One item remains open from Phase 5 and is tracked in Part 2 below: the
  `TODO.txt` triage (section 2.3).

## 1.2 Tutor Loop Remediation

Retired tracker: `docs/issues/tutor-loop-remediation-tracker.md`
(source audit: `docs/issues/tutor-loop-prompt-audit.md`)

All thirteen remediations (`TLR-001` through `TLR-013`) are implemented:

- [x] Response schema separation (`quiz_result` excluded from normal tutor
  responses) and `sentence_evaluation` source binding fixed.
- [x] Persistent context split from first-turn nudges; generic
  `start-session.md` removed.
- [x] Structured blocks preserved as JSON in model-facing history instead of
  lossy markdown.
- [x] Prompt clarity fixes: internal "plan" renamed, protocol label scope
  clarified, block separation rules de-duplicated, lettered navigation choices
  disambiguated from exercises, correction prompt block-list drift removed,
  block repair fallback sharpened, and tool rule duplication reduced.
- [x] Deterministic regression fixtures for common tutor-loop failure patterns
  (`tests/llmTutor/*.test.ts`).

Related supporting documents (analysis complete, behavior implemented; kept as
current-state documentation):

- [Block Input Standardization](./issues/block-input-standardization.md):
  which tutor blocks own their input UI versus use the chat composer.
- [Message Block Task Leakage](./issues/message-block-task-leakage.md):
  observed and repaired patterns where `message` blocks leaked exercise
  payloads.
- [Structured Block Post-Processing](./issues/structured-block-postprocessing.md):
  the high-confidence block repair loop (future deeper semantic review ideas
  remain recorded there).

## 1.3 Teacher-Assigned Practice (Quizzes Feature)

Retired tracker: `docs/issues/teacher-assigned-practice-implementation-tracker.md`
(design: [Teacher-Assigned Practice](./features/teacher-assigned-practice.md))

V1 implementation landed (Slices 0-11):

- [x] Quiz schema, repository, and CRUD/share/attempt helpers.
- [x] AI-assisted draft generation, whole-draft revision, and single-block
  generation, with `General`, `Bloques`, and `AI chat` authoring tabs and
  persisted authoring chat history.
- [x] Numbered blocks with stable ids and reorder/delete/duplicate/add
  actions.
- [x] Teacher test attempts, shared student runtime, evaluation policy,
  progress events, guest result claiming, and follow-up tutor conversations
  seeded with quiz-attempt snapshots.

Notes:

- The original free product-funded guest evaluation was later superseded by
  the Resource Simplification V2 Slice 14 decision: evaluation always runs on
  the student's own credit-gated key.
- The tracker's remaining open items were triaged into this roadmap: the
  anonymous rate-limiting decision is in Part 2 (section 2.3); dashboards,
  rosters, manual quiz JSON, deep block editing, block delete confirmation,
  and prompt-contract fixtures are deferred in Part 3.

## 1.4 Resource Simplification V2

Retired tracker: `docs/issues/resource-simplification-v2-tracker.md`
(design: [Resource Simplification V2](./features/resource-simplification-v2.md))

The core V1 product surface. All implementation slices are done:

- [x] Slice 0 — Terminology and scope freeze (`Recursos`, `Quizzes`,
  `Guías de Práctica`, `Roleplay`, `Carpetas`).
- [x] Slice 1 — Generic resource schema: `resources` table plus type-specific
  tables, folder membership, sharing model, and repository primitives with
  migration tests.
- [x] Slice 2 — Unified `Recursos` catalog shell with the single `Nuevo`
  create menu, empty states, and route smoke tests.
- [x] Slice 3 — Practice guide product rename with preserved behavior.
- [x] Slice 4 — Resource folders as the only organization model: nesting,
  move-to-folder modal with cycle prevention, breadcrumbs, and standardized
  common-versus-specific resource option menus.
- [x] Slice 5 — Quizzes (then assignments) as first-class catalog resources
  with preserved attempt/snapshot/progress behavior.
- [x] Slice 6 — Practice guides as catalog resources with preserved tutor
  launch and frozen conversation snapshots.
- [x] Slice 7 — Chat rooms removed as a product area (destructive table
  cleanup deferred to Final Cleanup, Part 2 section 2.2). Archived feature
  notes: [Chat Rooms](./features/chatrooms.md).
- [x] Slice 8 — Generic live sharing: `resource_share_links` plus
  `resource_access_grants`, folder-inherited access, QR/share modals, and
  legacy link redirects.
- [x] Slice 9 — Downstream updates: progress bitácora with shared source
  labels, resource-aware logging/analytics (`resourceId`, `resourceType`), and
  payment/credit doc updates.
- [x] Slice 10 — Resource foundation cleanup: dead code removal, navigation
  standards documented, and architecture docs updated.
- [x] Slice 11 — Roleplay as the final resource type: simplified authoring
  contract with AI draft/revision, dynamic first line, dedicated learner
  writing UI, post-completion evaluation, progress events, sharing, and
  follow-up practice. Design: [Roleplays](./features/roleplays.md).
- [x] Slice 12 — Tutor resource tools replaced with UI resource creation: only
  `get_learner_progress` and `update_conversation_title` remain as tools; the
  "Crear recurso" menu creates assignment/guide/roleplay resources seeded from
  the conversation (and from summary/result surfaces) via
  `resourceFromContext`.
- [x] Slice 13 — Home page work: intentionally moved out to V3 (see Part 3).
- [x] Slice 14 — Free resources for growth: anonymous fill-then-account flow
  for shared quizzes (guest attempt, claim and evaluate after signup) and
  anonymous "Comenzar" flows for shared roleplays/practice guides, always on
  the student's own credit-gated key with starter credits.
- [x] Slice 15 — `Tarea` renamed to `Quiz` everywhere (schema, identifiers,
  routes, UI copy, docs) via a clean pre-production baseline rename, plus
  Spanish gender/clitic polish.

## 1.5 Manual QA For V1

Run against live inference; completed 2026-07-02:

- [x] Roleplay end-to-end QA: creation, AI revision, launch, evaluation,
  sharing, and follow-up tutor practice (Slice 11 exit).
- [x] Create-resource-from-conversation smoke: start a tutor conversation and
  create each resource type from it (Slice 12 verification).
- [x] Authenticated quiz smoke: full create/attempt/result flow after the Quiz
  rename (Slice 15 verification).
- [x] Anonymous growth funnel QA: fill a shared quiz as a guest, sign up on
  `Evaluar`, verify claim + evaluation on the new account; `Comenzar` on a
  shared roleplay and practice guide (Slice 14).

---

# Part 2: Remaining Work For V1

## 2.1 Pre-Production Fixes (External Configuration)

- [x] Fix the Google OAuth consent screen: the app's OAuth client lives in the
  "Mister F and Minimo Games" Google Cloud project, whose branding still had a
  leftover app name from another project. Updated the Branding settings
  (2026-07-02) so the consent screen shows "Mister F". Note: branding is
  per-project, so the Minimo Games client in the same project now also shows
  "Mister F"; moving it to its own project is a post-V1 nicety. No logo
  uploaded yet (a logo triggers Google's brand verification review).

## 2.2 Final Cleanup And Clean Database Baseline

Goal: remove legacy data structures and compatibility code before production,
because the project starts with a clean database. Do this last, once no schema
changes remain, so the baseline is rebuilt exactly once. Use the
`database-migration-safety` skill and review
`misterf-web/src/server/db/migrations.ts` before every persisted-data change.

- [x] Remove legacy chatroom persistence (the chatroom surface is already
  removed; only this destructive schema cleanup remains):
  - Drop the `chat_rooms`, `chat_room_characters`, `chat_room_conversations`,
    `chat_room_messages`, `chat_room_conversation_reports`, and
    `conversation_chat_room_report_snapshots` tables/indexes from the
    baseline.
  - Remove the dead `*ChatRoom*` repository helpers (about 30 exported
    functions) plus their row types and mappers from `repository.ts`.
  - Update `tests/db/migrations.test.ts`, which currently asserts the chatroom
    tables and columns exist.
  - Decide whether the `/chatrooms` and `/chatroom-conversations`
    compatibility redirects in `server.ts` stay or are removed.
- [x] Remove legacy practice-guide share links (generic live sharing owns the
  behavior):
  - Drop the `practice_guide_share_links` table/index from the baseline.
  - Remove `findPracticeGuideShareLinkById`,
    `findPracticeGuideShareLinkForPracticeGuide`, and
    `getOrCreatePracticeGuideShareLink` from `repository.ts`.
  - Remove or fold the `/practice-guides/shared/:shareId` and
    `/practice-guides/shared/:shareId/accept` legacy redirect
    routes/handlers.
- [x] Remove legacy quiz share links:
  - Drop the `quiz_share_links` table/index from the baseline.
  - Remove `findQuizShareLinkById`, `findQuizShareLinkForQuiz`, and
    `getOrCreateQuizShareLink` from `repository.ts`.
  - Remove or fold the `/quizzes/shared/:shareId` and
    `/quizzes/shared/:shareId/start` legacy redirect routes/handlers.
  - Keep the generic `resource_share_links` table and the
    `*ResourceShareLink*` helpers; only the per-type legacy share links go.
- [x] Remove the unused `quizzes.allow_public_attempts` column (migration
  `add_quiz_public_attempts`) and the unused `OPENROUTER_FREE_API_KEY` env var
  (set locally and on the server), left over from the Slice 14 policy
  decision.
- [x] Remove old internal naming that no longer needs a compatibility alias
  (verified by broad grep; no legacy naming remains in code, views, or tests).
- [x] Rebuild the clean baseline migration so fresh production installs start
  from the simplified resource model.
- [x] Re-run schema, repository, route, and render tests against a fresh
  database.
- [x] Re-run a broad grep for legacy names, routes, tables, prompts, and docs.
- [x] Audit page heading scale and vertical space across resource pages
  (`h1`/`h2`/section-heading sizes and margins currently take too much
  vertical space in several views).

Exit criteria:

- [x] Fresh databases contain only the current production-intended schema.
- [x] No runtime code depends on deleted legacy structures.
- [x] Old compatibility routes are either removed or intentionally redirected.
- [x] The migration history is clean for the first production deployment.

Verification:

- [x] Fresh SQLite migration check.
- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test` (98 passing)

## 2.3 Production-Readiness Decisions

- [x] Decide whether anonymous quiz attempt creation needs rate limiting or
  abuse protection for V1. The original free-guest-evaluation concern is
  partially superseded by the Slice 14 decision (evaluation always runs on
  the student's own credit-gated key), but guests can still create attempt
  rows anonymously via `POST /quizzes/shared/:shareId/take`.
- [x] Triage `TODO.txt` at the repository root: move still-relevant ideas into
  [issues/incomming.md](./issues/incomming.md) or this roadmap, then delete
  the file.

---

# Part 3: Deferred To Post-V1

Recorded so nothing is lost; none of these block the first version.

## Product Features

- Home page work (V3). Two surfaces: a logged-out landing page presenting the
  product, and a logged-in home showing the composer plus pre-generated
  practice-guide-style suggestion cards (random at first, later ranked by a
  recommendation system that refreshes when profile progress updates, and
  including the user's own recent guides). Home suggestions should reference
  resource ids where useful. Detailed design:
  [Home Suggestions Tracker](./issues/home-suggestions-tracker.md) and
  [Home Start Experience](./features/home-start-experience.md).
- Public/free shared roleplay attempts with optional max learner-turn limits.
- Classroom layer: teacher/student roles, class groups or rosters, due dates,
  teacher dashboards, student result review by teachers, and organization or
  teacher-funded student credits.
- CEFR level standardization (A1-C2) for resources, following the standards
  used in Florida language teaching
  ([issues/incomming.md](./issues/incomming.md)).
- Marketplace exploration ([issues/incomming.md](./issues/incomming.md)).
- Tutor plan sub-steps, and structured onboarding that pre-generates practice
  guides so sessions do not start from scratch
  ([issues/incomming.md](./issues/incomming.md)).

## Engineering And Quality

- Prompt-contract fixtures that validate representative generated quiz JSON
  (generation, single-block generation, revision, and evaluation) without a
  live model.
- Deeper manual per-block content editing in the quiz `Bloques` tab, and
  delete confirmation for non-trivial blocks.
- Static manual quiz JSON support for development/debugging.
- Deeper semantic review layer for structured tutor blocks
  ([Structured Block Post-Processing](./issues/structured-block-postprocessing.md)).
- [UI Style Consistency Audit](./issues/ui-style-consistency-audit.md):
  semantic CSS class naming pass across the app.

## Agent Skills Backlog

Recurring implementation patterns worth turning into concise agent skills so
future resource work stays consistent:

- `resource-sharing-conventions`: live shared resource references,
  profile/link sharing, QR/link modal behavior, access checks, and future
  public/free quiz and roleplay exceptions.
- `ai-authoring-chat-conventions`: General/AI Chat tab layout, authoring
  history passed into each inference, assistant reply plus structured JSON
  changes, and pending modal scroll behavior.
- `resource-attempt-runtime`: start/freeze/run/finish/evaluate/result/
  follow-up flows and progress event writing.
- `resource-follow-up-conversations`: Mr. F conversations created from
  resource results, frozen source snapshots, visible source links, credit
  policy, and preventing the tutor from re-grading the same result.
- `markdown-content-fields`: which fields render markdown, which edit fields
  use the Markdown editor, and safe rendering.
- `roleplay-pedagogy-and-evaluation`: learner English production focus,
  avoiding non-language moral/persona judgment, creative scenarios, turn
  limits, and future guest/free policy.

---

# V1 Exit Criteria

- [x] All Manual QA items (Part 1, section 1.5) pass against live inference.
- [x] The Google OAuth consent screen shows the Mr. F product branding.
- [x] Fresh databases contain only the production-intended schema and the
  migration history is clean for the first deployment.
- [x] Every production-readiness decision (Part 2, section 2.3) is resolved
  (implemented or explicitly deferred in Part 3).
- [x] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass on
  the final cleanup baseline.
