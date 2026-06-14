# UI Style Consistency Audit

## Status

Planned.

## Background

Some views reuse CSS classes that were originally named for a specific feature
but now behave as generic layout helpers. For example, profile and chat room
forms currently reuse classes such as `practice-module-form-card`, even though
those pages are not practice-module pages.

This works visually, but the naming hides intent and makes future UI work more
fragile. It also increases the risk that a style change made for one feature
accidentally changes unrelated pages.

## Goal

Review how styles are shared across the app and make the UI more consistent
without inventing a separate design system outside Bootstrap/Bootswatch Flatly.

The desired result is:

- page markup uses semantic class names that match the page or reusable pattern
- shared styles are named generically only when they are truly shared
- feature-specific styles do not leak into unrelated features
- buttons, links, cards, forms, tabs, modals, and alerts follow Bootstrap/Flatly
- custom CSS is limited to app-specific layout or pedagogical/chat components

## Audit Scope

Review these areas:

- EJS page templates in `misterf-web/views`
- shared shell and partials in `misterf-web/views/partials`
- app CSS in `misterf-web/src/client/styles`
- generated class usage around forms, cards, page headers, tabs, modals, and
  list/detail layouts

## Specific Things To Look For

- Feature-named classes reused as generic helpers, such as
  `practice-module-form-card` outside practice-module pages.
- Custom button or link styles where Bootstrap classes would be enough.
- Multiple visual treatments for equivalent UI patterns.
- Page headers that use different spacing, hierarchy, or typography without a
  product reason.
- Form cards with inconsistent width, padding, labels, help text, and action
  alignment.
- Tabs that diverge from the project Bootstrap tab/pill convention.
- Modals that mix link-style close/cancel actions with Bootstrap button actions.
- Custom color usage that bypasses Bootstrap tokens or the documented app theme
  variables.

## Proposed Remediation

1. Inventory repeated page patterns and decide which are truly shared.
2. Introduce neutral reusable class names only for real shared patterns, such as
   `resource-form-shell` or `app-form-card`.
3. Rename misleading feature-specific classes where possible.
4. Prefer Bootstrap utilities over new custom CSS when the behavior is standard.
5. Keep feature-specific classes only for feature-specific layout or behavior.
6. Update `docs/design/visual-design.md` if the audit establishes new reusable
   UI conventions.
7. Verify representative pages manually after each cleanup pass.

## Non-Goals

- Do not redesign the entire app visually in one pass.
- Do not replace Bootstrap/Bootswatch Flatly with a custom design system.
- Do not rename classes mechanically without checking the visual impact.
- Do not use CSS cleanup as an excuse to change product behavior.
