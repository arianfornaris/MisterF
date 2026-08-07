# Roadmap X — Deferred, Not Yet Scheduled

Date: 2026-07-31 (last updated: 2026-08-06)

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
2. **The pilot funnel** ([Roadmap V3](roadmap-v3.md) §1.6 and its exit
   criteria). Guest → starts → completes → reviews → practices → the teacher
   opens the results. This is how the pilot gets measured at all; without it,
   "the pilot went well" is an anecdote. *Closed in V3 on 2026-08-01 and left
   here:* the events are emitted, nothing aggregates them, and V3 stopped
   tracking a gap this document owns.
3. **AI cost per cycle** ([Roadmap V3](roadmap-v3.md) §1.7). What one complete
   teacher cycle costs in inference, per operation. *Closed in V3 on 2026-08-01
   (founder decision): inference is paid for by the credits users buy, so this
   is a pricing input rather than a pilot risk.* It stays here because the
   question does not go away, it only stops blocking: it feeds the contribution
   margin the business documents need
   ([negocio-roadmap](../business/negocio-roadmap.md), Fase 5), the question of
   whether the welcome credit actually covers a first full activity, and the
   "one package lasts about a month" sentence the landing cannot write yet
   ([Roadmap V3.5](roadmap-v3-5.md) §1.1).

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

# X.4 Native-Speaker Review Of The Public Copy

Deferred 2026-08-01, at the founder's direction, while closing
[Roadmap V3.5](roadmap-v3-5.md). Two items land here together — the English
native-speaker read (V3.5 §1.8) and the fluent Creole review (V3.5 §1.4) —
because they are the same problem twice: the landing page ships public prose in
two languages the founder does not write natively, and no amount of internal
reasoning substitutes for someone reading it.

## The Problem

The landing is the first thing a prospective teacher sees, and it exists in
three editions at real URLs.

- **English is the default edition**, chosen deliberately: the buyer's
  professional identity is teaching English, and both academies and investors
  read English. The founder has flagged commercial English as a personal
  development area
  ([Contexto del fundador](../business/contexto-del-fundador.md)), so the
  edition doing the most persuasive work is the one written with the least
  confidence. §1.8 also settled a naming rule — product = "Mister F", tutor =
  "Mr. F" — whose whole justification is that it reads as deliberate to a
  native speaker. That claim is untested.
- **The Creole edition is a careful machine translation**, and says so in its
  own catalog header. Haitian adults in South Florida are a named part of the
  pilot audience, so this is not a courtesy edition — it is copy a real reader
  will judge the product by.

Both are cheap to fix and impossible to fix alone.

## Why It Is Deferred

Neither is engineering work; both need a person the founder does not currently
have lined up. Holding a release for an unscheduled favor is how a shipped page
stops shipping. The cost of waiting is bounded and known: the copy is
serviceable, not embarrassing, and every claim in it has already been checked
against the product (the §1.1 corrections).

The risk it does not cover: prose that is *correct* but reads as translated is
exactly the kind of thing the author cannot see, and it is a trust signal for a
teacher evaluating an unknown tool.

## What Would Pull It In

- **The founder meets either reader.** For English, one hour from any native
  speaker who will read the page aloud; for Creole, one Haitian teacher or
  learner from the pilot audience. This is the likely trigger and it needs no
  planning — it is an errand, not a project.
- **The pilot reaches a Creole-speaking teacher or class.** At that point the
  Creole edition stops being precautionary and becomes the copy a real user
  reads, and the review should precede the introduction rather than follow it.
- **Any substantial rewrite of the landing copy** — for example if §1.9's
  positioning question comes back from the pilot with an answer that changes
  the hero. Re-reviewing after a rewrite is cheaper than reviewing twice.

## Related

- [Roadmap V3.5](roadmap-v3-5.md) §1.4 (Creole), §1.8 (English, and the
  "Mister F" / "Mr. F" rule).
- `src/server/i18n/locales/ht.ts` — the catalog header states the machine
  translation caveat.
- [Contexto del fundador](../business/contexto-del-fundador.md).

---

# X.5 Gemini Thought Signatures In The Tutor Tool Loop

Observed 2026-08-06 during the §1.10 live QA of the conversation-origin line,
and deferred the same day at the founder's direction. A practice-guide session's
opening turn failed and the learner got the generic "se me enredó la respuesta"
message. The cause was a provider rejection, not a bug in our parsing:

> `AI_APICallError: [Google AI Studio] Corrupted thought signature.`

## The Problem

Gemini 3 does not return its reasoning in the clear. It attaches an **encrypted
thought signature** to model turns — above all to function calls — and when the
client replays that history the signature must come back verbatim, attached to
the same part. A signature that arrives altered, truncated, or incomplete is
rejected with this error. Note what it says: not *missing*, **corrupted** — we
sent something back and it did not validate.

The only place this application replays a Gemini assistant turn is the
**multi-step tool loop inside one `generateText` call**
(`services/llmTutor/index.ts`, `stopWhen: stepCountIs(6)`): the model calls a
tool, the AI SDK appends the assistant message plus the tool result and calls
again. The two other candidates are ruled out — our own correction retry appends
only a *user* message (`appendStructuredCorrectionRequest`), and conversation
history from the database is plain text carrying no signatures.

What makes that loop suspect is `services/llmTutor/providers.ts`:

```ts
openrouter: { reasoning: { effort: …, exclude: true } }
```

`exclude: true` asks OpenRouter not to return reasoning blocks at all, while the
provider still reconstructs `reasoning_details` when sending the assistant turn
back, **dropping any `google-gemini-v1` entry that has no `signature`**
(`@openrouter/ai-sdk-provider@2.8.0`, `dist/index.js:3068`, which warns and
points at its own issues
[#418](https://github.com/OpenRouterTeam/ai-sdk-provider/issues/418) and
[#423](https://github.com/OpenRouterTeam/ai-sdk-provider/issues/423)). Excluding
the reasoning and then replaying its remains is a plausible way to send an
incomplete signature set.

That last step is a **hypothesis, not a reproduction.** What is established: the
error came from Google through OpenRouter, on `google/gemini-3.6-flash`, and it
is intermittent — two and a half minutes later the same model on the same code
path completed a turn that *did* call `update_conversation_title`. First
occurrence in the local logs; never seen in production traces so far.

## Why It Is Deferred

It is intermittent, it has been seen once, and the failure is already contained:
the credit gate and error handling turned it into a polite message rather than a
broken page. Chasing an unreproduced provider bug ahead of the pilot buys less
than the pilot does.

The cost of waiting is that the learner-visible symptom is indistinguishable
from the model genuinely failing, so if it becomes frequent nobody will
recognise it as this.

## What Would Pull It In

- **A second occurrence**, especially in production or during a teacher's
  session. One is noise; two is a defect with a user in front of it.
- **Any change to the tutor's tool set.** More tools means more steps that
  replay an assistant turn, which is exactly the exposure.
- **A `@openrouter/ai-sdk-provider` release that closes #418/#423** — then the
  fix is an upgrade rather than an investigation.

## When It Is Picked Up

Cheapest first:

1. Make the provider's own warning visible (`globalThis.AI_SDK_LOG_WARNINGS`),
   so the next occurrence says whether reasoning entries were dropped.
2. Stop sending `exclude: true` for Gemini 3.x ids. Reasoning tokens are billed
   either way — `exclude` only hides them from the response — so the cost is
   noise in the response, not money.
3. Retry once on `AI_APICallError`. The loop currently treats it as
   non-correctable and throws, so a transient provider failure always reaches
   the learner. This is worth doing on its own merits, independently of the
   diagnosis.

## Related

- `src/server/services/llmTutor/providers.ts` (`getProviderOptions`),
  `src/server/services/llmTutor/index.ts` (the agent loop).
- [Roadmap V3](roadmap-v3.md) §2.5 — the three-tier Google portfolio that put
  Gemini 3.x on every text path.

---

# X.6 An Owner Cannot Reopen Their Own Result

Found 2026-08-06 when the founder asked how to get back to a quiz's summary
after finishing it, and noted rather than fixed the same day. The answer turned
out to be that **there is no way** — not a hidden one, none.

## The Problem

Every resource page renders the "your attempts" list behind the same condition:

| Resource | Template | Gate |
| --- | --- | --- |
| Quiz | `views/quizzes-show.ejs:212` | `!canManageQuiz` |
| Roleplay | `views/roleplays-show.ejs:190` | `!canManageRoleplay` |
| Practice guide | `views/partials/practice-guides-view.ejs:189` | `!canManagePracticeGuide` |

So the list is shown to a **recipient** and hidden from the **owner**. That was
made deliberate and uniform in `6bf38dc9`, whose reasoning is recorded in the
templates: the owner's own runs are just test runs, they have the Participants
card for other people's, and "owners still reach their own chats from the
conversation list."

Two of those three reasons do not survive contact with the other surfaces:

- **The Participants card excludes the owner's own attempts by design**
  ([Roadmap V3](roadmap-v3.md) §1.6 — a `Probar` run is not participation), so
  it is not the fallback the comment assumes.
- **"The conversation list" only exists for practice guides.** A guide session
  *is* a conversation, so it appears in Recientes and, since 2026-08-06, names
  its guide at the top of the chat ([Roadmap V3.5](roadmap-v3-5.md) §1.10). A
  quiz or roleplay attempt is not a conversation and appears in no list
  anywhere.

`/progress` does not close the gap either: the events tab renders the evaluated
attempt's title, date, and summary, but the card is not a link
(`views/progress.ejs:227`). The result exists, is evaluated, is owned by the
person looking for it, and is reachable only by typing
`/quiz-attempts/<id>/result` with an id nothing on screen shows.

One indirect path does exist now, by accident of the origin work: if the owner
pressed **Practicar** on the result, that follow-up conversation is in Recientes
and its origin line links back to the result.

## Why It Is Deferred

The founder chose to note it rather than fix it mid-session, and it is not on
the pilot's critical path: the teacher-facing loop is about *participants'*
results, which works. The people it hits are authors reviewing their own test
run — today, mostly the founder.

The cost of waiting is small but real: it looks like data loss. The evaluation
is right there in the database and the app acts as if it never happened, which
is the same shape as the archived-resource gap that
[Roadmap V3](roadmap-v3.md) §2.4 closed.

## What Would Pull It In

- **A pilot teacher asks the same question the founder did.** It is the obvious
  question after taking your own quiz, and the answer is currently "you can't",
  which is a bad answer to give a teacher evaluating the tool.
- **Any work on `/progress`.** Making those cards link to their source is the
  same fix from the other end, and arguably the better one, since it covers
  every past attempt rather than one resource at a time.

## When It Is Picked Up

The data is already there: both handlers query the attempt list **with the
owner's own profile** (`quizzes/handlers.ts:1816`, `roleplays/handlers.ts:855`)
and hand it to the view, which then declines to render it. So the change is a
template condition and a label that distinguishes the author's own test runs
from participants' attempts — not a query, not a route, not a migration.

Scene media has no attempts and is unaffected.

## Related

- [Roadmap V3](roadmap-v3.md) §1.6 (participation excludes the owner), §2.4
  (the archived-resource precedent for a data-loss-shaped gap).
- [Roadmap V3.5](roadmap-v3-5.md) §1.10 (the origin line, and the one indirect
  path back).
