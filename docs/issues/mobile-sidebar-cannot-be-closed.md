# The Mobile Sidebar Cannot Be Closed

Date: 2026-07-31

Status: **Open, reproduced, root cause identified.** Reported by the founder on
an iPhone; reproduced at 375×812 against the local server and confirmed in the
computed styles. Not yet fixed.

This is filed here rather than in [Roadmap X](../roadmap/roadmap-x.md) because
it is not deferred work — it is a defect that traps a visitor on the product's
primary mobile surface, and the holding area is explicitly for things that were
postponed on purpose.

## Symptom

On a phone, open any app page, tap the hamburger in the chat toolbar to show
the side panel, and there is then no way to dismiss it. The panel covers the
screen and the visitor is stuck with it until they reload or navigate away.

## Root Cause

Two independent facts combine, and neither alone would trap anyone.

**1. The close button is white on white.**

The panel is `offcanvas-lg offcanvas-start` (`views/partials/app-shell-open.ejs`).
It does have a dismiss button — `<button class="btn-close d-lg-none"
data-bs-dismiss="offcanvas">` — and it is present, positioned, and hit-testable
at the top right. It is simply invisible:

- Bootswatch Flatly sets `--bs-btn-close-color: #fff` and a close icon whose SVG
  is `fill='%23fff'`, i.e. **white**.
- Bootstrap ships an override that repaints it black inside overlays:
  `.modal .btn-close, .offcanvas .btn-close, .toast .btn-close { background-image: … fill='%23000' … }`.
- That selector is `.offcanvas`. **This panel is `.offcanvas-lg`**, which is a
  different class — Bootstrap's responsive offcanvas variant. The override never
  matches, so the button keeps the white icon.
- Measured on the open panel: icon fill `#fff`, panel background
  `rgb(255, 255, 255)`, opacity `0.4`.

A white glyph at 40% opacity on a white panel is not a visibility problem, it is
an invisibility one.

**2. There is no backdrop left to tap.**

The usual escape hatch is tapping outside the panel. At phone width the panel
fills the viewport: measured 375×812 inside a 375×812 window, leaving **0 px**
of backdrop uncovered. The backdrop element exists (`.offcanvas-backdrop fade
show`, z-index 1040) but none of it is reachable.

`Escape` still dismisses the panel, which is why this does not reproduce on a
desktop browser at a narrow window — and why a phone, which has no Escape key,
is the one place it bites.

## Fix

The one-line version is to make the override match the responsive variant, in
the app stylesheet rather than by editing Bootstrap:

```css
.offcanvas-lg .btn-close { /* the same black-icon background Bootstrap gives .offcanvas */ }
```

Worth considering in the same pass, since both are cheap and each would have
prevented the trap on its own:

- Give the panel a `max-width` under `lg` so a strip of backdrop is always
  tappable. This is the fix that does not depend on anyone noticing a 16 px
  glyph.
- Check every other `offcanvas-*` responsive variant in the views for the same
  inherited-white-icon problem, rather than patching this one instance.
- Add the close affordance to the panel's own header in a form that does not
  rely on the Bootstrap icon at all.

## Verifying A Fix

At 375×812, with the panel open, all three must hold:

1. The close icon renders dark against the white panel.
2. Tapping the icon dismisses the panel.
3. Either some backdrop is tappable, or requirement 2 is genuinely sufficient —
   decide which, rather than leaving it to chance.

## Related

- `views/partials/app-shell-open.ejs` — the panel, the toolbar button, and the
  dismiss button.
- `views/partials/app-stylesheet.ejs` — where the override belongs.
- `.agents/skills/bootstrap-ui-conventions` — how this project overrides
  Bootstrap.
