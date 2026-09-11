---
name: theme-surface-conventions
description: Use when creating, editing, or reviewing Mister F UI surfaces or CSS that affects page containers, app chrome, panels, cards, backgrounds, borders, border radii, shadows, gradients, or theme portability with Bootstrap and the Cuaderno theme.
---

# Theme Surface Conventions

## Overview

Keep Mister F's general UI surfaces theme-friendly.

**Since the Cuaderno theme (2026-09-09), the app no longer loads
Bootswatch Flatly.** It compiles its own Bootstrap build from
`misterf-web/src/client/theme/`. Read that folder's `README.md` before changing
any surface: it is the authority on tokens, and it supersedes this skill on
three points listed under "Cuaderno amendments" below. Everything else here
still stands — the goal was always portability, and owning the theme is the
strongest form of it.

Anything about the learning/teaching mode — surfaces that follow it, the
switch, what may or may not change per mode — is in the `cuaderno-theme`
skill. Surfaces written with the tokens below already follow the mode.

## Cuaderno Amendments

Three rules below changed when the app took ownership of its theme. The
reasoning is in `misterf-web/src/client/theme/README.md`.

1. **Radii.** `--mf-card-radius` replaces `var(--bs-card-border-radius)` for
   card-like surfaces, because the radius now varies by mode. The rule "never
   hardcode a radius" is unchanged — the token indirection is what makes the
   mode layer possible.
2. **Shadows.** The theme defines exactly two shadow tokens
   (`--mf-shadow-card`, `--mf-shadow-lift`). Cards remain flat by default;
   elevation is opt-in through `.mf-lift`. Do not write a third shadow.
3. **Backgrounds.** `--bs-body-bg` now resolves to `--mf-app-bg`, which the
   mode swaps. Read `var(--bs-body-bg)` or `var(--mf-app-bg)`; never hardcode
   the page ground.

Still forbidden, with no exception: gradients on general containers. The theme
ships none and should keep shipping none.

## Core Rules

- Prefer Bootstrap and Cuaderno surface tokens over hardcoded visual treatment:
  - `var(--mf-app-bg)` / `var(--mf-app-bg-deep)`
  - `var(--mf-paper)`
  - `var(--mf-line)` / `var(--mf-line-strong)`
  - `var(--mf-card-radius)`
- The Bootstrap tokens below still resolve and remain correct for Bootstrap's
  own components:
  - `var(--bs-body-bg)`
  - `var(--bs-card-bg)`
  - `var(--bs-tertiary-bg)`
  - `var(--bs-border-color)`
  - `var(--bs-border-color-translucent)`
  - `var(--bs-border-radius)`
  - `var(--bs-card-border-radius)`
- General containers must look flat and theme-native:
  - app shells
  - page/resource containers
  - section panels
  - editor panels
  - list/detail page chrome
  - card-like wrappers used as page structure
- Do not add `linear-gradient()` or `radial-gradient()` to general containers.
- Do not add custom `box-shadow` to general containers.
- Do not hardcode broad container radii such as `8px`, `14px`, or `18px`; use Bootstrap radius variables.
- Use borders, spacing, Bootstrap background tokens, and component hierarchy before custom visual styling.

## Allowed Exceptions

Custom visual treatment may be appropriate inside content-specific UI, especially when it helps distinguish interactive learning material:

- chat bubbles
- exercise blocks inside chat content
- inline answer/evaluation states
- small interactive controls
- dropdowns, popovers, tooltips, and focus states

Keep these exceptions scoped. Do not let their gradients, shadows, or custom radii become the default language for app-level containers.

## The App Shell: Edge To Edge, Flat

**Changed 2026-09-11 (founder direction, after `design/experience-demo/`).**
The shell used to be a centered block holding two floating panels with a
shared shadow. It is now edge to edge, and the shared-shadow exception that
used to live here is gone — there is no shadow on app chrome at all.

- The shell fills the window at every width (`.app-shell`, `.chat-workspace`
  in `app-shell.css`). No outer margin, no centered max-width block.
- The **side panel** is flush with the window edge: `var(--app-side-panel-bg)`
  (paper), no radius, no shadow, and a single hairline
  `border-right: 1px solid var(--line)` against the content. Below `lg` it is
  the offcanvas and the top toolbar takes the same paper and a hairline
  bottom border.
- The **content** — `.app-page` and `.chat-layout`, and any new right-hand
  view — is **not a card**: transparent background on the page ground
  (`--mf-app-bg`, which the mode swaps), no radius, no shadow, no border. Cards
  and heroes inside it provide the surfaces.
- Do not reintroduce a panel shadow, a panel radius, or a margin around the
  shell. A new full-page view renders inside `.app-page` and inherits all of
  this.

## Review Workflow

1. Identify whether the element is general chrome or content-specific UI.
2. For general chrome, use Bootstrap tokens and flat surfaces.
3. Before adding custom CSS, check whether Bootstrap classes or variables already cover the need.
4. When touching CSS, search the affected files for:
   - `linear-gradient`
   - `radial-gradient`
   - `box-shadow`
   - `border-radius:`
5. Remove or replace general-container gradients, shadows, and hardcoded radii unless the task explicitly asks for them.
6. Leave content-specific chat/exercise styling alone unless the user asks to redesign that content.

## Preferred Replacements

- Replace general gradients with `background: var(--bs-body-bg)`, `var(--bs-card-bg)`, or `var(--bs-tertiary-bg)`.
- Replace general custom shadows with a border or no extra depth.
- Replace general fixed radii with `var(--bs-card-border-radius)` or `var(--bs-border-radius)`.
- Replace inset shadows used only as borders with a real `border`.
