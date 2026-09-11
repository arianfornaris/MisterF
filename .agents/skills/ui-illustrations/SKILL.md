---
name: ui-illustrations
description: Use before adding, generating, regenerating, or placing any illustration or image in the Mister F app UI — heroes, spot illustrations, empty-state images, decorative art on the homes, library, progress or creation pages — or when someone asks for "more images", "an illustration here", or new art "in the same style". Covers the decision of whether an image belongs at all, the three asset classes and their budgets, the locked style prompt, the generator and its registry, where files live, how a view references them, and review before commit. Scene-media learning images and roleplay avatars are separate (see `generate-scene-assets` and `design/illustration-style-guide.md`).
---

# UI Illustrations

Every illustration in the app UI must look like it came from **one set**: flat
2D vector cartoon, English-workbook tone, the Cuaderno palette, no text. The set
stays coherent for one mechanical reason — every image is generated from the
**same fixed style block**, and only a one-or-two-sentence *subject* changes.
Follow the recipe below and a new image will match the existing ones; improvise
the prompt and it will not.

Pair with `cuaderno-theme` (the slots the images go into),
`project-language-conventions` (alt text in three locales) and
`generate-scene-assets` (the design-side key).

## Where Things Live

| What | Where |
| --- | --- |
| Served files | `misterf-web/public/illustrations/<name>.png` → `/public/illustrations/<name>.png` |
| Registry (one entry per file) | `design/ui-illustrations/illustrations.json` |
| Generator + the style block | `design/ui-illustrations/generate.py` |
| Theme slots | `.mf-hero` / `.mf-hero-art`, `.mf-spot` / `.mf-spot-inline`, `.mf-empty` (`src/client/theme/components/_page.scss`, `_states.scss`) |
| Origin and rationale | `design/ui-refresh-demo/README.md` §6 (the demo where the style was set) |

Every file in `public/illustrations/` has a registry entry, and the registry
records where each one is used. A file with no entry is an orphan; an entry
whose `usedIn` is empty should be deleted.

## First: Does It Need An Image At All?

Ask in this order and stop at the first yes (from the demo's decision tree):

1. **Does it show the product?** → an HTML mockup, never a screenshot.
2. **Does it identify a resource?** → the drawn CSS cover of `.mf-rcard`, never
   an image per resource.
3. **Does it set the tone of a page, or fill an empty state?** → **a UI
   illustration** — this skill.
4. **Is it learning content?** → scene media (`design/illustration-style-guide.md`).
5. **Is it a person in a roleplay?** → the existing avatars in
   `public/roleplay-characters/`.

If none apply, the answer is no image. Illustrations are few on purpose: at most
one hero per top-level page (today, one per home composition — `hero-aprendo`
and `hero-enseno`), spots only where they sit beside a label that already says
the same thing, and an empty-state image per empty surface.

## The Three Classes

The file-name prefix is the class, and the class is the contract. The generator
refuses an unknown prefix and derives ratio, size and palette from it.

| Class | Prefix | Ratio | Delivered | Budget | Slot |
| --- | --- | --- | --- | --- | --- |
| Hero | `hero-` | 16:9 | 1400 px wide | ≤ 100 KB | `.mf-hero-art` (CSS background) |
| Spot | `spot-` | 1:1 | 512×512 | ≤ 40 KB | `<img class="mf-spot">` or `mf-spot mf-spot-inline` (56 px) |
| Empty state | `empty-` | 4:3 | 640 px wide | ≤ 40 KB | `<img>` inside `.mf-empty` |

Name as `<class>-<subject>` in Spanish, like the existing set: `hero-aprendo`,
`spot-biblioteca`, `empty-clase`.

## Visual Rules (Review Every Image Against These)

- **Flat 2D vector cartoon**: rounded shapes, crisp dark outlines, flat fills,
  light shading. No gradients, texture, 3D or photography.
- **Palette-locked**: `#FBF8F4` paper, `#00496A` navy, `#B8541F` terracotta,
  `#0F766E` teal, `#4F46E5` indigo, `#E6E0D7` sand, `#FFFFFF`. An image that
  brings in a new hue is regenerated, not retouched.
- **No readable text** — no letters, numbers, signs, logos. Writing is abstract
  lines. The app ships in es/en/ht and images are not translated.
- **One subject, generous margins.** Heroes keep the left ~45% nearly empty so
  the copy sits there in any language; on narrow screens the theme stacks the
  art under the copy and crops from the right.
- **Reads at 48 px.** If the subject is not recognisable as a thumbnail, it is
  too busy.
- **Adult, inclusive, classroom-safe.** Adult learners, varied ages, skin tones
  and bodies; never a child standing in for an adult learner; no stereotypes.
- **Family colors mean something.** A spot whose dominant accent is a content
  family's color (quiz indigo, roleplay teal…) reads as that family. Do not
  reuse a family spot for something else — `spot-roleplay` is not "a
  conversation"; that is why `spot-charla` exists.
- **Never mode-dependent.** A mode never moves layout (`cuaderno-theme` rule 4),
  so no `[data-mode]` rule may show or hide art. Different art for different
  compositions (each home has its own hero) is chosen by the view the server
  renders, never by CSS.

## The Style Block

Single source of truth: `STYLE` in `design/ui-illustrations/generate.py`. Quoted
here for review — **edit it there, never here, and never per image**:

```text
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
```

The full prompt is `subject` + blank line + style block + blank line +
`Aspect ratio: <ratio>.` Changing the style block changes the look of every
future image and splits the set — treat it like a theme token, with the
founder's say-so.

## Writing A Subject

Copy the shape of the existing entries in `illustrations.json`:

- **Start with the framing**: "A wide horizontal scene: …" (hero), "A single
  centered spot illustration: …" (spot), "A gentle empty-state illustration: …"
  (empty).
- **Name every object and the staging**, not a mood: what is on the table,
  where the person looks, what is left empty.
- **One dominant accent from the palette**, by hex, for spots
  ("Deep navy #00496A is the dominant accent color."). Pick a family color only
  when the spot stands for that family.
- **Empty states**: "Very light, mostly paper cream, muted and calm, lots of
  empty space." Nothing in them should look like content.
- **Heroes**: "Plenty of clean empty space on the left."
- **Say what must not appear** when the model tends to add it ("No characters.",
  "The speech bubbles are completely empty.").

## Adding An Image

1. Walk the decision tree above. Write down which rung answered it.
2. Add an entry to `design/ui-illustrations/illustrations.json`: `name` (with
   the class prefix), `subject`, `usedIn` (view and slot), `alt`
   (`"decorative"` or the i18n key).
3. Preview the exact prompt without spending anything:
   `python3 design/ui-illustrations/generate.py <name> --dry-run`
4. Generate (from the repo root; skips files that exist):
   `python3 design/ui-illustrations/generate.py <name>`
   It calls OpenRouter with the **design-side key**
   (`design/scene-scripts/.assts-gen-key`, gitignored — never print it, never a
   user's credit), then resizes, strips and quantizes with ImageMagick (PNG8)
   and prints the size against the class budget. `OVER` means fix it before
   committing. One image is one call; say so before generating a batch.
5. **Look at it** (open the PNG) and check every visual rule. Readable text,
   a stray hue, a child, or a busy thumbnail → regenerate with
   `--force`, tightening the subject rather than touching the style block.
6. Place it in the view (below), then look at the page in the browser at
   desktop and 375 px.

To regenerate an existing file: `generate.py <name> --force`.

## Placing It In A View

- **Hero** — a CSS background, so it can bleed to the edge and crop:

  ```ejs
  <section class="mf-hero">
    <div class="mf-hero-copy">…eyebrow, title, lede, one primary action…</div>
    <div class="mf-hero-art"
      style="background-image: url('/public/illustrations/hero-aprendo.png')"
      role="img" aria-label="<%= t('home.heroAlt') %>"></div>
  </section>
  ```

  A hero carries meaning as the page's tone, so it gets `role="img"` and an
  i18n `aria-label` in es/en/ht.
- **Spot** beside a heading that already names it — decorative:

  ```ejs
  <img class="mf-spot mf-spot-inline" src="/public/illustrations/spot-guia.png"
    alt="" width="56" height="56" loading="lazy">
  ```
- **Empty state** — decorative image, then title, body and **always an
  action**:

  ```ejs
  <div class="mf-empty">
    <img src="/public/illustrations/empty-clase.png" alt="" width="640" height="478" loading="lazy">
    <p class="mf-empty-title">…</p>
    <p class="mf-empty-body">…</p>
    <a class="btn btn-primary btn-sm" href="…">…</a>
  </div>
  ```

Always set `width`/`height` (no layout shift) and `loading="lazy"` below the
fold. Never size an image with ad hoc CSS — the slot classes fix the size so a
spot cannot grow into a hero.

## Before Committing

- The PNG is the optimized output of `generate.py` (never a raw model PNG) and
  within budget.
- The registry entry exists and its `usedIn` is accurate.
- Alt: `alt=""` for decorative images; i18n keys in all three locales for heroes
  or any image that carries meaning.
- The page was looked at in the browser, desktop and 375 px.
