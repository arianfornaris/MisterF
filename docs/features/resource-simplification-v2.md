# Resource Simplification V2

Date: 2026-06-25

## Product Intent

V1 leaves Mister F with several resource-like areas that are useful but
increasingly redundant: practice guides, quizzes, legacy chat rooms, and
separate sharing flows attached to each resource family. V2 should simplify
this into one resource system that is easier to understand, organize, share,
and extend.

The goal is not to remove learning power. The goal is to make the product model
smaller:

- one place where users manage learning resources
- one shared organization model
- one shared sharing model
- clearer names for teachers and learners
- fewer parallel route, UI, and persistence patterns

This is a large refactor and should be implemented in slices.

## Target Resource Types

The V2 resource catalog contains:

- `Quiz`
- `Guía de Práctica`
- `Roleplay`
- `Carpeta de recursos`

Internal names should stay English:

- `Quiz`
- `PracticeGuide`
- `Roleplay`
- `ResourceFolder`
- `Resource`

`Roleplay` landed in the final implementation slice as the fourth active
resource type.

## Major Product Changes

### Remove Chat Rooms

Remove `Salas de chat` as a standalone resource area.

The existing chatroom feature overlaps with the `Roleplay` concept but is
too separate from the rest of the product:

- separate sidebar entry
- separate room/conversation model
- separate share links
- separate reporting/follow-up path
- no clear connection to the broader resource library

V2 should migrate only the useful learning ideas into `Roleplay`; it should not
carry the old standalone chatroom product surface forward.

Current implementation status:

- the sidebar entry has been removed
- standalone chatroom routes now redirect to `/resources`
- chatroom EJS views, client entrypoints, page CSS, prompt files, and runtime
  services have been removed
- tutor chat no longer receives chatroom report context or chatroom tools
- legacy chatroom schema/repository helpers remain only as migration debt until
  the baseline reset or an explicit destructive migration removes them

### Rename Practice Guide To Practice Guide

Rename the product concept:

- Spanish UI: `Guía de Práctica` -> `Guía de Práctica`
- Internal/domain language: `PracticeGuide` -> eventually `PracticeGuide`

The new name is clearer because the resource is not only a narrow lesson unit. It guides a
tutor conversation by describing goals, context, and practice behavior.

Implementation can happen in stages:

1. UI copy changes first.
2. Routes and docs can keep compatibility redirects.
3. Internal code/table names can be renamed only when the schema refactor is
   ready.

### Use Resource Folders For Organization

Practice guides should not have a separate resource-specific grouping model.
Their product role is handled by `Carpeta de recursos`, which can group any
supported resource type:

- quizzes
- practice guides
- roleplays
- future resource types

Because V2 is landing before production data is preserved, the baseline keeps
only generic resource folders.

### Introduce Resources

`Recursos` becomes the umbrella area for all reusable/shareable learning
objects.

A resource should provide the shared cross-cutting behavior:

- ownership by user and profile
- type
- title
- description
- optional topic/level metadata
- archive state
- updated timestamp
- folder membership
- share state
- public link share
- profile share through live access grants where supported
- search/filter/list/grid rendering

Each concrete resource type keeps its own runtime behavior.

### Introduce Resource Folders

`Carpeta de recursos` is itself a resource type.

Folders exist to organize and share resources. They should support:

- title and description
- parent folder, for nested folders
- child folders
- contained resources
- optional ordering
- archive
- sharing
- owner view
- shared recipient view
- moving resources between folders
- moving folders between parent folders, while preventing cycles

Target direction: V2 should allow nested folders. The first implementation can
ship a flat folder model if needed, but the product model should not assume
folders are permanently flat. Nested folders must prevent self-containment and
cycles by design.

### Introduce Roleplays

`Roleplay` resources should replace the useful learning idea behind chatrooms
with a simpler resource-shaped concept.

Initial product direction:

- a roleplay is a reusable free-form two-character scenario
- it defines a situation, learner context, characters, learner role, opening
  line, tone, vocabulary, goals, and optional learner-turn limit
- the AI plays the fictional character
- the learner writes English turns in a dedicated roleplay-writing UI
- the roleplay ends when the learner presses finish or reaches the configured
  learner-turn limit
- completion produces an evaluated result with sentence-evaluation-like
  annotations for each learner turn
- evaluated authenticated attempts produce progress and follow-up practice

Roleplay should not simply recreate V1 chatrooms. It should be closer to a
practice resource than a social room:

- no separate "room" area
- no multi-conversation room dashboard as the primary mental model
- no unrelated group-chat feature surface
- no guided branching in the first version
- no normal chat transcript as the primary runtime UI

Roleplay implementation is intentionally last in the refactor. The V2 starting
point is AI roleplay with explicit scenario metadata, a dedicated writing
surface, attempts with frozen snapshots, post-completion evaluation, and
quiz-style follow-up actions.

See [Roleplays](./roleplays.md) for the detailed product definition.

## Proposed Information Architecture

### Sidebar

Replace separate resource entries with one primary entry:

- `Recursos`

Inside the resource page, provide filters/tabs:

- `Todos`
- `Quizzes`
- `Guías`
- `Roleplay`
- `Carpetas`
- `Archivados`

This avoids sidebar growth as the product adds more resource types.

### Resource Navigation

Resource navigation should feel explicit and consistent across folders,
quizzes, practice guides, and roleplays.

This standard applies through the resource show/detail view. Resource edit and
authoring views may use a close button instead of breadcrumbs, because editing
is a focused workflow entered from a specific resource.

Runtime pages such as quiz attempts, quiz results, tutor
conversations, and roleplay sessions may use their own flow-specific
navigation, but their entry points should still be reachable from the resource
detail page.

Catalog root behavior:

- `/resources` is the root of the resource area.
- It does not need a breadcrumb.
- It shows the catalog title and the global `Nuevo` menu in the page header.
- Search, filter, and sort controls belong below the header.

Folder detail behavior:

- `/resources/folders/:folderId` shows the folder title as the page title.
- It shows a breadcrumb directly below the title:
  - `Recursos / Folder name`
  - `Recursos / Parent folder / Folder name` when nested folders exist
- It shows folder actions directly below the breadcrumb.
- The folder action row order is:
  - `Nuevo`
  - `Opciones`
- The `Nuevo` menu creates resources in the current catalog context.
- The `Opciones` menu owns common folder resource actions first, such as moving
  the folder and archiving or restoring it.
- Folder-specific actions, such as editing folder metadata and future folder
  sharing controls, appear below the common actions with a divider when that
  improves scanning.

Nested folder behavior:

- `Recursos / Parent folder / Child folder`
- Folder breadcrumbs must link to every parent folder.
- A folder can contain resources and child folders.
- The UI must prevent moving a folder into itself or into one of its descendants.

Resource detail behavior:

- Quiz, practice guide, and roleplay detail pages show the resource
  type and resource title.
- They show a breadcrumb before resource actions:
  - `Recursos / Resource title` when the resource is not in a folder.
  - `Recursos / Folder name / Resource title` when opened from or assigned to a
    folder.
- Breadcrumb segments should use real links:
  - `Recursos` links to `/resources`.
  - `Folder name` links to `/resources/folders/:folderId`.
  - The current resource title is text, not a link.
- Resource actions appear below the breadcrumb, not floating in the top-right
  corner.
- Resource-specific primary actions come before `Opciones`.
  - Quiz: `Probar`
  - Practice guide: `Probar`
  - Roleplay: launch/start action, to be named when roleplays are defined
- `Opciones` owns secondary actions such as share, edit, archive, restore, and
  other resource-specific management actions.
- Resource detail pages must include both common resource options and
  resource-specific options in the same `Opciones` menu.
- Common resource options apply to every resource type:
  - move to folder
  - archive or restore
  - share where the resource supports sharing
- Resource-specific options live below the common options, separated by a
  divider when that improves scanning.
  - Quiz-specific examples: edit task, share public student link, share
    with profile, view attempts where applicable
  - Practice-guide-specific examples: edit guide, launch guided practice, share
    guide-specific links where still needed
  - Roleplay-specific examples: edit roleplay, launch roleplay, configure
    roleplay scenario
- Detail pages do not show a close `X`; the breadcrumb provides resource-area
  navigation.
- If a resource detail page includes a global `Nuevo` menu later, it must appear
  in the same action row below the breadcrumb. When `Nuevo` and `Opciones` are
  both present in that row, `Nuevo` appears before `Opciones`.

Edit and authoring view behavior:

- Edit views may use a close `X`.
- The close button must link to the resource detail page, not to the old
  type-specific list and not to browser history.
- Quiz edit closes to `/quizzes/:quizId`.
- Practice guide edit closes to `/practice-guides/:practiceGuideId`.
- Breadcrumbs are optional in edit views. If they are added later, they should
  complement the close button rather than replace the explicit close target.

Breadcrumb context should be explicit. Do not rely on `document.referrer`,
browser history, or implicit back behavior to infer where the user came from.

Preferred context sources:

1. The current folder path when the user is inside a folder.
2. The resource's folder membership when the resource belongs to one folder.
3. A server-validated folder context parameter when the same resource can be
   opened from multiple folders in the future.
4. The catalog root when no folder context exists.

Move-to-folder modal:

- Moving a resource or folder should open a modal rather than navigating away.
- The modal starts at the resource's current folder. If the resource is not in a
  folder, it starts at the resource root.
- The modal lists child folders for the opened destination.
- The opened folder is the selected destination. Users do not choose from a
  separate per-row select action.
- Clicking a folder row enters that folder, then the footer `Mover` button
  confirms moving to the opened folder.
- The modal shows its own breadcrumb:
  - `Recursos`
  - `Recursos / Parent folder`
  - `Recursos / Parent folder / Child folder`
- Each breadcrumb segment is clickable so the user can jump back to any parent.
- The modal clearly shows the currently selected destination.
- The folder list area has a fixed height and scrolls internally when there are
  many child folders, so the footer action does not jump as the user navigates.
- The modal should allow moving to the resource root when removing a resource
  from a folder by opening the `Recursos` breadcrumb destination.
- The modal must disable invalid destinations:
  - the resource's current folder, when moving there would be a no-op
  - the folder itself, when moving a folder
  - any descendant of the folder being moved
- Confirming the modal updates folder membership and returns the user to the
  relevant current view.

Use standard Bootstrap structure:

- page title block
- small breadcrumb row under the title
- compact flex action row under the breadcrumb
- Bootstrap dropdowns for `Nuevo` and `Opciones`
- Bootstrap Icons inside menu items and buttons

Avoid:

- floating page actions in the top-right corner on folder/detail pages
- duplicate action rows
- actions split between header and breadcrumb area
- browser-history-dependent back buttons
- old type-specific list destinations from resource detail/edit views

### Resource List

The `Recursos` page should become the main management surface.

Expected controls:

- create resource menu
- search
- type filters
- folder breadcrumb when inside a folder, including parent folders when nested
- one list layout for resources and folders
- archived toggle only when archived resources exist
- archive/share actions
- move-to-folder action in resource option menus

Expected item metadata:

- title
- resource type badge
- short description
- topic/level when available
- updated date
- shared access state
- folder location when useful

### Resource Detail

Each detail page should share a common shell:

- breadcrumb
- title
- type badge
- primary action
- options menu
- common resource options
- resource-specific options

Then each type owns its body:

- `Quiz`: quiz summary and `Probar`/attempt/share flows
- `Guía de Práctica`: launch tutor practice with guide context
- `Roleplay`: launch roleplay practice
- `Carpeta`: contained resource list and sharing controls

## Proposed Data Model Direction

There are two likely schema strategies.

### Option A: Generic Resource Header Plus Type Tables

Recommended for V2.

Create a generic `resources` table:

- `id`
- `user_id`
- `profile_id`
- `type` with values `quiz`, `practice_guide`, `resource_folder`, and
  `roleplay`
- `title`
- `description`
- `topic`
- `level`
- `archived_at`
- `source_resource_id`
- `source_user_id`
- `source_profile_id`
- `shared_via`
- timestamps

Then keep type-specific tables whose primary key is also the resource id:

- `quizzes.id -> resources.id`
- `practice_guides.id -> resources.id`
- `resource_folders.id -> resources.id`
- `roleplays.id -> resources.id`

Folder membership should be stored outside `resources`:

- `resource_folder_items.folder_id`
- `resource_folder_items.resource_id`
- `resource_folder_items.resource_type`
- `resource_folder_items.position`

Nested folders are modeled by allowing `resource_folder` as an item type in
`resource_folder_items`. This keeps folder membership and ordinary resource
membership in one table and preserves the rule that a resource or folder has at
most one current parent folder.

Folder movement must prevent invalid states at the persistence/service boundary:

- a folder cannot contain itself
- a folder cannot move into one of its descendants
- a resource or folder should have one current parent folder at most
- moving to the catalog root clears the parent folder relationship

Sharing should use one generic table:

- `resource_share_links.id`
- `resource_share_links.resource_id`
- `resource_share_links.created_at`
- `resource_share_links.revoked_at`

Accepted shares should use live access grants rather than copied imports:

- `resource_access_grants.id`
- `resource_access_grants.resource_id`
- `resource_access_grants.user_id`
- `resource_access_grants.profile_id`
- `resource_access_grants.granted_by_user_id`
- `resource_access_grants.granted_via`
- `resource_access_grants.share_link_id`
- `resource_access_grants.revoked_at`

A recipient sees the owner's current resource through the grant. If the owner
edits the resource, recipients see the updated version. Recipients should not be
able to edit, archive, move, or re-share resources they only access through a
grant.

Benefits:

- one list query
- one folder model
- one share-link model
- one archive model
- easier future resource types

Risks:

- migration touches many existing repositories
- old route handlers need careful redirects or compatibility shims
- resource type authorization must stay explicit

### Option B: Keep Separate Tables And Add Resource Index

Create a generic read/index table that points to existing resource tables.

Benefits:

- smaller initial blast radius
- can migrate UI before deep storage changes

Risks:

- duplicated state can drift
- folders and sharing become harder
- long-term code may stay more complex than V1

Recommended approach: use Option A if V2 is implemented before production data
needs to be preserved. Use Option B only if production migration risk becomes
too high.

## Sharing Model

V2 should converge sharing into one generic model:

- `resource_share_links`
- `resource_access_grants`
- owner-only metadata on `resources`

Sharing a folder should share the folder as an organized bundle. With nested
folders, folder sharing should expose live contents through the folder grant.

Current V2 direction:

- recipients access the owner's resource by reference
- folder shares expose current folder contents
- adding or editing content in a shared folder updates what recipients see
- recipients need an account before accepting a share link
- quiz links temporarily follow the generic account-required share flow

Future exception: `Quizzes` should eventually support a special public student
flow where a student can complete the quiz and receive free AI evaluation
before creating an account. That is intentionally deferred so Slice 8 can first
land the generic resource-sharing model.

## Migration Strategy

Before every implementation slice that touches persistence, review
`misterf-web/src/server/db/migrations.ts`.

If V2 starts before production launch, prefer resetting the baseline schema so
the first production migration history is clean.

If any V1 schema has already reached production, use forward-only migrations:

- migrate chatroom data only if it exists and should be preserved
- migrate legacy practice guides into practice guides/resources
- migrate quizzes into resources
- create generic share links while preserving old public URLs through redirects

Do not leave both old and new resource systems active for longer than necessary.

## Progress, Reports, And Home Suggestions

Resource simplification should update downstream features:

- progress event sources should use resource ids where helpful
- `/progress?tab=events` should list all evaluated sources that update learner
  progress: tutor conversation reports shown as `Bitácora`, quizzes shown
  as `Quiz`, roleplays shown as `Roleplay`, and future evaluated resources once
  they write progress events
- home suggestions should recommend resources by type, but the personalized
  home suggestion system is now treated as a separate larger feature outside
  this V2 slice
- quiz follow-up should continue to work
- practice guide conversations should still store frozen guide snapshots
- roleplay runs produce progress events after authenticated evaluated attempts
- old chatroom report snapshot concepts should be removed or replaced

## Payments And Credits

Existing policies should remain conceptually stable:

- AI authoring consumes creator credits
- quiz shared-student evaluation remains product-funded/free to the
  student unless explicitly changed
- launching normal tutor practice from a resource follows standard credit policy

Roleplay authoring, AI revision, runtime character turns, evaluation, and
follow-up tutoring use the standard credit policy.

## Open Questions

1. Should future `Roleplay` resources support more than one AI role, or keep the
   two-character constraint for a long time?
2. Which roleplay result metrics should be shown as scores versus qualitative
   feedback?
3. Should old `/practice-guides` URLs redirect to `Recursos`, or should they
   remain as compatibility routes for one release?
4. Should internal code rename `PracticeGuide` to `PracticeGuide` immediately,
   or should UI copy change first?
5. Should `Quizzes` and `Guías` remain createable from the resource menu only, or
   also from contextual empty states?
6. Should resource folders be profile-scoped only, or can account-level folders
   group resources across profiles later?

## Recommended Implementation Shape

Use the tracker in
[Resource Simplification V2 Tracker](../issues/resource-simplification-v2-tracker.md).

Implement in this order:

1. finalize terminology and route strategy
2. design the generic resource data model
3. introduce the resource shell without removing old behavior
4. rename practice guides to practice guides at the UI layer
5. make resource folders the only organization model
6. migrate quizzes and practice guides into the resource catalog
7. remove chatrooms
8. consolidate generic sharing, progress, docs, and tests
9. add roleplays as the final new resource type
