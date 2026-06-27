# Resource Simplification V2

Date: 2026-06-25

## Product Intent

V1 leaves Mister F with several resource-like areas that are useful but
increasingly redundant: practice modules, assignments, chat rooms, and
share-link/import flows attached to each resource family. V2 should simplify
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

The eventual V2 resource catalog should contain:

- `Tarea`
- `Guía de Práctica`
- `Diálogo`
- `Carpeta de recursos`

Internal names should stay English:

- `Assignment`
- `PracticeGuide`
- `Dialogue`
- `ResourceFolder`
- `Resource`

`Dialogue` is deliberately deferred until the final implementation slice. The
resource schema can reserve the type to avoid churn later, but early V2 work
should focus on assignments, practice guides, folders, and shared resource
infrastructure.

## Major Product Changes

### Remove Chat Rooms

Remove `Salas de chat` as a standalone resource area.

The existing chatroom feature overlaps with the future `Diálogos` concept but is
too separate from the rest of the product:

- separate sidebar entry
- separate room/conversation model
- separate share links
- separate reporting/follow-up path
- no clear connection to the broader resource library

V2 should either migrate useful chatroom ideas into `Diálogos` or remove the
feature entirely if no production data needs preservation.

### Rename Practice Module To Practice Guide

Rename the product concept:

- Spanish UI: `Módulo de práctica` -> `Guía de Práctica`
- Internal/domain language: `PracticeModule` -> eventually `PracticeGuide`

The new name is clearer because the resource is not only a module. It guides a
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

- assignments
- practice guides
- dialogues after the final dialogue slice lands
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
- profile share/import where supported
- search/filter/list/grid rendering

Each concrete resource type keeps its own runtime behavior.

### Introduce Resource Folders

`Carpeta de recursos` is itself a resource type.

Folders exist to organize and share resources. They should support:

- title and description
- contained resources
- optional ordering
- archive
- sharing
- owner view
- shared recipient view

Decision: V2 folders do not support nested folders. A folder can contain
assignments, practice guides, and eventually dialogues, but it cannot contain
another folder. This keeps the first resource model simple and prevents the UI
from becoming a file manager.

### Introduce Dialogues

`Diálogos` should replace the useful learning idea behind chatrooms with a
simpler resource-shaped concept.

Initial product direction:

- a dialogue is a reusable conversation-practice scenario
- it can define a situation, roles, tone, vocabulary, and target objective
- it can be launched as a guided practice conversation
- it can be shared like other resources
- it can produce progress and follow-up practice

A dialogue should not simply recreate V1 chatrooms. It should be closer to a
practice resource than a social room:

- no separate "room" area
- no multi-conversation room dashboard as the primary mental model
- no unrelated group-chat feature surface
- no standalone chatroom reports unless the dialogue runtime explicitly needs
  evaluated results

Dialogue implementation is intentionally last in the refactor. Open decision:
whether a dialogue is a scripted exchange, an AI roleplay, or a hybrid. The
recommended V2 starting point is AI roleplay with explicit scenario metadata and
one user-facing launch flow.

## Proposed Information Architecture

### Sidebar

Replace separate resource entries with one primary entry:

- `Recursos`

Inside the resource page, provide filters/tabs:

- `Todos`
- `Tareas`
- `Guías`
- `Diálogos` after the final dialogue slice lands
- `Carpetas`
- `Archivados`

This avoids sidebar growth as the product adds more resource types.

### Resource List

The `Recursos` page should become the main management surface.

Expected controls:

- create resource menu
- search
- type filters
- folder breadcrumb when inside a folder
- list/grid layout
- archived toggle only when archived resources exist
- archive/share actions

Expected item metadata:

- title
- resource type badge
- short description
- topic/level when available
- updated date
- shared/imported state
- folder location when useful

### Resource Detail

Each detail page should share a common shell:

- close/back button
- title
- type badge
- primary action
- options menu
- share action
- archive action

Then each type owns its body:

- `Tarea`: assignment summary and `Probar`/attempt/share flows
- `Guía de Práctica`: launch tutor practice with guide context
- `Diálogo`: launch dialogue practice
- `Carpeta`: contained resource list and sharing controls

## Proposed Data Model Direction

There are two likely schema strategies.

### Option A: Generic Resource Header Plus Type Tables

Recommended for V2.

Create a generic `resources` table:

- `id`
- `user_id`
- `profile_id`
- `type` with values `assignment`, `practice_guide`, `resource_folder`, and
  eventually `dialogue`
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

- `assignments.id -> resources.id`
- `practice_guides.id -> resources.id`
- `resource_folders.id -> resources.id`
- `dialogues.id -> resources.id` after the final dialogue slice

Folder membership should be stored outside `resources`:

- `resource_folder_items.folder_id`
- `resource_folder_items.resource_id`
- `resource_folder_items.resource_type`
- `resource_folder_items.position`

The folder membership table should disallow `resource_folder` as an item type so
nested folders are prevented by the persistence model, not only by UI checks.
For V2, a resource belongs to zero or one folder.

Sharing should use one generic table:

- `resource_share_links.id`
- `resource_share_links.resource_id`
- `resource_share_links.created_at`
- `resource_share_links.revoked_at`

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
- `resource_profile_shares` or equivalent profile import records
- shared/imported metadata on `resources`

Sharing a folder should share the folder as an organized bundle. Because folders
do not nest in V2, folder sharing can stay one level deep. Open decisions:

- Should folder sharing expose live contents or snapshot contents?
- Should recipients import copies or access the owner's shared resource?
- Should adding a new item to a shared folder update recipients automatically?

Recommended V2 default: use snapshots/copies for recipient stability, unless a
later classroom feature needs live teacher-managed resources. Profile sharing
can be modeled as copied resources with `source_resource_id` and `shared_via`
metadata instead of a live grant table in the first implementation.

## Migration Strategy

Before every implementation slice that touches persistence, review
`misterf-web/src/server/db/migrations.ts`.

If V2 starts before production launch, prefer resetting the baseline schema so
the first production migration history is clean.

If any V1 schema has already reached production, use forward-only migrations:

- migrate chatroom data only if it exists and should be preserved
- migrate practice modules into practice guides/resources
- migrate assignments into resources
- create generic share links while preserving old public URLs through redirects

Do not leave both old and new resource systems active for longer than necessary.

## Progress, Reports, And Home Suggestions

Resource simplification should update downstream features:

- progress event sources should use resource ids where helpful
- home suggestions should recommend resources by type
- assignment follow-up should continue to work
- practice guide conversations should still store frozen guide snapshots
- dialogue runs should define whether they produce progress events
- old chatroom report snapshot concepts should be removed or replaced

## Payments And Credits

Existing policies should remain conceptually stable:

- AI authoring consumes creator credits
- assignment shared-student evaluation remains product-funded/free to the
  student unless explicitly changed
- launching normal tutor practice from a resource follows standard credit policy

New dialogue generation or evaluation must get explicit credit policy before
implementation.

## Open Questions

1. Should `Diálogos` support multiple AI roles, or start with one roleplay
   partner?
2. Should `Diálogos` produce an evaluated result, or only tutor follow-up
   signals?
3. Should old `/practice-modules` URLs redirect to `Recursos`, or should they
   remain as compatibility routes for one release?
4. Should internal code rename `PracticeModule` to `PracticeGuide` immediately,
   or should UI copy change first?
5. Should `Tareas` and `Guías` remain createable from the resource menu only, or
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
4. rename practice modules to practice guides at the UI layer
5. make resource folders the only organization model
6. migrate assignments and practice guides into the resource catalog
7. remove chatrooms
8. consolidate generic sharing, progress, docs, and tests
9. add dialogues as the final new resource type
