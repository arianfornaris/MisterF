# Resource Simplification V2 Tracker

Date: 2026-06-25

This tracker breaks the V2 resource simplification into implementation slices.
The work is intentionally large and should be done over several days, with each
slice reviewed before moving to the next one.

Primary design document:

- [Resource Simplification V2](../features/resource-simplification-v2.md)

Related documents:

- [Data Model](../architecture/data-model.md)
- [Feature Flows](../architecture/feature-flows.md)
- [Teacher-Assigned Practice](../features/teacher-assigned-practice.md)
- [Roleplays](../features/roleplays.md)
- [Home Start Experience](../features/home-start-experience.md)
- [Home Suggestions Tracker](./home-suggestions-tracker.md)
- [Payments](../features/payments.md)
- [Chat Rooms](../features/chatrooms.md)

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Decisions

- [x] V2 folders support nesting through `resource_folder_items`.
- [x] `Roleplay` was implemented in the final resource type slice.
- [x] Slice 1 uses the generic `resources` table plus type-specific tables
  strategy.
- [x] Folder membership is a separate table and a resource or folder belongs to
  zero or one parent folder in V2.
- [x] Generic sharing uses live `resource_access_grants`; recipients see the
  owner's current resource instead of receiving copied imports.

## Implementation Rules

- [x] Review `misterf-web/src/server/db/migrations.ts` before every persisted
  data change.
- [x] Decide whether V2 lands before production baseline reset or after
  production forward-only migrations begin.
- [x] Keep project docs, comments, tests, and code identifiers in English.
- [x] Keep Spanish only for intentional learner/user-facing UI copy.
- [x] Preserve Bootstrap/Bootswatch conventions and the theme-surface rules.
- [~] Avoid keeping old and new resource systems active longer than necessary.
- [~] Preserve or redirect public links where data already exists.
- [x] Keep credit policy explicit for every AI authoring or evaluation flow.
- [~] Add tests at the repository, route, and render layers for each migration
  slice.

## Current Milestone

Current status: **Slices 1-8, 10, and the first Roleplay implementation in
Slice 11 are implemented. Dedicated assignment and legacy practice-guide
runtime routes remain active as compatibility routes, while the resource
catalog owns listing, folder organization, live sharing, common resource
actions, and Roleplay creation/launch/share.**

Completed:

- [x] Capture V2 product direction.
- [x] Create design document.
- [x] Create implementation tracker.
- [x] Decide to support folder nesting for V2.
- [x] Implement `Roleplay` in the final resource type slice.
- [x] Draft generic resource schema plan.
- [x] Add `add_resource_foundation` migration.
- [x] Add generic resource repository primitives.
- [x] Mirror assignment and practice guide metadata into `resources`.
- [x] Add migration and repository tests for resource foundation behavior.
- [x] Add unified `Recursos` page shell.
- [x] Replace the sidebar assignment/practice-guide entries with `Recursos`.
- [x] List assignments, practice guides, and resource folders together.
- [x] Add grid/list layout support in the early shell, then remove layout
  switching when the product settled on the list layout.
- [x] Keep search and type filters out of the first resource page iteration per
  product review.
- [x] Add resource folder creation.
- [x] Add folder detail pages with nested-folder breadcrumbs.
- [x] Add move-to-folder and remove-from-folder actions for assignable
  resources and folders.
- [x] Add generic archive/restore actions for resources.
- [x] Redirect `/assignments` and `/practice-guides` list routes to
  `/resources`.
- [x] Keep old assignment and practice-guide detail routes reachable from
  resource cards.
- [x] Keep practice-guide detail pages visible while the active navigation
  entry is `Recursos`.
- [x] Remove resource favorite state from schema, repository APIs, routes, UI,
  tests, and current docs.
- [x] Add live generic sharing for assignments, practice guides, and folders.
- [x] Add route-level coverage for generic share render/accept and legacy share
  redirects.
- [x] Extract the shared resource list item partial.
- [x] Update current docs for resource navigation, live sharing, practice guide
  naming, and chatroom removal.
- [x] Add Roleplay as a resource type with schema, authoring, runtime,
  evaluation, progress, sharing, and follow-up tutor practice.

Next recommended step:

- [ ] Manual QA Roleplay creation, AI revision, launch, evaluation, sharing, and
  follow-up practice. Personalized home suggestions remain split into a
  separate larger feature.

## Slice 0: Terminology And Scope Freeze

Goal: agree on names and resource boundaries before touching code.

Tasks:

- [x] Confirm Spanish UI labels:
  - `Recursos`
  - `Tareas`
  - `Guías de Práctica`
  - `Roleplay`
  - `Carpetas`
- [x] Confirm internal names:
  - `Resource`
  - `Assignment`
  - `PracticeGuide`
  - `Roleplay`
  - `ResourceFolder`
- [x] Decide whether `PracticeGuide` is renamed internally in V2 or kept as a
  compatibility implementation detail.
- [x] Decide whether folder nesting is in V2.
- [x] Decide whether folder sharing is live or snapshot/copy based.
  - Folder sharing is live and exposes current folder contents through the
    accepted grant.
- [x] Decide whether `Roleplay` is scripted, AI roleplay, or hybrid.
  - First version: free-form two-character AI roleplay with post-completion
    evaluation. No guided branching yet.
- [x] Decide whether chatroom data must be migrated or can be discarded.
  - Pre-production strategy: discard legacy chatroom data during the planned
    baseline reset, or remove it through an explicit destructive cleanup before
    production.
- [x] Update this tracker with decisions.

Exit criteria:

- [x] No open naming ambiguity blocks schema work.
- [x] The V2 resource type list is stable.
- [x] The migration strategy is chosen.

Verification:

- [x] Documentation review.

## Slice 1: Generic Resource Schema Plan

Goal: define the persistent foundation before changing routes or UI.

Tasks:

- [x] Review current migration history.
- [x] Inventory existing tables:
  - [x] `practice_guides`
  - [x] `practice_guide_share_links`
  - [x] `assignments`
  - [x] `assignment_share_links`
  - [x] `chat_rooms`
  - [x] `chat_room_share_links`
  - [x] chatroom conversation/report tables
- [x] Choose schema strategy:
  - generic `resources` table plus type-specific tables
  - not a temporary resource index table
- [x] Draft table definitions.
- [x] Define resource type enum/check values.
- [x] Define folder membership model.
- [x] Define resource sharing model.
- [x] Define indexes for profile list, type filtering, folders, and archive.
- [x] Decide URL compatibility strategy for old links.
- [x] Update [Data Model](../architecture/data-model.md) draft section.
- [x] Implement the first resource foundation migration in code.
- [x] Implement repository helpers for resource folders, membership, listing,
  ordering, and generic share links.
- [x] Add tests for fresh schema, legacy backfill, and repository operations.

Exit criteria:

- [x] Schema shape is documented before implementation.
- [x] First implementation is locally testable as an incremental migration.
- [x] Migration baseline/reset path is confirmed before production deployment.

Verification:

- [x] Self review of schema notes.
- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`

## Slice 2: Resource Shell Without Behavior Removal

Goal: introduce the `Recursos` surface while old feature behavior still works.

Tasks:

- [x] Add resource route shell.
- [x] Add `Recursos` sidebar entry.
- [x] Add resource list page.
- [x] Keep type filters out of the first implementation per product review.
- [x] Keep search out of the first implementation per product review.
- [x] Add grid/list layout support.
- [x] Add empty states.
- [x] Add single `Nuevo` create-resource menu.
- [x] Add resource folder creation.
- [x] Add resource folder detail pages.
- [x] Add move-to-folder and remove-from-folder actions.
- [x] Add generic archive/restore resource actions.
- [x] Add common resource list-item partials.
- [x] Keep old routes reachable during this slice.
- [x] Add route and architecture smoke tests.

Exit criteria:

- [x] Users can open `Recursos`.
- [x] Existing assignments/practice guides appear in the resource list.
- [x] Old feature pages still work.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Route/architecture smoke for resource list redirects and resource-mounted
  practice-guide pages.

## Slice 3: Practice Guide To Practice Guide

Goal: rename the product concept while preserving behavior.

Tasks:

- [x] Replace Spanish UI copy `Guía de Práctica` with `Guía de Práctica`.
- [x] Replace sidebar/list labels in the unified resource catalog.
- [x] Update page titles, buttons, empty states, modals, and share text.
- [x] Update docs that mention the user-facing concept.
- [x] Keep old URL compatibility or add redirects.
- [x] Decide whether code identifiers remain `practiceGuide` until schema
  consolidation.
- [x] Add tests for visible labels where practical.

Exit criteria:

- [x] Users see `Guía de Práctica` consistently.
- [x] Existing practice behavior is unchanged.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Render-path coverage in `tests/server/routes.test.ts` asserts the
  `Guía de Práctica` label on resource pages, replacing the manual list/detail
  label pass.

## Slice 4: Use Resource Folders As The Organization Model

Goal: keep generic folders as the only resource organization model.

Tasks:

- [x] Add resource folder data model.
- [x] Add folder list/detail UI.
- [x] Add create/edit/archive/share folder actions.
- [x] Add add-to-folder/remove-from-folder actions.
- [x] Add folder breadcrumbs.
- [x] Add folder-aware resource list filtering.
- [x] Support nested resource folders.
- [x] Add move-to-folder flow for resources.
- [x] Add move-folder flow with cycle prevention.
- [x] Add move destination modal with current-folder default selection, folder
  drill-down, fixed-height scrolling folder list, and modal breadcrumbs.
- [x] Standardize resource option menus into common options plus
  resource-specific options. Assignment, practice-guide, and folder views now
  share breadcrumb navigation, move-to-folder actions, share/archive actions,
  and dedicated edit actions; roleplay detail menus follow the same common
  resource action pattern.
- [x] Discard the old guide-specific grouping path from the pre-production
  baseline.
- [x] Remove old guide-specific grouping create/edit/list UI.
- [x] Remove old guide-specific grouping share UI after generic folders exist.
- [x] Add repository tests for folder membership and ordering.

Exit criteria:

- [x] Users can organize guides and assignments in folders.
- [x] Users can move resources and folders between nested folders.
- [x] Only resource folder UI remains for organization.
- [x] Existing pre-production grouping data is intentionally discarded by the
  baseline reset strategy.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Migration tests for fresh and migrated databases.
- [x] Re-run verification after nested folders and move-to-folder behavior are
  implemented.

## Slice 5: Assignments As Resources

Goal: make `Tareas` first-class items in the resource catalog.

Tasks:

- [x] Attach assignments to generic resources.
- [x] Move assignment list behavior into `Recursos` or redirect it there.
- [x] Preserve assignment detail/edit/attempt flows.
- [x] Preserve free shared-student evaluation policy.
- [x] Move assignment sharing to generic resource sharing where possible.
- [x] Ensure assignment attempts still snapshot assignment content.
- [x] Ensure progress events still record evaluated attempts.
- [x] Show assignment attempts/results on assignment detail pages where
  applicable.
- [x] Add route compatibility for existing assignment URLs if needed.
- [x] Update assignment docs after implementation.

Exit criteria:

- [x] Tareas appear and behave correctly from the `Recursos` list.
- [x] Assignment-specific runtime pages still work.
- [x] Existing assignment tests pass.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Assignment authoring/share/attempt/result smoke.

## Slice 6: Practice Guides As Resources

Goal: make practice guides first-class items in the resource catalog.

Tasks:

- [x] Attach practice guides to generic resources.
- [x] Preserve guide launch into tutor conversation.
- [x] Preserve conversation practice-guide snapshots.
- [x] Migrate or redirect old practice guide share links.
- [x] Remove duplicated list/archive/share code where generic resource
  behavior now owns it.
- [x] Moved "update home suggestions to reference resource ids" to the
  [Home Page Work (V3)](./home-page-work-v3.md) document so all home/start page
  work is tracked together.

Exit criteria:

- [x] Practice guides appear and behave correctly from `Recursos`.
- [x] Starting tutor practice from a guide still stores a frozen snapshot.
- [x] Old practice guide paths have a clear redirect or compatibility path.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Guide launch/share smoke.

## Slice 7: Remove Chat Rooms

Goal: remove `Salas de chat` as a standalone product area.

Tasks:

- [x] Decide whether any chatroom concepts migrate into `Roleplay`.
- [x] Remove sidebar entry.
- [x] Remove chatroom routes or add temporary redirects.
- [x] Remove chatroom views.
- [x] Remove chatroom client entry if unused.
- [x] Remove chatroom server services when no longer referenced.
- [x] Remove chatroom share-link routes.
- [x] Legacy chatroom repository helpers are dead (no feature code references
  them); their destructive removal is deferred to and tracked in the Final
  Cleanup section.
- [x] Chatroom table removal is deferred to and tracked in the Final Cleanup
  section, to run with the clean baseline reset.
- [x] Update docs to mark chatrooms deprecated or remove them from current
  architecture docs.

Notes:

- Useful chatroom learning ideas are deferred to `Roleplay`; they should be
  redesigned as resource-shaped roleplay practice instead of migrated directly.
- The current slice intentionally leaves legacy chatroom tables and repository
  helpers in place. Removing them is schema/destructive persistence work and
  should happen with the planned baseline reset or a forward-only migration.

Exit criteria:

- [x] No user-facing `Salas de chat` surface remains.
- [x] No dead route, view, or client entry remains.
- [x] Feature tests no longer depend on chatrooms.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] `rg "chatroom|chat_room|Salas de chat"` reviewed for intentional
  remnants.

## Slice 8: Generic Sharing And Import Cleanup

Goal: remove duplicated sharing models.

Tasks:

- [x] Add/finish generic resource share links.
- [x] Add live `resource_access_grants` for accepted shares.
- [x] Add profile sharing support as live grants instead of copied imports.
- [x] Redirect old practice guide and assignment links into the generic share
  flow.
- [x] Define folder sharing behavior as live access to current folder contents.
- [x] Add QR/share modal support for resource folders.
- [x] Investigated the legacy share-link tables/helpers/routes and relocated
  their removal to the Final Cleanup section. They are still referenced by the
  active `/assignments/shared/*` and `/practice-guides/shared/*` compatibility
  redirects, so removal is not yet safe.
- [x] Update share modal copy to explain live shared resources.
- [x] Add repository tests for live grants and folder-inherited access.
- [x] Add route-level tests for generic share accept/login behavior.
- [x] Moved the public/free student flow growth idea to Slice 14 (Free
  Resources For Growth).

Exit criteria:

- [x] One sharing implementation supports current resource types and can extend
  to roleplays in the final slice.
- [x] Public links work for assignments, guides, and folders.
- [x] Old links are redirected into the generic share page.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Public share route smoke per resource type.

## Slice 9: Home, Progress, Payments, And Logging Updates

Goal: update downstream systems to understand the resource catalog. Personalized
home suggestions are now a separate feature and are not implemented in this
slice.

Tasks:

- [x] Split home-start recommendation work into a separate future feature.
- [x] Update progress event docs and code paths for resource ids.
- [x] Show tutor reports, assignment attempts, and roleplay attempts in the
  progress bitácora with shared source labels.
- [x] Add reusable agent skills for resource page conventions and learner
  progress event conventions.
- [x] Preserve assignment attempt progress behavior.
- [x] Update runtime logging event names from feature-specific resources to
  generic resource ids where helpful.
- [x] Update analytics/log metadata to include `resourceId` and `resourceType`.
- [x] Update payment/credit docs for resource-aware production logs.

Exit criteria:

- [x] Downstream systems no longer assume only practice guides/assignments for
  resource metadata.
- [x] Logs can reconstruct user/model behavior by resource context for current
  assignment and practice-guide resource flows.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Manual log review for resource actions.

## Slice 10: Resource Foundation Cleanup

Goal: remove old names, dead code, and stale docs before introducing roleplays.

Tasks:

- [x] Remove unused practice-guide grouping files/types.
- [x] Document the resource breadcrumb and action-placement navigation standard
  in [Resource Simplification V2](../features/resource-simplification-v2.md).
- [x] Document nested folders, move-to-folder modal behavior, and common versus
  resource-specific options in
  [Resource Simplification V2](../features/resource-simplification-v2.md).
- [x] Remove unused chatroom runtime files.
- [x] Remove duplicated resource card/list helpers.
- [x] Update [README](../README.md).
- [x] Update [Data Model](../architecture/data-model.md).
- [x] Update [Feature Flows](../architecture/feature-flows.md).
- [x] Update [Home Start Experience](../features/home-start-experience.md).
- [x] Update [Payments](../features/payments.md).
- [x] Archive or rewrite [Chat Rooms](../features/chatrooms.md).
- [x] Run broad grep for old user-facing labels:
  - `Guías de Práctica`
  - `Practice Guide`
  - `chatroom`
  - `Salas de chat`
- [x] Run full test suite.

Exit criteria:

- [x] The resource model is coherent in code, docs, UI, and tests.
- [x] No stale chatroom feature surface remains.
- [x] The resource foundation is ready for the final roleplay feature slice.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Manual QA coverage through route/render smoke for resource
  list/detail/create/share/archive/folder flows.

## Slice 11: Introduce Roleplay Last

Goal: add `Roleplay` as the final new resource-shaped conversation practice
feature after the resource foundation is already coherent.

Tasks:

- [x] Finalize roleplay product definition.
- [x] Add roleplay schema/type table if it was not reserved in the resource
  baseline.
- [x] Add roleplay authoring UI.
  - [x] AI draft from natural-language prompt.
  - [x] Rebaseline authoring to the simplified contract: title, description,
    scenario, level, one pedagogical focus field, optional max learner turns,
    and two fixed characters (`learner` and `ai`) with name/description only.
  - [x] Remove the first-pass over-specific authoring fields: learner context,
    target topic, learning goals, language focus, evaluation focus, model
    instructions, opening line, learner character id, character icon, role,
    persona, and speaking style.
  - [x] AI revision from author instructions.
- [x] Add roleplay detail page.
  - [x] Show resource metadata.
  - [x] Show applicable roleplay attempts/results.
- [x] Add roleplay launch flow.
  - [x] Generate the AI character's first line dynamically when an attempt
    starts instead of storing an opening line on the resource.
- [x] Add roleplay runtime prompt/service.
- [x] Add dedicated learner writing UI using the pedagogical content style and
  character icons.
- [x] Decide whether roleplay runs produce evaluated results.
  - Roleplay attempts produce evaluated results after completion.
- [x] Decide progress event behavior.
  - Authenticated evaluated roleplay attempts create learner progress events.
- [x] Add roleplay sharing through generic resource sharing.
- [x] Update payment/credit docs for roleplay authoring/evaluation.
- [ ] Track future public/free shared roleplay attempts with optional max
  learner-turn limits.
- [x] Add tests for roleplay validation, repository helpers, and schema paths.
- [x] Add render-path smoke tests for roleplay pages.

Exit criteria:

- [x] A user can create, open, share, and launch a roleplay.
- [x] Roleplay behavior is clearly distinct from removed chatrooms.
- [x] Credit policy is explicit for AI generation/evaluation.
- [ ] V2 is ready for final manual QA before production.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Roleplay create/launch/share smoke.

## Slice 12: Replace Tutor Tools With UI Resource Creation

Goal: remove the model-invoked resource-creation tools from Mr. F tutor
conversations and instead let the user explicitly create a resource in the
context of that conversation through the UI. Read-only/reference tools stay.

Product direction:

- Quitar las tools de las conversaciones con Mister F. Lo mejor es darle la
  opción al usuario vía UI de crear un recurso en el contexto de esa
  conversación.

Scope decision:

- Remove all practice-guide tools from the tutor: `create_practice_guide`,
  `update_practice_guide`, `delete_practice_guide`, `list_practice_guides`, and
  `build_practice_guide_link`. `practiceGuideTools.ts` was deleted.
- Keep only the non-resource tools: `get_learner_progress` (progress lookup) and
  `update_conversation_title` (runtime title).
- Replace resource creation with a learner-initiated UI flow that reuses the
  existing AI authoring drafts, seeded with the current conversation context.
- The conversation "Crear recurso" menu mirrors the resource catalog "Nuevo"
  menu and supports the AI-authored types: assignment, practice guide, and
  roleplay. Folder creation stays out (it is not AI-authored from context).
- After creating a resource, append a link to it as a message in the
  conversation and stay in the conversation, so the learner can keep chatting or
  open the resource from the link.
- Remove the `practice_guide_link` response block entirely (schema, types,
  validation, renderer, block prompt, and protocol references). Opening a saved
  guide is done from the resource UI.

Tasks:

- [x] Inventory current tutor tools, their definitions, and their invocation
  points in the `llmTutor` runtime and `tutorWorkflow` side effects.
- [x] Decide which tool-driven outcomes must survive as explicit UI actions
  versus be dropped.
- [x] Remove all practice-guide tool definitions from the tutor LLM runtime
  (deleted `practiceGuideTools.ts` and its `index.ts` wiring/merge helpers).
- [x] Confirm `tutorWorkflow` has no tool-handling paths for the removed tools.
- [x] Add a conversation-scoped UI affordance to create a resource (assignment,
  practice guide, or roleplay) from the current conversation ("Crear recurso"
  composer menu + shared modal).
- [x] Pass a conversation context snapshot (transcript + optional instruction)
  into the matching resource authoring flow per type.
- [x] After creation, append a link to the new resource as a message in the
  conversation and stay in the conversation.
- [x] Extend "Crear recurso" to the summary surfaces (conversation summary,
  assignment result, roleplay result), each seeded with that surface's
  context and redirecting to the new resource, keeping the existing "Practicar"
  action. The shared `resourceFromContext` service backs every surface.
- [x] Keep the LLM credit gate explicit for the AI authoring triggered from the
  conversation.
- [x] Update tutor prompts and docs to reflect tool removal.
- [x] Update tutor runtime, workflow, and prompt tests.

Exit criteria:

- [x] Tutor conversations no longer expose model-invoked resource tools (only
  `get_learner_progress` and `update_conversation_title` remain).
- [x] Users can create an assignment, practice guide, or roleplay scoped to a
  conversation from the UI, and the conversation shows a link to the new
  resource.
- [x] No dead tool definition, schema, or workflow path remains.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [ ] Manual smoke: start a tutor conversation and create each resource type
  from it (requires live inference and credit; not yet run).

## Slice 13: Home Page Work

Moved to V3. Home/start page work is tracked in a separate document:
[Home Page Work (V3)](./home-page-work-v3.md). Detailed personalized-suggestion
design continues in the [Home Suggestions Tracker](./home-suggestions-tracker.md).
This slice number is kept as a pointer so Slices 14 and 15 do not need
renumbering.

## Slice 14: Free Resources For Growth

Goal: provide free resources to every user, including prospective students who
do not yet have an account, as a user-acquisition lever. Let people experience
real resource value before signing up so the product can grow its user base.

Decisions:

- [x] Free public taking is opt-in per quiz: the owner marks a quiz as public
  and free (`quizzes.allow_public_attempts`).
- [x] Free evaluation uses a dedicated platform OpenRouter key
  `OPENROUTER_FREE_API_KEY`, falling back to `OPENROUTER_API_KEY`
  (`getFreeResourceOpenRouterApiKey`). If neither is set, the free flow is off.

Tasks:

- [x] Give `Quizzes` a public/free student flow where quiz completion and AI
  evaluation can happen before account creation (moved from Slice 8).
  - Owner toggle `POST /quizzes/:quizId/public-attempts` +
    `allow_public_attempts` column (forward migration `add_quiz_public_attempts`).
  - Anonymous start `POST /quizzes/public/:shareId/attempt` creates a guest
    attempt; submit evaluates with the free key; the guest sees the result.
- [x] Decide which resource types are offered as free/gift resources: quizzes
  first. Roleplay/practice guide remain future.
- [x] Define the credit/cost policy: guest quiz evaluation uses the dedicated
  free-resource key, so spend is isolated and bounded by that key's OpenRouter
  limit (not the per-user credit gate).
- [x] Define the conversion path: from the result page, "Practicar" sends guests
  to signup/login; on return the guest attempt is auto-claimed
  (`renderQuizResultPage`) so they can practice it and keep it in progress.
- [~] Abuse/rate-limit protection for unauthenticated free evaluation: currently
  bounded by the dedicated key's OpenRouter limit and the per-quiz opt-in. A
  per-IP/attempt rate limit is a future hardening step.
- [x] Add tests for the public/free attempt start path (owner toggle, anonymous
  start, guard for non-public quizzes). The LLM evaluation itself is not tested
  (no live inference in tests).

Exit criteria:

- [x] A prospective student can complete a free public quiz and receive AI
  evaluation before creating an account.
- [x] The free-resource flow has an explicit, bounded credit policy (dedicated
  key).
- [x] The flow converts a free attempt into a new account and claims it.

Notes:

- This slice captures the growth and user-acquisition direction that was
  previously a single "future" bullet in Slice 8.
- Roleplay has a parallel future public/free attempt idea in Slice 11; align
  both under this growth direction when implemented.
- Remaining hardening: per-IP/attempt rate limiting for anonymous starts and
  submissions.

## Slice 15: Rename Tarea Resource To Quiz

Goal: rename the `Tarea` resource type to `Quiz` everywhere, including the
database schema, internal identifiers, routes, UI copy, and docs. Use this slice
with `database-migration-safety`, `project-language-conventions`, and
`testing-conventions`.

Decisions (made):

- [x] Spanish UI label `Quiz`, plural `Quizzes`.
- [x] Full internal identifier rename (`assignment`/`Assignment` ->
  `quiz`/`Quiz`), including schema names.
- [x] Clean baseline rename instead of a forward-only migration. The project is
  pre-production and the database can be reset, so the existing migrations were
  edited in place to create a fresh database directly with the `quiz` schema
  (tables, columns, indexes, and the `resources`/`resource_folder_items` type
  CHECK value `'quiz'`). The earlier forward-only rename migration was removed,
  no legacy `ALTER ... RENAME` compatibility is kept, and the local dev database
  was reset. A fresh migration run was verified to produce the `quiz` schema with
  no remaining `assignment` objects.

Tasks:

- [x] Rename the database schema: `assignments`/`assignment_attempts`/
  `assignment_share_links`/`conversation_assignment_attempt_snapshots` tables,
  their columns and indexes, and the `resources`/`resource_folder_items` type
  value `'assignment'` -> `'quiz'`.
- [x] Update the repository layer: function names, row types, and SQL.
- [x] Rename server identifiers: the feature folder (`src/server/quizzes`),
  routes (`/quizzes/*`, `/quiz-attempts/*`), handlers, services, and types.
- [x] Route compatibility: pre-production, so old `/assignments/*` URLs are
  renamed outright with no redirect.
- [x] Update client identifiers, entries (vite + build-client), views, and CSS.
- [x] Replace the Spanish UI copy `Tarea`/`Tareas` with `Quiz`/`Quizzes` across
  views, menus, modals, and empty states.
- [x] Update logging/analytics `resourceType: 'assignment'` -> `'quiz'` and
  event names.
- [x] Update downstream references in docs, prompts, and skills. The collision
  with the existing tutor quiz-content `quizBlockSchema` was resolved by aliasing
  that import to `tutorQuizBlockSchema` in the quizzes service.
- [x] Rename and update tests and fixtures (`quizzesRepository`,
  `quizzesService`, route/render and migration tests).

Exit criteria:

- [x] No `assignment`/`Tarea` resource naming remains in code, schema, UI,
  prompts, skills, current-state docs, or tests (historical migration names in
  `migrations.ts` are intentionally preserved).
- [x] Fresh databases use the `quiz` schema names.
- [x] Existing quiz behavior is unchanged (tests pass).

Verification:

- [x] Fresh SQLite migration check (seeded data-loss + FK/integrity verification).
- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test` (89 passing)
- [x] Broad grep for `assignment`/`Assignment`/`Tarea`/`Tareas`.
- [x] Built the client and restarted the local server; `/resources` responds 302
  and the dev DB migrated without error. Full authenticated quiz
  create/attempt/result smoke needs live inference and was not run.

Follow-ups (minor):

- [x] Spanish clitic and gender polish where copy refers back to a now-masculine
  `quiz` (for example `Nueva quiz` -> `Nuevo quiz`, `Quiz compartida` ->
  `Quiz compartido`, `enviarla` -> `enviarlo`) across quiz views, handlers, and
  client status text.

## Future Agent Skills Backlog

Goal: turn recurring V2 resource implementation patterns into concise agent
skills so future resource work stays consistent.

Source analysis:

- [Agent Skill Gap Analysis](./agent-skill-gap-analysis.md)

Tasks:

- [ ] Create `resource-sharing-conventions`.
  - Cover live shared resource references, profile/link sharing, QR/link modal
    behavior, access checks, and future public/free quiz and roleplay
    exceptions.
- [ ] Create `ai-authoring-chat-conventions`.
  - Cover General/AI Chat tab layout, authoring history, history passed into
    each inference, assistant reply plus structured JSON changes, pending modal
    scroll behavior, and avoiding revision-history tables unless needed.
- [ ] Create `resource-attempt-runtime`.
  - Cover start/freeze/run/finish/evaluate/result/follow-up flows, progress
    event writing, and avoiding separate persisted preview/test attempt modes.
- [ ] Create `resource-follow-up-conversations`.
  - Cover creating Mr. F conversations from resource results, frozen source
    snapshots, visible source-resource links, credit policy, and preventing the
    tutor from re-grading the same result.
- [ ] Create `markdown-content-fields`.
  - Cover which fields render markdown, which edit fields use the Markdown
    editor, model instructions for markdown-capable fields, and safe rendering.
- [ ] Create `roleplay-pedagogy-and-evaluation`.
  - Cover learner English production focus, avoiding non-language moral/persona
    judgment, sentence-evaluation-style review, creative scenarios, turn limits,
    and future guest/free policy.

## Final Cleanup: Remove Legacy Data Structures

Goal: remove legacy data structures and compatibility code before production
because the project will start with a clean database.

Tasks:

- [ ] Review every legacy table that exists only for pre-V2 compatibility.
- [ ] Remove legacy chatroom tables, repository helpers, services, and tests
  (relocated from Slice 7; the chatroom surface is already removed and only this
  destructive schema cleanup remains).
  - Drop the `chat_rooms`, `chat_room_characters`, `chat_room_conversations`,
    `chat_room_messages`, `chat_room_conversation_reports`, and
    `conversation_chat_room_report_snapshots` tables/indexes from the baseline.
  - Remove the dead `*ChatRoom*` repository helpers (about 30 exported
    functions) plus their row types and mappers from `repository.ts`.
  - Update `tests/db/migrations.test.ts`, which currently asserts the chatroom
    tables and columns exist.
  - Decide whether the `/chatrooms` and `/chatroom-conversations` compatibility
    redirects in `server.ts` stay or are removed.
- [ ] Remove legacy practice-guide share/import tables and copied-resource
  compatibility paths once generic live sharing fully owns the behavior
  (relocated from Slice 8).
  - Drop the `practice_guide_share_links` table/index from the baseline.
  - Remove `findPracticeGuideShareLinkById`,
    `findPracticeGuideShareLinkForPracticeGuide`, and
    `getOrCreatePracticeGuideShareLink` from `repository.ts`.
  - Remove or fold the `/practice-guides/shared/:shareId` and
    `/practice-guides/shared/:shareId/accept` legacy redirect routes/handlers.
- [ ] Remove quiz legacy share/import tables and copied-resource
  compatibility paths once generic sharing and the Slice 14 public Quiz flow
  are settled (relocated from Slice 8).
  - Drop the `quiz_share_links` table/index from the baseline.
  - Remove `findQuizShareLinkById`,
    `findQuizShareLinkForQuiz`, and
    `getOrCreateQuizShareLink` from `repository.ts`.
  - Remove or fold the `/quizzes/shared/:shareId` and
    `/quizzes/shared/:shareId/start` legacy redirect routes/handlers.
  - Keep the generic `resource_share_links` table and the
    `*ResourceShareLink*` helpers; only the per-type legacy share links go.
- [ ] Remove old internal naming where it no longer needs compatibility,
  especially `PracticeGuide` identifiers that can safely become
  `PracticeGuide`.
- [ ] Rebuild the clean baseline migration so fresh production installs start
  from the simplified resource model.
- [ ] Re-run schema, repository, route, and render tests against a fresh
  database.
- [ ] Re-run a broad grep for legacy names, routes, tables, prompts, and docs.
- [ ] Audit page heading scale and vertical space across resource pages.
  - Review `h1`, `h2`, and section-heading sizes/margins because current page
    headers occupy too much vertical space in several views.

Exit criteria:

- [ ] Fresh databases contain only the current production-intended schema.
- [ ] No runtime code depends on deleted legacy structures.
- [ ] Old compatibility routes are either removed or intentionally redirected.
- [ ] The migration history is clean for the first production deployment.

Verification:

- [ ] Fresh SQLite migration check.
- [ ] `npm run typecheck`
- [ ] `npm run test:typecheck`
- [ ] `npm test`
- [ ] Manual QA for resources, assignments, practice guides, sharing, progress,
  payments, and roleplays if implemented by then.
