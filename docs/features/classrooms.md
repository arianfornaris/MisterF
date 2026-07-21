# Classrooms, Guides, And The Sharing Primitive

Date: 2026-07-18 (last updated: 2026-07-18)

Status: **North-star design — stages 1–2 in the V3 MVP, the rest deferred.**
Captured from founder direction on 2026-07-18 during the Teacher Pilot MVP
discussion, then refined the same day into the unifying formula below. The
committed slice lives in [Roadmap V3](../roadmap/roadmap-v3.md) §1.6 and
[Propuesta de MVP](../business/propuesta-mvp.md); everything else is promoted
only when pilot evidence demands it. Supersedes and expands the "Capa de aula
(classroom)" entry in the idea inbox
([issues/incomming.md](../issues/incomming.md)).

## The Unifying Primitive

Mister F must serve both the classroom (teacher–students) and the solo
self-learner (a "ChatGPT with steroids" experience: dedicated UI, games,
guided practice) without becoming two products. The formula is to separate
the **relationship** from the **container**. What the teacher with a class,
the parent with a child, the private tutor with one student, and the
self-learner all share is not a classroom — it is one primitive:

> **Someone who guides creates/shares an activity → someone who practices
> completes it → the result flows back to the one who shared it.**

- Teacher → students: shares with twenty people.
- Parent → child: shares with one. No roster, no organization.
- Private tutor → student: identical.
- Self-learner: guide and practicer are the same person; the "teacher
  report" collapses into their own progress, which already exists.

The classroom is not a new relationship — it is an **organizational lens**
over this primitive (grouping people, packaging activities, due dates) for
guides with many practicers. Nothing pedagogical lives in the classroom;
everything pedagogical lives in the activity, the evaluation, and the
follow-up practice.

Design consequences:

- **No account-level roles.** Every account can learn and every account can
  guide. A parent who studies English themselves *and* assigns practice to
  their child is the acid test; hard roles break it. (Decided 2026-07-18;
  consistent with the MVP's no-profiles decision.)
- **The guide's dashboard emerges without a classroom.** An aggregated
  "Shared by me" view (my shared activities + who completed them) already
  serves the parent, the tutor, and the small teacher.
- **The two worlds feed each other.** The follow-up practice of an assigned
  task *is* the self-learning experience — same tutor, same resources, same
  progress. The business hypothesis (invited students continue alone) is
  structural, not a bridge to build.

## One Primitive, Every Pedagogical Resource

Added 2026-07-18 (founder direction): the feedback loop is not quiz-specific
— it applies to every pedagogical resource. Sharing already exists for all
three today (`share/profile` → `shared/:shareId/start` for quizzes, practice
guides, and roleplays); what each type needs is its **result artifact**, the
thing that flows back to the sharer:

| Resource | Result artifact | Notes |
| --- | --- | --- |
| Quiz | Evaluated attempt | Objective and aggregable; V3 MVP scope. |
| Roleplay | Attempt evaluation + transcript | `finish`/`result` already exist; nearly symmetric with quizzes. The learner's production *is* the conversation with the character, so the transcript is part of the task. |
| Practice guide | The session's finalized report — not the raw chat | A tutor conversation feels private in a way a task does not; the existing finalized-report artifact is what returns. |

The governing rule generalizes the MVP consent decision: **disclosure
follows assignment, not resource type.** If the guide assigned the activity,
its result artifact returns by design (disclosed at start); the learner's
free practice stays theirs, shared only by opt-in.

The return path is also **the sharer's choice** (founder decision,
2026-07-20): each share carries a results-feedback flag — on for "this is an
assignment, results come back to me", off for sharing the resource as plain
content. Attempts snapshot the flag at start, so consent (the learner's
notice) and collection (the sharer's flag) are always frozen together on the
attempt.

Scope discipline: the V3 MVP returns results for quizzes only, but the
cross-cutting pieces — disclosure copy, the "Shared by me" view (which lists
all shared resource types from day one), and the naming of results
routes/storage — are built resource-generic so extending to roleplays and
practice guides is an increment, not a refactor. That extension is the first
candidate of the next iteration.

## Two Kinds Of Link (Do Not Merge Them)

1. **Linked independent account.** An adult with their own account who
   receives shared activities (and later, possibly gifted credits) from a
   guide, but owns their data and wallet. This is the pilot's student and
   the future B2C conversion — and the referral program's subject. Forcing
   these users into guide-owned accounts would kill both.
2. **Managed account (deferred).** A master account creates, controls, and
   funds sub-accounts, including their credit limits — the Apple Family
   Sharing / Google Family Link pattern. Right for those who cannot or
   should not be autonomous: minors, academy-owned seats, community-program
   beneficiaries. See below.

## Managed Accounts (Deferred Direction)

Not needed now: **the parent case works today with multiple learning
profiles inside one account** — the account is the parent's own, so no
child-privacy surface opens yet. Managed accounts become relevant when the
practicer needs a real separate account (own device, own sessions, academy
seats).

What they will solve when built:

- **Minors**: parental consent is inherent in the structure (the master owns
  the account). Still requires legal review (COPPA) before shipping.
- **Credits**: a master wallet with per-sub-account allocations and caps.
  Architecturally this is the existing gesture — superadmin already sets a
  per-user OpenRouter `limitUsd`; a master doing that for its sub-accounts
  is the same operation with a different owner. Keep "who controls this
  account's spend limit" as a seam, not an assumption.
- **Frictionless onboarding**: the guide creates seats and hands out access.

**Design requirement to honor from day one — emancipation.** The child grows
up; the student leaves the academy. A managed account must be convertible
into an independent one, carrying its learning history, because progress
belongs to the learner, not the master. This costs one line in the data-model
design now and a painful migration later if ignored.

## Why The Full Layer Is Deferred

- The approved differentiation is a **light continuity layer** without
  required school infrastructure
  ([Investigación de la competencia](../business/investigacion-de-la-competencia.md),
  §10.2, §13); "complex school administration" is listed under *postpone
  until the core is validated* (§14).
- The founder operates alone; every entity (classrooms, packages,
  invitations, managed accounts, organizations) multiplies migrations,
  permissions, consent surfaces, and recurring support
  ([Contexto del fundador](../business/contexto-del-fundador.md), §6).
- The pilot exists to learn whether teachers think in "classes and packages"
  or in "I send this link on WhatsApp". Build after the answer, not before.

## The Ladder (Decided 2026-07-18)

Steps 1–2 are V3 MVP scope; steps 3–6 are explicitly another iteration,
each promoted individually on evidence.

1. **Quiz-owner results + next-class report** (V3, [Roadmap V3](../roadmap/roadmap-v3.md)
   §1.6): the primitive is born — share → practice → results return.
   Disclosure-at-start consent; adults only for external students; the
   parent-child case runs through profiles inside the parent's own account.
2. **"Shared by me" view** (V3, same section): one aggregated page — my
   shared activities, attempt counts, who practiced. The guide's entry point
   with no roles and no new entities.
3. **Aula section**: an optional sidebar area organizing what already exists
   — people grouped into classes, activities grouped into packages, due
   dates. A lens, not a rebuild; whoever doesn't need it never sees it.
   Cheapest precursor worth testing first: several quizzes behind one share
   link.
4. **Gifted credits** to linked independent accounts (the light step for
   teachers with adult students).
5. **Managed accounts** (master + sub-accounts, credits and caps included),
   with emancipation designed in. Enables minors with real accounts, family
   setups, and academy seats. Requires legal review before shipping.
6. **Organizations**: the institutional master (academies, community
   programs). Postponed per the business roadmap until the independent
   segment retains and pays, or an institution funds the work.

Evidence-driven authoring (feed results as context into creating the next
activity) can land early as a "create a new activity from these results"
action on the report — it needs no chat surface and no new entities.

## Open Questions

- Do teachers group by class, by link, or by student? (Primary pilot
  question; decides how much of step 3 is needed.)
- Invitation-gated student sign-up vs open sign-up with link attribution
  (pilot default: open, via shared links).
- Consent per level: activity result (disclosure-at-start — decided),
  practice report (student opt-in — decided), class-level aggregation and
  organization visibility (undecided).
- Whether "package" is a share-link feature or a first-class entity.
- Managed-account boundaries: what the master can see beyond results
  (conversations? progress?), and the exact emancipation flow.
- How gifted credits and managed-account allocations interact with pricing
  and the referral program
  ([Programa de referidos](../business/programa-de-referidos-y-creadores.md)).

## Relationship To Existing Features

- [Teacher-Assigned Practice](teacher-assigned-practice.md): quizzes, share
  links, guest attempts, claim, evaluation, follow-up — the substrate of the
  primitive. Its deferred "teacher dashboards, rosters, classroom result
  review" items graduate into step 3.
- Learning profiles: multiple profiles per account are the interim
  parent-child answer (step 1) and the conceptual seed of sub-accounts
  (step 5).
- [Payments](payments.md) and credit gating: pilot funding is manual
  (superadmin per-user limits); steps 4–5 generalize who controls a limit.
- Progress events: power the self-learner side and the report aggregation;
  class-level views read from the same events.
- [Home Start Experience](home-start-experience.md): the logged-in home
  variants idea is the self-learner half of the formula (dedicated UI,
  pre-generated practice cards).
