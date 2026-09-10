# Cuaderno — Mister F Design Framework

A static design proposal for the Mister F application UI, plus the rules needed
to keep building it. Nine pages, one stylesheet, nine illustrations, no build
step and no dependencies.

> The demo's on-screen copy is Spanish because it mocks the `es` edition of a
> product whose UI is internationalized. This document, the code and the
> comments are English, per `.agents/skills/project-language-conventions`.

> **Update — this proposal now has an implementation.** The design system below
> ships as a real Bootstrap theme in `misterf-web/src/client/theme/`
> ("Cuaderno"), and the application already runs on it. That folder's README is
> the authority on tokens, modes, families and components; the live component
> reference is `/public/theme/kitchen-sink.html`. The nine pages here are still
> the design argument and the page-level proposals, and they keep their own
> standalone stylesheet — they predate the theme and were left untouched so the
> proposal and its implementation can be compared side by side.

## Open it

```bash
python3 -m http.server 8091 --directory design
```

Then <http://localhost:8091/ui-refresh-demo/index.html>. The launch entry
`scene-scripts-review` in `.claude/launch.json` already serves exactly this.

| Page | What it proposes |
| --- | --- |
| `index.html` | The argument, and the map of the demo |
| `estilo.html` | The system on one page: palette, type, modes, components, image rules |
| `aprendo-inicio.html` | **New.** A learner home; today the root is an empty chat |
| `aprendo-biblioteca.html` | Redesign of `/resources`. Renders in **both** modes — use the switcher |
| `aprendo-recurso.html` | Redesign of `/quizzes/:id` |
| `aprendo-progreso.html` | Redesign of `/progress` |
| `crear.html` | Redesign of the `new` screens. Renders in both modes |
| `enseno-inicio.html` | **New.** The teacher's dashboard |
| `enseno-clase.html` | The Teacher Pilot screen: deliveries, per-block failures, next-class report |

Blue boxes labelled **Nota** are review annotations. They are not part of the
design and never ship.

---

## 1. The diagnosis

The landing page already solved what Mister F looks like: warm paper, navy ink,
one terracotta accent, Literata for headlines, and HTML mockups instead of
screenshots. Cross the login boundary and all of it disappears — the app is
Bootswatch Flatly's neutral gray with no imagery, and every kind of content
looks identical in a list.

Three concrete consequences, all visible in the current build:

1. **Nothing is identifiable at a glance.** `/resources` is a gray list where a
   quiz, a roleplay and a practice guide differ only by a small text badge.
2. **There is no front door.** Signed in, `/` is an empty chat that asks the
   learner to invent the session. The product knows what they were doing
   yesterday and does not say so.
3. **Learning and teaching wear the same clothes.** A teacher checking
   deliveries before class and a learner doing a worksheet get the identical
   chrome, density and tone, which serves neither.

What already works and is kept almost untouched: the landing, the chat, and the
quiz blocks.

## 2. The proposal, in three moves

**Move 1 — The color already exists; promote it.** Quiz, roleplay, practice
guide, scene and conversation each already own a color in
`misterf-web/src/client/styles/app.css` (`--mf-quiz`, `--mf-teal`,
`--mf-practice`, `--mf-choice`, `--mf-dialogue`), but only inside an exercise.
Lift those same values to the library, the cards, the chips and the navigation.
No new palette is invented, so nothing has to be re-approved.

**Move 2 — Draw before you photograph.** Most of the missing imagery is not
photography and not even illustration: it is HTML mockups (for showing the
product) and CSS covers (for identifying a resource). Generated illustration is
reserved for page tone and empty states. Nine images cover the whole app.

**Move 3 — Make the mode visible.** One `data-mode` attribute on `<html>`
switches six variables. Learning is warm paper, serif, roomy, illustrated.
Teaching is cool paper, sans, dense, tabular. Same components, same code.

---

## 3. Foundations

All tokens live in `assets/tokens.css`. Port that file to
`misterf-web/src/client/styles/base.css`.

### Paper and ink

| Token | Value | Use |
| --- | --- | --- |
| `--sand` | `#FBF8F4` | App background, **Aprendo** |
| `--cool` | `#F2F5F7` | App background, **Enseño** |
| `--paper` | `#FFFFFF` | Cards, panels |
| `--line` / `--line-strong` | `#E6E0D7` / `#D5CEC2` | Borders, dividers |
| `--ink` / `--ink-soft` / `--ink-faint` | `#101F27` / `#4D6069` / `#7B8B93` | Text, three levels only |

### Brand

| Token | Value | Use |
| --- | --- | --- |
| `--navy` | `#00496A` | Primary action; accent in **Enseño** |
| `--terracotta` | `#B8541F` | Accent in **Aprendo**; also the `escena` family |

Both come from the landing, which took the navy from the brand mark.

### Family colors

| Family | Token | Value | Already in `app.css` as |
| --- | --- | --- | --- |
| Quiz | `--fam-quiz` | `#4F46E5` | `--mf-quiz` |
| Roleplay | `--fam-roleplay` | `#0F766E` | `--mf-teal` |
| Practice guide | `--fam-guia` | `#1F6F8B` | `--mf-practice` |
| Scene / media | `--fam-escena` | `#B8541F` | `--mf-choice` (close) |
| Conversation | `--fam-charla` | `#6C4B2C` | `--mf-dialogue` |

Each has a `-tint` companion used for fills.

> **The four-places rule.** A family color may appear in the **type chip**, the
> **card cover**, the **icon**, and the **active state** (border, rail, bar).
> Nowhere else. Never as the background of a large surface — the one exception
> is the create screen, where choosing between kinds *is* the task — and never
> on body text. Break this and the app becomes a fruit salad, which is the
> failure mode this system is designed to avoid.

Implementation: a `.fam-*` class sets `--fam` and `--fam-tint` for its subtree.
Components read only those two variables, so adding a sixth content type is one
class and zero component changes.

### Semantic colors

`--ok` `#166534`, `--warn` `#92400E` (strong `#C98A00`), `--bad` `#991B1B`,
each with a tint. Correct/to-improve tallies use ok/warn — never ok/bad. A
learner who got something wrong is not in an error state.

### Type

- **Display** — `Literata` (already loaded app-wide) for page titles, section
  titles, resource titles, and practice content.
- **UI** — system sans for everything else.
- **Scale** — 12 / 13 / 15 / 17 / 19 / 24 / 30 / 38. Nothing between.
- In **Enseño**, `--heading-font` becomes the sans and page titles drop to 30.

### Shape and depth

- Radii: `4 / 8 / 12 / 16 / 22 / 999`. `--card-radius` is `16` in Aprendo and
  `12` in Enseño; never hardcode a card radius.
- Two shadows only: `--shadow-card` (resting elevation) and `--shadow-lift`
  (hover). No page invents a third.
- Spacing is a 4px scale, `--space-1` … `--space-8`.

---

## 4. The two modes

`data-mode="aprendo" | "enseno"` on `<html>` redefines six variables:
`--mode`, `--mode-deep`, `--mode-tint`, `--app-bg`, `--card-radius`,
`--heading-font`. Nothing else in the sheet knows the modes exist.

| | Aprendo | Enseño |
| --- | --- | --- |
| Background | warm paper `--sand` | cool paper `--cool` |
| Accent | terracotta | navy |
| Headings | Literata (serif) | system sans, tighter |
| Radius | 16px | 12px |
| Hero illustration | yes, on top-level pages | no |
| Default layout | cards | tables |
| Voice | second person, about you | third person, about the group |

Plus a persistent 4px colored rail down the left edge of the shell, and a
segmented **Aprendo / Enseño** switcher at the top of the sidebar. Four pixels
of color is the cheapest "which product am I in" signal that survives
scrolling.

### Rules for mode differentiation

1. **Differentiate through the token layer, never by forking a component.** If
   a difference cannot be expressed as a variable, it probably should not exist.
2. **Cap it at five or six differences.** More and the two modes stop reading
   as one product.
3. **Never differentiate meaning.** A green check means the same thing in both.
   Family colors are identical in both. Only chrome, density and voice change.
4. **Copy is a differentiator and must be authored per mode**, through i18n
   keys, not by string-swapping in the view. The demo fakes this with
   `data-copy-aprendo` / `data-copy-enseno`; the real app needs parallel key
   families (`library.title.learner` / `library.title.teacher`).
5. **Whole blocks may be mode-only** (`.only-aprendo` / `.only-enseno` in the
   demo). In the app, branch in the view — do not ship hidden markup.

### What a mode is *not*

It is not a permission and not an account type. The same person switches all
day. Mode must be a cheap, reversible, per-session toggle — the existing
profile switcher is the natural place for it, and profiles already exist
(`profiles` table, `misterf-web/src/server/profiles/`).

---

## 5. Components

Everything below is either a Bootstrap component restyled with tokens or a
genuinely new pattern. The split matters for `.agents/skills/bootstrap-ui-conventions`.

| Class | What it is | Bootstrap origin |
| --- | --- | --- |
| `.btn` `.btn-primary` `.btn-ghost` `.btn-mode` | Pill buttons | `btn`, `btn-primary`, `btn-outline-*` |
| `.card` `.card-quiet` `.card-lift` | Surfaces | `card` |
| `.chip` | Family / status pill | `badge` |
| `.table` | Data table | `table` |
| `.rcard` | **New.** Resource card with drawn cover | — |
| `.acard` | **New.** Colored create action | — |
| `.stat` | **New.** Number tile | — |
| `.bar` `.meter-row` `.cols` | **New.** CSS-only progress and charts | — |
| `.block` | **Kept.** Exercise block, plus a family rail | existing quiz styles |
| `.mock` `.mock-line` | **Kept.** HTML product mockup | from the landing |
| `.streak` | **New.** Effort record, Aprendo only | — |
| `.empty` | **New.** Empty state with spot illustration | — |

### `.rcard` covers

The cover is drawn in CSS: family tint + a repeating dot pattern + one line
glyph. Free, infinite, never wrong, and recognizable in a grid of twenty. **Do
not generate an image per resource.** A user creating a quiz should not wait on
an image model, and a library of 200 items should not be 200 files.

### `.streak`

The one openly playful component, and the only one restricted to Aprendo. It is
a record of effort, not a score: no leaderboard, no loss state, no red, and
nothing is ever taken away. Any activity counts.

---

## 6. Imagery

### The decision tree

Ask in this order and stop at the first yes.

1. **Does it show the product?** → **HTML mockup** (`.mock`). Never a
   screenshot, never an image. It cannot go stale, it translates itself, it
   weighs nothing, and it is visibly an example. This is what the landing does
   and it is the single highest-value rule here.
2. **Does it identify a resource?** → **CSS cover** (`.rcard-cover`).
3. **Does it set the tone of a page, or fill an empty state?** →
   **illustration** (hero or spot). Generated, and there should be very few.
4. **Is it learning content?** → **scene**, from the existing library, governed
   by `design/illustration-style-guide.md`. This system does not touch it.
5. **Is it a person in a roleplay?** → **existing avatars** in
   `misterf-web/public/roleplay-characters/`.

If none apply, the answer is no image.

### Asset classes

| Class | Ratio | Delivered size | Budget | Where |
| --- | --- | --- | --- | --- |
| Hero | 16:9 | 1400px wide | ≤ 100 KB | One per top-level Aprendo page |
| Spot | 1:1 | 512×512 | ≤ 40 KB | Family marks, inline accents |
| Empty state | 4:3 | 640px wide | ≤ 40 KB | One per empty surface |
| Scene | 1:1 | 720×720 | existing | Learning content |
| Avatar | 1:1 | existing | existing | Roleplay characters |

Nine assets cover the whole application. If a tenth is proposed, the burden is
to show that steps 1–3 of the decision tree do not answer it.

### Visual rules

- **Flat 2D vector cartoon**, same family as the roleplay avatars: rounded
  shapes, crisp outlines, flat fills, light shading. No gradients, no texture,
  no 3D, no photography, ever.
- **Palette-locked** to `#FBF8F4`, `#00496A`, `#B8541F`, `#0F766E`, `#4F46E5`,
  `#E6E0D7`, `#FFFFFF`. An illustration that introduces a new hue is rejected,
  not adjusted.
- **No readable text.** No letters, numbers, signs, labels, logos or
  watermarks. Where writing belongs, draw abstract lines. Same rule as the
  scene library, for the same reason: the app is translated into three
  languages and images are not.
- **Generous margins and one subject.** Heroes keep the left ~45% nearly empty
  so copy can sit over the same band in any language.
- **Must read at 48px.** If the subject is unrecognizable as a favicon-sized
  thumbnail, it is too busy.
- **Inclusive and classroom-safe**, matching the audience: adult learners,
  varied ages, skin tones and body types, everyday situations, never a
  stereotype and never a child when the learner is an adult.
- **Alt text**: descriptive when the image carries meaning; `alt=""` when it is
  decorative next to text that already says it. Heroes use
  `role="img"` + `aria-label` because they are CSS backgrounds.

### Generation recipe

Model `google/gemini-3.1-flash-image` through OpenRouter, with the key at
`design/scene-scripts/.assts-gen-key` (gitignored — see
`.agents/skills/generate-scene-assets`). The generator used for this demo is
reproducible: subject line, then a fixed style block, then the ratio.

```text
<one or two sentences describing the subject and its staging>

Style: clean flat 2D vector cartoon illustration in a friendly modern
English-workbook style. Rounded approachable shapes, crisp clean outlines, flat
color fills with light minimal shading, no gradients, no texture, no
photorealism, no 3D. Palette strictly limited to: warm paper cream #FBF8F4
background, deep navy #00496A, terracotta #B8541F, teal #0F766E, indigo
#4F46E5, muted sand #E6E0D7, off-white #FFFFFF. Warm, calm, optimistic,
classroom-safe, inclusive. Strict constraint: absolutely no readable text, no
letters, no numbers, no logos, no signs, no labels, no watermarks anywhere in
the image. Where writing would appear, draw simple abstract horizontal lines
instead. Composition: generous empty margins, single clear subject, reads well
at small size.

Aspect ratio: <16:9 | 4:3 | 1:1>.
```

Only the first paragraph changes between assets. That is what keeps nine images
generated on different days looking like one set.

### Optimization pipeline

The model returns ~900 KB PNGs. Flat vector art quantizes almost losslessly:

```bash
magick in.png -resize 1400x -strip -colors 64 \
  -define png:compression-level=9 PNG8:out.png
```

Heroes: `1400x`, 64 colors. Spots: `512x512`, 48 colors. Empty states: `640x`,
48 colors. This took the demo's nine assets from ~8 MB to 247 KB total, with no
visible loss on flat art. **Never commit an unoptimized generated PNG.**

`generate-illustrations.py` in this folder does both steps and is the exact
script that produced these nine files. Run it from the repo root; it skips
assets that already exist, so regenerating one is
`python3 design/ui-refresh-demo/generate-illustrations.py spot-quiz` after
deleting that file.

### Naming

`<class>-<subject>.png` — `hero-aprendo`, `spot-quiz`, `empty-biblioteca`. The
class prefix is the contract; a file named `spot-*` must satisfy the spot rules.

---

## 7. Voice

- **Aprendo** speaks to one person about their own work, in the second person,
  present tense, short sentences: *"Sigue donde lo dejaste."* It never scolds,
  never uses a score as a judgment, and names the next concrete action.
- **Enseño** speaks about the group, leads with the number, and ends in
  something to do before class: *"5 de 6 fallaron el bloque #3."*
- Practice content stays English in every edition — as it already does — while
  instructions follow the reader's language. The demo respects this.

All of it goes through the i18n catalogs
(`misterf-web/src/server/i18n/locales/`) in `es`, `en` and `ht`. No hardcoded
strings in views.

---

## 8. Accessibility

- Body text on paper is `--ink` (≥ 12:1). `--ink-soft` is the floor for
  secondary text; `--ink-faint` is for 12–13px metadata only, never for
  sentences.
- Family colors are used at full strength on tint backgrounds, where every pair
  clears 4.5:1. They are never used as light-on-light.
- **Color is never the only signal.** Every family chip carries its name; every
  status chip carries a word; tallies carry numbers.
- Focus ring is `3px solid var(--mode)` at `2px` offset, on everything.
- Mode is signalled by background, accent, typography, layout *and* the
  switcher's `aria-current` — not by hue alone.
- Every interactive element in the demo is a real `<a>` or `<button>`.

---

## 9. Adopting this in `misterf-web`

Deliberately incremental; no big-bang rewrite.

1. **Tokens first.** Port `tokens.css` into `base.css`, mapping the family
   variables onto the existing `--mf-*` values rather than duplicating them.
   Nothing changes visually. Low risk, unblocks everything else.
2. **Chips and cards.** Add `.chip` and `.rcard` and rebuild `/resources`. This
   is the single biggest perceived change for the smallest diff.
3. **Mode plumbing.** Add mode to the active profile, set `data-mode` in
   `app-shell-open.ejs`, add the switcher next to the existing profile
   switcher. Still no new pages.
4. **The two homes.** `aprendo-inicio` and `enseno-inicio` as real routes, each
   with its own handler (per `AGENTS.md`: one handler per page).
5. **The teacher class page**, which is the Teacher Pilot MVP screen and the
   one with direct roadmap value.
6. **Progress and create**, last, because they are the least visited.

### Conflicts with existing conventions — read before starting

`.agents/skills/theme-surface-conventions` currently forbids, on general
containers: gradients, custom `box-shadow`, and hardcoded radii; and it requires
`--bs-*` tokens. This proposal is compatible in spirit but needs three explicit
amendments, which are Arian's call and not an agent's:

1. **Radii.** `--card-radius` replaces `var(--bs-card-border-radius)` because
   the radius must vary by mode. The rule "never hardcode a radius" is kept —
   the token indirection is what makes it possible.
2. **Shadows.** The sheet defines two shadows and uses them on cards, not just
   on the two main panels. The current rule allows a shared shadow only for the
   left and right panels. Either widen it to "two shared shadow tokens,
   defined once" or keep cards flat and lose the hover lift.
3. **Backgrounds.** `--app-bg` no longer resolves to `var(--bs-body-bg)`. The
   theme stays Flatly for components; the surface palette becomes ours.

The one thing this proposal does **not** ask for: gradients. There are none,
and there should stay none.

### What is deliberately unchanged

The landing. The chat. The exercise blocks. The scene library and its style
guide. The roleplay avatars. Flatly as the component theme. The i18n
architecture. Those are the parts that already work.
