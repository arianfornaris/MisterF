---
name: theme-surface-conventions
description: Use when creating, editing, or reviewing Mister F UI surfaces or CSS that affects page containers, app chrome, panels, cards, backgrounds, borders, border radii, shadows, gradients, or theme portability with Bootstrap/Bootswatch Flatly.
---

# Theme Surface Conventions

## Overview

Keep Mister F's general UI surfaces theme-friendly. The app currently uses Bootswatch Flatly, but page chrome should remain portable if the Bootstrap theme changes later.

## Core Rules

- Prefer Bootstrap and Bootswatch surface tokens over hardcoded visual treatment:
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

## Main Panel Border Treatment

The app is organized around two main desktop panels: the left navigation/conversation panel and the right content panel. These panels may use a shared shadow treatment so the shell does not feel too flat.

- Define the main panel treatment once with shared CSS variables.
- Apply it consistently to the left panel and every right-panel variant.
- Prefer no visible border on these panels unless the user explicitly asks for one.
- A shared main-panel `box-shadow` is allowed for these two structural panels only; keep it soft and theme-token-based so it does not compete with content cards.
- When using Bootstrap `--bs-*-rgb` variables, use comma-compatible `rgba(var(--bs-*-rgb), alpha)` syntax.
- Do not use gradients, page-specific custom shadows, or fixed radii for this exception.
- Do not create one-off border styles for individual pages unless the user explicitly asks for a distinct visual state.

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
