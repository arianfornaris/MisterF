# Roadmap V3.5 — Public Landing Page

Date: 2026-07-30

Status: **Planning — not started.** V3.5 is a single-purpose mini-roadmap: give
Mister F a public landing page. It covers only the logged-out entry surface and
the infrastructure that surface needs (routing, language editions, share
previews, crawlability, conversion measurement). Nothing else belongs here.

This document is the living tracker for V3.5: items move through the status
legend as work happens (`[~]` when started, `[x]` with a date when done), and
notes are added inline when decisions change an item's scope. There is no fixed
execution order — the next item is chosen by analyzing the current state at each
step.

## Why A Separate Roadmap

[Roadmap V3](roadmap-v3.md) shipped the Teacher Pilot MVP: a real teacher can
run the full assigned-practice cycle in production.
[Roadmap V4](roadmap-v4.md) is the deferred backlog, explicitly waiting for
pilot evidence before it is re-scoped.

The landing page fits neither. It is small, self-contained, and it blocks the
business roadmap rather than the product one: Fases 2–4 of the
[Business Roadmap](../business/negocio-roadmap.md) require reaching 3–5 real
teachers, and today every one of those conversations ends by sending someone to
a URL that opens a chat composer with no explanation of what the product is,
who it is for, or who built it. V3.5 closes that gap without reopening V4.

## Versioning Note

The `versioning-and-releases` scheme anchors **MAJOR** to the roadmap version.
V3.5 is a scoped mini-roadmap, **not** a MAJOR bump: its deploys ship as `3.x`
MINOR releases (the landing changes what a user sees), and MAJOR stays `3`
until V4 ships. Current production version at the time of writing: `3.2.0`.

## Scope

### In Scope

- A public landing page for logged-out visitors, in the app's own stack
  (Express + EJS + Bootstrap/Flatly).
- Root routing: logged-out visitors get the landing, authenticated users keep
  going straight to the app.
- Language editions with real URLs and `hreflang`.
- Open Graph / share previews, because most first visits will arrive from a
  link pasted into WhatsApp, not from a search engine.
- Crawlability basics that do not exist today: meta description, canonical,
  `robots.txt`, `sitemap.xml`.
- Two conversion metrics, instrumented from day one.

### Out Of Scope

- **The authenticated home.** The personalized start surface for logged-in
  learners stays a separate, unstarted exploration
  ([Home Start Experience](../features/home-start-experience.md) and
  [Home Suggestions Tracker](../issues/home-suggestions-tracker.md)). V3.5 must
  not quietly become that work.
- A marketing site outside the app (no separate static site, no CMS, no second
  deploy target). The founder is a solo operator on a USD 60/month budget
  ([Presupuesto inicial](../business/presupuesto-inicial.md)); a second stack to
  maintain is a cost the landing does not justify.
- A blog or content-marketing program.
- Pricing tiers. No price has been validated
  ([Business Roadmap](../business/negocio-roadmap.md), Fase 5), so the landing
  states the pilot honestly instead of inventing a table.
- Testimonials, client logos, or traction numbers that do not exist yet.

## Audience Decision

Four kinds of visitor arrive at this page: a curious learner, a potential
investor, an academy tutor the founder has already pitched, and the target
buyer — the independent teacher or tutor of adult immigrant learners.

**The page speaks to the teacher.** The other three are served by paths inside
the page, not by diluting the headline:

- the curious learner gets a dedicated section with its own call to action,
  further down;
- the investor is served by clarity of stage — problem, audience, phase,
  founder — which the teacher-facing content already provides;
- the pitched academy tutor arrives with context, and needs the first screen to
  confirm, in five seconds, what they were told.

The promise is already approved and should be used as written, not reinvented
([Investigación de la competencia](../business/investigacion-de-la-competencia.md),
section 13; [Propuesta de MVP](../business/propuesta-mvp.md), section 1):

> Convierte cada tarea y dificultad real en práctica guiada, y llega a la
> próxima clase sabiendo dónde necesita ayuda cada estudiante.

Category to communicate: a **light continuity layer** around the teacher's own
material — not an LMS, not an editorial curriculum.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Landing Page Structure And Copy

The page is one server-rendered route with the sections below, in this order.
Every section is short; the page should be scannable in under a minute.

- [ ] **Hero.** The approved promise as the headline, a one-line statement of
  who it is for ("independent teachers and tutors of adult learners — with your
  own material, no school platform, no imposed curriculum"), one primary call to
  action, one secondary. The hero image is the **next-class report**, not the
  chat: the report is the proof of the promise, and a chat screenshot is
  indistinguishable from every other AI product.
- [ ] **The 30-second proof.** A link to a real shared activity the visitor can
  complete without an account (see 1.2).
- [ ] **How it works, in four steps**, with real screenshots: paste your
  material → the activity is generated → share the link → see who did it and
  what they got wrong.
- [ ] **"What Mister F is not."** Three lines: not an LMS, no curriculum
  imposed, students install nothing and open a link. Differentiation for this
  category communicates better by negation than by a feature list.
- [ ] **For self-directed learners.** One paragraph and its own call to action.
- [ ] **Who is behind it.** Founder section with a real photo and name, the
  origin of the product (an immigrant adult learning English; the real "Mister
  F" is a career English teacher now teaching in Florida), and the registered
  entity, Little Software LLC, Florida
  ([Contexto del fundador](../business/contexto-del-fundador.md)). For a teacher
  evaluating an unknown tool this outweighs any feature claim.
- [ ] **Product stage: pilot open.** "In pilot with teachers in South Florida.
  Limited places." Creates real (not manufactured) urgency, sets expectations
  that this is not a finished suite, and tells an investor the stage without a
  traction section.
- [ ] **Price, stated honestly.** Free during the pilot; the final price will be
  defined with the pilot teachers. A vague pricing section destroys B2B trust; a
  stated "not yet, and here is why" does not.
- [ ] **Data and privacy, in four lines.** Adults only; a student sees a notice
  before answering when the person who shared the activity will see the results;
  your material stays yours. The consent model already exists
  ([Propuesta de MVP](../business/propuesta-mvp.md), section 4.A) — saying so
  costs nothing and pre-empts the first objection any academy raises.
- [ ] **FAQ, six to eight real questions.** "Do my students need an account?",
  "Does it work with my PDF?", "Which languages?", "What if the AI gets
  something wrong?". Doubles as the objection page and as the only long-tail
  search surface the landing itself will have.
- [ ] **Footer.** Terms, privacy (both already exist as routes and views),
  contact, language switcher.

Call-to-action discipline: **one** primary action, with the same wording,
repeated at most three times down the page.

## 1.2 The 30-Second Proof (Public Example Activity)

The strongest asset available is that shared links with guest attempts already
work ([Propuesta de MVP](../business/propuesta-mvp.md), section 3, step 2). The
demo does not need to be built — it needs to be chosen and curated.

- [ ] Author a demo activity aimed at the pilot audience (adult, practical
  situation, A2–B1) and share it with a stable link.
- [ ] Decide how the demo link is protected from drift: it must not be
  archivable, deletable, or editable by accident, and its attempts must not
  pollute the founder's own results views.
- [ ] Verify the full guest path from the landing on a phone: open → answer →
  immediate evaluation → invitation to create an account.
- [ ] Decide whether the demo attempt's evaluation consumes credits and, if so,
  whose — a public demo that silently spends inference has a cost ceiling that
  must be known before the link is public.

## 1.3 Root Routing And The Guest Experience

Today `/` is served by `chatRouter.get('/', renderChatPage)` for everyone, and
logged-out visitors get a chat composer with `guestInitialGreeting`.

- [ ] Route `/` to the landing for unauthenticated requests and keep the app
  entry unchanged for authenticated sessions.
- [ ] Decide the fate of guest chat: keep it at an explicit URL reachable from
  the landing, or retire it. It is a real asset (a visitor can talk to Mr. F
  with no account) and should not be dropped as a side effect of adding a
  landing.
- [ ] Preserve every existing deep link. Shared resources, attempt pages, auth
  routes, and legal pages must not start bouncing through the landing.
- [ ] Make sure the post-signup destination is still the app, not the landing.

## 1.4 Language Editions And hreflang

The app already ships three instruction languages with typed, parity-enforced
catalogs (`src/server/i18n/locales/{en,es,ht}.ts`).

- [ ] Serve one real URL per language edition rather than switching content on
  a single URL, and cross-link them with `hreflang`.
- [ ] Decide the default edition. Recommendation: **English by default, Spanish
  prominently linked.** The buyer's professional identity is teaching English,
  and both academies and investors read English; the learner-facing section and
  the product itself remain multilingual.
- [ ] Decide whether Haitian Creole ships with the first version or follows.
  Every paragraph of landing copy is paid for three times.

## 1.5 Share Previews (Open Graph)

For the next several months traffic will come from founder outreach and from
teachers pasting links into WhatsApp — not from search. The link preview card is
therefore a more valuable surface than any meta keyword.

- [ ] Add Open Graph and Twitter Card tags to `document-head.ejs`, which today
  carries only `title` and a favicon.
- [ ] Design a share image for the landing.
- [ ] Give **shared resources** their own preview (activity title, level, and
  who shared it). This is the card dozens of students actually see, and it is
  the closest thing the product has to an organic growth loop.
- [ ] Verify the rendered cards in WhatsApp, Messenger, and one desktop client.

## 1.6 Conversion Instrumentation

Two numbers, from day one, so the page can be fixed with evidence instead of
taste.

- [ ] Count landing visits that **open the example activity**. A low number
  means the hero is failing.
- [ ] Count those visitors who then **create an account**. A high first number
  with a low second means the problem is the product or the timing of the
  signup prompt, not the copy.
- [ ] Decide the measurement mechanism within the budget and the existing
  privacy posture — the app has client error telemetry
  (`src/server/telemetry/clientErrors.ts`) but no analytics.
- [ ] Connect these two counts to the pilot funnel instrumentation still open in
  [Roadmap V3](roadmap-v3.md), section 1.7, so the funnel starts at the first
  visit rather than at the first account.

## 1.7 Indexable Public Practice Content

Second track, deliberately after the landing ships. A new domain will not rank
for head terms; the realistic search surface is long-tail practice content, which
the product can already generate.

- [ ] Decide whether selected shared activities can be published as public,
  indexable pages (for example "English practice A2: making a clinic
  appointment"), and what the owner's consent for that looks like.
- [ ] Define the URL shape, metadata, and how such pages link back to the
  landing.
- [ ] Confirm this does not conflict with the resource sharing and consent rules
  already shipped.

---

# Part 2: Engineering And Quality

## 2.1 Landing Rendering And Performance

- [ ] Build the landing inside the existing stack: an EJS view, server-rendered,
  Bootstrap/Flatly primitives per
  [Visual Design](../design/visual-design.md), no new front-end framework and no
  new build target.
- [ ] Keep the page usable with no client JavaScript beyond what Bootstrap
  needs. It is the one page whose first paint is the product's first impression.
- [ ] Optimize the screenshots and the founder photo; a landing that loads
  slowly on a phone over mobile data fails with exactly the audience it targets.
- [ ] Decide whether the landing loads the app stylesheet and icon font at all,
  or a reduced subset.

## 2.2 Crawlability Infrastructure

None of this exists today.

- [ ] `meta name="description"` per page (`document-head.ejs` has no
  description).
- [ ] Canonical URLs.
- [ ] `robots.txt` — including which app routes must **not** be crawled.
- [ ] `sitemap.xml` covering the landing editions and, later, any public
  practice pages from 1.7.
- [ ] Decide the indexing policy for shared resource links: they are public by
  design but were not written to be found by strangers.

## 2.3 Landing Copy In The i18n Catalogs

- [ ] Decide where landing copy lives. The locale catalogs are typed and enforce
  key parity across `en`/`es`/`ht`, which is the right guarantee, but a landing
  adds many long prose strings to a file designed for UI labels. Choose
  deliberately between the shared catalogs and a landing-specific namespace, and
  record the reason.
- [ ] Ensure the language switcher on the landing changes the **edition URL**,
  not just the session language.

## 2.4 Tests And Regression Coverage

- [ ] Route-architecture coverage for the new root behavior: logged-out gets the
  landing, authenticated gets the app, deep links unaffected.
- [ ] EJS compile coverage for the new views and partials, per
  `ejs-view-structure` (nested include paths only fail at render time).
- [ ] i18n parity coverage for whatever key structure 2.3 chooses.
- [ ] Manual pass at mobile width, in both language editions.

## 2.5 Assets

- [ ] Real product screenshots for the hero and the four steps, from a seeded
  account with presentable content (not the founder's live data).
- [ ] Founder photo.
- [ ] Share image (1.5). `public/brand/` currently holds only a favicon and the
  panel logo.

---

# Open Decisions

These block implementation and are the founder's to make. Recommendations are
included where the roadmap has one.

1. **Default language edition.** Recommendation: English default, Spanish
   linked from the top.
2. **Does guest chat survive**, and at which URL?
3. **Which demo activity** is the public example, and who pays for the inference
   its evaluations consume?
4. **Analytics mechanism** for the two conversion counts, within budget and
   within the current privacy posture.
5. **Exact wording of the pilot and price statement** — this is the sentence
   most likely to be quoted back by a prospect.
6. **Founder section depth**: photo plus a short paragraph, or a fuller story.
7. **Whether Haitian Creole ships with version one** or follows.
8. **Whether shared resource pages should be indexable** (gates 1.7).
9. **Domain and URL shape** for the language editions.

---

# V3.5 Exit Criteria

- [ ] A logged-out visitor at the root sees the landing; an authenticated user
  is unaffected; every existing deep link still works.
- [ ] The example activity can be completed end to end from a phone, with no
  account, starting from the landing.
- [ ] Share previews render correctly in WhatsApp for both the landing and a
  shared activity.
- [ ] The landing exists in at least the two committed language editions, at
  real URLs, cross-linked with `hreflang`.
- [ ] `robots.txt`, `sitemap.xml`, meta descriptions, and canonicals are in
  place.
- [ ] The two conversion counts are recorded and can be read.
- [ ] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass, with
  regression coverage for the new routing.
- [ ] Deployed to production per the `versioning-and-releases` skill, as a `3.x`
  MINOR release.
