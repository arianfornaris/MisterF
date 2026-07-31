# Public Pages Design System

Scope: the **public, logged-out surfaces** of Mister F — today the landing page
(`views/landing.ejs`, `public/landing.css`), tomorrow a blog, a public practice
library, or any page whose job is a first impression rather than a task.

This document exists so a second public page can be built without rediscovering
the decisions, and so the reasoning survives the person who made it.

## Relationship To The Application Theme

[Visual Design](./visual-design.md) governs the **application**: Bootstrap and
Bootswatch Flatly own the theme, and Mister F tokens are confined to
instructional content. That rule stands and is not weakened by this document.

The public pages are a deliberate exception, decided on 2026-07-30. The two
surfaces have different jobs:

- **The app** should feel native to its theme. A teacher working in it wants
  familiar controls, not personality. Bootstrap is exactly right there.
- **A public page** has one job — be believed in the first five seconds — and a
  Bootstrap admin panel with marketing copy in it reads as a template. It also
  pays for the whole framework, an icon font, and a script that a static page
  never uses.

So the landing ships `public/landing.css` and nothing else: no Bootswatch, no
icon font, no app stylesheet, no JavaScript. A route test enforces it.

**Which rules still apply to public pages:** the surface conventions from
`theme-surface-conventions` in spirit — flat containers, tokens over one-off
values, no decorative gradients on page chrome — and every accessibility rule.
What does not apply is "use a Bootstrap component for it".

---

## Principles

These are the decisions that produced the current page. New public pages should
be able to point at each one.

### 1. Editorial, not SaaS

The palette is warm paper and ink with one navy and one terracotta. Headlines
are set in a serif. The intent is that the page reads like something written by
a person who teaches, not like a dashboard marketing itself — which is also the
truth about the product.

Concretely: no blue-to-purple gradients, no glassmorphism, no floating 3D
product shots, no icon grid of twelve features.

### 2. The page must be instant on mobile data

The audience is adult immigrant learners and the teachers who work with them,
opening a link that was forwarded to them, usually on a phone. Every byte is a
decision.

- Zero JavaScript. The FAQ is `<details>`; nothing else needs behavior.
- Zero images. Product visuals are drawn in HTML and CSS (see *Mockups*).
- One stylesheet, one webfont family.

Current cost: about 17 KB of HTML and 15 KB of CSS, uncompressed.

### 3. One primary action, repeated verbatim

The page has exactly one primary call to action, in the same words each time it
appears (hero and closing), and one secondary. Varying the wording to avoid
repetition weakens both. Secondary actions are outlined, never solid — the
hierarchy has to be legible without reading.

### 4. Claims are checkable

Every statement on a public page must be true of the code as it exists, and
nameable in it. This page has already broken that rule three times and been
corrected: it described a "next-class report" that is not a screen, a roster
that does not exist, and a "free during the pilot" price that was never the
case.

Two rules came out of those corrections and belong to this design system as
much as to the copy:

- **Never name a screen or a metric the product does not have.** Promise
  outcomes; describe only what renders.
- **Never state a commercial term that is not readable in the code or in an
  approved business document.**

### 5. Text carries the page; visuals confirm it

Every mockup on the page is redundant with the sentence beside it. That is why
they can be `aria-hidden` and why the page still works with images of any kind
unloaded.

---

## Tokens

All defined in `:root` in `public/landing.css`.

### Colour

| Token | Value | Role |
| --- | --- | --- |
| `--ink` | `#101f27` | Body text, headings |
| `--ink-soft` | `#4d6069` | Secondary prose, descriptions |
| `--ink-faint` | `#7b8b93` | Fine print, labels, meta |
| `--navy` | `#00496a` | Brand. Primary buttons, dark bands, accents on tints |
| `--navy-deep` | `#00354e` | Primary button hover, text on light navy |
| `--navy-tint` | `#e7eff4` | Numerals, level badges, quiet emphasis |
| `--accent` | `#b8541f` | Eyebrows, focus ring, the single warm accent |
| `--accent-soft` | `#f6ece4` | Background of `Example` pills |
| `--paper` | `#ffffff` | Cards, alternating bands |
| `--sand` | `#fbf8f4` | Page background |
| `--line` | `#e6e0d7` | Hairlines, card borders |
| `--line-strong` | `#d5cec2` | Outlined buttons, stronger separators |

**The navy is the brand mark's own colour**, sampled from
`design/MisterF-v2.png` (`rgb(0, 73, 106)`), not chosen by eye.

**The accent is used sparingly on purpose** — eyebrow labels, the `Example`
pill, focus rings. If it starts appearing in three places per screen it stops
meaning anything.

Semantic colours used inside mockups only, and matched to the app's own
success/danger feel: `#1f6f52` on `#e3f2ea` for correct, `#a03c22` on `#fbe7e3`
for to-improve.

### Type

| Token | Value |
| --- | --- |
| `--font-display` | `'Literata', Georgia, 'Times New Roman', serif` |
| `--font-ui` | system stack (`-apple-system`, `Segoe UI`, Roboto, …) |

Literata is **already loaded by the app** for learning content, so the public
pages pay nothing extra for it and inherit a real connection to the product's
voice. Everything else uses the system stack: no second webfont, and body text
that looks native on the reader's device.

Scale, all fluid via `clamp()` so nothing needs breakpoint-by-breakpoint sizes:

| Element | Size |
| --- | --- |
| Hero `h1` | `clamp(31px, 4.2vw, 50px)`, line-height `1.1` |
| Section `h2` | `clamp(28px, 3.4vw, 40px)` |
| Card / panel `h2` | `clamp(22px, 2.2vw, 27px)` — a card heading is not a section heading |
| `h3` | `19px` |
| Body | `17px` / `1.65` |
| Lede | `clamp(17px, 1.5vw, 19px)` |
| Fine print | `14px` |

Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`. Measure is
capped at `--measure: 62ch`, and step text at `46ch`.

### Space, radius, shadow

- Page gutter: `clamp(20px, 5vw, 40px)`; content width `1140px`.
- Band padding: `clamp(56px, 8vw, 104px)`.
- `--radius: 14px` for small surfaces, `--radius-lg: 22px` for cards. Buttons
  and pills are fully rounded (`999px`).
- Two shadows only: `--shadow` for resting cards, `--shadow-lift` for the hero
  card and the demo module. Nothing else casts one.

---

## Layout Grammar

The page is a stack of **bands**, alternating background so sections separate
without dividers:

| Class | Use |
| --- | --- |
| `.band` | Default, on `--sand` |
| `.band--paper` | White, bordered top and bottom |
| `.band--dark` | Navy. **Used once**, for the one action that matters most |

`.band--dark` is the strongest device on the page. Spending it twice halves it.

Inside a band: `.wrap` centres content; `.section-head` holds the heading;
`.cols` is the two-column split (`1.1fr / 0.9fr` at ≥1000px, single column
below), with `.cols--even`, `.cols--tight`, and `.cols--middle` modifiers.

Breakpoints, and only these: `560px` (phone chrome), `760px` (small tablet),
`900px` (step mockups move beside their text), `1000px` (two-column layouts).

---

## Components

- **`.btn` / `.btn--primary` / `.btn--ghost`** — pill buttons, 1px lift on
  hover. Inside `.band--dark` and `.panel`, the primary inverts to white on
  navy; that inversion is required, not decorative, or the button disappears.
- **`.card`, `.card--lift`** — white, hairline border, rounded `--radius-lg`.
- **`.panel`** — navy block for a secondary offer (pilot, price).
- **`.pill`** — accent-tinted label. Reserved for `Example`.
- **`.eyebrow`** — uppercase, letterspaced, accent-coloured. One per page,
  above the `h1`; sections do not get one.
- **`.tally--ok` / `.tally--bad`** — the correct / to-improve chips, shared by
  the hero card and the step mockups.
- **`.faq`** — native `<details>` list, chevron drawn with a rotated border.

Icons are **inline SVG**, 24×24, `stroke-width: 2`, `currentColor`. No icon
font on public pages.

---

## Mockups

The page shows the product without a single screenshot. The rules that keep
that honest:

1. **Schematic, never photographic.** Enough structure to recognise the moment,
   never enough to be mistaken for a capture. If it starts looking like a real
   screenshot, it has to become one.
2. **Labelled when it shows data.** The hero card carries an `Example` pill. A
   made-up class must never read as a real one.
3. **Mirrors a real screen.** The hero reproduces the participation page —
   kicker, counts, one row per question with its tallies, AI summary — and
   reuses the product's own i18n labels (`quizzes.correctSuffix`,
   `quizzes.toImproveSuffix`). If the screen changes, the mockup is wrong and
   should be updated with it.
4. **`aria-hidden="true"` on decorative mockups.** They illustrate the sentence
   beside them; a screen reader should get the sentence, not a description of
   imaginary furniture.
5. **Practice content stays English in every edition.** Instructions translate,
   the English being practised does not — which is exactly how the product
   behaves, and the mockups demonstrate it by existing.

---

## Building A New Public Page (e.g. the blog)

1. New top-level EJS view (`ejs-view-structure`: one view per page).
2. `include('partials/document-head', { includeAppStyles: false, pageStylesheet, metaDescription })`.
3. Reuse `public/landing.css`. If the new page needs its own rules, add a
   second stylesheet rather than growing the landing's — and promote anything
   both pages use into a shared `public/public-pages.css` at that point.
4. Reuse the band / wrap / card grammar so the pages feel like one site.
5. Set `canonicalUrl`, and `alternateEditions` if the page is translated.
6. Keep the budget: no JavaScript, no images. A blog post with a diagram should
   ask whether the diagram can be HTML first.

For an article page specifically, the piece not yet designed is the **prose
column**: measure (`--measure` is a good start), heading rhythm inside long
text, blockquote, inline code, and figure captions. That is the only new
component work a blog needs.

---

## If The App Theme Is Ever Restyled From This

The founder has raised making a Bootstrap/Bootswatch variation for the
application out of this palette. The honest position:

- **The colour and type tokens transfer.** They map onto Bootstrap's
  `--bs-primary`, `--bs-body-color`, `--bs-body-bg`, `--bs-border-color`,
  `--bs-border-radius`, and the `$font-family-base` / heading font variables.
  A Flatly variation with `--navy` as primary, `--sand` as body background,
  `--ink` as body colour, and Literata for headings is a contained change.
- **The layout grammar does not transfer, and should not.** Bands, oversized
  serif headlines, and 62ch measures belong to a page that is read once. An
  application needs density, familiar controls, and no surprises.
- **Do it as a theme override, never by importing `landing.css` into the app.**
  The two files must stay independent; the moment the app depends on the
  landing's CSS, the landing can no longer be changed freely, which is the
  whole reason it was separated.

A sensible first step, if this is picked up: restyle only the app's *primary
colour and heading font* and stop there. That gets most of the family
resemblance for a fraction of the risk.
