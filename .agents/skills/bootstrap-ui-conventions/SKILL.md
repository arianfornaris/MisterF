---
name: bootstrap-ui-conventions
description: Use when creating or updating UI in this Mister F project. Prefer Bootstrap (compiled through the app's own Cuaderno theme) and Bootstrap Icons before adding custom CSS or bespoke visual components.
---

# Bootstrap UI Conventions

Use this skill when working on UI or styling in this project.

**The app runs on its own Bootstrap theme, Cuaderno**
(`misterf-web/src/client/theme/`), not on stock Bootswatch Flatly. Read that
folder's `README.md` before adding UI. In short: everything below still applies
to Bootstrap's own components, and the theme adds a small set of `mf-`-prefixed
components for the patterns Bootstrap has no answer for (resource cards,
family chips, exercise blocks, stat tiles, product mockups). Check the kitchen
sink at `/public/theme/kitchen-sink.html` before inventing a component.
For anything that should look different in learning vs teaching mode, read the
`cuaderno-theme` skill first — the answer is almost always "nothing to do, it
already follows".

Follow these rules:

- Prefer Bootstrap components, utility classes, and default Bootstrap styling, as the Cuaderno theme renders it, whenever possible.
- Before creating new CSS, first check whether the need can be solved with existing Bootstrap classes such as `btn`, `card`, `list-group`, `badge`, `alert`, `dropdown`, spacing utilities, flex utilities, grid utilities, typography utilities, and responsive utilities.
- Do not invent custom visual styles when a standard Bootstrap component already covers the use case.
- Keep custom CSS focused on app-specific layout or behavior that Bootstrap does not already provide.
- For views outside the chat experience, default to standard Bootstrap structure and appearance so theme changes remain easy and consistent.
- When icons are needed, prefer [Bootstrap Icons](https://icons.getbootstrap.com/) over ad hoc inline SVGs unless there is a strong reason not to.

Workflow:

1. Try to solve the UI with Bootstrap primitives first.
2. Add custom CSS only for project-specific gaps.
3. Preserve the app's Bootstrap and Cuaderno visual language.
