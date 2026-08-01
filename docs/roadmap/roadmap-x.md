# Roadmap X — Deferred, Not Yet Scheduled

Date: 2026-07-31

Status: **Open holding area.** This document has no release attached to it and
no completion date. Items sit here until they are pulled into a numbered
roadmap or dropped.

## What This Document Is

Work that is **understood well enough to start** and has been **deliberately
postponed**. Each entry records what the work is, why it is not being done now,
and — the part that matters — **what would pull it into a real roadmap**.

Without that last line an entry is just a graveyard with better formatting.

## What It Is Not

- **Not the idea inbox.** [issues/incomming.md](../issues/incomming.md) holds
  raw ideas, often a paragraph, often unexamined. An idea graduates to this
  document once someone has thought it through: the problem is named, the shape
  of a solution is sketched, and the decision to defer is a decision rather
  than neglect.
- **Not a numbered roadmap.** `roadmap-vN.md` documents are release scope,
  tracked item by item to done. Nothing here is committed to any release.

## How An Entry Leaves

Either its trigger fires and it moves, in full, into the roadmap that owns that
release — or the reason it existed goes away and it is deleted, with a line
saying why. Entries do not rot here silently; if one is still untouched after
two roadmaps have shipped, that is evidence the trigger was wrong.

---

# X.1 Platform Metrics

Deferred 2026-07-31, at the founder's direction, while shipping the landing
page. The immediate trigger was the landing's two conversion counts
([Roadmap V3.5](roadmap-v3-5.md) §1.6), which turned out to be one instance of
something larger: **the platform emits events but cannot answer questions.**

## The Problem

Three separate pieces of work are blocked on the same missing capability, and
each has been written down as if it were its own problem:

1. **Landing conversion** ([Roadmap V3.5](roadmap-v3-5.md) §1.6). How many
   visitors open the example activity, and how many of those create an account.
   Without it, every change to the landing is a guess: a page nobody converts
   on and a page nobody *reaches* need opposite fixes, and the two are
   indistinguishable from the outside.
2. **The pilot funnel** ([Roadmap V3](roadmap-v3.md) §1.7 and its exit
   criteria). Guest → starts → completes → reviews → practices → the teacher
   opens the results. This is how the pilot gets measured at all; without it,
   "the pilot went well" is an anecdote.
3. **AI cost per cycle** (same section). What one complete teacher cycle costs
   in inference, per operation. It feeds the contribution margin the business
   documents need
   ([negocio-roadmap](../business/negocio-roadmap.md), Fase 5) and the question
   of whether the welcome credit actually covers a first full activity.

## What Exists Today

- **Structured JSON logs.** `services/logger.ts` writes one JSON line per
  event to stdout, and pm2 captures it to a file on the server. The event
  vocabulary is already decent — credit checkouts and exhaustion, LLM
  validation and repair, resource creation, CSRF failures, frontend errors.
- **Client error telemetry.** `telemetry/clientErrors.ts` collects browser
  errors over HTTP.
- **Learner progress events.** A real table, but it models the *learner's*
  progress for teaching purposes, not product usage.

What is missing is not instrumentation. It is that **nothing aggregates**.
Answering "how many teachers created an activity last week" means grepping pm2
log files by hand, on a server, with no history beyond log rotation.

## Shape Of A Solution

Three options, in increasing cost:

1. **A first-party event table.** A small table in the existing SQLite, an
   anonymous id in a first-party cookie to join steps, and a few named events.
   Costs nothing, adds no third party, needs no consent banner, and works
   without JavaScript — which matters because the landing deliberately ships
   none. Gives exactly the questions asked and nothing else: no referrers, no
   campaigns, no in-page behavior. Every new question is new code.
2. **Self-hosted analytics** (Plausible, Umami). Privacy-preserving, no
   cookies, real dashboards, referrers included. Costs a server or a
   subscription, and is one more thing for a solo operator to run.
3. **Third-party analytics** (GA4). Free and complete, but sends the behavior
   of teachers and adult learners to Google. The current privacy policy does
   not describe that, so it would have to change, and a consent banner on the
   landing is precisely what makes a first-time visitor leave.

Recommendation when this is picked up: **option 1 first**, scoped to the three
questions above rather than to "analytics" in general. Option 2 becomes worth
paying for on the day there is enough traffic to ask where it came from — which
would itself be good news.

## Why It Is Deferred

The landing shipped on 2026-07-31 and traffic today is whatever the founder
sends by hand. Instrumentation before there is anything to measure is work that
ages before it is used.

The cost of waiting is real and worth stating: the first visits are the most
informative, and they are not recoverable. This is a deliberate trade, not an
oversight.

## What Would Pull It In

Any one of these:

- The pilot starts with real teachers — measuring it is not optional, and
  [Roadmap V3](roadmap-v3.md) already says so.
- The landing gets traffic from anywhere other than the founder's own outreach.
- A decision has to be made about the landing that the two counts would settle
  — a rewrite of the hero, or moving where the account is asked for.

## Related

- [Roadmap V3.5 §1.6](roadmap-v3-5.md) — the landing counts, now pointing here.
- [Roadmap V3 §1.7](roadmap-v3.md) — pilot funnel and AI cost per cycle.

---

# X.2 A Blog

Raised by the founder on 2026-07-31, while the landing was being finished.

## The Idea

Publish articles on the site to attract visitors and build credibility with
teachers. Claude can draft them, which removes the constraint people usually
assume is the blocker.

## Why It Is Not The Blocker

Writing capacity is not what makes a blog work, and treating it as the
constraint is how blogs die. Two harder problems come first:

- **A blog with three posts and a last entry from eight months ago is worse
  than no blog.** It is the clearest public signal that a product is
  abandoned, and it sits on the same domain as the landing that says the
  product is being actively shaped with its pilot teachers.
- **Articles have to say something only this founder knows.** Generic,
  model-written SEO filler about "10 tips to learn English" is precisely what
  search engines have spent years demoting, and a working teacher recognises it
  in one paragraph. What would be worth reading is what the pilot produces:
  what actually happens when adult immigrant learners are given practice
  between classes, what teachers do with the results, what fails. That material
  does not exist yet.

## The Cheaper Version Of The Same Bet

[Roadmap V3.5 §1.7](roadmap-v3-5.md) closed the question of indexing
user-shared activities with a no, and pointed at the alternative: a **curated,
product-owned practice library** at its own slugged URLs. That is the same
acquisition play as a blog — long-tail search traffic on a new domain — but the
content is the product itself rather than writing about the product, it is
already half-built (ten hand-authored activities and a seeder), and it does not
rot when nobody publishes for a month.

If only one of the two gets done, it should probably be the library.

## Why It Is Deferred

It belongs to a marketing campaign, and there is no campaign: acquisition today
is the founder sending links to teachers he can reach. Marketing content before
there is a validated message is content written about a hypothesis.

## What Would Pull It In

- The pilot ends and leaves real material — what happened, with numbers.
- The positioning is settled with real teachers (see
  [Roadmap V3.5 §1.9](roadmap-v3-5.md)), so the articles argue a message that
  has been tested rather than one being guessed at.
- There is a way to tell whether any of it works, which is X.1.

---

# X.3 The Production Server's Node Version

Surfaced 2026-07-31 by the 3.5.0 deploy, which printed `EBADENGINE` warnings
during the remote install.

## The Problem

Production runs **Node v20.16.0** (npm 9.2.0), installed from the Ubuntu 24.10
archive as `/usr/bin/node` (package `nodejs 20.16.0+dfsg-1ubuntu1`). There is no
nvm on the box and the distro offers no newer candidate, so `apt upgrade` cannot
move it. Local development runs **Node v24.14.1**. Four majors apart, and
nothing in the repository says which one is correct: `misterf-web/package.json`
has no `engines` field.

**What is not the problem, despite how it reads.** The warnings name
`vite@8.0.13` and `rolldown@1.0.1`, both wanting `^20.19.0 || >=22.12.0`. Both
are devDependencies. `deploy.sh` builds locally (line 14) and the server runs
`npm ci --omit=dev`, so neither is installed there — confirmed on the server:
`node_modules` contains no `vite`, `rolldown`, or `typescript`. npm warns while
resolving the lockfile and then omits them. Today the warnings are noise.

The exposure is what happens next:

1. **A runtime dependency raises its floor.** The day a package under
   `dependencies` rather than `devDependencies` requires Node ≥ 20.19, `npm ci`
   on the server fails. That every case so far has been a devDependency is luck,
   not design — and with no `engines` field, nothing catches it locally, where
   Node 24 installs it happily.
2. **That failure lands with production already stopped.** `deploy.sh` runs
   `pm2 stop` *before* `npm ci`. A failed install therefore does not fall back
   to the previous version — it leaves the app down, and recovery is manual over
   SSH.
3. **Node 20 is out of support.** Its scheduled end-of-life was 2026-04-30, so
   the server has been running an unpatched runtime for roughly three months.
   Re-confirm the date against nodejs.org before scheduling the work.

## Shape Of A Solution

Three steps, in this order:

1. **Declare the floor.** Add an `engines` field to `misterf-web/package.json`
   naming the Node the project supports. Cheap, and it turns a deploy-time
   surprise into an install-time error — which also makes the next two steps
   verifiable rather than hopeful.
2. **Upgrade the server's Node.** Needs the NodeSource repository or nvm, since
   the Ubuntu archive is pinned at 20.16.0. Node 22 LTS is the conservative
   target; Node 24 matches local development and closes the gap entirely.
3. **Rebuild the native module.** `better-sqlite3` is compiled against exactly
   one ABI (`node_modules/better-sqlite3/build/Release/better_sqlite3.node`).
   Changing Node without reinstalling `node_modules` crash-loops the app with
   `ERR_DLOPEN_FAILED`, the same trap that has already bitten this project
   locally. The next deploy's `npm ci` rebuilds it, so the upgrade must not be
   left half-applied between deploys.

One more thing worth deciding in the same sitting, independent of the Node
version: **move `pm2 stop` after `npm ci` in `deploy.sh`.** It is a few lines
and it removes the failure mode in point 2 — a broken install becomes a failed
deploy instead of an outage. This is the cheapest risk reduction available here
and does not need to wait for the rest.

Before touching `apt` at all, check the OS. Ubuntu 24.10 is an interim release
with a nine-month support window, so it went end-of-life around 2025-07; an
EOL release's archives move to `old-releases.ubuntu.com`, which has to be sorted
out before any third-party repository will install cleanly. Whether the OS
itself deserves an upgrade is a larger question this work will run into.

## Why It Is Deferred

Nothing is broken. The warnings are cosmetic today, the deploy that produced
them succeeded, and the site is serving. Upgrading Node under a live
single-server deployment with a native SQLite binding is a real maintenance
window for a solo operator, and spending it the same week the landing ships
trades a working system for a tidier one.

The cost of waiting is that the trigger below is not something the founder
chooses — a dependency bump elsewhere decides it, and it decides it during a
deploy.

## What Would Pull It In

- Any dependency bump that raises a **runtime** package's engine floor above
  20.16. At that point this is not maintenance, it is a blocked deploy.
- A security advisory against Node 20 that reaches this application. There will
  be no patch for it: the runtime is past end-of-life.
- The next time `deploy.sh` is edited for any reason — the `pm2 stop` reordering
  should ride along rather than wait for the rest of this entry.
- Any maintenance window opened for another reason, since the risky part is the
  window, not the work.

## Related

- `deploy.sh` — the build/install split and the `pm2 stop` ordering.
- `.agents/skills/production-server-ops` — server topology and the deploy flow.
- `.agents/skills/versioning-and-releases` — how a release reaches production.

---

# X.4 A Share Card For The Landing

Raised by the founder on 2026-07-31, after the 3.5.0 deploy.

## The Problem

Not that the landing has no Open Graph card — it has one. `landing/handlers.ts`
sets `ogImageUrl` to `/public/brand/share-card.png`, and production serves it
(1200×630, 71 KB, HTTP 200). The problem is what that card is and what it fails
to distinguish.

**The image is the bare logo on white.** No words, no proposition, no
screenshot. `twitter:card` is `summary_large_image`, so it is rendered at full
width — and a small centred mark on an empty white field looks emptier the
bigger it is drawn, not more confident.

**It is the same file the shared resources use.** `resources/handlers.ts:631`
points at that identical PNG. So the product's home page and "a teacher shared
an activity with you" produce the same picture. Shared resources at least pass
`ogTitle: resource.title`, so their preview says something specific in text; the
landing has nothing to distinguish it.

**The title under the card is Spanish in every edition.** `og:title` comes from
the page `<title>`, which the landing builds as `Mister F · ${appDocumentTitle}`
— and `appDocumentTitle` is the hardcoded constant `'Mr. F, tutor de inglés'`
(`pages/shell.ts:16`). Verified: the English edition at `/` and the Haitian
Creole edition at `/ht` both share as *"Mister F · Mr. F, tutor de inglés"*.
The `og:description` is correctly translated; the title above it is not. For a
landing whose whole pitch is that it speaks the teacher's language, the share
preview says otherwise in the first line.

This matters more than it looks, because sharing a link is the *only*
acquisition channel the product has today: the founder sends the landing to
teachers by WhatsApp, and the card is what they see before deciding to tap.

## Shape Of A Solution

Three pieces, separable, in increasing cost:

1. **Translate the title.** Move `appDocumentTitle` into the i18n catalogs so
   `og:title` follows the edition. This is a small change, it is not really
   "a share card" work at all, and it fixes the most embarrassing part.
2. **A landing-specific card.** Its own image, distinct from the resource card,
   carrying the headline proposition in type rather than a logo alone — the
   landing's own hero sentence is the obvious candidate. Static PNG, authored
   once, no rendering pipeline.
3. **A per-edition card**, if step 1 proves the language of the preview matters:
   three PNGs and a locale-keyed `ogImageUrl`.

Option 2 does not need option 3 to be worth doing. Option 1 is worth doing even
if neither of the others ever happens.

## Why It Is Deferred

Producing the artwork is design work, not engineering, and the founder is the
only person who can decide what the card should say — the proposition is still
being tested with the first pilot teachers ([Roadmap V3.5
§1.9](roadmap-v3-5.md)). A card authored around a message that changes next
month is a card authored twice.

Item 1 is the exception and does not depend on any of that.

## What Would Pull It In

- The landing gets shared anywhere with a public audience rather than in direct
  one-to-one messages — a post, a directory, a teachers' group.
- The positioning settles, so there is a sentence worth setting in type.
- Item 1 alone, at any moment: it is a translation fix with no design attached
  and no reason to wait for the rest of this entry.

## Related

- `src/server/landing/handlers.ts` — `ogImageUrl`, `canonicalUrl`, `title`.
- `src/server/pages/shell.ts:16` — the hardcoded Spanish `appDocumentTitle`.
- `src/server/resources/handlers.ts:631` — the shared-resource card, same file.
- `views/partials/document-head.ejs` — how the tags are emitted.

