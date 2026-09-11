# Cuaderno — the Mister F theme

Mister F's own Bootstrap theme. It replaces Bootswatch Flatly outright: the
application no longer loads `bootswatch/flatly/bootstrap.min.css`, it loads
`public/build/css/cuaderno-<hash>.css`, compiled from this folder.

Cuaderno is Flatly's descendant, not its sibling. Every decision that made
Flatly feel calm — flat surfaces, no gradients, a dark desaturated primary — is
kept. What changes is the palette, the type, and two things Bootstrap has no
concept of: **content families** and **modes**.

- The visual argument and the page designs: `design/ui-refresh-demo/README.md`
- The live component reference: **<http://localhost:5005/public/theme/kitchen-sink.html>**

---

## 1. Why a theme and not an override sheet

The obvious cheaper option was to keep loading Flatly and layer our CSS on top.
It was rejected for one reason: **you cannot change a variable from the
outside.** Border radius, the type scale, `$primary`, focus width and button
shape are baked into hundreds of Bootstrap rules at compile time. Overriding
them afterwards means re-declaring those rules at higher specificity, which is
how a stylesheet turns into a pile of `!important` inside a year.

Compiling Bootstrap ourselves means:

- `$primary` is navy **everywhere** — buttons, links, focus rings, active list
  items, checkboxes, the progress bar — from one line.
- A Bootstrap `.card` and a Cuaderno `.mf-rcard` read the same radius token, so
  they cannot drift apart.
- Flatly's render-blocking `@import url(...)` for the Lato web font is gone.
- An app view written a year ago picks up the new look without being touched.

The cost is a Sass build step and `sass` as a devDependency. That is the whole
cost.

## 2. Layout

```
src/client/theme/
  cuaderno.scss             entry point; owns the Bootstrap import stack
  _tokens.scss              THE ONLY FILE WHERE A RAW VALUE MAY APPEAR
  _bootstrap-variables.scss Bootstrap's $variables, re-pointed at tokens
  _utilities.scss           additions to Bootstrap's $utilities map
  _root.scss                the --mf-* custom properties, plus compat aliases
  _modes.scss               [data-mode] — the aprendo/enseño layer
  _families.scss            .mf-fam-* — the content-family layer
  _reboot.scss              element-level defaults Bootstrap does not cover
  _flatly-layer.scss        our answer to Bootswatch's own component layer
  components/
    _chip.scss              .mf-chip
    _cards.scss             .mf-rcard, .mf-acard, .mf-lift
    _data.scss              .mf-stat, .mf-bar, .mf-meter, .mf-tally, .mf-cols
    _page.scss              .mf-page-*, .mf-hero, .mf-res-band, .mf-section-*
    _practice.scss          .mf-block, .mf-choice, .mf-mock, .mf-streak
    _states.scss            .mf-empty, .mf-spot, .mf-mode-switch, .mf-mode-rail
```

`cuaderno.scss` spells out Bootstrap's import stack instead of importing
`bootstrap/scss/bootstrap` because the theme has to inject at three points that
Bootstrap does not expose:

1. **before `variables`** — our `$variable` configuration;
2. **before `utilities/api`** — our additions to the `$utilities` map;
3. **after everything** — the Cuaderno layer.

## 3. Build

`node scripts/build-client.mjs` (run by `npm run build`, and therefore by
`npm run pm2:restart`) compiles the theme with `node_modules` on the Sass load
path and writes:

| File | Who reads it |
| --- | --- |
| `public/build/css/cuaderno-<hash>.css` | the app, via `views/partials/theme-stylesheet.ejs` |
| `public/build/css/cuaderno.css` | the kitchen sink only — a static page cannot resolve a hash |

The unhashed copy is gitignored: it is a byte-for-byte duplicate, so on a
fresh clone the kitchen sink is blank until `npm run build:client` has run once.

`views/partials/theme-stylesheet.ejs` is **generated**. Do not edit it; edit the
Sass and rebuild.

Bootstrap 5.3 is still written with `@import`, which Dart Sass has deprecated.
The build silences `import`, `if-function`, `global-builtin` and
`color-functions` so that a **real** warning is visible instead of being buried
under three hundred we cannot act on until Bootstrap 6. If you add Sass and see
no output, that is the point.

### Iterating

```bash
npm run build:client        # recompile CSS + JS, rewrite the partials
```

CSS-only changes need no server restart — the stylesheet is a static file. A
change under `views/` or `src/server/` does (`npm run pm2:restart`; see the
`restart-local-server` skill).

## 4. Tokens

`_tokens.scss` is the only file in the theme allowed to contain a raw value. If
you are typing a hex code, a rem, a shadow or a duration anywhere else, stop:
either the token exists, or it needs to.

Three layers, and the rule for choosing between them:

| Layer | Example | Use it when |
| --- | --- | --- |
| Sass variable | `$mf-navy` | configuring Bootstrap, or doing color math at compile time |
| `--bs-*` | `var(--bs-border-color)` | styling a Bootstrap component |
| `--mf-*` | `var(--mf-fam-tint)` | styling a Cuaderno component, or any value that changes with the mode |

Nothing outside `_bootstrap-variables.scss` should read a `$mf-*` Sass variable
at runtime — components read custom properties, which is what makes the mode
and family layers possible at all.

### The palette

Paper and ink, brand, families and semantics are all listed in `_tokens.scss`
with a comment each. Two rules that are easy to get wrong:

- **Three levels of ink.** `--mf-ink` for body, `--mf-ink-soft` for secondary
  copy, `--mf-ink-faint` for 12–13px metadata **only**. A sentence never gets
  `--mf-ink-faint`.
- **Correct/to-improve is OK + WARN, never OK + DANGER.** A learner who got
  something wrong is not in an error state. `danger` is for destructive actions
  and real failures.

## 5. Modes

`data-mode="learn" | "teach"` on `<html>`, written server-side from the active
profile's `home_mode` (Roadmap V3 §1.14, migration 30). The keys are the values
the column stores, so the CSS and the database cannot drift. The label a person
reads is a verb in the first person — *Estoy aprendiendo* / *Estoy enseñando* —
and lives in the i18n catalogs, never here.

The mode is a **full change of skin for the signed-in app** — founder decision
2026-09-10, taken after comparing this against a narrower "accent only" version
on screen. Nine rows do all of it:

| | Learn | Teach |
| --- | --- | --- |
| `--mf-mode` (+ `-deep`, `-tint`, `-rgb`) | terracotta | navy |
| `--mf-app-bg` / `--bs-body-bg` | warm paper `#FBF8F4` | cool paper `#F2F5F7` |
| `--mf-app-bg-deep` / `--bs-secondary-bg` | `#F3ECE2` | `#E6EDF1` |
| `--mf-card-radius` | `1rem` | `0.75rem` |
| `--mf-heading-font` | Literata | system sans |
| `--mf-heading-tracking` | `-.015em` | `-.02em` |
| `--mf-neutral` / `--bs-secondary` (`btn-secondary`, `.text-secondary`) | warm grey `#6B5A4E` | slate `#4D6069` |
| `--mf-line` (+ `-strong`) / `--bs-border-color` | `#E6E0D7` / `#D5CEC2` | `#D6DEE4` / `#C9D3DA` |
| Bootstrap primary family | follows the accent | follows the accent |

**Bootstrap follows too.** `_modes.scss` redefines the `--bs-*` properties
Bootstrap emits on `:root` (`--bs-primary`, its `-rgb`, `-bg-subtle`,
`-text-emphasis`, `-border-subtle`, and the link colors), which moves every
utility, every link and every subtle surface. `_mode-bootstrap.scss` then
re-points the components Bootstrap compiles from `$primary` at build time —
`.btn-primary`, `.nav-pills`, `.list-group`, checked form controls and the
rest. **That file is not a per-mode fork:** every rule is written once and
reads `--mf-mode`, so it contains no `[data-mode=…]` selector and a third mode
would need no change to it.

**Neutrals follow the temperature, not the accent.** `btn-secondary`,
`btn-outline-secondary`, `.text-secondary` and every border are warm grey on
the warm paper and slate on the cool one. Before this, a secondary button was
a fixed slate and read as blue while learning. The warm grey was chosen for
the same weight as the slate (6.57:1 against 6.58:1 with white text), and the
cool line for the same 1.24:1 on its ground as the warm line on sand. Component
borders read `var(--bs-border-color)` at runtime rather than a compiled hex,
which is Bootstrap's own default — the theme had overridden it.

**Two things the mode still never does.** It never moves **layout** — nothing
reflows, nothing appears or disappears, so switching is a repaint and stays
cheap to do several times a day. And it never changes **meaning** — a green
check, a family color and a warning are identical in both.

**A page with no profile has no mode.** `:root` gets the `--mf-*` fallbacks but
**not** the Bootstrap re-point, so the sign-in screens keep the theme's own
navy identity instead of inheriting a mode they are not in.

**No component in this theme contains the word `learn` or `teach`.** That is
the invariant. Keep it.

### Rules

1. **Differentiate through `_modes.scss` only.** If a difference cannot be
   expressed as a variable, it probably should not exist.
2. **Keep the list short.** Nine entries today. More and the two modes stop
   reading as one product.
3. **Never differentiate meaning.** A green check, a family color and a warning
   mean the same thing in both. Only chrome and voice move — and chrome never
   includes layout: nothing reflows, appears or disappears because of the
   mode.
4. **Copy is a differentiator** — but it belongs in the i18n catalogs as
   parallel keys, not in CSS and not in string swaps in the view.
5. **Every page must survive with no `data-mode`.** A signed-out page has no
   mode; `:root` carries the `--mf-*` fallbacks of `$mf-mode-default` but not
   the Bootstrap re-point, so it stays navy.
6. **Never style by mode outside the theme.** No `[data-mode]` selector in
   `src/client/styles/`, and no `homeMode` conditional in a view to choose a
   class or a color. `btn-primary`, links, `--bs-primary-*` and `--mf-mode`
   already follow; a view that branches on the mode for looks is a bug.

### How it is wired in the app

`views/partials/app-shell-open.ejs` writes the attribute onto `<html>` from
`activeProfile.homeMode`; a request with no profile omits it and `:root`
carries the default. Mode is **presentation, never permission** — no
authorization path reads it, both modes reach every feature, and the same
person switches several times a day.

- `views/partials/home-mode-switch.ejs` is the control (`.mf-mode-switch`).
  It posts to `/home/mode`, which writes the profile's stored preference.
  It renders twice: with short labels under the brand in the side panel,
  and icon-only (`compact: true`, `.mf-mode-switch--icons`) at the end of
  the mobile toolbar beside the translator, `d-lg-none`. The open offcanvas
  covers the toolbar, so the two are never on screen together.
- `views/partials/app-shell-open.ejs` renders `.mf-mode-rail` inside the
  conversation panel — three pixels of accent, the one mode signal that
  survives navigating away from the home. Positioned in `app-shell.css`.
- Nothing else opts in. The mode reaches every page through `<html>`, so no
  view carries a mode class and no view should start.

For agents, `.agents/skills/cuaderno-theme/SKILL.md` is the short operational
version of this section and of §9.

## 6. Families

Five kinds of content, one color each:

| Family | Class | Was, in `base.css` |
| --- | --- | --- |
| Quiz | `.mf-fam-quiz` | `--mf-quiz` |
| Roleplay | `.mf-fam-roleplay` | `--mf-teal` |
| Practice guide | `.mf-fam-guia` | `--mf-practice` |
| Scene | `.mf-fam-escena` | `--mf-choice` |
| Conversation | `.mf-fam-charla` | `--mf-dialogue` |

None of these colors is new. They already existed inside exercise content; the
theme promotes them to the library, the cards and the navigation.

A `.mf-fam-*` class sets `--mf-fam`, `--mf-fam-tint` and `--mf-fam-ink` for its
subtree. Components read those three and know nothing about which family they
are in, so **adding a sixth kind of content is one entry in `$mf-families` and
zero component changes.**

> ### The four-places rule
>
> A family color may appear in the **type chip**, the **card cover**, the
> **icon**, and the **active state** (border, rail, bar). Nowhere else.
>
> Never as the background of a large surface — `.mf-acard` on the create screen
> is the single exception, because there the color is explaining a choice
> rather than decorating — and never on body text.
>
> Break this and the app becomes a fruit salad, which is the exact failure this
> system exists to avoid.

Families are deliberately **not** in Bootstrap's `$theme-colors`. That would
generate `.btn-quiz`, `.alert-roleplay`, `.text-bg-guia` and a dozen other
invitations to break the rule above.

## 7. Components

Every class the theme adds is prefixed `mf-`. Everything without the prefix is
Bootstrap's, restyled through variables.

| Class | What | Notes |
| --- | --- | --- |
| `.mf-chip` | family / status mark | always carries its name in words |
| `.mf-rcard` | resource card | cover is drawn in CSS, never an image; the glyph is an SVG or a Bootstrap Icon (`.mf-rcard-glyph.bi`), which is what app views use |
| `.mf-acard` | create action | the one licensed large color surface |
| `.mf-stat` | number tile | `.mf-stat-accent` on at most one per screen |
| `.mf-bar` `.mf-meter` `.mf-tally` `.mf-cols` | proportions and small charts | CSS only; no charting library |
| `.mf-block` `.mf-choice` `.mf-blank` | exercise blocks | the existing design, plus a family rail |
| `.mf-mock` `.mf-mock-line` | a product mockup in HTML | never a screenshot |
| `.mf-streak` | effort record | Aprendo only; no loss state, no red |
| `.mf-empty` `.mf-spot` | empty states and illustration slots | always ends in an action; images come from `public/illustrations/` via the `ui-illustrations` skill |
| `.mf-hero` `.mf-res-band` `.mf-page-*` | page furniture | a hero is rendered only by learning compositions — the view decides, never a `[data-mode]` rule (a mode never makes things appear or disappear) |
| `.mf-mode-switch` `.mf-mode-rail` | mode chrome | |
| `.mf-lift` `.mf-lift-strong` | opt-in elevation | cards are flat by default |

### Why the covers are drawn and not generated

`.mf-rcard-cover` is a family tint, a dot screen and one stroke glyph. It costs
nothing, it is infinite, it is never wrong, and it is identifiable in a grid of
twenty. Generating an image per resource would make a user wait on a model to
save a quiz and turn a 200-item library into 200 files. Do not do it.

## 8. Utilities

Added through Bootstrap's utilities API (`_utilities.scss`), so they get
responsive variants and `!important` behaviour like everything else:

- `.text-ink`, `.text-ink-soft`, `.text-ink-faint`, `.text-mode`,
  `.text-mode-deep`, `.text-fam`, `.text-fam-ink`, `.text-ok`, `.text-warn`
- `.bg-paper`, `.bg-app`, `.bg-app-deep`, `.bg-mode-tint`, `.bg-fam-tint`,
  `.bg-ok-tint`, `.bg-warn-tint`
- `.border-line`, `.border-line-strong`, `.border-mode`, `.border-fam`
- `.font-display`, `.font-heading`, `.font-ui`
- `.fs-2xs` … `.fs-3xl` (the Cuaderno scale, alongside Bootstrap's `.fs-1`…`.fs-6`)
- `.rounded-card`

The type scale gets its own utility entry rather than extending Bootstrap's
`font-size`, which runs every value through RFS — and RFS expects a number, not
a custom property.

## 9. Recipes

**Change the palette.** Edit `_tokens.scss`. Nothing else.

**Add a content family.** Add an entry to `$mf-families` with `base`, `tint` and
`ink`. `.mf-fam-<name>` and `--mf-fam-<name>` appear automatically; no component
changes.

**Add a component.** New file in `components/`, imported at the bottom of
`cuaderno.scss`. Prefix it `mf-`. It may read `--mf-*` and `--bs-*` custom
properties and must not read `$mf-*` Sass variables. **Add it to the kitchen
sink in the same commit** — a component that is not on that page cannot be
reviewed, and will be re-invented six weeks later.

**Restyle a Bootstrap component.** First try a `$variable` in
`_bootstrap-variables.scss`. Only if that cannot express it, add a rule to
`_flatly-layer.scss`. Never add a rule that fights specificity with Bootstrap's
own output.

**Make something mode-dependent.** Add a variable to `$mf-modes` and emit it in
`mf-mode-properties`. If it is a Bootstrap component that compiles the color
in, re-point its `--bs-*` variables in `_mode-bootstrap.scss` — reading
`--mf-mode`, never naming a mode. Do not add a `[data-mode=…]` selector to a
component file.

## 10. Relationship to the app's existing stylesheets

Two stylesheets load, in this order:

1. `cuaderno-<hash>.css` — this theme
2. `app-<hash>.css` — the app's thirteen feature stylesheets, bundled by
   `scripts/build-client.mjs` (the chat, the shell, resource pages, quizzes…)

They are separate on purpose: switching the theme was one line in
`document-head.ejs` rather than a sweep through thirteen files. `_root.scss`
emits **compatibility aliases** (`--app-serif-font`, `--ink`, `--line`,
`--panel`, `--mf-quiz`, `--mf-teal`, …) so those stylesheets keep working
unchanged.

That is a migration aid, not the destination. The intended direction:

1. Move a feature stylesheet's tokens onto `--mf-*` / `--bs-*`.
2. Delete the aliases it was using once nothing references them —
   `grep -rn "--mf-quiz" src/client/styles`.
3. Move genuinely reusable patterns into `components/`; leave feature layout
   where it is.

`src/client/styles/base.css` still declares its own `:root` block. It loads
after the theme and therefore wins. Reconciling those two is the first
migration task and the one place the two systems can currently disagree.

## 11. Accessibility

- `$min-contrast-ratio` is **3**, not Flatly's 2.05. Flatly's value is why its
  amber buttons carry white text; ours picks dark ink for amber and light ink
  for navy.
- Focus is a 3px ring in the mode accent, on **everything** — Bootstrap only
  styles its own components, so `_reboot.scss` covers `:focus-visible`
  globally. Do not remove it.
- Color is never the only signal: chips carry their name, statuses carry a
  word, tallies carry numbers.
- Hover lift and card transitions are disabled under
  `prefers-reduced-motion: reduce`.
- There is **no dark mode**. `$enable-dark-mode` is off, and Bootstrap's
  `data-bs-theme` is untouched and orthogonal to `data-mode`. If dark mode is
  ever wanted, it is a third value on `data-bs-theme`, not a third mode.

## 12. Deviations from Flatly, for the record

| | Flatly | Cuaderno | Why |
| --- | --- | --- | --- |
| Font | Lato, fetched by `@import url()` inside the CSS | system stack + Literata | Flatly's import blocks first paint from inside the stylesheet |
| `$primary` | `#2C3E50` slate | `#00496A` navy | the brand mark |
| Links | `$success` green | navy | a green link reads as "success" |
| `$min-contrast-ratio` | 2.05 | 3 | white-on-amber is not legible |
| Buttons | rounded rect | pill | matches the landing |
| Alerts | solid, saturated, white text | tinted with a colored rail | most alerts here say "here is what to do next" |
| Tabs | folder tabs | underline | quieter next to dense content |
| Cards | flat | flat, `.mf-lift` opt-in | keeps the surface conventions intact |

## 13. Reverting

If Cuaderno has to go back, it is one line. In
`views/partials/document-head.ejs`, swap:

```ejs
<%- include('theme-stylesheet') %>
```

back to:

```html
<link rel="stylesheet" href="/vendor/bootswatch/flatly/bootstrap.min.css">
```

Reverting also costs the mode chrome: `.mf-mode-switch` and `.mf-mode-rail`
lose their styles, so `home-mode-switch.ejs` would need its Bootstrap nav-pill
markup back and the rail element removed.

## 14. Known gaps

- **`base.css` still owns a `:root` block** that duplicates part of the theme.
- **Few views use the `mf-` components.** The mode switch, the rail and the
  teaching home's page furniture do; everything else still uses the app's own
  classes. Porting `/resources` and the resource pages is the remaining work in
  `design/ui-refresh-demo/README.md` §9.
- **Nothing is trimmed.** The build includes every Bootstrap component,
  carousel and placeholders included. Trimming is a legitimate optimisation but
  needs an audit of all 45 views first, and is a separate decision from the
  theme.
