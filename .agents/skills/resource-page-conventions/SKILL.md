---
name: resource-page-conventions
description: Use when creating, editing, or reviewing Mister F resource pages and resource-like flows, including the `/resources` catalog, folders, resource detail pages, edit pages, attempt pages, result pages, breadcrumbs, close buttons, action rows, resource history, and shared resource navigation.
---

# Resource Page Conventions

Use this skill with `bootstrap-ui-conventions`, `bootstrap-icons-conventions`,
`ejs-view-structure`, and `theme-surface-conventions`. Also use
`database-migration-safety` when the change touches persisted resource data.

## Core Rules

- The unified resource catalog is `/resources`. Dedicated detail routes such as
  `/assignments/:id`, `/roleplays/:id`, and `/practice-guides/:id` may remain
  resource-specific.
- Detail pages show the resource title, then a breadcrumb, then an action row.
  Actions do not float in the top-right corner of detail pages.
- Resource action row order is the specific primary action first, then
  `Opciones`.
- `Opciones` owns common resource actions such as share, move, archive, restore,
  and resource-specific secondary actions.
- Resource detail pages use breadcrumbs for resource-area navigation and do not
  show a close `X`.
- Edit, authoring, attempt, and result pages may use a close `X`, but it must
  link deterministically to the owning resource detail page. Do not use browser
  history or the removed type-specific list pages as the target.
- Result pages place follow-up actions directly below the title/summary area so
  desktop and mobile layouts expose the same action order.
- Resources that create attempts or evaluated results should show their
  relevant history on the detail page when that helps the user return to prior
  work.
- Use Bootstrap Icons only. For close buttons use `bi bi-x-lg`.
- Keep resource-specific renderers in dedicated EJS views or small reusable
  partials. Do not collapse unrelated resource pages into a single conditional
  mega-view.

## Checks Before Finishing

- Verify breadcrumbs point to `/resources`, folder detail pages, and the current
  resource detail page as appropriate.
- Verify close buttons use the owning resource detail route, not
  `document.referrer`, `history.back()`, or old list pages.
- Verify shared resource navigation still has enough folder/path context to
  build correct breadcrumbs.
- Run the relevant typecheck/test/build command and restart the local server
  when views or server code changed.
