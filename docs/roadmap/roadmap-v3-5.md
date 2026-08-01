# Roadmap V3.5 — Public Landing Page

Date: 2026-07-30

Status: **In progress.** The first slice shipped to the branch on 2026-07-30:
the landing page renders at `/` for visitors, in English and Spanish, with the
crawler surfaces that did not exist before. What remains is mostly content and
measurement — the example activity, real screenshots, the share card, language
editions at real URLs, and the two conversion counts.

V3.5 is a single-purpose mini-roadmap: give
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

Shipped 2026-07-30 as `views/landing.ejs`, rendered by
`src/server/landing/handlers.ts`, with the copy in the `landing` namespace of
the `en` and `es` catalogs. Every section below exists; the two that depend on
assets or on a chosen demo activity carry their own note.

- [x] **Hero.** The approved promise as the headline, a one-line statement of
  who it is for ("independent teachers and tutors of adult learners — with your
  own material, no school platform, no imposed curriculum"), one primary call to
  action, one secondary. The hero image is the teacher's **results view**, not
  the chat: the results are the proof of the promise, and a chat screenshot is
  indistinguishable from every other AI product. **Shipped with a labelled
  example card**, not a screenshot — it carries an `Example` badge so it is
  never read as a real class. Replacing it with a real screenshot is item 2.5.
  **Corrected 2026-07-30 (founder caught it): the first version described a
  product surface that does not exist.** It called the card a "next-class
  report" — a phrase from the business documents, not a screen; the app calls
  it `Participación`, with a `Resumen de respuestas` and an on-demand
  `Resumen con IA`. It also showed "5 of 8 students completed it", implying a
  roster the product has no concept of, and "kept practicing: 3 students",
  which no owner-facing view exposes — the follow-up practice is stored against
  the student's own conversation and, per
  [Propuesta de MVP](../business/propuesta-mvp.md) §4.A, sharing it with the
  teacher is deliberately out of the MVP. The card now shows only what the
  participation page really renders: responded/evaluated counts, a question
  prompt with its correct tally, and the AI summary. The rule this leaves
  behind: **landing copy may promise outcomes, never name screens or metrics
  the product does not have.**
  A second pass on the same card, the same day, caught one more: the row was
  labelled "Most missed", and the app ranks nothing — the participation page
  lists every question in the quiz's own order with its correct/partial/
  to-improve tallies, and the teacher reads the pattern themselves. The row now
  mirrors one of those list items. Whether the app *should* surface the
  most-missed question is a real product question, logged in the idea inbox
  ([issues/incomming.md](../issues/incomming.md)); the landing may not claim it
  until it ships.
- [x] **The 30-second proof.** Done 2026-07-30: the section names the activity
  the visitor is about to open, with its level, and links to a real shared
  quiz. It renders only when the environment has seeded demos (see 1.2), so the
  page never ships a dead link.
- [x] **How it works**, in five steps: your material → review → share the link
  → the student gets feedback and practices → you see how the class did.
  Shipped with text and numbered cards; real screenshots are item 2.5. Step 5
  was reworded 2026-07-30 with the hero correction above.
- [x] **"What Mister F is not."** Three lines: not an LMS, no curriculum
  imposed, students install nothing and open a link. Differentiation for this
  category communicates better by negation than by a feature list.
- [x] **For self-directed learners.** One paragraph and its own call to action,
  pointing at `/chat`.
- [x] **Who is behind it.** Founder section with a real photo and name, the
  origin of the product (an immigrant adult learning English; the real "Mister
  F" is a career English teacher now teaching in Florida), and the registered
  entity, Little Software LLC, Florida
  ([Contexto del fundador](../business/contexto-del-fundador.md)). For a teacher
  evaluating an unknown tool this outweighs any feature claim. **Shipped
  without the photo** — that asset is item 2.5.
- [x] **Product stage: pilot open.** **Corrected 2026-07-31 (founder):
  "limited places" was false — the pilot is open to any teacher.** Manufactured
  scarcity was the one persuasion device on the page that was not backed by
  anything, and the call to action inherited it ("ask for a place"). The
  section now says the pilot started with teachers in South Florida and is open
  to whoever wants it, keeps the local anchor because it is true and credible,
  and swaps the call to action for an invitation to talk — which also surfaces
  a real advantage at this stage: the teacher would be talking to the person
  building the product. Original wording: "In pilot with teachers in South Florida.
  Limited places." Creates real (not manufactured) urgency, sets expectations
  that this is not a finished suite, and tells an investor the stage without a
  traction section.
- [ ] **Say how long a package lasts.** Proposed by the founder 2026-07-31:
  tell the reader that one USD 5 package typically covers a month of practice.
  It would be a strong sentence — "how fast does this drain?" is the question a
  buyer actually has — and it is **not writable yet**. The AI cost of one full
  cycle has never been measured; it is open in [Roadmap V3](roadmap-v3.md) §1.7,
  in that roadmap's exit criteria, and as the third question in
  [Roadmap X §X.1](roadmap-x.md). Writing it now would be the fourth time this
  page stated something the code cannot back, after the next-class report, the
  roster, and "free during the pilot". **When X.1 measures cost per cycle, this
  becomes writable and should be written.**
- [x] **Price, stated honestly.** **Rewritten 2026-07-30 — the first version was
  simply false, and the founder called it "absolutely wrong".** It said "free
  during the pilot", which describes no state the product has ever been in: the
  platform runs on credits, a new account starts with a welcome balance
  (`OPENROUTER_USER_KEY_LIMIT_USD`), and more credits are bought in one package
  of **200 credits for USD 5.00**
  (`src/server/payments/packages.ts`) — there is no subscription and no pilot
  tariff. The claim came from reading the pilot's *credit policy* item in
  [Roadmap V3](roadmap-v3.md) §1.7 as "the pilot is free", when what that item
  actually closed with is the opposite: the pilot runs on the ordinary
  self-serve model, unchanged. Saying "free" would have been the single most
  damaging sentence on the page — a teacher who signs up on that promise hits a
  purchase wall and stops trusting everything else. The section now says what
  is true: credits, a starting balance to explore, USD 5 packages after that,
  nothing charged until the user chooses to buy. The hero and closing footnote
  carried the same claim and were corrected with it.
  The rule this adds to the one from the hero card: **the landing may not state
  a commercial term that is not readable in the code or in an approved business
  document.**
- [x] **Data and privacy, in four lines.** Adults only; a student sees a notice
  before answering when the person who shared the activity will see the results;
  your material stays yours. The consent model already exists
  ([Propuesta de MVP](../business/propuesta-mvp.md), section 4.A) — saying so
  costs nothing and pre-empts the first objection any academy raises.
- [x] **FAQ, six real questions**, as a Bootstrap accordion. "Do my students need an account?",
  "Does it work with my PDF?", "Which languages?", "What if the AI gets
  something wrong?". Doubles as the objection page and as the only long-tail
  search surface the landing itself will have.
- [x] **Footer.** Terms, privacy, contact, and the tagline; the language
  switcher sits in the header instead.

Call-to-action discipline: **one** primary action, with the same wording,
repeated at most three times down the page.

## 1.2 The 30-Second Proof (Public Example Activity)

Shipped 2026-07-30 as a **pool of ten hand-authored activities**, one picked at
random per visit, rather than a single link. A pool spreads the first
impression across levels and situations, survives one activity going stale, and
lets a teacher reload to see the range.

- [x] Author the demo activities aimed at the pilot audience (adult, practical
  situations, A1–B2). Ten quizzes live in
  `src/server/landing/demoActivities.ts`: first day at a new job, bus and
  directions, clinic appointment, grocery store, routine and shifts, calling
  about an apartment, a problem with a bill, a job interview, a meeting at your
  child's school, and reporting a safety problem / asking for time off. Between
  them they cover all seven item kinds a landing visitor can meet, both
  multiple-choice selection modes, and sections.
  - Hand-authored fixtures, not generated: no inference cost, reviewed in a
    pull request, identical in every environment, and immune to model drift.
  - Quizzes only. A roleplay or practice guide spends inference on every turn,
    and this pool is opened by anonymous visitors; a quiz costs nothing until
    it is submitted, and submission is already gated behind signup.
  - No `quiz_translate_to_english` / `quiz_understand_in_spanish` items: both
    are Spanish-coupled, and a landing visitor has not chosen an instruction
    language.
- [x] Decide how the demo link is protected from drift. The activities live in
  a dedicated account (`LANDING_DEMO_EMAIL`, default `examples@misterf.us`)
  with no password and no identity row, so it cannot be signed into. Resource
  ids are derived from the fixture slug, which makes
  `npm run seed:landing-demos` idempotent: re-running updates content in place
  and every share URL already handed out keeps working. Their share links are
  set to **not** collect results, so no stranger's attempt lands in anyone's
  report.
- [x] Decide whether the demo attempt's evaluation consumes credits and whose.
  **Left exactly as it is (founder decision, 2026-07-30):** the visitor answers
  anonymously, creates an account to see the evaluation, and the welcome credit
  covers that first evaluation. Payment details are only ever needed to buy a
  second balance, so the demo has no anonymous inference cost at all.
- [ ] Verify the full guest path on a phone, end to end, against production
  once seeded: open → answer → create an account → evaluation. Locally the
  anonymous half is verified (open, all item kinds render and accept answers);
  the account half needs a real signup.

## 1.3 Root Routing And The Guest Experience

Today `/` is served by `chatRouter.get('/', renderChatPage)` for everyone, and
logged-out visitors get a chat composer with `guestInitialGreeting`.

- [x] Route `/` to the landing for unauthenticated requests and keep the app
  entry unchanged for authenticated sessions. Done 2026-07-30: `landingRouter`
  is registered before `chatRouter` and calls `next()` whenever a session
  exists, so a signed-in user (including one with an unverified email, who
  belongs in the app with its verification notice) still lands in the app.
- [x] Decide the fate of guest chat: **kept**, at `/chat`, linked from the
  landing's learner section. A visitor can still talk to Mr. F with no account;
  only the URL changed.
- [x] Preserve every existing deep link. Nothing else was touched — the landing
  only claims `/` for sessionless requests — and the route smoke tests still
  pass.
- [x] Make sure the post-signup destination is still the app, not the landing.
- [x] **Send the primary call to action where it says it goes.** Founder report,
  2026-07-30: "Create your first activity" led to signup and then dropped the
  new user on `/`, the tutor chat — the app, but not what the button promised,
  and the worst possible first minute for a teacher who came to build
  something. Fixed by pointing the CTA at
  `/signup?returnTo=%2Fquizzes%2Fnew`. Nothing new had to be built: `returnTo`
  already survives the signup form, Google OAuth, email verification, and
  profile onboarding, and `renderSignup` passes an already-signed-in visitor
  straight through. Two route tests pin it — the CTA carries the parameter, and
  a session hitting that URL is redirected to the editor.
  Unchanged: auth redirects to `/`, which resolves to the app once a session
  exists.

## 1.4 Language Editions And hreflang

The app already ships three instruction languages with typed, parity-enforced
catalogs (`src/server/i18n/locales/{en,es,ht}.ts`).

**Done 2026-07-31.** The first slice reused the app's `?lang=` switcher, which
stored a cookie and redirected: one URL, content varying by cookie, fine for a
human and useless for a crawler.

- [x] Serve one real URL per language edition rather than switching content on
  a single URL, and cross-link them with `hreflang`. Shape: English keeps `/`
  (the URL people type, share, and print, so it renders instead of
  redirecting), Spanish is `/es`, Creole is `/ht`, and `/en` exists for the
  switcher while declaring `/` as its canonical so the two never compete for
  the same index entry. On an edition path the locale is forced over both the
  cookie and `Accept-Language` — that is what makes it a page rather than a
  cookie state — and the cookie is written so the app the visitor signs into
  speaks the language the landing did. The root still negotiates and says which
  edition it served through its canonical, with `Vary: Accept-Language`.
  Reciprocal `hreflang` (plus `x-default`) on all four URLs, and the sitemap
  carries `xhtml:link` alternates. A signed-in visitor hitting an edition path
  is redirected to `/`, the app.
  Two defects found while building it, both silent:
  1. **The root stopped being the landing entirely.** `renderLanding` grew a
     fourth parameter, and Express infers handler *kind* from arity — a
     four-argument function is an error handler, skipped during normal routing.
     The root fell through to the chat page with a 200 and nothing in the logs.
     The exported handlers are now deliberately three-argument wrappers, with a
     comment saying why. The existing route test would have caught this
     immediately; it was found in the browser because the suite had not been
     re-run after the rewrite.
  2. **A crawler would have been served Spanish at `/`.** Express's
     `acceptsLanguages` returns the first supported locale when a request
     states no preference — `es`, purely from key order in the language
     registry — and crawlers routinely send no `Accept-Language` header or the
     wildcard `*`. The root would have canonicalised to `/es`, leaving the
     chain `/en` → `/` → `/es` and English effectively unindexed. No stated
     preference now means the default edition, wildcard included.
- [x] Decide the default edition: **English by default, Spanish one click
  away.** The buyer's professional identity is teaching English, and both
  academies and investors read English; the learner-facing section and the
  product itself remain multilingual. Implemented 2026-07-30 through the app's
  existing locale resolution (`defaultLocale` is already `en`).
- [x] Decide whether Haitian Creole ships with the first version or follows.
  **Shipped 2026-07-30.** It was briefly left out on the argument that a
  machine translation of marketing prose reads as untrustworthy to the very
  audience it is trying to convince. That argument does not survive contact
  with the rest of the product: the `ht` catalog already serves the whole
  application UI, the privacy policy, and the terms as a careful machine
  translation, at higher stakes than a landing page. Applying a stricter
  standard here was inconsistent, and the cost was real — see the item below.
- [x] **Selecting Kreyòl appeared to do nothing** (founder observation,
  2026-07-30). The pill highlighted, the page reloaded, and the copy stayed in
  English, which reads as a broken switcher rather than as a deliberate gap.
  Fixed the same day by translating the `landing` namespace into `ht` rather
  than by hiding the pill: Haitian adults in South Florida are a named part of
  the pilot audience, and a Creole speaker opening a link forwarded by their
  teacher should see their own language. A route test now asserts the page
  really changes language, so the failure mode cannot come back silently.
- [ ] Have a fluent Creole speaker review the landing copy. Same standing
  caveat as the legal pages: the catalog is a careful machine translation and
  says so in its own header comment.

## 1.5 Share Previews (Open Graph)

For the next several months traffic will come from founder outreach and from
teachers pasting links into WhatsApp — not from search. The link preview card is
therefore a more valuable surface than any meta keyword.

- [x] Add Open Graph and Twitter Card tags to `document-head.ejs`, which
  carried only `title` and a favicon. Done 2026-07-30: `og:title`, `og:url`,
  `og:type`, `og:site_name`, `og:description`, `twitter:card`, plus
  `meta description` and `canonical`. All optional and read through `locals`,
  so the app pages that include the partial without them are unaffected.
- [~] Design a share image for the landing. **Placeholder shipped 2026-07-30**
  at `public/brand/share-card.png`: 1200×630, the Mister F logo centred on
  white, composed from `design/MisterF-v2.png`. Deliberately open — a card that
  says what the product does, or shows the report, would convert better than a
  bare logo, and this is the image dozens of students see when a teacher
  forwards a link.

  Reopened by the founder 2026-07-31, after 3.5.0. Two things the placeholder
  makes concrete, now that the resource card next to it is finished:

  - **It is the same file both surfaces use.** `resources/handlers.ts:631`
    points at that identical PNG, so the product's home page and "a teacher
    shared an activity with you" produce the same picture. The resource card at
    least carries a specific title and description in text; the landing has
    nothing to tell it apart. `twitter:card` is `summary_large_image`, so the
    image renders full width — a small centred mark on an empty white field
    looks emptier the larger it is drawn.
  - Sharing a link is the only acquisition channel the product has today, which
    is what makes this worth more than its size suggests.

- [ ] **Translate the page title.** `og:title` comes from the page `<title>`,
  which the landing builds as `Mister F · ${appDocumentTitle}` — and
  `appDocumentTitle` is a hardcoded Spanish constant, `'Mr. F, tutor de inglés'`
  (`pages/shell.ts:16`). Verified 2026-07-31: the English edition at `/` and the
  Haitian Creole edition at `/ht` both share as *"Mister F · Mr. F, tutor de
  inglés"*. The `og:description` is translated correctly; the title above it is
  not. For a landing whose pitch is that it speaks the teacher's language, the
  preview says otherwise in its first line.

  This is a translation fix with no design attached — move the constant into the
  i18n catalogs — and it should not wait for the image above. It also affects
  the browser tab title on every page, not only the share card.
- [x] Give **shared resources** their own preview. Done 2026-07-31: the card
  carries the activity title, and a description of the form
  `Quiz · A2 — <the activity's own description>`, falling back to a translated
  sentence when the resource has none. This is the card a whole class sees when
  a teacher pastes the link, so it is the closest thing the product has to an
  organic growth loop.
  It also corrected the mechanism used to keep those pages out of search.
  `robots.txt` was disallowing `/resources/shared/`, which does not mean "do
  not index" — it means "do not crawl", so the page is never fetched, a
  `noindex` tag there could never be read, and some link-preview bots refuse a
  disallowed URL outright, which would have left the card blank. The pages are
  now crawlable and carry `noindex, follow`. The policy is unchanged — these
  links stay out of the index — but it is now expressed the way it can actually
  be honored, and §1.7 becomes a one-line change if the answer there is yes.
- [x] Verify the rendered cards in WhatsApp. Founder-confirmed 2026-07-31: the
  links were pasted and the previews render.

## 1.6 Conversion Instrumentation — moved to Roadmap X

**Deferred 2026-07-31 at the founder's direction, to
[Roadmap X §X.1](roadmap-x.md).** The two counts this section asked for — how
many visitors open the example activity, and how many of those create an
account — turned out to be one instance of a larger gap: the platform emits
structured events but nothing aggregates them, which also blocks the pilot
funnel and the AI-cost-per-cycle work in [Roadmap V3](roadmap-v3.md) §1.7.
Building a measurement path for the landing alone would have been the third
place the same missing capability was worked around.

The trade is stated in Roadmap X and is deliberate: the first visits are the
most informative and are not recoverable, but instrumentation built before
there is traffic ages before it is used.

## 1.7 Indexable Public Practice Content — dropped

**Closed 2026-07-31 (founder decision): not needed for now, and the question as
originally framed was the wrong one.**

It asked whether *shared user activities* could be made indexable. They should
not be, and not merely for now:

- **It would pollute the report the product promises.** A share link that
  collects results turns every stranger arriving from a search engine into an
  attempt row on that teacher's participation page — inside the very report
  sold as "know how your class did".
- **The material is not ours to republish.** Teachers paste their own content,
  some of it from published textbooks. Indexing it republishes it at scale
  under this domain, across hundreds of activities nobody will ever read.
- **A teacher shared with their class, not with the internet.** The link is
  technically public and socially private; indexing changes a contract the
  owner never agreed to.

If long-tail search is wanted later, the answer is **product-owned content**,
not user content: a curated library published deliberately, at its own slugged
URLs. The mechanism already exists — the ten hand-authored example activities
and their seeder — so growing it is a content exercise, not an engineering one.
That would be a new item in its own roadmap, not this one.

Shared resource pages keep `noindex, follow` (see §2.2), which is now the
permanent posture rather than a holding position.

---

## 1.8 "Mister F" Or "Mr. F" In English Copy

Raised by the founder on 2026-07-30 after reading the English landing: the page
says "Mister F" many times, and it is not obvious that spelling it out is
natural in English, where the honorific is normally abbreviated.

Today both forms are in use, and arguably for different jobs:

- **Mister F** is the product and the company-facing name — the repository, the
  documentation, the brand mark, the page title.
- **Mr. F** is the tutor persona the learner talks to — `appDocumentTitle` is
  `Mr. F, tutor de inglés`, the side panel says `Mr. F`, and the landing's
  learner call to action is "Practice with Mr. F".

So the landing is already following a rule; what is untested is whether that
rule reads as deliberate or as inconsistent to a native speaker seeing the page
for the first time.

- [x] Decide the rule and write it down. **Decided 2026-07-30: keep the split**
  — product = "Mister F", tutor = "Mr. F" — and make it legible once instead of
  leaving the reader to infer it. Spelling out "Mister" is not an error in
  English; it is a brand device with good precedent (Mister Rogers, Mister
  Softee) and it reads warm and neighborly, which is the register this product
  wants. The problem was never the spelling, it was showing two forms and
  explaining neither. The founder section now closes the loop in one clause:
  the real Mister F is the founder's father, "and the tutor your students
  practice with carries his name: Mr. F".
- [x] Check the English copy sentence by sentence for places where the *tutor*
  is meant but the product name is used. Fixed 2026-07-30: step 1 said
  "Mister F drafts the activity" (the drafting is the tutor's job — the name is
  now dropped entirely), and the learner section put both forms in consecutive
  sentences, the one spot where the split reads as sloppiness rather than as a
  distinction.
- [x] Count the repetitions regardless. Was **9 "Mister F" to 2 "Mr. F"** in
  roughly 700 words. Now **5 to 3**, with the product named where it belongs —
  the meta description, the "What Mister F is not" heading, and the founder
  section — and "it" carrying the rest. Applied to all three locales.
- [ ] Have a native English speaker read the page once this is settled — the
  cheapest possible review, and the founder has flagged commercial English as a
  development area
  ([Contexto del fundador](../business/contexto-del-fundador.md)).

The rule applies to all three editions and is already reflected in `en`, `es`,
and `ht`. What remains is the native-speaker read, which no amount of internal
reasoning replaces.

## 1.9 Positioning: One Workflow, Or The Teacher's Own

Raised by the founder on 2026-07-31, reading the shipped page.

The headline promise — *"turn every assignment into guided practice, and reach
your next class knowing what to review"* — describes **homework after class**.
The product does not require that. A teacher can just as well send an activity
*before* a lesson to find out where the difficulty will be, or as preparation,
or as a warm-up, or as something a student does on their own between sessions.
The founder's concern is precise: a teacher whose way of working is not the one
described may conclude on the first screen that this is not for them, and
leave.

The concern is right about the risk and, I think, wrong about the fix.

**Why the headline should not broaden.** A narrow promise is what makes the
page land; "use it however you like" sells to nobody, because it asks the
reader to do the imagining. The approved positioning
([Investigación de la competencia](../business/investigacion-de-la-competencia.md)
§13) is deliberately one sentence about one cycle, and V3 built exactly that
cycle. Trading it for flexibility would cost more readers than it saves.

**Where the fix belongs.** Low on the page, where a skeptical reader is already
hunting for reasons it does not fit them — the FAQ, which exists to answer
objections, and possibly one clause in step 1. The cost is a few lines; the
hero is untouched.

- [ ] Add an FAQ entry along the lines of *"Do I have to use it after class?"*
  — no: before a lesson to see where the difficulty will be, after it to
  practice what went wrong, or between sessions. One answer, three uses named
  explicitly.
- [ ] Reconsider step 1, which says "the homework you had already planned" and
  quietly assumes the after-class direction. "Your text, your topic, or the
  homework you had planned" already almost covers it.
- [ ] Keep the headline as approved, and treat the whole question as a
  hypothesis for the pilot rather than a copy decision. The business research
  is explicit that no message should be adopted before it is tested with real
  teachers — and the teachers in the pilot are the only people who can say
  whether the framing helped them or boxed them in. **This item should not be
  closed by reasoning; it should be closed by asking them.**

---

## 1.10 "Recientes" As A Timeline, Not Just A Chat List — to evaluate

Raised by the founder on 2026-07-31. **This is an evaluation, not a decision.**

Note the scope tension before anything else: this is authenticated app chrome,
and the Out Of Scope section above says in as many words that V3.5 must not
quietly become the authenticated-home work. It is recorded here at the founder's
direction; if it grows past an evaluation it belongs with
[Home Start Experience](../features/home-start-experience.md) and
[Home Suggestions Tracker](../issues/home-suggestions-tracker.md), which already
own the personalized start surface.

### What The Panel Shows Today

`panel-recents` renders `listConversationsForProfile(userId, profileId)` —
every conversation for the active profile, newest first, unlimited. So the
question "does it only show chats with Mr. F?" has a more interesting answer
than it looks:

- **Practice guides already appear.** The `conversations` table carries a
  `practice_guide_id`, and a learner practising a guide is having a
  conversation. Those rows are already in the list — just labelled and iconed
  exactly like an open-ended tutor chat, with nothing saying which guide they
  came from.
- **Quizzes and roleplays never appear.** Their attempts live in
  `quiz_attempts` and `roleplay_attempts`, which the panel does not read.

So the gap is not "resources are missing" — it is that one of the three formats
leaks in undifferentiated while the other two are invisible.

### The Timeline Already Exists

`learner_progress_events` is profile-scoped and already records exactly what a
timeline would need: a stable `sourceType` and `sourceId`, a title, a summary,
and a details JSON carrying `resourceId` and `resourceType`, written for every
evaluated attempt and tutor report (`.agents/skills/learner-progress-events`).
It is what `/progress` renders, and `/progress` is already a nav link in this
same panel, two rows above Recientes.

That reframes the question. It is not "should we build a timeline" — one exists.
It is **whether the sidebar should show it, and what that does to the two
surfaces.**

### The Real Question To Answer

Recientes is a *navigation* list: things you can reopen and act on, with a
per-row menu offering rename, finalize-and-summarize, and delete. Progress
events are a *record*: things that already happened and were evaluated.

Merging them mixes those two jobs, and the seams show immediately — none of
rename, finalize, or delete means anything for a completed quiz attempt. So the
evaluation has to answer:

- [ ] Does a learner actually want one merged stream, or do they want to resume
  a chat quickly? Those pull in opposite directions: a timeline that includes
  every completed attempt pushes the resumable conversation further down a list
  that is already unlimited.
- [ ] If merged, what are the row actions for a non-conversation entry, and does
  a quiz attempt row open the result page or the resource?
- [ ] What happens to `/progress` if the sidebar shows the same events? Two
  surfaces for one record is a maintenance cost and a confusion, and the answer
  might be that Recientes stays a chat list precisely *because* `/progress`
  exists.
- [ ] The cheapest partial move, worth considering on its own: **mark the guide
  conversations that are already there** as belonging to a guide. That fixes a
  real inconsistency today, needs no new query, and does not commit to the
  larger question.

### How To Close It

With a pilot learner, not by reasoning. The panel's job depends on whether
people come back to resume something or to look at what they have done, and
that is observable. This is also one of the things
[Roadmap X §X.1](roadmap-x.md) would answer, and cannot answer today.

---

# Part 2: Engineering And Quality

## 2.1 Landing Rendering And Performance

- [x] Build the landing inside the existing stack: an EJS view, server-rendered,
  no new front-end framework and no new build target. Done 2026-07-30.
  **Rebuilt on its own visual system the same day (founder direction): the
  landing is exempt from [Visual Design](../design/visual-design.md), which
  governs the application.** It ships `public/landing.css` and nothing else —
  no Bootswatch, no icon font, no app stylesheet, no script. The rationale is
  that a marketing page and a working tool have different jobs: the app should
  look native to its theme, the landing should look like it was designed. The
  palette is taken from the brand mark (`rgb(0, 73, 106)`) over warm paper with
  a single terracotta accent, and headlines use Literata, the serif the product
  already uses for learning content. Icons are inline SVG.
- [x] Keep the page usable with no client JavaScript. **Zero scripts**: the FAQ
  is native `<details>`, and a route test asserts no `<script>` and no
  Bootstrap reach the page.
- [ ] Optimize the screenshots and the founder photo; a landing that loads
  slowly on a phone over mobile data fails with exactly the audience it targets.
  Nothing to optimize yet — the page ships with no photographic assets.
- [x] Decide whether the landing loads the app stylesheet and icon font at all.
  **Neither.** `document-head.ejs` takes `includeAppStyles: false` plus a
  `pageStylesheet`, so a public page can bring its own CSS; the landing is the
  only caller today. Payload: ~17 KB of HTML and ~15 KB of CSS, uncompressed.

## 2.2 Crawlability Infrastructure

Done 2026-07-30. `robots.txt` and `sitemap.xml` are routes rather than files
under `public/`, which is mounted at `/public` and cannot answer the root paths
crawlers ask for.

- [x] `meta name="description"` per page.
- [x] Canonical URLs.
- [x] `robots.txt` — an allowlist (`/`, `/login`, `/signup`, `/privacy`,
  `/terms`) with everything else disallowed.
- [x] `sitemap.xml` covering the landing and the legal pages. Language editions
  join it when 1.4 gives them URLs; public practice pages when 1.7 decides.
- [x] Decide the indexing policy for shared resource links: **closed for now.**
  They are public by design but were written to be opened by a student who was
  given the link, not found by a stranger. Opening them is the explicit,
  separate decision in 1.7.

## 2.3 Landing Copy In The i18n Catalogs

- [x] Decide where landing copy lives. **The shared catalogs, under a `landing`
  namespace.** Decided 2026-07-30: the `t()` helper, the locale middleware, and
  the switcher all work there for free, and the namespace keeps the prose in one
  block instead of scattered among UI labels. The catalogs are not structurally
  parity-enforced (`LocaleCatalog` is an index signature), which is what makes
  the deliberate `ht` omission possible without breaking the build. The keys are
  server-rendered only, so they never reach the client catalog.
- [x] Ensure the language switcher on the landing changes the **edition URL**,
  not just the session language. Done 2026-07-31 with §1.4: the switcher links
  to `/en`, `/es`, and `/ht` with `hreflang` on each anchor, so it is something
  a crawler can follow and a visitor can bookmark or forward. Blocked on 1.4; today it uses the app's
  `?lang=` cookie switcher.

## 2.4 Tests And Regression Coverage

- [x] Route coverage for the new root behavior, in `tests/server/landing.test.ts`
  (9 cases): landing for anonymous, app for a session, `/chat` for guest chat,
  both locales plus the `ht` fallback, the meta/canonical/Open Graph tags, the
  demo call to action hidden while unconfigured, `robots.txt`, and `sitemap.xml`.
- [x] EJS render coverage: the tests fetch the page, so a bad include path fails
  the suite rather than production.
- [x] A guard test for the standalone stylesheet decision: the landing must
  keep shipping no Bootstrap, no icon font, and no script.
- [x] Manual pass at mobile width in both editions, repeated after the visual
  rebuild. No horizontal scroll at 375px in either language; the sticky header
  swaps language endonyms for two-letter codes under 560px so it stays one row
  even in Spanish, where `Iniciar sesión` was reaching the edge.

## 2.5 Assets

- [~] Real product screenshots for the hero and the steps. The seeded demo
  activities (1.2) are now the presentable content to shoot against, and the
  **student-side** screens are reachable with no account. The **teacher-side**
  screens — authoring, sharing, and the next-class report — need an
  authenticated session and, for the report, at least two evaluated attempts.
  Decide who captures those and against which account.
- [x] ~~Founder photo.~~ Dropped 2026-07-31 at the founder's request. The
  section never depended on it: what makes it work is a named person, a
  registered company, and the origin story. A photo would have been one more
  signal, not the one carrying the weight.
- [x] Share image (1.5), as a logo placeholder. Replacing it stays open there.

---

# Open Decisions

These block implementation and are the founder's to make. Recommendations are
included where the roadmap has one.

1. ~~**Default language edition.**~~ Decided 2026-07-30: English default,
   Spanish and Creole one click away in the header, all three fully
   translated.
2. ~~**Does guest chat survive**, and at which URL?~~ Decided 2026-07-30: yes,
   at `/chat`.
3. ~~**Which demo activity** is the public example, and who pays for the
   inference its evaluations consume?~~ Decided 2026-07-30: a pool of ten
   hand-authored quizzes, picked at random; the visitor's own welcome credit
   pays for the evaluation after they sign up, so nothing changes in the
   payment flow.
4. **Analytics mechanism** for the two conversion counts, within budget and
   within the current privacy posture.
5. **Exact wording of the pilot and price statement** — this is the sentence
   most likely to be quoted back by a prospect, and the one the page has
   already got wrong once (see 1.1). Open sub-questions: whether to name the
   welcome balance in a concrete unit a teacher can picture ("enough for one
   full activity" rather than a credit count or a dollar figure), and whether
   the pilot should carry any commercial term at all beyond the ordinary
   self-serve model — [Roadmap V3](roadmap-v3.md) §1.7 closed that it should
   not, and the landing must not re-open it by accident.
6. **Founder section depth**: photo plus a short paragraph, or a fuller story.
7. ~~**What the Creole pill does until the landing is translated**~~ (section
   1.4). Decided 2026-07-30: translate it, do not hide it. What remains is a
   fluent-speaker review of the Creole copy, tracked in 1.4.
8. **Whether shared resource pages should be indexable** (gates 1.7). Blocked
   in `robots.txt` until this is answered.
9. **Domain and URL shape** for the language editions.
10. **"Mister F" or "Mr. F" in English copy** (section 1.8), and how often the
    page should name itself at all.

---

# V3.5 Exit Criteria

- [x] A logged-out visitor at the root sees the landing; an authenticated user
  is unaffected; every existing deep link still works. Verified 2026-07-30 by
  the route tests and a click-through on the local server.
- [~] The example activity can be completed end to end from a phone, starting
  from the landing. The anonymous half works; the signup-to-evaluation half
  still needs a real run (1.2).
- [x] Share previews render correctly in WhatsApp for both the landing and a
  shared activity. Founder-confirmed 2026-07-31. The landing has a placeholder card; a shared activity has no
  preview of its own yet (1.5).
- [x] The landing exists in all three language editions, at real URLs,
  cross-linked with `hreflang`. Done 2026-07-31.
- [x] `robots.txt`, `sitemap.xml`, meta descriptions, and canonicals are in
  place. Done 2026-07-30.
- [x] ~~The two conversion counts are recorded and can be read.~~ Removed from
  V3.5 on 2026-07-31: the work moved to [Roadmap X §X.1](roadmap-x.md), so it
  can no longer gate this release. V3.5 ships measured by nothing, which is a
  known and accepted cost.
- [x] The example activities are seeded **in production**. Done 2026-07-31,
  right after the 3.3.0 deploy: all ten created and share-linked, and the
  landing is serving one at random. A deploy does not carry content, so the
  seeder must be re-run after any change to the fixtures. Steps and the two
  ways to get it wrong are in the `production-server-ops` skill, "Seeding
  Content After A Deploy".
- [x] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass, with
  regression coverage for the new routing. 332 tests green at the 3.3.0
  release. Green as of 2026-07-30 (321 tests);
  re-check before the release.
- [x] Deployed to production per the `versioning-and-releases` skill, as a
  `3.x` MINOR release. **Shipped 2026-07-31 as `3.3.0`**; `/health` confirms
  it, and the three language editions answer 200 in their own language.
