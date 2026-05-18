---
name: ejs-view-structure
description: Use when creating or refactoring EJS pages in this Mister F project. Prefer one top-level EJS view per page or route, and use partials only as reusable utilities or shared sections instead of collapsing multiple pages into one large conditional template.
---

# EJS View Structure

Use this skill when creating or refactoring server-rendered EJS pages in this project.

Follow these rules:

- Prefer one top-level EJS file per page or route.
- Do not collapse multiple distinct pages into one giant EJS template full of page-mode conditionals.
- Use partials as reusable utilities, shells, repeated sections, modals, or shared fragments.
- Keep page-specific layout in the page view, not in a generic conditional partial.
- If two pages have different responsibilities, they should normally have different top-level EJS files.
- If content is reused in several places, extract only that repeated part into a partial.
- Treat partials as building blocks, not as a substitute for page boundaries.
- Preserve clean route-to-view mapping whenever possible so it is obvious which EJS file renders each page.

Recommended structure:

1. Create a dedicated page view such as `views/chatrooms.ejs`, `views/practice-modules.ejs`, or `views/profiles.ejs`.
2. Use partials for shared shells, headers, cards, dialogs, or repeated widgets.
3. Avoid adding new `pageMode` branches to a template when the result is really a separate page.
4. When refactoring, split oversized templates by page responsibility first, then extract reusable partials second.

Good examples:

- Separate pages:
  - `views/chat.ejs`
  - `views/chatrooms.ejs`
  - `views/practice-modules.ejs`
- Shared utilities:
  - `views/partials/app-shell-open.ejs`
  - `views/partials/app-shell-close.ejs`
  - `views/partials/...`

Avoid this pattern:

- One giant `index.ejs` that conditionally renders several unrelated pages.
- Partials that behave like hidden pages instead of reusable fragments.

Workflow:

1. Decide the real page boundary first.
2. Create or keep a dedicated top-level EJS view for that page.
3. Extract only reusable fragments into partials.
4. Keep the final structure easy to navigate from route to view.
