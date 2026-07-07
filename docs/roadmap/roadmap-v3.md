# Roadmap V3

Date: 2026-07-06 (last updated: 2026-07-06)

Status: **In planning.** V3's headline pillar is comprehension exercises
(listening, reading, and image comprehension), promoted and carried over from
[Roadmap V2](roadmap-v2.md) where it was scoped out so V2 could ship as the
internationalization release. Remaining product-feature candidates stay in the
idea inbox, [issues/incomming.md](../issues/incomming.md), until they are
promoted here.

This document is the living tracker for V3: items move through the status
legend as work happens (`[~]` when started, `[x]` with a date when done), and
notes are added inline when decisions change an item's scope. There is no fixed
execution order — the next item is chosen by analyzing the current state at each
step.

V3 development continues on the `v2` branch lineage after `2.0.0` ships; a `v3`
branch will be cut from `main` once V2 releases. `main` remains the production
branch.

Product context: the primary audience is students in South Florida, many of
them Hispanic and Haitian. V2 made the platform's instruction language
selectable (Spanish, English, Haitian Creole). V3 builds on top of that: all
comprehension stimuli are in English (the target language), while question
wording and feedback follow the user's instruction language.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Comprehension Exercises (Stimulus + Questions)

Promoted from the idea inbox 2026-07-04; carried from Roadmap V2 to V3 on
2026-07-06. Design:
[Comprehension Exercises](../features/comprehension-exercises.md) — one
reusable pattern (a stimulus plus questions bound to it) reusing the `quiz`
item kinds and the `quiz_result` evaluation pipeline, rendered as a single
card. Implementation follows the design doc's phase order; each phase ships
independently.

- [ ] Detailed block design decision: `stimulus` field on the existing
  `quiz` block versus dedicated stimulus blocks (the design doc leans to
  the former).
- [ ] Phase 1 — Reading comprehension: LLM-generated passage at the
  learner's level, questions in the same card, results through the
  `quiz_result` pipeline and progress events. No new infrastructure;
  validates the pattern.
- [ ] Phase 2 — Listening comprehension: server-side quality TTS from an
  LLM-generated transcript, audio cached by transcript hash in object
  storage (DigitalOcean Spaces), two voices for dialogues, player UX
  (limited replays, 0.75x speed, transcript revealed after answering), and
  TTS spend inside the existing credit guardrails.
- [ ] Phase 3 — Image comprehension: curated image library with rich
  metadata (batch pre-generated or stock, e.g. Pixabay); the tutor selects
  by metadata and generates questions about the description.
- [ ] Availability in teacher quizzes: reading/listening sections as quiz
  items once the stimulus pattern exists in the protocol.
- [ ] Manual QA per phase against live inference.

Interaction with the V2 i18n work: comprehension stimuli are always in
English (the target language); question wording and feedback follow the
user's instruction language. The i18n prompt parametrization shipped in V2,
so Phase 1 can proceed without double work on prompt copy.

---

# Part 2: Engineering And Quality

- [ ] Always-on semantic message classifier for tutor blocks, deferred from
  V2 on 2026-07-06
  ([Structured Block Post-Processing](../issues/completed/structured-block-postprocessing.md)):
  a cheap per-response classifier inference that catches exercise payloads in
  `message` prose that the deterministic linter misses. Prerequisite: quantify
  the linter's miss rate from production block-repair logs first — the
  classifier taxes every tutor turn with extra cost and latency, so it must be
  justified by data. Revisit after the comprehension blocks land, since they
  change the leakage surface.

---

# V3 Exit Criteria (Draft)

- [ ] Reading and listening comprehension exercises work end to end in
  tutor conversations (image comprehension may ship later without blocking
  V3).
- [ ] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass;
  new prompt surfaces have regression fixtures.
- [ ] Deployed to production per the versioning policy
  (`versioning-and-releases` skill).
