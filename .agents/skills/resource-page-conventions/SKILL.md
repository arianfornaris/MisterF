---
name: resource-page-conventions
description: Use when creating, editing, or reviewing Mister F resource pages, the media library, and resource-like flows, including the `/resources` catalog, `/media-library`, folders, detail pages, edit/authoring pages, creation (`-new`) pages, attempt pages, result pages, breadcrumbs, close buttons, action rows, the primary action label ("Probar" for the author vs "Comenzar" / "Hacer el quiz" for recipients), adding a new resource type, resource history, and shared resource navigation.
---

# Resource Page Conventions

Use this skill with `bootstrap-ui-conventions`, `bootstrap-icons-conventions`,
`ejs-view-structure`, and `theme-surface-conventions`. Also use
`database-migration-safety` when the change touches persisted resource data.

This skill covers both the `/resources` area and the `/media-library` area:
media items are resources too, so they follow the same navigation conventions
(with the folder differences noted in [Breadcrumb Navigation](#breadcrumb-navigation)).

## Core Rules

- The unified resource catalog is `/resources`. Dedicated detail routes such as
  `/quizzes/:id`, `/roleplays/:id`, and `/practice-guides/:id` may remain
  resource-specific.
- Detail pages show the resource title, then a breadcrumb, then an action row.
  Actions do not float in the top-right corner of detail pages.
- Resource action row order is the specific primary action first, then
  `Opciones`. The primary action's label depends on who is looking — see
  [Primary Action Label](#primary-action-label).
- `Opciones` owns common resource actions such as share, move, archive, restore,
  and resource-specific secondary actions.
- Every page in the resources and media-library areas carries a breadcrumb —
  see [Breadcrumb Navigation](#breadcrumb-navigation). This is the single
  back-navigation convention for the area; do not ship a resources/media page
  without one.
- Result pages place follow-up actions directly below the title/summary area so
  desktop and mobile layouts expose the same action order.
- Every page scoped to one resource carries the resource kicker above the
  title — see [Resource Page Kicker](#resource-page-kicker).

## Primary Action Label

The primary action on a detail page starts the resource (a quiz attempt, a
roleplay attempt, a practice-guide chat). Both viewers get the same button and
the same student-facing flow, but not the same meaning, so the label follows
**who is looking, never the resource type**:

| Viewer | Label | Why |
| --- | --- | --- |
| The author (`canManageQuiz`, `canManageRoleplay`, `canManagePracticeGuide`… true) | `resources.test` — "Probar" | Their run is a private test: `collectResults` is false and it never counts as participation (`resource-attempt-runtime`). |
| Anyone else (a link or profile share recipient) | `resources.takeQuiz` — "Hacer el quiz" for quizzes; `resources.start` — "Comenzar" for roleplays, practice guides and any new type without a more specific verb | They are doing the activity for real, and the author may receive their results. |

- Branch in the view on the page's `canManage*` flag:
  `<%= canManageX ? t('resources.test') : t('resources.start') %>`. The flag is
  permission, so this is not a hand-styled mode branch (`cuaderno-theme`).
- Authoring (`/edit`) pages are owner-only, so their run button is always
  `resources.test`.
- The shared page `/resources/shared/:shareId` never says "Probar": an author
  who opens their own link is redirected to the detail page.
- Labels come from i18n in es/en/ht. Never a hardcoded string, and never a
  per-type label computed in a handler.
- **A new resource type** adds the same ternary on its detail page and extends
  the recipient check in `tests/server/routes.test.ts` ("renders and accepts
  generic live resource share links"), which asserts a recipient never reads
  "Probar", plus an owner assertion on its own detail test.

History: until 2026-09-12 the label was fixed per type — the quiz and guide
said "Probar" to everyone (a student read "Probar" on a real attempt) and the
roleplay said "Comenzar" to everyone (the author read "Comenzar" on a private
test).

## Resource Page Kicker

A page that belongs to a single resource must always say **what kind of resource
it is**, with its icon, no matter how deep it sits. Otherwise a page like
participation or a result shows only a title, and the reader cannot tell a quiz
from a roleplay from a practice guide.

- Render it through the shared partial `views/partials/resource-page-kicker.ejs`,
  placed directly above the `app-page-title`. Do not hand-write an
  `app-page-kicker` paragraph on a resource page.
- Parameters:
  - `resourceType` — `quiz`, `practice_guide`, `roleplay`, or `scene_media`.
  - `pageLabel` — optional; what *this* page is (`Participación`, `Editando`,
    `Resultado`). **Omit it on the resource's own detail page**, where the type
    alone is the kicker.
- It renders `<icon> <Type>` and, with a label, `<icon> <Type> · <Page>`. The
  icon set is the same one the catalog rows use in
  `src/server/resources/handlers.ts`, so a resource looks the same in the list
  and on its pages. Add new types to both places together.
- Reuse the existing type names (`quizzes.quizKicker`,
  `practiceGuides.guideKicker`, `roleplays.roleplayKicker`,
  `mediaLibrary.mediaKicker`) rather than adding a per-page combined string like
  "Quiz en edición"; the page part belongs in `pageLabel`
  (`resources.pageEditing` and friends), so the type stays one translation.
- Remember `ejs-nested-include-paths`: from a top-level view the include is
  `partials/resource-page-kicker`, but from another partial it is the relative
  `resource-page-kicker`. Only rendering catches a wrong path.

## Breadcrumb Navigation

Navigation across the resources and media-library areas is uniform: **every**
page carries a breadcrumb as its back-navigation trail. This replaces the old
"detail uses breadcrumb, focused pages use only a close `X`" split.

- Render the breadcrumb through the shared partial
  `views/partials/breadcrumb.ejs`. Do not repeat the markup per view. It renders
  as an `app-page-copy` paragraph placed directly under the `app-page-title`,
  with ` / ` separators; every crumb except the last is a link, the last is
  plain text for the current page.
- Trail composition:
  - **Resources:** `/resources` (labelled `resources.title`) → folder ancestry
    from `resourceFolderPath` → the current resource or action. Foldered
    resources include every ancestor folder in order.
  - **Media library:** `/media-library` (labelled `mediaLibrary.title`) → the
    current item or action. The media library has **no folders**, so the trail
    is flat — root then current, never a folder segment.
- Per page-type:
  - **List** (`/resources`, `/media-library`): the area root is the origin of
    the trail and its title already names the location, so the root list needs
    no breadcrumb. A foldered list view (`/resources/folders/:id`) does show one:
    root → ancestor folders → current folder (plain).
  - **Area root → home.** An area root (`/resources`, `/media-library`, and
    `/progress` outside this area) carries a close `X` to `/`, rendered by
    `views/partials/home-close-button.ejs` as the **last direct child of an
    `.app-page-header-root-close` header** — never inside
    `app-page-header-actions`. That keeps the `X` in the top-right corner at
    every width while "Nuevo" stacks under the title on phones (it used to
    drop below the title with the actions). Breadcrumbs **never** gain a home crumb: the
    side panel's `Inicio` and the phone toolbar's house are the way home, and
    the root's `X` completes the close chain (inner page → owner → area root →
    home). Roadmap V3 §1.15.
  - **Detail:** full trail ending in the resource/item title as plain text.
  - **Edit / authoring:** same trail as the owning detail, ending in the
    resource title (optionally followed by an "Editar"/authoring crumb).
  - **Creation (`-new`):** catalog root → origin folder ancestry if the creation
    started inside a folder, else just the root → a "Nuevo…" / "Nueva…" plain
    crumb. The origin folder travels through the whole creation flow: the
    `/resources/folders/:id` list passes `?folder=<id>` on its create links, the
    `-new` GET validates that folder and threads it into the breadcrumb, a hidden
    form field, and the close-`X`/cancel target, and the create POST assigns the
    new resource to that folder (`addResourceToFolder`). Never depend on
    `document.referrer` for this.
  - **Attempt / result / evaluating:** these carry the breadcrumb too, but only
    for the authenticated resource-owner/participant context. Quiz attempt,
    evaluating, and result pages are reachable by guests through share links
    (guest-token flow, `attempt.userId` is null); a guest has no `/resources`
    catalog, so **do not** render the breadcrumb for guests — they keep the
    close-`X` only. Render the breadcrumb only when the viewer is authenticated
    and it is their own attempt. Roleplay attempt/result pages are always
    authenticated (the attempt owner must match the viewer), so they always
    carry the breadcrumb. Where present, the close-`X` may stay as the immersive
    exit. **A guest's close `X` never points at `/quizzes/:id`** — that is the
    owner's page and 302s a visitor without a session to `/login`. The handler
    passes `closeHref` (`buildAttemptCloseHref`): the quiz page for an owned
    attempt or the author's read-only view, otherwise the quiz's active share
    page, or `/` once the link is revoked (`quizzes/guestAttempts.ts`).
    Roadmap V3 §1.18.
- A close `X`, when present, must link deterministically to the owning resource
  detail page (or the area root for creation flows, or the home `/` for an
  area root itself). Do not use browser history
  (`document.referrer`, `history.back()`) or the removed type-specific list
  pages as its target.
- Resources that create attempts or evaluated results should show their
  relevant history on the detail page when that helps the user return to prior
  work.
- Use Bootstrap Icons only. For close buttons use `bi bi-x-lg`.
- Keep resource-specific renderers in dedicated EJS views or small reusable
  partials. Do not collapse unrelated resource pages into a single conditional
  mega-view.

## Checks Before Finishing

- Verify the detail page's primary action reads "Probar" for the author and
  the real-action label ("Hacer el quiz" / "Comenzar") for a recipient, with a
  route test for both viewers.
- Verify every resources/media-library page renders the shared breadcrumb
  partial, and that the trail points to `/resources` or `/media-library`, folder
  ancestry, and the current page as appropriate.
- Verify media-library breadcrumbs stay flat (root → current), with no folder
  segment, since the media library has no folders.
- Verify `-new` pages resolve their origin folder (or fall back to the area
  root) rather than relying on `document.referrer`.
- Verify close buttons, where present, use the owning resource detail route (or
  area root), not `document.referrer`, `history.back()`, or old list pages.
- Verify shared resource navigation still has enough folder/path context to
  build correct breadcrumbs.
- Run the relevant typecheck/test/build command and restart the local server
  when views or server code changed.
