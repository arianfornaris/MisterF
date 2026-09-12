# AGENTS

You are an expert software developer, especially in web application development and AI application development.

You apply strong software engineering best practices based on sound design patterns, clean architecture, and code that is easy to read and maintain.

Code should be written so that it is understandable by other human developers and by AI agents working on the project later.

Document code appropriately when that improves readability and maintainability. Favor clear structure, explicit naming, and concise comments that explain intent, constraints, or non-obvious decisions.

Prefer clean, legible implementations over clever or overly compressed code.

Always prefer architectures where classes of errors are prevented by design instead of being masked later with defensive guards, patches, or ad hoc conditionals. Use guards only when they are genuinely part of a sound design boundary, not as a substitute for proper structure.

Each page or route should have its own dedicated handler. Do not let one handler assume responsibility for multiple unrelated pages or feature flows. Put truly shared behavior into utilities or services instead of collapsing many pages into one controller.

Project-specific agent guidance lives in `.agents/skills`.

## UI Theme Guidance

This project uses its own Bootstrap theme, **Cuaderno**, compiled from
`misterf-web/src/client/theme/`. It replaced Bootswatch `Flatly` and keeps
Flatly's flat structure, but the palette, type, radii and modes are ours.
Read `.agents/skills/cuaderno-theme/SKILL.md` before any UI work, and the
theme's `README.md` for the full reference.

Before any UI change, read these four skills in `.agents/skills/`, in this
order:

1. `cuaderno-theme` — the theme, the two modes, and how to lay out a page
   (content width, grids, page headers).
2. `theme-surface-conventions` — the edge-to-edge shell, flat surfaces, no
   shadows or gradients on containers, where the legal footer goes.
3. `bootstrap-ui-conventions` and `bootstrap-icons-conventions` — Bootstrap
   components and Bootstrap Icons first.
4. `ui-illustrations` — before adding or generating any image.

Add `resource-page-conventions` for anything under `/resources`,
`/media-library`, or a single resource's pages.

The signed-in app has two modes, learning and teaching, that repaint it
through CSS custom properties. Never style by mode by hand — no mode
conditionals in views, no `[data-mode]` selectors outside the theme. The
accent, `btn-primary`, links and subtle surfaces already follow the mode.

When building or updating UI:

- Prefer standard Bootstrap components, spacing, typography, and states, as the Cuaderno theme renders them.
- Treat `btn-primary` as the default primary accent unless a specific context calls for another semantic variant. It follows the active mode automatically.
- Preserve clear action hierarchy:
  - one primary action when appropriate
  - quieter secondary actions with outline, link, or lighter variants when they are not primary
- Avoid custom visual treatments that fight the theme's clean, flat, modern appearance.
- Prefer Bootstrap-native interaction patterns such as modals, accordions, alerts, badges, cards, list groups, and dropdowns before creating custom UI patterns.
- Illustrations and images in the UI (heroes, spots, empty states) all come from one generated set with one locked style. Read `.agents/skills/ui-illustrations/SKILL.md` before adding, generating, or placing any.
- If a Bootstrap component has a native focus, hover, active, or expanded state, assume that state is intentional unless there is a strong UX reason to refine it.
