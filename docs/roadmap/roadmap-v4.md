# Roadmap V4

Date: 2026-07-07 (last updated: 2026-07-18)

Status: **Deferred backlog.** V4 holds the work explicitly deferred past
[Roadmap V3](roadmap-v3.md). On 2026-07-18 V3 was refocused as the Teacher
Pilot MVP (see the
[Roadmap V3/V4 MVP Adjustment Proposal](roadmap-v3-v4-mvp-adjustment-proposal.md)),
and everything the pilot does not need was carried here. **Pilot evidence
should reorder and re-scope this list before V4 planning is committed** —
that is the point of running the pilot first. Remaining product-feature
candidates stay in the idea inbox,
[issues/incomming.md](../issues/incomming.md), until they are promoted here.

This document is the living tracker for V4: items move through the status
legend as work happens (`[~]` when started, `[x]` with a date when done), and
notes are added inline when decisions change an item's scope. There is no fixed
execution order — the next item is chosen by analyzing the current state at
each step.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Generalized Translation Scaffolding (Any Support Language)

Deferred here from a V2 audit discussion on 2026-07-07.

- [ ] Generalize the two Spanish-hardcoded translation mechanics —
  `translate_to_english` / `understand_in_spanish` (tutor blocks and quiz
  item kinds) — into support-language translation scaffolding available to
  every non-English instruction language. Conceptually they are "translate
  from your language to English" and "explain in your language what this
  English sentence means"; today `ht` profiles use the monolingual block
  set only because the blocks were Spanish-hardcoded, not as a pedagogical
  decision. The V2 registry work already centralized the gating
  (`includesSpanishTranslationBlocks` drives the tutor protocol, the tutor
  quiz set, quiz authoring prompts, and the authoring UI kind picker), so
  the remaining work is:
  - Rename the flag to something like `includesTranslationBlocks` and
    enable it for `ht` (and future support languages).
  - Parametrize the block docs (`translate-to-english-prompt.md`,
    `understand-in-spanish-prompt.md`, `quiz-translation-items.md`,
    `quiz-translation-authoring-kinds.md`) by `INSTRUCTION_LANGUAGE_NAME`
    instead of saying "Spanish" in their bodies.
  - Fill the per-language registry fragments that are empty today for
    `ht` (quiz evaluation/authoring translation rules).
  - Review exercise-submission evaluation and the leakage patterns for
    the `ht` case; review UI labels ("Entender en español" → generic).
  - Keep the existing persisted discriminators (`understand_in_spanish`
    etc.) as-is: they are internal identifiers stored in quiz drafts,
    snapshots, and message blocks, and renaming them would force a data
    migration for cosmetic benefit.
  - QA pass with an `ht` profile (tutor blocks, quiz authoring, attempt
    evaluation, shared es-authored quizzes still rendering as authored).

## 1.2 Comprehension Exercises — Phases 2 And 3

Carried from [Roadmap V3 §1.1](roadmap-v3.md) on 2026-07-18 (MVP refocus).
Phase 1 (reading) stays in V3 as an optional stretch goal. Design:
[Comprehension Exercises](../features/comprehension-exercises.md). Stimuli are
always in English (the target language); question wording and feedback follow
the user's instruction language.

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

## 1.3 Scene Media Library — Remaining Work

Carried from [Roadmap V3 §1.2](roadmap-v3.md) on 2026-07-18 (MVP refocus).
The shipped work — built-in library (150 media items), media library UI,
user-generated media pipeline (image/script/audio to Spaces), per-layer
preview/apply editing, and the prompt-quality hardening — stays recorded in
V3, which holds the detailed history and decisions. Design:
[Scene Media Library](../features/scene-media-library.md). Remaining:

- [ ] Tutor integration: add the `scene_media` block to the tutor block
  protocol, schema, validation, persisted block schema, repair prompt, and
  TypeScript types; render it in tutor chat (responsive image, audio
  controls, optional script/transcript, mobile-safe Bootstrap/Flatly
  styling); update tutor prompt guidance so the model references media ids
  and never emits raw paths, arbitrary URLs, or dynamic generation requests.
- [ ] Scene media resolver completion: the `resolve_scene_media` tutor tool
  adapter and the direct quiz/resource call sites (shared service, catalog,
  and validation already exist).
- [ ] Media-to-resource derivation: create quizzes, practice guides, and
  future resource types from a selected media item through a
  resource-specific instruction modal, preserving `sourceMediaId`
  provenance.
- [ ] Step-by-step creation/derivation flow: guide the author through
  discrete decisions (title/level/format, script, layers) and leave the
  expensive credit-gated image/audio generation as the final step.
- [ ] Create-script → review → create-audio flow: generate the structured
  script first, let the author review/edit, and only then synthesize the
  per-turn audio clips.
- [ ] Voice and delivery-style authoring control: per-speaker voice selection
  from the Gemini prebuilt catalog plus natural-language style direction
  (emotion, pace, register) passed to the TTS call. Note Gemini TTS has no
  true child voices and no cloning; a provider with real child voices would
  be a separate follow-up.
- [ ] Media player/transcript unification: enable the player's transcript
  with active-turn highlight on the media detail/authoring pages (they still
  render the script in a separate card) and consider caching the combined
  audio blob to avoid re-fetching clips per view.
- [ ] Tests: route/render and repository coverage for storage-backed
  generated media, profile access boundaries, generated-layer failure modes,
  archive, atomic persistence, no-copy reuse; focused fixtures for valid
  block rendering, invalid asset ids, missing optional layers, private
  generated media access, and the media library source boundary.
- [ ] Preview/asset orphan sweep: periodic cleanup of
  `.../scene-media/{id}/**/preview-*` objects leaked when the process
  restarts between generate and apply (bounded, best-effort today).
- [ ] Human adult-voice listening QA of the regenerated built-in WAV clips
  ([handoff](../issues/built-in-adult-scene-wav-refresh.md)).

## 1.4 Voice Messages in Roleplays

Carried from [Roadmap V3 §1.4](roadmap-v3.md) on 2026-07-18 (MVP refocus);
originally added 2026-07-08. Idea: let the learner send **audio messages** in
a [Roleplay](../features/roleplays.md) attempt, and let the fictional
character reply with audio too when the learner turns that on. This deepens
the English-production goal of roleplays — practicing speaking and listening,
not only writing — while staying inside the existing roleplay resource shape
(snapshot attempt, evaluate, progress, follow-up).

- [ ] Learner audio input: record a spoken English turn in the roleplay-writing
  UI, transcribe it (speech-to-text), and feed the transcript into the same
  turn pipeline the written turns use, so evaluation and progress work
  unchanged. Decide whether the transcript, the audio, or both are persisted in
  the attempt for later evaluation.
- [ ] Character audio output (opt-in): when the learner enables it, the
  fictional character's turns are voiced with TTS. Reuses the shared audio
  infrastructure from [1.3 Scene Media Library — Remaining Work](#13-scene-media-library--remaining-work)
  and the comprehension Phase 2 TTS work (server-side quality TTS,
  object-storage caching, voice selection, credit guardrails) — sequence this
  after that infrastructure exists.
- [ ] Evaluation of spoken turns: decide how pronunciation/fluency factor into
  Mr. F's turn-by-turn evaluation, or whether v1 evaluates only the transcript
  text (same as written turns) and defers spoken-specific feedback.
- [ ] Cost, latency, and guardrails: STT and TTS spend inside the existing
  credit guardrails; UX for record/playback limits mirrors the comprehension
  listening constraints where sensible.
- [ ] Manual QA against live inference (record → transcribe → character voice
  reply → evaluate).

Dependency note: the character-audio half leans on the shared media/TTS
infrastructure (sections 1.2 and 1.3 above), so it is naturally sequenced
after that lands. The learner-audio (STT) half is more independent and could
pilot the speech surface earlier.

## 1.5 CEFR Level Standardization

Carried from [Roadmap V3 §1.5](roadmap-v3.md) on 2026-07-18 (MVP refocus);
originally added 2026-07-14. Media and Roleplay authoring currently use the
`A1-A2`, `B1-B2`, and `C1` bands. Formalize how Mister F represents and uses
learner levels across the entire app without prematurely changing the
remaining free-form level fields.

- [ ] Inventory every level field, prompt, filter, schema, resource type,
  learner profile, media record, and evaluation surface that currently uses
  labels such as A1, A2, B1, B2, C1, ranges, or free-form text.
- [ ] Define one canonical CEFR representation and policy for single levels,
  ranges, unknown levels, display labels, localization, and backward
  compatibility with existing records.
- [ ] Apply the canonical representation consistently across authoring,
  runtime adaptation, evaluation, progress, resource filtering, and media.
- [ ] Add migration/compatibility coverage and prompt-contract tests before
  replacing existing free-form level values.

## 1.6 Guides, Aula Section, And Managed Accounts (Candidate — Gated On Pilot Evidence)

Added 2026-07-18; refined the same day into the sharing-primitive formula in
[Classrooms](../features/classrooms.md). The ladder's steps 1–2 (quiz-owner
results + "Shared by me" view) are V3 MVP scope; the founder decided the
remaining steps belong to a later iteration. **Not committed:** promote
individual steps here only when the V3 pilot shows they are needed.

- Step 2.5 — **Results return for roleplays and practice guides** (added
  2026-07-18; likely the first post-MVP extension): sharing already exists
  for both; add each type's result artifact flowing back to the sharer —
  roleplay attempt evaluation + transcript, practice-guide finalized session
  report (not the raw chat) — reusing the resource-generic results surface
  and disclosure-at-start consent built in V3. Disclosure follows
  assignment, not resource type.
- Step 3 — **Aula section**: an optional sidebar area organizing what already
  exists (people grouped into classes, activities into packages, due dates).
  A lens over the primitive, not a rebuild; precursor worth testing first is
  several quizzes behind one share link.
- Step 4 — **Gifted credits** to linked independent accounts.
- Step 5 — **Managed accounts**: master account + sub-accounts with
  master-controlled credits and caps; enables minors with real accounts,
  families, and academy seats. Emancipation (converting a managed account to
  an independent one, carrying its history) must be designed into the data
  model; legal review required before shipping.
- Step 6 — **Organizations**: the institutional master.

Also in this family, cheap and independent once outreach starts: the public
landing page and the opt-in "share my practice with the teacher" action.

---

# Part 2: Engineering And Quality

## 2.1 LLM Inference Portfolio Audit And Governance

Carried from [Roadmap V3 §2.1](roadmap-v3.md) on 2026-07-18 (MVP refocus);
originally added 2026-07-15 after finding that resource authoring operations
can inherit a global model tier and reasoning effort even when their output
contract does not require the same quality/latency tradeoff as a tutor
conversation. The pilot-cycle cost/latency measurement slice stayed in V3
(§1.7 Pilot Readiness); the rest is here:

- [ ] Inventory every inference in the application. For each call site, record
  the product operation, user-visible surface, resolved model in each
  environment, model tier or explicit model id, reasoning effort, temperature,
  expected input/output size, structured schema, retry/correction loop, credit
  boundary, and whether the response is blocking, streamed, or background work.
- [ ] Measure representative production and local traces per operation: credit
  check time, provider latency, input/output/reasoning tokens, cost, correction
  turns, validation failures, and end-to-end user-visible latency. Do not infer
  suitability from the global tier name alone.
- [ ] Define and document the model-selection policy for Mister F. Assign a
  model and reasoning effort deliberately to each inference according to its
  quality, latency, cost, context-size, and structured-output needs. Structured
  transformations and bounded draft edits should default to minimal or no
  reasoning unless evaluation evidence justifies more.
- [ ] Create a canonical governing artifact for future inference work, preferably
  `docs/architecture/llm-inference-policy.md` as the source of truth plus a
  focused project skill or an extension of the existing LLM skills containing
  the actionable review checklist. It must require every new inference to
  declare its operation name, model selection, reasoning effort, credit gate,
  response contract, retry policy, observability, and user-facing latency
  behavior.
- [ ] Add automated coverage that prevents inference call sites from silently
  inheriting unsuitable defaults where an explicit decision is required, and
  keeps the governing inventory synchronized with code.
- [ ] Establish a small representative evaluation set per inference class and
  run live quality/latency/cost comparisons before changing a model or reasoning
  level. Record the decision and its evidence in the governing artifact.

## 2.2 Structured Block Post-Processing

Carried from [Roadmap V3 §2.2](roadmap-v3.md) on 2026-07-18; deferred from V2
on 2026-07-06.

- [ ] Always-on semantic message classifier for tutor blocks
  ([Structured Block Post-Processing](../issues/completed/structured-block-postprocessing.md)):
  a cheap per-response classifier inference that catches exercise payloads in
  `message` prose that the deterministic linter misses. Prerequisite: quantify
  the linter's miss rate from production block-repair logs first — the
  classifier taxes every tutor turn with extra cost and latency, so it must be
  justified by data. Revisit after the comprehension blocks land, since they
  change the leakage surface.
