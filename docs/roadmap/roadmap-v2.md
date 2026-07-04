# Roadmap V2

Date: 2026-07-04 (last updated: 2026-07-04)

Status: **In planning / active.** V2 has two product pillars: English-first
internationalization of the platform, and comprehension exercises
(listening, reading, and image comprehension). Part 2 carries the
engineering and quality items deferred from
[Roadmap V1](roadmap-v1.md). Remaining product-feature candidates stay in
the idea inbox, [issues/incomming.md](../issues/incomming.md), until they
are promoted here.

This document is also the living tracker for V2: items move through the
status legend as work happens (`[~]` when started, `[x]` with a date when
done), and notes are added inline when decisions change an item's scope.
There is no fixed execution order — the next item is chosen by analyzing
the current state at each step.

Product context: the primary audience is students in South Florida, many of
them Hispanic and Haitian. Today the whole platform (UI and tutor
assistance) is Spanish-only, which serves the Hispanic audience but excludes
everyone else.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Internationalization (English First)

Goal: make the platform's instruction language selectable. V2 ships exactly
two instruction languages — Spanish (current) and English — following the
common pattern in pedagogical materials of English as the base language.
The architecture must make adding a third language cheap (Haitian Creole is
the natural post-V2 candidate for the Haitian community), but V2 does not
ship it.

Scope notes:

- The instruction language is the language of the UI and of the tutor's
  assistance/explanations. The target language of study (what students
  practice producing and comprehending) remains English and is unaffected.
- For English-instruction users studying English, prompts must avoid
  translation-based scaffolding and lean on monolingual techniques.

- [ ] Design review: validate and update the existing
  [Multilingual English Learning](../features/multilingual-english-learning.md)
  proposal (target language / support language / interface locale) as the
  design doc for this initiative, resolving: where the language preference
  lives (per-user setting, onboarding choice, and pre-login detection), the
  string strategy for EJS views and client scripts, how system prompts
  parametrize the instruction language, and what happens to mixed-language
  shared resources. V2 ships English only; Haitian Creole stays post-V2.
- [ ] i18n infrastructure: externalize UI strings from EJS views, partials,
  client scripts, flash messages, and validation errors into per-language
  catalogs (`es`, `en`); pick or build a minimal helper (no heavyweight
  framework unless the design doc justifies it).
- [ ] Per-user language preference: onboarding choice, settings toggle, and
  a sensible default for anonymous/shared-link visitors (`Accept-Language`
  with explicit override).
- [ ] Tutor and LLM surface: parametrize system prompts, block protocol
  copy, evaluation feedback, and AI authoring (quiz/guide/roleplay
  generation and revision) by instruction language.
- [ ] Transactional surfaces: emails, legal pages, and error pages in both
  languages.
- [ ] English translation pass over the full catalog, reviewed against the
  product glossary (`Recursos`/`Resources`, `Guías de Práctica`/`Practice
  Guides`, etc.).
- [ ] Manual QA: full product walkthrough in English (signup → onboarding →
  tutor session → quiz → shared resource) and regression walkthrough in
  Spanish.

## 1.2 Comprehension Exercises (Stimulus + Questions)

Promoted from the idea inbox 2026-07-04. Design:
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

Interaction with 1.1: comprehension stimuli are always in English (the
target language); question wording and feedback follow the user's
instruction language. Phase 1 should land after the i18n prompt
parametrization to avoid double work on prompt copy.

---

# Part 2: Engineering And Quality

Carried over from Roadmap V1, Part 3 (moved here 2026-07-04). The "static
manual quiz JSON for development" item was reframed as a resource
import/export product idea and moved to the idea inbox
([issues/incomming.md](../issues/incomming.md)).

- [ ] Prompt-contract fixtures that validate representative generated quiz
  JSON (generation, single-block generation, revision, and evaluation)
  without a live model.
- [ ] Deeper semantic review layer for structured tutor blocks
  ([Structured Block Post-Processing](../issues/completed/structured-block-postprocessing.md)).
- [ ] [UI Style Consistency Audit](../issues/ui-style-consistency-audit.md):
  semantic CSS class naming pass across the app.

---

# V2 Exit Criteria (Draft)

- [ ] A new user can complete the full product experience with English as
  the instruction language, and Spanish behavior is unchanged.
- [ ] Reading and listening comprehension exercises work end to end in
  tutor conversations (image comprehension may ship later without blocking
  V2).
- [ ] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass;
  new prompt surfaces have regression fixtures.
- [ ] Deployed to production as `2.0.0` per the versioning policy
  (`versioning-and-releases` skill).
