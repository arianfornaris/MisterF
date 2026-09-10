---
name: cuaderno-theme
description: Use before any Mister F UI or CSS work — views, EJS partials, app stylesheets, colors, buttons, backgrounds, radii, headings — and whenever something should look different in learning vs teaching mode (`data-mode`, `home_mode`, "Estoy aprendiendo" / "Estoy enseñando", the mode switch, terracotta vs navy). Covers the app's own Bootstrap theme (Cuaderno), how the two modes repaint the whole app through CSS custom properties, and the rules that keep a mode from being styled by hand.
---

# Cuaderno Theme And Modes

The app does **not** use Bootswatch Flatly. It compiles its own Bootstrap build,
**Cuaderno**, from `misterf-web/src/client/theme/`. The full reference is that
folder's `README.md`; this skill is the operational short version. The live
component reference is `http://localhost:5005/public/theme/kitchen-sink.html`
(run `npm run build:client` once first) — check it before inventing anything.

## The Model In One Paragraph

The server writes `data-mode="learn" | "teach"` onto `<html>` from the active
profile's `home_mode` (`views/partials/app-shell-open.ejs`). That is the only
place the mode is decided. `_modes.scss` turns the attribute into CSS custom
properties — accent, page ground, card radius, heading face — and also
redefines Bootstrap's own `--bs-primary` family. `_mode-bootstrap.scss`
re-points the components Bootstrap compiles (`.btn-primary`, `.nav-pills`,
`.list-group`, checked inputs…) at `var(--mf-mode)`, **once**. Every component
just reads variables, so the whole app repaints when the attribute changes.
Learning is terracotta on warm paper with serif headings; teaching is navy on
cool paper with sans headings.

## Rules For Writing UI

1. **Never style by mode by hand.** No `if (homeMode === 'teach')` in a view to
   pick a class or a color. No `[data-mode=…]` selector in
   `src/client/styles/` or in a theme component. If you are about to write
   one, stop — the value almost certainly already follows the mode.
2. **For "the accent", use what already follows.** `btn-primary`,
   `btn-outline-primary`, links, `.text-primary`, `.bg-primary`,
   `--bs-primary-bg-subtle` / `--bs-primary-text-emphasis`, and in custom CSS
   `var(--mf-mode)` / `--mf-mode-deep` / `--mf-mode-tint`. All of them change
   with the mode on their own. Neutral actions (`btn-secondary`,
   `btn-outline-secondary`) and borders follow the mode's temperature — warm
   grey or slate, `var(--mf-neutral)` / `var(--mf-line)` — never its accent.
   Pick the variant for its rank in the hierarchy, not to get a color.
3. **Semantic colors never follow the mode.** Success, warning, danger and the
   content-family colors (`quiz`, `roleplay`, `guia`, `escena`, `charla`) mean
   the same in both modes. Do not make them mode-dependent.
4. **The mode never moves layout.** Nothing may reflow, appear or disappear
   because of the mode. Switching must stay a repaint. A difference in
   *content* between modes (a different panel, a different list) belongs in
   the server handler, as the two home compositions do — not in CSS.
5. **Copy differences go through i18n.** Parallel keys in `es`, `en` and `ht`
   (see `project-language-conventions`), never string swaps in a view.
6. **Pages with no profile have no mode.** Sign-in screens render without the
   attribute and keep the theme's navy. Do not force a mode onto them.
7. **Raw values live only in `_tokens.scss`.** Every other file reads a Sass
   variable from there or a custom property. No hex in a component, no hex in
   an app stylesheet for something the theme already names.

## Recipes

- **A value that should differ per mode.** Add it to `$mf-modes` in
  `_tokens.scss` and emit it in `mf-mode-properties` in `_modes.scss`. Keep the
  list short — nine entries today; every new one makes the modes read less
  like one product.
- **A Bootstrap component that does not follow the mode.** Find the `--bs-*-*`
  custom property it reads (Bootstrap 5.3 components expose them) and
  re-point it at `var(--mf-mode…)` in `_mode-bootstrap.scss`. Written once,
  with no mode name in it. This is **not** a per-mode fork, and it never needs
  one — an earlier claim that a full reskin would require forking every
  component was wrong.
- **A new component.** New file in `theme/components/`, imported at the end of
  `cuaderno.scss`, prefixed `mf-`, reading only `--mf-*` / `--bs-*` custom
  properties. Add it to the kitchen sink in the same commit.
- **Restyle a Bootstrap component for both modes.** `$variable` in
  `_bootstrap-variables.scss` first; `_flatly-layer.scss` only if a variable
  cannot express it.

## The Mode Switch

`views/partials/home-mode-switch.ejs`, rendered under the brand in the side
panel by `app-shell-open.ejs`. It posts to `/home/mode`, which writes the
profile's stored preference (no session override — one source of truth), and
returns to the current page. Short labels `home.modeLearnShort` /
`home.modeTeachShort` on one line; the full phrase is the tooltip. On phones
a second, icon-only copy (`include('home-mode-switch', { compact: true })`,
`.mf-mode-switch--icons`) sits at the end of the top toolbar beside the
translator — icon-only options must carry the full phrase as `aria-label`.

**Never give `.conversation-panel` a position below `lg`.** It is Bootstrap's
`.offcanvas-lg` there and must stay `position: fixed`; a `position: relative`
from `app-shell.css` outranks it and the open panel collapses to zero height.
It happened once (2026-09-09). Check the panel at 375px after touching it. The mode is
**presentation, never permission**: no authorization path reads it.

## Verify Before Finishing

1. `npm run build:client` (or `npm run pm2:restart`, which builds and restarts
   — see `restart-local-server`; pm2 serves compiled output).
2. Look at the changed page in **both** modes. Switch with the control in the
   side panel, or on the kitchen sink with its toggle. QA accounts are in
   `live-product-qa`; switching modes spends no credit.
3. Check a signed-out page still renders navy with no `data-mode`.
4. `npm test` — `tests/server/routes.test.ts` asserts the attribute on `<html>`
   for both modes and on a non-home page.

## Related

- `misterf-web/src/client/theme/README.md` — the full theme reference.
- `bootstrap-ui-conventions`, `theme-surface-conventions` — still apply to
  Bootstrap components and surfaces; the theme README overrides the latter on
  radii, shadows and backgrounds.
- Roadmap V3 §1.14 (`docs/roadmap/roadmap-v3.md`) — why the modes exist and
  every decision about them, including the reversals.
