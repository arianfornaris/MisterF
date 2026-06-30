# Teacher-Assigned Practice Implementation Tracker

Date: 2026-06-20

This tracker turns the `Quizzes` feature plan into implementation slices. Keep
each slice independently shippable where possible, update status as work lands,
and avoid mixing teacher authoring, public student attempts, free guest
evaluation, and follow-up tutoring in one oversized change.

Primary design document:

- [Teacher-Assigned Practice](../features/teacher-assigned-practice.md)

Related policy documents:

- [Payments](../features/payments.md)
- [Runtime Logging Policy](../operations/runtime-logging-policy.md)
- [Data Model](../architecture/data-model.md)
- [Feature Flows](../architecture/feature-flows.md)

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Implementation Rules

- [x] Review `src/server/db/migrations.ts` before every persisted-data change.
- [x] Add forward-only migrations after the v1 baseline; do not edit applied
  production-era migrations.
- [x] Keep project artifacts in English unless copy is intentionally
  learner-facing Spanish UI text.
- [x] Keep UI aligned with Bootstrap, Bootswatch Flatly, Bootstrap Icons, and
  existing resource-page conventions.
- [x] Credit-gate all teacher AI authoring operations.
- [x] Keep shared student evaluation free to the student and separate from
  teacher-paid authoring usage.
- [x] Replaced separate teacher test attempts with normal authenticated
  attempts that update learner progress after evaluation.
- [x] Preserve full validation before storing AI-generated quiz drafts,
  blocks, attempts, or results.
- [x] Log ids and status metadata in production without storing full learner
  answers unless full LLM tracing is explicitly enabled.

## Current Milestone

Current status: **V1 implementation landed locally**.

Implemented in this pass:

- [x] Quiz migration, repository types, and CRUD/share/attempt helpers.
- [x] AI-assisted initial draft generation, whole-draft revision, and single
  block generation.
- [x] `Quizzes` navigation, list, create, authoring, detail, share, public
  shared-link, attempt, and result pages.
- [x] `General`, `Bloques`, and `AI chat` authoring tabs.
- [x] Persist `AI chat` history on the quiz and send it as context for
  later revisions.
- [x] Numbered blocks with stable ids and reorder/delete/duplicate/add actions.
- [x] Teacher test attempts with the student-facing UI.
- [x] Shared guest attempts and free product-funded evaluation.
- [x] Authenticated progress events and guest result claiming after login.
- [x] Follow-up tutor conversations seeded with quiz-attempt snapshots.
- [x] Client build entry and committed build artifacts for deploy-light servers.

Remaining hardening:

- [ ] Add abuse protection/rate limiting for free guest evaluations.
- [ ] Add deeper manual per-block content editing in the `Bloques` tab.
- [ ] Add teacher-facing result dashboards and student roster workflows in the
  deferred classroom layer.
- [ ] Add prompt-contract fixtures that validate representative generated
  quiz JSON without calling a live model.

## Slice 0: Planning Baseline

Goal: make sure the feature agreement is captured before implementation begins.

- [x] Choose the Spanish UI name `Quizzes`.
- [x] Document the human-teacher use case.
- [x] Document the acquisition flow: teachers need accounts and credits;
  students can complete shared Quizzes before account creation.
- [x] Document free shared-student evaluation and standard-credit follow-up.
- [x] Document the AI-assisted authoring workflow.
- [x] Document the `Bloques` / `AI chat` tab model.
- [x] Document numbered blocks and stable internal block ids.
- [x] Document teacher test/evaluation behavior.
- [x] Add an implementation roadmap to the feature document.
- [x] Create this implementation tracker.

Verification:

- [x] `git diff --check`

## Slice 1: Schema And Repository Foundation

Goal: create the persistent model without exposing incomplete user-facing
behavior.

Tasks:

- [x] Re-read `src/server/db/migrations.ts` and current repository patterns.
- [x] Decide whether `quiz_attempts` belongs in the first migration or
  waits for the student runtime slice.
- [x] Add a new forward-only migration after `create_current_schema`.
- [x] Add `quizzes`.
- [x] Add `quiz_share_links`.
- [x] Remove separate quiz authoring sessions; generated quizzes are
  persisted directly as quizzes.
- [x] Add `quiz_attempts` if included in this slice.
- [x] Add optional conversation quiz-attempt snapshot table only if
  follow-up tutoring is in the same release train.
- [x] Extend learner progress source types to allow `quiz_attempt`, but do
  not write quiz progress events yet.
- [x] Add repository row types, stored types, mappers, and CRUD helpers.
- [x] Add tests for fresh SQLite migration.
- [x] Add focused repository tests for create/read/update/share/attempts.
- [x] Update [Data Model](../architecture/data-model.md).

Exit criteria:

- [x] Fresh SQLite migration passes.
- [x] Repository tests cover the new tables.
- [x] No route exposes incomplete quiz authoring behavior.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`

## Slice 2: Basic Quiz Resource Shell

Goal: make Quizzes visible to authenticated teachers as a normal resource area.

Tasks:

- [x] Add `src/server/quizzes/routes.ts`.
- [x] Add `src/server/quizzes/handlers.ts`.
- [x] Mount `quizzesRouter` from `src/server/server.ts`.
- [x] Update route architecture tests for the new router.
- [x] Add sidebar/navigation entry below `Guías de Práctica`.
- [x] Add list page.
- [x] Add new page.
- [x] Add detail page.
- [x] Add edit page.
- [x] Add archive/restore actions.
- [x] Add share-link route and owner share modal.
- [ ] Add static manual quiz JSON support for development/debugging.
- [x] Add `Probar` action that creates normal authenticated attempts.
- [x] Add EJS views that follow resource-page conventions.

Exit criteria:

- [ ] A teacher can create a simple quiz without AI.
- [x] A teacher can list, open, edit, archive, restore, and share an quiz.
- [x] Test attempts render the student-facing shape without recording progress
  or consuming credits before submission.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] EJS render smoke of list/new/detail/edit/share/test.

## Slice 3: Quiz Contract And Quiz Renderer Reuse

Goal: make the quiz content contract stable before AI authoring depends on
it.

Tasks:

- [x] Define `QuizDraft`.
- [x] Define `QuizBlock`.
- [x] Define quiz response normalization.
- [x] Reuse the existing `quiz` item contract where possible.
- [x] Add stable internal block ids.
- [x] Add visible block-number mapping.
- [x] Add server-side validation for saved drafts.
- [x] Extract/adapt quiz renderer helpers so they work outside chat without
  `messageId:blockIndex`.
- [x] Render every supported exercise type in test attempts.
- [x] Add tests for valid and invalid quiz payloads.

Exit criteria:

- [x] Invalid quiz payloads are rejected before persistence.
- [x] Reordering preserves stable ids and updates visible block numbers.
- [x] Test attempts support the full supported exercise catalog.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] EJS test-attempt smoke for each exercise type.

## Slice 4: AI-Assisted Initial Authoring

Goal: let the teacher create a first validated draft from a natural-language
prompt.

Tasks:

- [x] Add quiz generation prompt under `system-prompts/resources`.
- [x] Add quiz generation correction prompt.
- [x] Extend `resourceDrafts` or create an quiz-specific generation
  service.
- [x] Validate generated drafts with quiz schemas.
- [x] Credit-gate initial generation with the teacher account.
- [x] Store authoring data directly on the quiz.
- [x] Store initial prompt in the quiz `AI chat` history and persist the
  current validated draft.
- [x] Log generation success, validation failure, malformed output repair, and
  credit exhaustion.
- [x] Add UI pending/loading state for generation.

Exit criteria:

- [x] A teacher can describe a Quiz and receive a validated draft.
- [x] Credit exhaustion shows product UI instead of a raw error.
- [x] The generated draft opens in the authoring workspace.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [ ] Prompt contract fixtures for generated quiz JSON.

## Slice 5: Bloques Tab Editing

Goal: let the teacher shape the quiz structure without AI chat.

Tasks:

- [x] Add `Bloques` tab with Bootstrap `nav-pills`.
- [x] Show every block with visible `Block N` numbering.
- [x] Show stable type labels.
- [x] Add reorder controls.
- [x] Update visible numbers immediately after reorder.
- [ ] Add delete confirmation for non-trivial blocks.
- [x] Add duplicate.
- [ ] Add deep manual per-block content edit.
- [x] Add exercise type catalog.
- [x] Add `Add block` type chooser.
- [x] Add Bootstrap `Add block` modal.
- [x] Credit-gate single-block AI generation.
- [x] Validate generated single blocks before insertion.
- [x] Log block add/delete/reorder events.

Exit criteria:

- [x] The teacher can edit the quiz structure from `Bloques`.
- [x] Block numbers stay correct after every operation.
- [x] Single-block generation inserts exactly one validated block.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] EJS and service smoke for reorder/delete/duplicate/add block.

## Slice 6: AI Chat Revisions

Goal: let the teacher modify the whole quiz or specific numbered blocks
through conversation.

Tasks:

- [x] Add `AI chat` tab with Bootstrap `nav-pills`.
- [x] Send the current draft with stable block ids to the model.
- [x] Send stable block ids alongside visible block numbers through the draft.
- [x] Persist teacher/assistant chat history with the quiz.
- [x] Send prior authoring chat turns with each revision request.
- [x] Add revision prompt.
- [x] Add revision correction prompt.
- [x] Return and display the model's teacher-facing revision response.
- [x] Validate revised drafts before replacing the current draft.
- [x] Keep the current validated draft as the authoritative quiz state
  for V1.
- [x] Remove separate authoring revision history from the persisted model.
- [x] Show concise changed-block summaries using visible block numbers.
- [x] Log revision requested/applied/failed events.

Exit criteria:

- [x] The teacher can ask for changes like "make block 4 easier".
- [x] The AI updates the structured draft, not only prose.
- [x] Revisions cannot silently corrupt unsupported block types.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [ ] Prompt contract fixtures for quiz revisions.

## Slice 7: Teacher Test Evaluation

Goal: let the teacher inspect and optionally test the full student experience.

Tasks:

- [x] Finalize teacher test attempts as the shared-link student layout shape.
- [x] Hide authoring controls, validation badges, rubrics, and teacher-only
  notes from teacher test attempts.
- [x] Removed the separate persisted teacher test attempt mode.
- [x] Let the teacher submit test answers for evaluation.
- [x] Use the same product-funded evaluation policy as normal Quiz attempts.
- [x] Ensure authenticated evaluated attempts update learner progress.
- [x] Log test started/submitted/evaluated events.

Exit criteria:

- [x] Starting a test attempt does not consume LLM credits.
- [x] Submitting answers follows the product-funded Quiz evaluation policy.
- [x] Evaluated authenticated attempts appear in learner progress.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] EJS smoke of teacher test pages.

## Slice 8: Shared Student Runtime

Goal: let students complete shared Quizzes, including without accounts.

Tasks:

- [x] Add shared quiz landing page.
- [x] Add start/resume attempt routes.
- [x] Add submit route.
- [x] Support guest attempt identity or claim tokens.
- [x] Store quiz snapshots on attempts.
- [x] Reuse quiz quiz renderer for student attempts.
- [x] Make submitted answers immutable after successful evaluation.
- [x] Keep authenticated attempts tied to active profile.
- [x] Keep guest attempts isolated from user-owned data.
- [x] Log attempt started/submitted events.

Exit criteria:

- [x] Any student with a valid link can complete a Quiz without logging in.
- [x] Authenticated attempts are tied to the active profile.
- [x] Guest attempts can render after submission without exposing unrelated user
  data.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] EJS smoke as guest and authenticated student.

## Slice 9: Student Evaluation Policy

Goal: evaluate submitted shared attempts under the free student policy.

Tasks:

- [x] Reuse or adapt `evaluateQuizResultItemsWithLlm`.
- [x] Include quiz metadata in evaluation context.
- [x] Run shared student evaluation under the product-funded policy.
- [x] Do not silently charge the teacher after sharing.
- [x] Do not require student account or credits for first shared evaluation.
- [ ] Add guest evaluation rate limiting or abuse protection.
- [x] Store validated `result_json`.
- [x] Render result screen.
- [x] Log malformed evaluation output and repair attempts through the shared quiz evaluator.

Exit criteria:

- [x] Guest student evaluation is free to the student.
- [x] Evaluation failures produce recoverable UI and useful logs.
- [x] Result JSON validates and can be rendered later.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [ ] Prompt contract fixtures for quiz evaluation.

## Slice 10: Progress And Follow-Up

Goal: turn evaluated quizzes into learner progress and targeted practice.

Tasks:

- [x] Record `quiz_attempt` learner progress events for authenticated
  attempts.
- [x] Add guest result claiming after account creation or login.
- [x] Add conversation quiz-attempt snapshots.
- [x] Add result action: practice detected difficulties with Mr. F.
- [x] Add result action: practice quiz topic with Mr. F through the same targeted follow-up conversation.
- [x] Apply normal student credit policy to follow-up tutoring.
- [x] Ensure insufficient credits render product UI through the tutor runtime.
- [x] Log follow-up conversation creation.

Exit criteria:

- [x] Authenticated evaluated attempts update progress.
- [x] Guest results can be saved only after account creation or login.
- [x] Follow-up tutoring receives quiz, responses, evaluation, and focus
  areas as teacher-only context.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Repository and prompt-context smoke for authenticated progress and follow-up.

## Slice 11: Hardening And Release Readiness

Goal: make the feature safe enough for first production use.

Tasks:

- [x] Add route smoke tests.
- [x] Add route architecture tests.
- [ ] Add prompt contract fixtures for quiz generation.
- [ ] Add prompt contract fixtures for block generation.
- [ ] Add prompt contract fixtures for revisions.
- [ ] Add prompt contract fixtures for evaluation.
- [x] Use global client error telemetry coverage for the authoring workspace.
- [x] Verify production logs include required quiz events.
- [x] Verify full learner answers are not logged in production by default.
- [ ] Document operational limits for free guest evaluations.
- [x] Build client assets.
- [x] Commit current `public/build` artifacts if deploy still expects committed
  build output.
- [ ] Restart local server after implementation changes that affect runtime.

Exit criteria:

- [x] `npm run typecheck` passes.
- [x] `npm run test:typecheck` passes.
- [x] `npm test` passes.
- [x] Fresh SQLite migration check passes.
- [ ] The feature can be disabled or hidden if guest evaluation needs more abuse
  controls before public launch.
- [x] Docs and implementation agree on payment, logging, guest access, and
  follow-up behavior.

## Deferred: Classroom Layer

Keep these outside the first implementation unless the product direction changes
before launch:

- [ ] Teacher/student roles.
- [ ] Class groups or rosters.
- [ ] Due dates.
- [ ] Teacher dashboard.
- [ ] Student result review by teachers.
- [ ] Organization or teacher-funded student credits.
- [ ] LMS integration.
