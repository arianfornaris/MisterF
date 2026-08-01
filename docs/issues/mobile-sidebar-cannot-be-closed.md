# The Mobile Sidebar Cannot Be Closed

Date: 2026-07-31

Status: **Fixed 2026-07-31.** Reported by the founder on an iPhone, reproduced
at 375×812 against the local server, and fixed in the same session. Three
independent defects had to be removed; each one alone would have left a way out,
which is why this survived until someone used it on a phone.

## Symptom

On a phone, open any app page, tap the hamburger in the chat toolbar to show the
side panel, and there is then no way to dismiss it. The panel covers the screen
and the visitor is stuck until they reload or navigate away.

## Root Cause

All three defects trace to the same origin: the panel is
**`.offcanvas-lg`**, Bootstrap's *responsive* offcanvas variant, and three
separate mechanisms in Bootstrap and Bootswatch are written against
`.offcanvas`, which `.offcanvas-lg` is not.

**1. The dismiss button was wired to nothing.**

`<button class="btn-close" data-bs-dismiss="offcanvas">` with no explicit
target. Bootstrap's dismiss handler resolves the thing to hide as
`getElementFromSelector(this) || this.closest('.offcanvas')` — and with no
`data-bs-target`, the fallback walks up looking for `.offcanvas` and finds
nothing. Verified in the page: `btn.closest('.offcanvas')` → `null`, no
`data-bs-target`, and tapping the button left `panel.classList.contains('show')`
still `true`. The button had never worked.

**2. The dismiss button was invisible.**

Bootswatch Flatly sets `--bs-btn-close-color: #fff` and a close icon whose SVG
is `fill='%23fff'`. Bootstrap repaints it black inside overlays with
`.modal .btn-close, .offcanvas .btn-close, .toast .btn-close` — again a selector
that `.offcanvas-lg` does not match. Measured on the open panel: icon fill
`#fff`, panel background `rgb(255, 255, 255)`, opacity `0.4`. A white glyph at
40% opacity on a white panel.

**3. There was no backdrop left to tap.**

`app-shell.css` had always asked for `.conversation-panel { width: min(86vw,
360px) }`, which would have left a strip of backdrop to tap. It never applied:
Bootstrap sets the width through `.offcanvas-lg.offcanvas-start`, **two
classes**, which outranks a single-class selector. The panel therefore took
`--bs-offcanvas-width` (400px, clamped by `max-width: 100%`) and measured
375×812 in a 375×812 window — **0 px** of backdrop uncovered.

`Escape` still dismissed the panel throughout, which is why this never showed up
in a narrowed desktop browser, and why a phone is the one place it bit.

## The Fix

`views/partials/app-shell-open.ejs` — name the target, so the dismiss handler
can resolve it:

```html
<button ... data-bs-dismiss="offcanvas" data-bs-target="#conversationPanel">
```

`src/client/styles/app-shell.css` — inside `@media (max-width: 991.98px)`,
matching Bootstrap's own breakpoint:

- `.conversation-panel.offcanvas-start { width: min(86vw, 360px) }` — two
  classes, so the width this file always intended finally wins.
- `.conversation-panel .btn-close { --bs-btn-close-filter: invert(1)
  grayscale(100%) }` — the same mechanism `.btn-close-white` uses, in the
  opposite direction: white icon inverted to black.

The width moved out of the unscoped `.conversation-panel` rule, where it was
dead: below `lg` Bootstrap outranked it, and at `lg` and above the existing
`@media (min-width: 992px)` block sets `width: 100%`.

## Verified

At 375×812, with transitions disabled to read settled state:

- Panel opens at `x: 0`, width **323 px**, leaving a **53 px** backdrop strip;
  `elementFromPoint` in that strip returns `offcanvas-backdrop fade show`.
- Close button: 32×32 at (276, 23), hit target is itself, filter
  `invert(1) grayscale(1)`.
- Tapping the close button → `show` goes false.
- Tapping the backdrop strip → `show` goes false.

At 1280×800, unchanged: panel `position: static`, 320 px in its grid column,
`transform: none`, visible, with the close and hamburger buttons hidden and no
backdrop.

## Worth Knowing Next Time

`.offcanvas-lg` is not `.offcanvas`. Any Bootstrap or Bootswatch rule, handler,
or documented behavior written against `.offcanvas` silently does not apply, and
"silently" is the operative word — nothing errors, the affordance is simply
inert or unstyled. This panel is currently the only responsive offcanvas in the
views; a second one would inherit all three defects.

## Related

- `views/partials/app-shell-open.ejs` — the panel, toolbar button, and dismiss
  button.
- `src/client/styles/app-shell.css` — the responsive block holding the fix.
- `.agents/skills/bootstrap-ui-conventions` — how this project overrides
  Bootstrap.
