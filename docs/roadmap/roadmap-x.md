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
