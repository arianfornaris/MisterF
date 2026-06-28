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
- [Home Start Experience](../features/home-start-experience.md)
- [Payments](../features/payments.md)
- [Chat Rooms](../features/chatrooms.md)

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Decisions

- [x] V2 folders support nesting through `resource_folder_items`.
- [x] `Diálogos` are deferred until the final implementation slice.
- [x] Slice 1 uses the generic `resources` table plus type-specific tables
  strategy.
- [x] Folder membership is a separate table and a resource or folder belongs to
  zero or one parent folder in V2.
- [x] Generic sharing starts with snapshot/copy semantics for profile and folder
  imports unless a later classroom feature explicitly needs live resources.

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
- [ ] Keep credit policy explicit for every AI authoring or evaluation flow.
- [~] Add tests at the repository, route, and render layers for each migration
  slice.

## Current Milestone

Current status: **Slice 2 resource shell is implemented, with parts of Slices
4, 5, and 6 already in place. Dedicated assignment and practice-module runtime
routes remain active while the resource catalog owns listing and folder
organization.**

Completed:

- [x] Capture V2 product direction.
- [x] Create design document.
- [x] Create implementation tracker.
- [x] Decide to support folder nesting for V2.
- [x] Defer `Diálogos` until the final resource type slice.
- [x] Draft generic resource schema plan.
- [x] Add `add_resource_foundation` migration.
- [x] Add generic resource repository primitives.
- [x] Mirror assignment and practice module metadata into `resources`.
- [x] Add migration and repository tests for resource foundation behavior.
- [x] Add unified `Recursos` page shell.
- [x] Replace the sidebar assignment/practice-module entries with `Recursos`.
- [x] List assignments, practice guides, and resource folders together.
- [x] Add grid/list layout support.
- [x] Keep search and type filters out of the first resource page iteration per
  product review.
- [x] Add resource folder creation.
- [x] Add folder detail pages with nested-folder breadcrumbs.
- [x] Add move-to-folder and remove-from-folder actions for assignable
  resources and folders.
- [x] Add generic archive/restore actions for resources.
- [x] Redirect `/assignments` and `/practice-modules` list routes to
  `/resources`.
- [x] Keep old assignment and practice-module detail routes reachable from
  resource cards.
- [x] Keep practice-module detail pages visible while the active navigation
  entry is `Recursos`.
- [x] Remove resource favorite state from schema, repository APIs, routes, UI,
  tests, and current docs.

Next recommended step:

- [ ] Finish Slice 3 user-facing rename from `Módulo de práctica` to
  `Guía de Práctica`, then finish folder sharing and generic resource cleanup.

## Slice 0: Terminology And Scope Freeze

Goal: agree on names and resource boundaries before touching code.

Tasks:

- [x] Confirm Spanish UI labels:
  - `Recursos`
  - `Tareas`
  - `Guías de Práctica`
  - `Diálogos`
  - `Carpetas`
- [x] Confirm internal names:
  - `Resource`
  - `Assignment`
  - `PracticeGuide`
  - `Dialogue`
  - `ResourceFolder`
- [x] Decide whether `PracticeModule` is renamed internally in V2 or kept as a
  compatibility implementation detail.
- [x] Decide whether folder nesting is in V2.
- [x] Decide whether folder sharing is live or snapshot/copy based.
- [ ] Decide whether `Diálogos` are scripted, AI roleplay, or hybrid.
- [ ] Decide whether chatroom data must be migrated or can be discarded.
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
  - [x] `practice_modules`
  - [x] `practice_module_share_links`
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
- [ ] Add common resource card/list-item partials.
- [x] Keep old routes reachable during this slice.
- [x] Add route and architecture smoke tests.

Exit criteria:

- [x] Users can open `Recursos`.
- [x] Existing assignments/practice modules appear in the resource list.
- [x] Old feature pages still work.

Verification:

- [x] `npm run typecheck`
- [x] `npm run test:typecheck`
- [x] `npm test`
- [x] Route/architecture smoke for resource list redirects and resource-mounted
  practice-module pages.

## Slice 3: Practice Module To Practice Guide

Goal: rename the product concept while preserving behavior.

Tasks:

- [~] Replace Spanish UI copy `Módulo de práctica` with `Guía de Práctica`.
- [x] Replace sidebar/list labels in the unified resource catalog.
- [~] Update page titles, buttons, empty states, modals, and share text.
- [~] Update docs that mention the user-facing concept.
- [x] Keep old URL compatibility or add redirects.
- [x] Decide whether code identifiers remain `practiceModule` until schema
  consolidation.
- [ ] Add tests for visible labels where practical.

Exit criteria:

- [ ] Users see `Guía de Práctica` consistently.
- [x] Existing practice behavior is unchanged.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [~] Manual UI pass on guide list/detail/share/start.

## Slice 4: Use Resource Folders As The Organization Model

Goal: keep generic folders as the only resource organization model.

Tasks:

- [x] Add resource folder data model.
- [x] Add folder list/detail UI.
- [~] Add create/edit/archive/share folder actions.
- [x] Add add-to-folder/remove-from-folder actions.
- [x] Add folder breadcrumbs.
- [x] Add folder-aware resource list filtering.
- [x] Support nested resource folders.
- [x] Add move-to-folder flow for resources.
- [x] Add move-folder flow with cycle prevention.
- [x] Add move destination modal with current-folder default selection, folder
  drill-down, fixed-height scrolling folder list, and modal breadcrumbs.
- [~] Standardize resource option menus into common options plus
  resource-specific options. Assignment, practice-guide, and folder views now
  share breadcrumb navigation, move-to-folder actions, share/archive actions,
  and dedicated edit actions; future dialogue detail menus still need the same
  audit after dialogues exist.
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
- [ ] Move assignment sharing to generic resource sharing where possible.
- [x] Ensure assignment attempts still snapshot assignment content.
- [x] Ensure progress events still record evaluated attempts.
- [x] Add route compatibility for existing assignment URLs if needed.
- [~] Update assignment docs after implementation.

Exit criteria:

- [x] Tareas appear and behave correctly from the `Recursos` list.
- [x] Assignment-specific runtime pages still work.
- [x] Existing assignment tests pass.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [~] Assignment authoring/share/attempt/result smoke.

## Slice 6: Practice Guides As Resources

Goal: make practice guides first-class items in the resource catalog.

Tasks:

- [x] Attach practice guides to generic resources.
- [x] Preserve guide launch into tutor conversation.
- [x] Preserve conversation practice-guide snapshots.
- [x] Migrate or redirect old practice guide share links.
- [~] Remove duplicated list/archive/share code where generic resource
  behavior now owns it.
- [ ] Update home suggestions to reference resource ids where useful.

Exit criteria:

- [x] Practice guides appear and behave correctly from `Recursos`.
- [x] Starting tutor practice from a guide still stores a frozen snapshot.
- [x] Old practice guide paths have a clear redirect or compatibility path.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [~] Guide launch/share/import smoke.

## Slice 7: Remove Chat Rooms

Goal: remove `Salas de chat` as a standalone product area.

Tasks:

- [x] Decide whether any chatroom concepts migrate into `Diálogos`.
- [x] Remove sidebar entry.
- [x] Remove chatroom routes or add temporary redirects.
- [x] Remove chatroom views.
- [x] Remove chatroom client entry if unused.
- [x] Remove chatroom server services when no longer referenced.
- [x] Remove chatroom share-link routes.
- [ ] Remove legacy chatroom repository helpers after the schema reset or an
  explicit destructive migration.
- [ ] Remove chatroom tables only if migration strategy allows it.
- [x] Update docs to mark chatrooms deprecated or remove them from current
  architecture docs.

Notes:

- Useful chatroom learning ideas are deferred to `Diálogos`; they should be
  redesigned as resource-shaped dialogue practice instead of migrated directly.
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
- [ ] Add profile sharing/import support where required.
- [ ] Migrate old practice guide and assignment links.
- [ ] Define folder sharing behavior.
- [ ] Add QR/share modal support for generic resources.
- [ ] Remove old share-link tables/helpers/routes when safe.
- [ ] Update share modal partials.
- [ ] Add tests for public links, revoked links, and imported copies.

Exit criteria:

- [ ] One sharing implementation supports current resource types and can extend
  to dialogues in the final slice.
- [ ] Public links work for assignments, guides, and folders.
- [ ] Old links are redirected or migrated.

Verification:

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Public share smoke per resource type.

## Slice 9: Home, Progress, Payments, And Logging Updates

Goal: update downstream systems to understand the resource catalog.

Tasks:

- [ ] Update home-start recommendation inputs.
- [ ] Update progress event docs and code paths for resource ids.
- [ ] Preserve assignment attempt progress behavior.
- [ ] Update runtime logging event names from feature-specific resources to
  generic resource ids where helpful.
- [ ] Update analytics/log metadata to include `resourceId` and `resourceType`.

Exit criteria:

- [ ] Downstream systems no longer assume only practice modules/assignments.
- [ ] Logs can reconstruct user/model behavior by resource context.

Verification:

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual log review for resource actions.

## Slice 10: Resource Foundation Cleanup

Goal: remove old names, dead code, and stale docs before introducing dialogues.

Tasks:

- [x] Remove unused practice-module grouping files/types.
- [x] Document the resource breadcrumb and action-placement navigation standard
  in [Resource Simplification V2](../features/resource-simplification-v2.md).
- [x] Document nested folders, move-to-folder modal behavior, and common versus
  resource-specific options in
  [Resource Simplification V2](../features/resource-simplification-v2.md).
- [x] Remove unused chatroom runtime files.
- [ ] Remove duplicated resource card/list helpers.
- [ ] Update [README](../README.md).
- [ ] Update [Data Model](../architecture/data-model.md).
- [ ] Update [Feature Flows](../architecture/feature-flows.md).
- [ ] Update [Home Start Experience](../features/home-start-experience.md).
- [ ] Update [Payments](../features/payments.md).
- [ ] Archive or rewrite [Chat Rooms](../features/chatrooms.md).
- [ ] Run broad grep for old user-facing labels:
  - `Módulos de práctica`
  - `Practice Module`
  - `chatroom`
  - `Salas de chat`
- [ ] Run full test suite.

Exit criteria:

- [ ] The resource model is coherent in code, docs, UI, and tests.
- [ ] No stale chatroom feature surface remains.
- [ ] The resource foundation is ready for the final dialogue feature slice.

Verification:

- [ ] `npm run typecheck`
- [ ] `npm run test:typecheck`
- [ ] `npm test`
- [ ] Manual QA for resource list/detail/create/share/archive/folder flows.

## Slice 11: Introduce Dialogues Last

Goal: add `Diálogos` as the final new resource-shaped conversation practice
feature after the resource foundation is already coherent.

Tasks:

- [ ] Finalize dialogue product definition.
- [ ] Add dialogue schema/type table if it was not reserved in the resource
  baseline.
- [ ] Add dialogue authoring UI.
- [ ] Add dialogue detail page.
- [ ] Add dialogue launch flow.
- [ ] Add dialogue runtime prompt/service.
- [ ] Decide whether dialogue runs produce evaluated results.
- [ ] Decide progress event behavior.
- [ ] Add dialogue sharing through generic resource sharing.
- [ ] Update payment/credit docs for dialogue authoring/evaluation.
- [ ] Add tests for dialogue validation, repository helpers, and render paths.

Exit criteria:

- [ ] A user can create, open, share, and launch a dialogue.
- [ ] Dialogue behavior is clearly distinct from removed chatrooms.
- [ ] Credit policy is explicit for AI generation/evaluation.
- [ ] V2 is ready for final manual QA before production.

Verification:

- [ ] `npm run typecheck`
- [ ] `npm run test:typecheck`
- [ ] `npm test`
- [ ] Dialogue create/launch/share smoke.
