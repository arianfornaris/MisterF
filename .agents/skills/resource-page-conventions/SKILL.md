---
name: resource-page-conventions
description: Use when creating, editing, or reviewing Mister F resource pages, the media library, and resource-like flows, including the `/resources` catalog, `/media-library`, folders, detail pages, edit/authoring pages, creation (`-new`) pages, attempt pages, result pages, breadcrumbs, close buttons, action rows, resource history, and shared resource navigation.
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
  `Opciones`.
- `Opciones` owns common resource actions such as share, move, archive, restore,
  and resource-specific secondary actions.
- Every page in the resources and media-library areas carries a breadcrumb —
  see [Breadcrumb Navigation](#breadcrumb-navigation). This is the single
  back-navigation convention for the area; do not ship a resources/media page
  without one.
- Result pages place follow-up actions directly below the title/summary area so
  desktop and mobile layouts expose the same action order.

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
    exit.
- A close `X`, when present, must link deterministically to the owning resource
  detail page (or the area root for creation flows). Do not use browser history
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
