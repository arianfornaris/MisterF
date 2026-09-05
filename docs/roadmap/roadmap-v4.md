# Roadmap V4

Date: 2026-07-07 (last updated: 2026-08-01)

Status: **Deferred backlog plus the complete Scene Media Library record.** V4
holds the work explicitly deferred past [Roadmap V3](roadmap-v3.md), together
with the shipped Media Library foundation and implementation history
transferred here on 2026-07-26. On 2026-07-18 V3 was refocused as the Teacher
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

## 1.2 Comprehension Exercises

Promoted from the idea inbox on 2026-07-04 and carried from V2 to V3 on
2026-07-06. Phases 2 and 3 moved here on 2026-07-18 during the Teacher Pilot
MVP refocus; the remaining Phase 1 reading stretch goal and its design
decision were transferred from [Roadmap V3 §1.1](roadmap-v3.md) on 2026-07-26
at the founder's direction, so V4 now owns the complete initiative. Design:
[Comprehension Exercises](../features/comprehension-exercises.md) — one
reusable pattern (a stimulus plus questions bound to it) reusing the `quiz`
item kinds and the `quiz_result` evaluation pipeline, rendered as a single
card. Each phase ships independently.

Stimuli are always in English (the target language); question wording and
feedback follow the user's instruction language. The V2 i18n prompt
parametrization means Phase 1 can proceed without duplicating prompt copy.

- [ ] Detailed block design decision: `stimulus` field on the existing
  `quiz` block versus dedicated stimulus blocks (the design doc leans to
  the former).
- [ ] Phase 1 — Reading comprehension: LLM-generated passage at the learner's
  level, questions in the same card, results through the `quiz_result`
  pipeline and progress events. No new infrastructure; validates the pattern.

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

## 1.3 Scene Media Library

Promoted to V3 on 2026-07-07. Design:
[Scene Media Library](../features/scene-media-library.md) - one source-neutral
`scene_media` block backed by a shared library of built-in and user-generated
scene media. The work started in V3 by promoting curated built-in assets, while
the library shape left room for generated scripts/audio and later dynamic
media flows.

**Transferred in full from V3 on 2026-07-26 at the founder's direction.** V4
now owns the shipped history, implementation decisions, in-progress work, and
remaining checklist below. Completed items retain their original dates; `[~]`
items describe the implemented foundation and the work still pending.

- [x] Promote approved design assets from `design/scene-images/` and
  `design/scene-scripts/` into product runtime asset folders. Done 2026-07-09:
  the first built-in slice copied 50 approved final scene images and 150
  generated listening audio files into `misterf-web/public/scene-media/`.
- [x] Generate or maintain a non-public server-side built-in registry with
  product-safe scene metadata, public image/audio URLs, one concrete learner
  level per media item, durations, and structured script data without duplicated
  flattened transcript text. Multiple script/audio levels for the same visual
  scene are represented as separate flat media items that share a visual asset
  id, not as nested variants on one media item. Done 2026-07-09:
  `build:scene-media` generates 150 flat built-in media items and validates them
  through the scene media service at startup.
- [x] Add a first authenticated media library UI under `/media-library`, with a
  side-panel link between New Conversation and Resources, filters, built-in
  media cards, and dedicated media detail pages with a close button back to the
  library. Done 2026-07-09.
- [~] Add a reusable scene media resolver service that selects from a compact
  catalog using natural-language criteria, validates returned ids
  deterministically, uses credit-gated inference in user-scoped flows, exposes
  `resolve_scene_media` as a tutor tool adapter, and can also be called directly
  by quiz/resource services. Started 2026-07-09: added the shared resolver
  service, compact catalog builder, deterministic id/layer/recent-media
  validation, malformed-output fallback, and mocked inference tests. The tutor
  tool adapter and direct quiz/resource call sites remain pending.
- [~] Add user-generated scene media. Foundation done 2026-07-09: persisted
  ready-only `user_scene_media`, active-profile ownership, user-media-first
  listing, source badges, dedicated `Create media` and
  `Create variation` pages, resource-style blocking generation progress, credit
  checks before each provider call, and no-copy reuse for kept image or
  script-and-audio layers. The synchronous pipeline connects image, structured
  script, audio, and object storage and persists a media row only after all
  requested layers are ready. Generation jobs, retry placeholders, and their
  realtime socket channel were removed on 2026-07-10. Archive, post-processing,
  and QA controls are still being filled in.
  - [x] Configure user-file storage defaults. Development resolves to
    `USER_FILE_STORAGE_PROVIDER=spaces`,
    `USER_FILE_STORAGE_BUCKET=misterf.us-files-dev`,
    `USER_FILE_STORAGE_REGION=atl1`,
    `USER_FILE_STORAGE_ROOT_PREFIX=misterf`, and
    `DO_SPACES_ENDPOINT=https://atl1.digitaloceanspaces.com`; production
    defaults to `misterf.us-files`. Done 2026-07-09.
  - [x] Add the user-file storage adapter boundary for generated media. Done
    2026-07-09: implemented a DigitalOcean Spaces/S3-compatible provider with
    SigV4 signed PUT, DELETE, presigned GET URLs, scene-media storage key
    helpers, and unit tests. Runtime credentials still come only from
    `DO_SPACES_ACCESS_KEY` and `DO_SPACES_SECRET_KEY`; the provider is ready for
    the generation pipeline.
  - [~] Connect generated media creation to user-file storage. Started
    2026-07-09: generated image layers are written under
    `misterf/users/{userId}/scene-media/{mediaId}/image/...`, generated audio
    layers are written under
    `misterf/users/{userId}/scene-media/{mediaId}/audio/...`, both persist
    `storageKey` metadata, and both read through authenticated app routes that
    issue short-lived Spaces URLs. Updated 2026-07-10: new and retried layers use
    stable public origin URLs for immutable scene-media image and audio objects,
    with long-lived browser cache headers. The MVP
    accepts direct binary access by anyone who knows the opaque URL; grant-aware
    edge protection is deferred until the media-resource sharing model. The
    current period-containing bucket names cannot use DigitalOcean's default
    wildcard CDN endpoint, so edge caching requires a custom domain/certificate
    or future dash-only buckets.
  - [~] Wire generated-image creation for `Image only`, complete-scene, and
    variations that choose `generate_new` image. Started 2026-07-09:
    `Image only`, complete-scene, and variation flows that regenerate
    the image call OpenRouter's dedicated Images API, default to
    `google/gemini-3.1-flash-lite-image` per the asset-generation research,
    request a square 1K source, pass source images as image-to-image references,
    post-process to exact 720x720 WebP, store public immutable bytes in Spaces,
    and map content-policy rejections to the approved failure message.
  - [~] Wire structured script generation for complete scenes. Started
    2026-07-09: complete-scene creation now generates validated JSON script
    packages from prompt, level, format, image/source context, and script-type
    preference; variation image and script generators now share structured
    source context containing title, setting, level, format, image alt text,
    visual summary, tags, skills, use cases, source script, and binding layer
    decisions. The generator enforces the MVP atomic script-and-audio layer and
    caps dialogue at three speakers.
  - [~] Wire audio generation from structured scripts. Started 2026-07-09:
    scripts are synthesized through OpenRouter's Speech API, defaulting to
    `google/gemini-3.1-flash-tts-preview` per the research; narration and
    monologue use one voice, dialogue assigns distinct voices where possible,
    and provider/model/voice metadata is persisted on the audio layer. Updated
    2026-07-12: audio is now an ordered list of per-turn WAV clips
    (`format: 'wav'`, `voiceStrategy: 'per_turn_clips'`) instead of one
    concatenated MP3; each clip stores its speaker, turn, and Spaces
    `storageKey`, and migration 21 purges legacy single-file audio rows. Human
    QA, exact duration targeting, and fallback/draft model controls remain
    pending.
  - [x] Remove persisted generation jobs and incomplete media placeholders.
    Completed 2026-07-10: failures return to the creation page with preserved
    form state, no media row is created until every requested layer is ready,
    and legacy job/incomplete rows are deleted by migration. Ready user media
    can still be archived from its detail page.
  - [ ] Add route/render and repository tests for storage-backed generated
    media, profile access boundaries, generated-layer failure modes, archive,
    atomic persistence, and no-copy reuse of built-in/user layers.
- [~] Add scene media editing: manual title edits plus per-layer "change
  with a preview" modals. Proposed 2026-07-13; the earlier tool-driven authoring
  chat idea was dropped in favor of per-layer buttons because they are more
  intuitive for non-technical authors.
  - [x] Manual title edits on the `General` tab. Done 2026-07-13 and refined
    2026-07-14: `edit/save` changes only the title. Level and script type were
    moved into the script-change modal so they cannot relabel an unchanged
    script/audio layer. Generation mode stays derived/read-only (a consequence
    of whether a script+audio layer exists). Updated 2026-07-14: an inline,
    credit-gated title generator uses the current image and scene context to
    fill the title input without saving; Save is enabled only after the title
    actually changes.
  - [~] Per-layer change modals with preview-before-apply. Done 2026-07-13:
    "Cambiar imagen" and "Cambiar guion" buttons on the `General` tab open one
    modal (`partials/scene-media-change-modal`) with a describe → generate →
    preview flow. Generation streams NDJSON progress (reuses commit `e78742db`)
    via `POST /media-library/:id/preview/{image,script}`; the preview is held
    in an in-memory store (`sceneMediaPreviewStore`) keyed to the media and is
    never applied until the author clicks "Usar esta versión"
    (`preview/apply`). "Volver a intentar" re-prompts without leaving the modal;
    image regeneration references the last pending preview so tweaks chain
    iteratively (image-to-image). Cancel/close discards the pending preview and
    deletes its temporary storage objects (`preview/discard`). Script changes
    are two steps: `preview/script` generates the script only (using the current
    or last-draft script as continuity context) and shows it side-by-side with
    the current script. Updated 2026-07-14: the modal also exposes level and
    script type as explicit generation parameters; approving the draft
    (`preview/script/apply`) generates the audio with streamed progress and
    atomically commits level, script type, script, and audio, so labels cannot
    drift from content and audio is never generated for a rejected script.
    Preview generation lives in
    `sceneMedia/sceneMediaPreview.ts`; apply uses `applyUserSceneMediaImage` /
    `applyUserSceneMediaScript`.
  - [x] Retire the legacy AI chat tab and the one-shot `edit/revise` flow.
    Done 2026-07-14: removed the tab, route, handler, client hooks,
    `services/sceneMediaRevisions.ts`, and its planning/correction prompts after
    the layer-specific change modals superseded them. The historical
    `authoring_messages_json` column remains unused for production-data
    compatibility; no destructive migration was introduced.
  - [ ] Preview/asset cleanup on process restart. The in-memory pending store
    means a restart between generate and apply leaks the temporary preview
    object in Spaces. Acceptable for now (bounded, best-effort); revisit with a
    periodic orphan sweep of `.../scene-media/{id}/**/preview-*` objects if it
    becomes noticeable.
- [x] Regenerate and promote the adult-only audio for
  `shared-umbrella-bus-stop-01`, `shared-lunch-classroom-01`, and
  `pancake-practice-kitchen-01`. Done 2026-07-12 (commit `dcbb08e8`): forced
  regeneration of all 45 per-turn WAV clips, `generate_clip_audio.py` now
  promotes `status: "generated"` only after every turn succeeds and repairs the
  `batchSummary` audio counters, review index and runtime catalog rebuilt
  (registry 150 ready / 0 pending). Human adult-voice listening QA is the only
  remaining step (see the
  [Built-In Adult Scene WAV Refresh Handoff](../issues/built-in-adult-scene-wav-refresh.md)).
- [ ] Add media-to-resource derivation so a selected media item can create
  quizzes, practice guides, and future resource types through a resource-specific
  instruction modal while preserving `sourceMediaId` provenance.
- [ ] Add the `scene_media` block to the tutor block protocol, schema,
  validation, persisted block schema, repair prompt, and TypeScript types.
- [ ] Render the block in tutor chat with responsive image display, audio
  controls, optional script/transcript display, and mobile-safe Bootstrap/Flatly
  styling.
- [ ] Update tutor prompt guidance so the model references media ids
  and never emits raw paths, arbitrary URLs, or dynamic generation requests
  through this block.
- [ ] Add focused tests/fixtures for valid block rendering, invalid asset ids,
  missing optional layers, private generated media access, and the media library
  source boundary.
- [~] Improve the media audio player now that audio is multi-file. Started
  2026-07-12: the per-turn WAV clips are fetched and concatenated client-side
  into a single WAV blob played through one `<audio>` element with one
  timeline, one scrubber, and one total duration; the track shows a marker at
  each character turn boundary and labels the current speaker. The player
  component also supports an optional transcript with active-turn highlight and
  click-to-jump. Remaining: enable that transcript on the media detail/authoring
  pages (which still render the script in a separate card) and de-duplicate,
  and consider caching the combined blob to avoid re-fetching clips per view.
- [ ] Improve the media derivation and creation flow to be step by step
  instead of one synchronous blocking pass: guide the user through the
  decisions (title/level/format, script, layers) as discrete steps, and leave
  image and audio generation as the final step so the expensive, credit-gated
  provider calls only run once everything else is confirmed.
- [x] Retire the proposed tool-driven media-authoring chat. Superseded
  2026-07-14 by the layer-specific preview/apply controls and inline title
  generation; media editing no longer owns a general AI chat surface.
- [ ] Allow a create-script, review, then create-audio flow: generate the
  structured script first, let the user review and edit it, and only then
  synthesize the per-turn audio clips from the approved script.
- [ ] Give authoring control over audio voice and delivery style. Today voices
  are hard-coded in gender-aware pools, the layer-specific editing flow has no
  voice/style lever, and the OpenRouter
  TTS request sends only text + voice with no style prompt — so a request like
  "make Sam sound like a 7-year-old" cannot change anything. Add per-speaker
  voice selection from the Gemini prebuilt catalog and natural-language style
  direction (emotion, pace, register) passed through to the TTS call, surfaced
  in the authoring flow. Note Gemini TTS has no true child voices and
  no voice cloning; this can only approximate a lighter/younger register, so a
  provider with real child voices would be a separate follow-up.
- [x] Audit and harden the system prompts that drive user media creation and
  editing, porting the guidelines proven while authoring the built-in library.
  Analyze all media metadata and evaluate the quality of the generation prompts
  in `src/server/services/sceneMediaScripts.ts` (and the revision/authoring
  chat). The built-in design docs already encode most of the quality bar —
  `design/scene-scripts/README.md` (P1–P7 quality requirements) and
  `design/scene-scripts/script-levels.md` — so the work is to distill those into
  the app's prompts and validation. Full analysis:
  [User Media Generation Prompt Audit](../issues/user-media-prompt-audit.md).
  Done 2026-07-13 (commit `b87c2a45`): all sub-tasks below implemented in
  `sceneMediaScripts.ts` (schema + prompt + content validation),
  `audioGeneration.ts` (gender-keyed voices), and the revision template.
  Findings, in priority order:
  - [x] **P0 — Gender-aware voices (end-to-end).** `audioGeneration.ts` assigns
    TTS voices by speaker order (`['Kore','Puck','Aoede']`), not gender, and the
    generation schema has no `gender` field — so the user path reproduces the
    exact bug the built-in library just fixed (a two-man dialogue gets a female
    voice; monologues are always female). Add `gender` to the script schema and
    prompt (the model already receives the image), and pick each voice from a
    gender-keyed pool (female: Kore/Aoede/Leda; male: Puck/Charon/Fenrir),
    reusing the runtime `SceneMediaSpeakerGender` type.
  - [x] **P1 — Forbid narration/meta text inside spoken turns.** The type union
    prevents a "mixed" script type, but nothing stops descriptive lines inside a
    turn ("He opens the door and says…") or meta phrases ("this image shows").
    Add the prompt rule and a server check mirroring the built-in
    `validate_no_description_phrases`.
  - [x] **P1 — Complexity-based level guidance.** Replace the duration-based
    hints ("about 20–45 seconds") with the `script-levels.md` bands
    (grammar/vocab/connectors per level plus the listening-load rule: shorter,
    single-pass-parseable sentences).
  - [x] **P2 — Narrative/identity specifics.** Name each character aloud in the
    first one or two turns; scale cast size by level (two speakers for A1-A2, at
    most three higher); require a clear arc (setup, complication, action,
    resolution). (Identity strategy and the answerability rule are already
    ported.)
  - [x] **P2 — TTS-safe text.** Instruct the model to spell out abbreviations and
    numbers so names/times/figures are pronounced correctly.
  - [x] **P3 — Schema tightening + revision parity.** Require `min(2)` speakers
    for `dialogue` (a one-speaker dialogue currently validates). The legacy
    all-purpose revision path inherited the same generator rules until that
    chat flow was removed on 2026-07-14.
- [x] Review the quality of every prompt in the media **creation and editing**
  flow, one prompt at a time, applying the `system-prompt-coherence` skill (read
  each loop as the model sees it: no contradictions, duplicated rules, or
  forbidden behavior without a stated alternative; confirm each carries the right
  gender/identity/level/safety guidance; and rewrite any JSON-shape description as
  TypeScript type/interface syntax per the skill's JSON Shape Convention). This
  extends the completed user-media
  audit above ([User Media Generation Prompt Audit](../issues/user-media-prompt-audit.md))
  to the full media prompt surface. Analyze each prompt one by one:
  - [x] **Script/metadata system prompt** —
    `system-prompts/scene-media/generation.md`. Now holds the self-documented
    TypeScript `Response`/`Script` type (the response contract), with per-field
    doc comments as the single source of truth; the field rules were removed from
    the prose so nothing is duplicated. Rules are coherent with the Zod schema.
  - [x] **Script/metadata user prompt** — `buildSceneMediaScriptUserPrompt` in
    `services/sceneMediaScripts.ts`. Replaced the inline JSON example with a
    reference to the `Response` type in the system prompt (single source of
    truth), and made the monologue `gender` required in the generation schema so
    the type matches field-for-field. Static level/format guidance stays in code
    (per-request assembly, not a flat template).
  - [x] **Image generation prompt** — `buildSceneMediaImagePrompt` in
    `sceneMedia/imageGeneration.ts` (format instruction, level, script hint,
    safety). Completed 2026-07-14: all formats and script preferences now share
    one scene-only rule that rejects captions, labels, panel numbers, speech
    bubbles, arrows, callouts, diagram marks, UI, logos, and watermarks. Natural
    text/signage is allowed only when intrinsic to the requested setting or
    specifically requested as a natural in-world object. Format and level
    guidance now state the positive visual alternative (actions, objects,
    composition, expressions), and regression tests cover every
    format/preference combination.
  - [x] **Source / continuity context** — `buildSceneMediaSourceContextPrompt` in
    `sceneMedia/generationContext.ts`. Completed 2026-07-14: the block is
    explicitly untrusted quoted data, only the active request is actionable,
    each layer decision has a concrete authority rule, and direct image evidence
    wins over stale descriptive metadata. Image editing now receives this
    context too, so a regenerated image stays compatible with a kept script.
  - [x] **Title system/user prompts** — `system-prompts/scene-media/title.md`
    and `buildSceneMediaTitleUserPrompt`. Reviewed 2026-07-14: the TypeScript
    response contract is the single source of field rules, the task is explicit,
    and source context remains untrusted continuity data.
  - [x] **Legacy revision planning and correction prompts** — removed with the
    retired media authoring chat on 2026-07-14; layer-specific modals now send
    explicit parameters directly to their dedicated generation flows.
  - [x] **Anti-drift tests for prompt ↔ schema ↔ data sync.** Completed
    2026-07-14: CI structurally compares the TypeScript `Response` contracts in
    `generation.md` and `title.md` with their Zod schemas (including fields,
    optionality, unions, enums, and discriminants), validates every built-in
    script against the generation contract, and checks the design script/image
    registries for supported types, speaker genders, identity strategies, and
    approved image references. The built-in build now carries narration gender
    into runtime data. Changing a prompt contract, schema, or built-in/design
    record without updating the others now breaks CI.
- [x] Add recoverable Media Library trash. Done 2026-07-26:
  `/media-library/trash` lists archived user-generated media, and
  `POST /media-library/:mediaId/restore` returns an item to ready status and
  the active library. Built-in media is never archivable. The Trash surface
  uses a dedicated view, a quiet entry link below the catalog controls, a
  deterministic close-`X` back to the catalog, breadcrumbs, an empty state,
  and es/en/ht copy. No permanent-delete action was added.
- [x] Review the Google image and TTS model lifecycle. Done 2026-07-26:
  production uses the code defaults `google/gemini-3.1-flash-lite-image` and
  `google/gemini-3.1-flash-tts-preview`. The image model is stable. The TTS
  model is still officially a preview, has no announced stable replacement or
  shutdown date, and should keep its current id for now. The retired
  `gemini-3.1-flash-image-preview` id is not used by Mister F. Do not rewrite
  historical built-in media metadata when a future model changes: its model
  fields record which model generated the existing assets.

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
  infrastructure from [1.3 Scene Media Library](#13-scene-media-library)
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

- Step 2.5 — **Results return for roleplays and practice guides** — **moved to
  [Roadmap V3 §1.6](roadmap-v3.md#16-quiz-results--next-class-report) on
  2026-07-26** at the founder's direction (pulled forward from this candidate
  ladder into the committed V3 scope). Implementation proposal lives there.
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

## 1.7 Manual Quiz Editing

Deferred from [Roadmap V3 §1.3](roadmap-v3.md) on 2026-07-26 at the founder's
direction. V3 keeps the scoped AI block-change operation as the only way to
correct block content; the previously proposed minimal V3 editor will not ship.

- [ ] Add deterministic manual editing across every supported quiz item kind,
  including prompts, answer options, answer keys, explanations, and kind-specific
  fields, without requiring inference.
- [ ] Add deterministic section rename, delete, and block reassignment controls.
- [ ] Preserve the proposal-and-approval boundary of AI modifications: manual
  edits save explicit author input, while AI operations continue to preview
  before apply.
- [ ] Cover each item-kind editor and section operation with service and
  route/render tests.

## 1.8 Master Chat (Idea To Consider)

Added 2026-07-26 as an exploratory V4 idea. Consider a **Master Chat** through
which an authorized user — presumably a teacher — can manage the site's
content conversationally by using a dedicated set of tools.

- [ ] Explore the product shape and validate the teacher use case before
  committing implementation scope. The chat could provide one place to find,
  create, organize, update, share, and archive resources and other
  teacher-owned content without navigating each authoring surface separately.
- [ ] Define a safe tool and permission model. The assistant must act only
  within the user's existing authorization boundaries, distinguish read
  operations from mutations, preview consequential changes before applying
  them, and leave an auditable record of tool actions.
- [ ] Decide which content types and operations belong in the first viable
  version, how the Master Chat reuses existing deterministic services instead
  of duplicating business logic, and when it should hand the user off to a
  dedicated visual editor.

## 1.9 History-Aware Agents: Resources And Recommendations From The Learner Record (Idea To Consider)

Added 2026-08-01 at the founder's direction. Idea: **agents that work over the
user's own history** and turn it into something actionable — either generating
resources the learner can practise with next, or producing recommendations for
the learner and for the teacher. Today every resource is created by an explicit
authoring act (someone opens `/quizzes/new`, writes a prompt, generates); the
learner record is written to, read for the progress page, and otherwise inert.

**This is an exploration, not committed scope.** The point of writing it here
is that the raw material already exists and nothing consumes it yet. The
founder's concrete first shape for it — a standing list of *the next five things
to practise* — is written up below, before the open questions, because it turns
the abstraction into something that can be shown to a learner and judged.

### What The History Already Contains

- `learner_progress_events` — one row per evaluated attempt or conversation
  report (`quiz_attempt`, `roleplay_attempt`, `tutor_conversation_report`), with
  a title, a summary, the originating `resourceId`/`resourceType`, and
  structured `details`: `difficulties`, `practiced`, `progress`,
  `recommendations`, `vocabulary`. The per-event `recommendations` are already
  generated and already persisted — no surface acts on them.
- The rolled-up progress profile per learner profile (`overview`,
  `strengths`, `focusAreas`, `recommendedPractice`, `vocabulary`,
  `updatedFromEvents`).
- Conversations (including practice-guide chats), quiz and roleplay attempts,
  and the resources the learner already owns or was shared.

So the first question is not "what data would we need" but "what should read
the data we already write".

### A Concrete First Shape: "The Next Five Things To Practise"

Added 2026-08-01 (founder). The most useful thing this agent could produce is
not an open-ended analysis but a **short, standing list: the next five things
this profile can practise.** Five is small enough to read, to act on, and to
regenerate cheaply; an unbounded feed is neither.

It is worth writing down because it makes the abstract idea testable — a list of
five is something you can show a learner and ask "is any of this what you would
have picked?", which no amount of internal reasoning answers.

**It draws on two sources, and they are not equal.**

1. **What the learner says about themselves** — the profile's own description
   and learning context. This is the *cold start*: on day one there is no
   history, and the self-description is the only thing that can make the five
   items specific rather than generic. It is also what keeps the list anchored
   to why the person is learning at all, which the history alone never says: an
   attempt record shows what went wrong, not that the learner needs English for
   a job interview next month.
2. **What the profile has already practised** — the `learner_progress_events`
   record and the rolled-up progress profile. This is what makes the list
   *change* over time: it should not keep proposing what was already mastered,
   and it should follow up on recurring difficulties.

The ordering matters for design: source 1 sets the *direction*, source 2 sets
the *next step*. A list built only from history drifts into remediation of
whatever the learner happened to attempt; a list built only from the
self-description never learns.

**Which exposes a real dependency the product does not currently honor.**

If the cold start depends on the self-description, then the moment the learner
writes it is load-bearing, and today it is treated as optional and minor:

- The onboarding screen offers **`Omitir por ahora`**
  (`views/profile-onboarding.ejs`, `POST /profiles/onboarding/skip`), so the
  field can be empty for the entire life of the profile.
- The copy is permissive rather than motivating — *"Puedes contar para qué
  quieres aprender inglés…"* (`profiles.onbContextHelp`) and *"Puedes mencionar
  tus objetivos, intereses, trabajo…"* (`profiles.contextHelp`). It reads like an
  optional bio, not like the input that shapes everything the tutor proposes.
- The tutor already substitutes `'No especificado.'` when it is blank
  (`llmTutor/prompt.ts:230`), which is the honest downstream cost made visible.

- [ ] **Make the self-description feel load-bearing at the moment it is
  written.** Explain what it is used for in concrete terms ("this is how Mr. F
  decides what to suggest you practise next"), show an example of a good answer
  rather than a list of categories, and reconsider whether skipping should stay
  as frictionless as it is. This is worth doing **independently of the agent** —
  the tutor and the authoring prompts already consume the field — but it becomes
  a prerequisite if the five-item list is built on it.
- [ ] **Decide what the list does when the description is empty and there is no
  history.** A brand-new profile with a skipped onboarding is the common case,
  not the edge case, and "five generic suggestions" is worse than showing
  nothing: it teaches the learner the feature is not about them. The honest
  answer may be to show the onboarding prompt instead of the list.
- [ ] **Decide whether the five are recommendations or generated resources.**
  This is the recommend-versus-generate question below, scoped: five *proposals*
  ("practise past tense in work situations") cost one cheap call and no clutter;
  five *generated quizzes* cost five expensive calls and five objects the
  learner must manage. Recommending, with generation as an explicit per-item
  action, is the obvious v1.
- [ ] **Decide when it refreshes.** A standing list implies staleness: after
  each evaluated attempt, on a schedule, or on demand. The quiz participation
  summary already solved this exact problem with an input fingerprint plus a
  "there are new responses since this summary" badge
  ([Roadmap V3 §1.6](roadmap-v3.md)) — reuse that pattern rather than inventing
  a refresh policy.

### Open Questions To Settle Before Any Scope

- [ ] **Who is the agent for?** A learner-facing agent (propose and generate
  the next practice) and a teacher-facing agent (what this student, or this
  group, needs next class) are different products with different privacy
  boundaries. Decide whether they are one engine with two audiences or two
  separate features, and note that the teacher half only makes sense on top of
  the sharing primitive — see [1.6](#16-guides-aula-section-and-managed-accounts-candidate--gated-on-pilot-evidence)
  and the V3 next-class report.
- [ ] **Recommend versus generate.** Recommending existing resources
  (rank what the learner already has access to, plus built-in content) is
  cheap, deterministic-ish, and reversible. Generating a new quiz, practice
  guide, roleplay, or scene media from the history is expensive, credit-gated,
  and creates clutter the user must then manage. Decide whether v1 recommends
  only, and treat generation as a second step the user explicitly approves.
- [ ] **When does it run?** Reactive (the learner asks, or a button on the
  progress page), event-driven (after an attempt is evaluated), or scheduled
  (a weekly digest). Background generation implies job infrastructure that
  1.3 deliberately removed, and credit spend the user did not initiate — that
  tradeoff must be decided, not inherited.
- [ ] **Where does it surface?** This overlaps directly with the personalized
  start surface already designed in
  [Home Start Experience](../features/home-start-experience.md) and
  [Home Suggestions Tracker](../issues/home-suggestions-tracker.md), and with
  the progress page. Do not build a second suggestion ranker beside those;
  decide whether this initiative *is* their engine.
- [ ] **Relation to [1.8 Master Chat](#18-master-chat-idea-to-consider).** Both
  are agentic surfaces over the same deterministic services. Master Chat is
  user-driven content management; this is history-driven proposal. They may
  share the tool layer and the preview-before-apply boundary.
- [ ] **Trust and evidence.** A recommendation should cite the events it came
  from ("three attempts, past tense errors in each") so learner and teacher can
  judge it, and so a wrong suggestion is diagnosable rather than mysterious.
- [ ] **Privacy and boundaries.** The agent reads a learner's record; define
  what a teacher may see (attempts explicitly shared with them, not the
  learner's private tutor conversations), and keep every tool call inside the
  caller's existing authorization boundary.
- [ ] **Quality gate.** Generated-from-history resources must pass the same
  level, safety, and prompt-contract bar as authored ones; sequence this after
  the inference governance work in
  [2.1](#21-llm-inference-portfolio-audit-and-governance) so a new recurring
  inference class does not silently inherit an unsuitable default model.

---

## 1.10 Share Image For The Landing And Shared Resources

Moved here from [Roadmap V3.5 §1.5](roadmap-v3-5.md) on 2026-08-01 at the
founder's direction. The landing shipped a **placeholder** card on 2026-07-30 —
`public/brand/share-card.png`, 1200×630, the Mister F logo centred on white,
composed from `design/MisterF-v2.png`. It works; it just does not do any work.
Replacing it is a design exercise rather than landing infrastructure, which is
why it left V3.5 rather than blocking it.

Why it is worth more than its size suggests: **sharing a link is the only
acquisition channel the product has today.** Traffic comes from founder outreach
and from teachers pasting links into WhatsApp, so the preview card is a more
valuable surface than any meta tag.

Two things the placeholder makes concrete:

- **One file serves two very different surfaces.** `resources/handlers.ts:631`
  points at the same PNG, so "Mister F, the product" and "a teacher shared an
  activity with you" produce an identical picture. The resource card at least
  carries a specific title and description in text; the landing has nothing to
  tell it apart.
- **It renders full width.** `twitter:card` is `summary_large_image`, so a small
  centred mark on an empty white field looks emptier the larger it is drawn.

- [ ] Decide whether the two surfaces should share one image at all, or whether
  a shared activity deserves its own card. The text beside them already differs;
  the question is whether the picture should.
- [ ] Design the landing card. A card that says what the product does, or that
  shows the results view the hero already mockups, would convert better than a
  bare logo. The landing's own visual system
  (`public/landing.css`: brand blue over warm paper, Literata headlines, a
  single terracotta accent) is the obvious source, and the hero mockup is a
  ready reference.
- [ ] Keep the §1.1 rule: the card may promise an outcome, never name a screen
  or a metric the product does not have. It is seen by more people than the page
  it links to, and by people who will never scroll far enough to be corrected.

---

## 1.11 A Derived Chat Must Say What It Was Derived From

Added 2026-08-01 (founder request): once a practice chat is derived from a
resource, that conversation should carry a link, somewhere durable, back to the
resource it came from.

The `resource-follow-up-conversations` skill already states this as a rule —
*"the conversation UI shows a visible link back to the source resource or result
so the learner can return to what they practiced from"* — so this is not a new
convention. It is a convention that half the derivation paths do not honor, and
that the other half honors in a way that does not survive a real session.

### What Happens Today

There are four ways a conversation gets derived from something, and they behave
differently:

| Origin | Link back today |
| --- | --- |
| Quiz attempt -> `Practicar` | A source-notice message naming the quiz and its result (`addResourceSourceNoticeMessage`) |
| Roleplay attempt -> `Practicar` | The same message |
| Practice guide -> chat | **Nothing.** `createConversationFromPracticeGuide` writes the snapshot and stops |
| Tutor report -> `Practicar` | **Nothing.** `createConversationFromTutorReport` writes the snapshot and stops |

So a learner practising a guide, or following up on a report, has no way back
from inside the chat — and every one of these conversations *does* store a
frozen source snapshot, so the link is a rendering gap, not a data gap.

### Three Problems, Not One

1. **Two of the four paths have no link at all.** The practice-guide case is the
   one a teacher's student is most likely to hit, since a shared guide is one of
   the three things a teacher assigns.
2. **The message scrolls away.** Where the link exists, it is the first message
   in the transcript. That is fine for one exchange and useless after twenty:
   the learner who wants to re-read the quiz is the learner who has been
   practising for a while. The skill says *"the conversation UI shows"* a link,
   which reads as chrome — persistent, next to the title — not as a message the
   conversation buries. A message is also the wrong place structurally: it is
   indistinguishable from something the tutor said.
3. **The copy is hardcoded Spanish.** `addResourceSourceNoticeMessage`
   (`db/repository.ts:5076`) builds `'el quiz'` / `'el Roleplay'` and its whole
   sentence inline, so an English or Creole learner who practises from a quiz
   gets a Spanish sentence from the tutor in an otherwise translated
   conversation. The conversation already carries `instruction_language`, so the
   locale is available where the message is written.

### Shape Of A Solution

- [ ] Decide where the link lives. Recommendation: **conversation chrome**, near
  the title, rendered from the stored snapshot rather than appended as a
  message — that is what makes it survive a long session and what the skill's
  wording already implies. Keeping the opening message as well is reasonable
  (it sets up the first turn), but it should stop being the only affordance.
- [ ] Cover all four origins, including practice guides and tutor reports. The
  snapshot tables already identify the source in every case
  (`conversation_quiz_attempt_snapshots`, `conversation_roleplay_attempt_snapshots`,
  `conversation_tutor_report_snapshots`, `conversation_practice_guide_snapshots`).
- [ ] Translate the source notice into es/en/ht, keyed off the conversation's
  own `instruction_language`.
- [ ] Handle the source being archived or deleted. The conversation reads its
  snapshot, not the live resource, so the chat itself keeps working — but a link
  to a resource the learner can no longer open should degrade to a plain label
  rather than a dead link.
- [ ] Decide what a *shared* participant sees. A student who practises from a
  teacher's shared quiz should reach the quiz they took, not a resource page
  they do not own; check this against the sharing rules before wiring the href.

### Related

- `.agents/skills/resource-follow-up-conversations` — the rule this closes, and
  the snapshot model behind it.
- [Roadmap V3.5 §1.10](roadmap-v3-5.md) — the same blindness one surface over:
  a practice-guide conversation is also unlabelled in the `Recientes` sidebar,
  so it is indistinguishable from an open-ended chat. That item is closed except
  for the labelling fix, which is the sidebar half of this problem and could
  reasonably ship with it.

---

## 1.12 Chat Groups (Idea To Consider)

Added 2026-08-01 at the founder's direction. Idea: **WhatsApp-style group chats
where learners write to each other in English**, with an agent reading the
conversation afterwards to identify each participant's errors and turn them into
practice.

**This is an exploration, and unlike most of this document it is not an
extension of an existing surface.** Everything the product does today is either
solo practice or a teacher assigning to a student; a group chat is the first
peer-to-peer surface, and that changes what has to be true before it ships.

### Why It Is Interesting

- **It is practice that does not feel like practice.** The learner writes English
  to be understood by a person, not to be graded, which is the closest thing to
  real use the product could offer — and error-correcting from authentic output
  is pedagogically stronger than correcting an exercise the learner knew was an
  exercise.
- **It reuses the engine that already exists.** "Read the record, find recurring
  difficulties, propose the next practice" is exactly
  [1.9](#19-history-aware-agents-resources-and-recommendations-from-the-learner-record-idea-to-consider),
  and `learner_progress_events` is already the shape errors get written into. A
  group chat is a new *source* for that pipeline, not a new pipeline.
- **It is the first thing in the product with a retention loop that is not the
  founder.** Today the only reason to come back is an activity someone assigned
  you; other people waiting for your reply is a different order of pull. Link
  sharing is the only acquisition channel the product has, and a group is a
  reason to bring someone in.
- **It fits the teacher story without needing the classroom entity.** A teacher
  with a group of adult learners already has a WhatsApp group; this is that
  group with correction attached.

### What Would Have To Be Decided First

These are not implementation details — several of them can sink the feature.

- [ ] **Moderation.** This would be the product's first user-generated content
  visible to other users. There is no moderation of any kind today, anywhere,
  and the audience is adult immigrant learners who may be vulnerable. Decide what
  happens when someone posts abuse, spam, or personal data, who can remove it and
  remove a member, and what the operator's obligation is. **A group chat with no
  answer here should not ship.**
- [ ] **Privacy of the correction.** Errors are personal. Decide whether an
  analysis is private to the writer, visible to a group owner (a teacher), or
  visible to the group. The V3 consent model is a **per-attempt** disclosure
  shown before answering; a continuous chat has no equivalent moment, so a new
  consent shape is needed — and "you agreed once at join time" is a weaker
  promise than what the product currently makes.
- [ ] **Who pays, and for what.** Group inference is unbounded in a way nothing
  else in the product is: messages arrive whether or not anyone asked for
  analysis. Per-message analysis multiplies cost by traffic. Decide whether the
  agent runs per message, per session, or on an explicit "analyse my week"
  action, and whose credit it draws — note that the credit model is strictly
  per-user today, and a group has no wallet. See §1.7 of
  [Roadmap V3](roadmap-v3.md) for how tight the welcome credit already is.
- [ ] **Correcting people in front of each other.** The obvious naive design —
  the tutor replying inline with corrections — would make learners write less,
  not more, which defeats the entire premise. The likely answer is that the group
  stays uncorrected and the correction arrives privately, later. Decide this
  before any UI, because it determines whether the feature helps or harms.
- [ ] **Relation to the classroom shape.** A group is very close to the `Aula`
  concept in [1.6](#16-guides-aula-section-and-managed-accounts-candidate--gated-on-pilot-evidence)
  and to [Classrooms](../features/classrooms.md). Decide whether a chat group
  *is* a classroom with a chat, or a separate lightweight primitive — building
  both is how the product ends up with two membership models.
- [ ] **What it costs to build.** Real-time multi-user chat is meaningfully more
  infrastructure than anything here today: the socket layer
  (`socket/chatSocket.ts`) exists but is scoped to one user and one conversation,
  and there is no membership, presence, notification, or read-state model.
  Estimate this honestly before it is compared against cheaper items.
- [ ] **Whether learners actually write to each other.** The failure mode is an
  empty group, and it is the most likely one: a group with three people and no
  messages is worse than no group, and the analysis engine has nothing to read.
  Decide what seeds conversation — a teacher prompt, a daily topic, the tutor as
  a participant — and treat "will they post" as the hypothesis to test first,
  cheaply, before building the surface.

### Related

- [1.9](#19-history-aware-agents-resources-and-recommendations-from-the-learner-record-idea-to-consider)
  — the error-to-practice engine this would feed, including the "next five
  things to practise" shape.
- [1.6](#16-guides-aula-section-and-managed-accounts-candidate--gated-on-pilot-evidence)
  and [Classrooms](../features/classrooms.md) — the membership model this must
  not duplicate.
- `.agents/skills/learner-progress-events` — where per-participant findings would
  be written so the rest of the product can already read them.

---

## 1.13 Estimate What A USD 5 Package Actually Buys

Added 2026-08-01 (founder). The credits page used to tell buyers, in all three
locales and directly beside the purchase button, that a package covers
*"aproximadamente un mes de práctica regular."* **That sentence was removed the
same day** — nothing in the code or in any approved business document supported
it, and it is the same unmeasured duration claim
[Roadmap V3.5 §1.1](roadmap-v3-5.md) refused to write on the landing. The
purchase note now says only what is true: exchanges consume credits, and the
payment goes to Little Software LLC.

**The claim was worth making, which is why this item exists.** "How fast does
this drain?" is the question a buyer actually has, and the honest answer is
better than no answer. It just has to be measured first.

### What Is Already Known

Measured 2026-08-01 from the structured logs, which carry
`usage.raw.cost_details.upstream_inference_cost` per call — real money, per
operation, already on disk and never analysed until now:

| Operation | n | Mean cost (USD) |
| --- | --- | --- |
| Tutor turn (`Mr. F`) | 56 | 0.00645 |
| Practice guide draft | 2 | 0.01057 |
| Quiz draft | 2 | 0.00977 |
| Roleplay participation summary | 3 | 0.00601 |
| Practice guide participation summary | 1 | 0.00514 |
| Tutor report | 3 | 0.00470 |
| Roleplay evaluation | 4 | 0.00416 |
| Quiz responses summary | 3 | 0.00383 |
| Roleplay draft | 1 | 0.00377 |
| Quiz metadata revision | 2 | 0.00180 |
| Roleplay turn / opening turn | 26 | ~0.00086 |

Two immediate readings. **The tutor turn dominates everything** — at ~$0.0065 a
turn it costs more than most one-off generations, and a session is many turns,
so package duration is essentially a function of how much someone chats. And a
measured guide session (3 turns plus the finalized report) cost **$0.034**, which
against a USD 5 package would be ~145 such sessions — but that number is not
trustworthy yet, for the reasons below.

### Remeasured 2026-08-03, After BYOK And The Tier Fix

The table above was gathered while inference ran through a BYOK provider key and
while four services hardcoded the `regular` tier. Both are gone as of `3.7.0`, so
those figures are historical. A clean full **student** cycle on a Lite profile —
quiz answered and evaluated, guide session of two tutor turns, finalized report —
now costs, per the key's own billed `usage`, **$0.0233**:

| Call | Logged `upstream_inference_cost` |
| --- | --- |
| Quiz evaluation | $0.00213 |
| Tutor turn | $0.00740 |
| Tutor turn | $0.00590 |
| Tutor report | $0.00105 |
| **Log total** | **$0.01648** |
| **OpenRouter billed `usage`** | **$0.02328** (contaminated — see the correction below) |

**Correction, 2026-08-03: the log and the billed usage agree exactly.** The ~41%
gap first recorded here was an artifact of the account used, not a provider
margin — that key had spent under the old provider-key routing, and the
settlement of that older spend landed inside the measurement window. Re-measured
on an account created after the change, with a single isolated inference and
nothing else: the logged `costUsd` read **$0.0023631** and the key's `usage`
moved from `0` to **$0.0023631**. Ratio 1.000.

So the per-call log can be summed for totals. The rule that survives is narrower:
**measure on an account with no history under a previous billing arrangement**,
and read `usage` before and after rather than trusting a cumulative figure.

On this basis a USD 5 package is on the order of **300 student cycles** (using the
trustworthy $0.01648 figure), and the tutor turn remains the dominant term at
roughly $0.006–0.007 each. That is still not the sentence to publish: it is one
cycle, on one profile, with a two-turn session.

### Why This Is Not Yet An Answer

- [x] **Quiz evaluation is missing from the telemetry entirely.** It called
  `generateText` directly without the wrapper that emits `llm_response`, so the
  single most-run inference in the teacher cycle had no cost record. Fixed in
  `3.7.0`: it now logs as `Quiz evaluation` / `quiz_evaluation`.
- [x] **Reconcile against OpenRouter's own usage figures.** Done 2026-08-03: on a
  clean account they agree to the cent. The `0` readings that made the endpoint
  look laggy were the previous provider-key routing excluding spend from the
  limit, not lag.
- [ ] **Define "regular practice" before estimating its duration.** A month for
  a learner doing two 10-turn sessions a week is a very different number from a
  daily user. The estimate has to name the usage it assumes, or it will be wrong
  for everyone.
- [x] **Cost telemetry must exist in production.** Found 2026-08-03 and fixed the
  same day: cost lived only inside `llm_response`, which is `logger.debug` and
  gated behind `LLM_TRACE_MODE`. Production runs at `LOG_LEVEL=info`, so **no
  cost was recorded in production at all** — every figure in this document came
  from a developer's machine. A dedicated `llm_cost` event now logs at `info`,
  ungated, carrying model, operation, tokens and cost but no prompt text, at all
  nine `generateText` call sites. Two of those (block repair and the translator)
  had never recorded cost in any environment. An architecture guard keeps the
  counts matched. Verified live with `LOG_LEVEL=info LLM_TRACE_MODE=off`: the
  cost event is written, the debug trace is not.
- [ ] **Run the sessions.** These are live-product runs, not unit tests, and they
  are mine to execute — see `.agents/skills/live-product-qa`. Concretely: a
  learner-only week (tutor chat plus follow-up practice), a full teacher cycle
  (authoring, sharing, evaluation, participation summary), and a
  chat-heavy session to find the upper bound.
- [ ] **Then write the sentence, with its assumption visible.** Something the
  code can back — "about N sessions of practice" beats a duration, because
  sessions are what the product counts and months are what usage varies over.

### Related

- [Roadmap V3.5 §1.1](roadmap-v3-5.md) — the rule this restores: the product may
  not state a commercial term that is not readable in the code or an approved
  business document.
- [Roadmap V3 §1.7](roadmap-v3.md) — the welcome-credit finding from the same
  session, and why the free cap is set by a provider reservation rather than by
  cost.
- [Roadmap X §X.1](roadmap-x.md) — platform metrics; this item is the narrow,
  answerable slice that does not wait for it.

---

## 1.14 Source Attachments (Files And URLs In AI Inferences)

Added 2026-08-30. Research: [AI Inference File Attachments](../research/ai-inference-file-attachments.md);
the narrower "create from source" flow it supersedes is in
[Third-Party Resource Exercise Extraction](../research/third-party-resource-exercise-extraction.md).

A teacher can attach source material — image, PDF, DOCX, or a URL — to resource
creation and to tutor chat. Images and PDFs go to the model as bytes; DOCX and
URLs are extracted to text server-side. **The binary is never persisted**: it
reaches the model once, and what survives into later turns is a text digest
stored on the message. Built on branch `v3` on 2026-08-30; the ingestion layer,
the upload endpoint, resource-creation wiring, and the chat wiring are in place
and verified live, so what follows is the work that came out of building it.

**Governing principle (founder, 2026-08-30): an attachment is part of a prompt
and shares that prompt's fate.** It is not a document the system holds on to, and
it has no life of its own beyond the request it was attached to. Where the
prompt survives, the attachment survives with it; where the prompt is consumed
and gone, so is the attachment.

That single rule settles most of the questions this feature keeps raising:

- In **chat**, the prompt is a message in a conversation that persists, so the
  attachment persists alongside it and later turns can refer back to it.
- In **resource creation and revision**, each AI operation is single-turn —
  request in, proposal out, no history — so the attachment lives exactly as long
  as that one request. A revision cannot refer to a document from an earlier
  operation for the same reason it cannot refer to an earlier prompt: neither
  one is there any more.

Consequences worth stating so nobody re-derives them as problems: there is no
attachment library, no re-use of a previously uploaded document, and no need for
a revision modal to show material from the creation step. Anyone who wants the
same worksheet in a second operation attaches it again.

**Attachments do not propagate into derived entities — founder decision,
2026-09-05.** An attachment belongs to the prompt it was attached to, and stops
there. It is not carried into whatever that prompt produced.

Audited 2026-09-05, and the shipped behaviour already matches:

| Inference | Sees the attachment? | |
| --- | --- | --- |
| Tutor agent loop | yes | the digest is rehydrated from `messages.metadata` onto its own turn |
| Resource creation and quiz modification | on that request only | single-turn; consumed and gone |
| Roleplay attempt turns | no | receives the stored draft, never the material that produced it |
| Block repair | no | `buildRepairMessages()` sends a fixed instruction with no history |
| Conversation report | no | `formatTutorTranscript` reads `message.content` |
| Create resource from conversation | no | `formatConversationTranscript` reads `message.content` |

Chat is the one place an attachment persists, because there the prompt itself
persists: the block representing it is part of the turn. Even so, a summary is
not obliged to cover it.

One nuance to keep straight, since it is easy to misremember: in the last two
rows the model is not *choosing* to leave the attachment out. The digest lives
in `metadata` and those transcripts are built from `content`, so it never
reaches the model at all. If it should ever become the model's judgement rather
than an absence, that is a change, not the current state.

A useful side effect: because those transcripts never carry the fenced
`ATTACHED DOCUMENT` block, the provenance leak fixed on 2026-09-04 cannot
reappear through the create-resource-from-conversation path.

### Shipped in the first pass

- [x] Ingestion layer: sniffing by magic bytes, `sharp` image normalization
  (EXIF stripped, capped at 1568 px), PDF page-count and scanned detection,
  `mammoth` for DOCX, `html-to-text` for HTML, URL fetch with DNS pinned against
  rebinding. **Done 2026-08-30.**
- [x] Upload endpoint with CSRF accepted via `x-csrf-token` header, bounded
  in-memory staging, one-shot ownership-checked claiming. **Done 2026-08-30.**
- [x] Wired into quiz/roleplay/practice-guide creation and into tutor chat,
  with the binary released after the first turn so retries and agent steps
  cannot re-bill the document. **Done 2026-08-30.**

### 1.14 Implementation Note — 2026-08-30 (second pass)

§1.14.1, the architecture item in §1.14.2, and §1.14.3 shipped together, since
they are three faces of one change. Verified live end to end on the local
server:

- Every attachment is extracted to text up front by
  `services/attachmentExtraction.ts`. Images and PDFs get a vision pass, because
  that is where reading order and scans live; DOCX and URLs pass through their
  mechanical text untouched, because an inference over already-faithful text
  could only paraphrase it.
- The byte path to the tutor is **gone**. A verified trace shows the model
  receiving the user's words followed by a fenced `ATTACHED DOCUMENT` block —
  the same text the user approved — and no binary anywhere in the request.
- The attach wizard runs process → review → accept, with two outcomes only.
- The transcript renders a chip per attachment; clicking it reopens the exact
  text the model received.

Defects found and fixed during this pass, both in guards that should have
caught them:

- `inferenceWaitStateArchitecture.test.ts` read only the first identifier after
  a route path, so **any credit-gated route that takes middleware never entered
  the inventory**. `POST /attachments/process` was invisible to it. Fixed to
  scan every argument.
- `clientCatalogKeys.test.ts` filtered client `t()` references down to shipped
  namespaces before checking them, so a reference to a namespace nobody ships
  was silently ignored — it let a button render the literal text
  `common.cancel`. Fixed with a second assertion, and `common` is now shipped.

Still open in §1.14.2: observability, the memory-growth investigation, and
re-sizing the staging cap (now much less pressing — staging holds extracted
text, not binaries, so an entry costs kilobytes).

### 1.14.1 Show The User What The System Understood

The founder's requirement, 2026-08-30. **This is the item that matters most in
this section**, because it turns the feature's core compromise into something
honest rather than hidden.

- [x] When a user attaches a file or URL in chat, render a UI element in the
  transcript showing the attachment's name. Clicking it opens the **processed
  content** — the text the system actually extracted or, for an image, the
  description it generated. That text is exactly what travels through the rest
  of the conversation history, so the user sees precisely what the model sees.

Why this is worth doing properly:

- The digest is already the whole truth of the conversation after turn one. The
  user currently has no way to know whether the system read their worksheet
  correctly, and finds out only when the tutor answers oddly three turns later.
  Making the digest visible converts a silent failure into a checkable one.
- It is honest about a real limitation. A scanned PDF or a bad photo produces a
  thin digest; showing it lets the teacher re-shoot the photo instead of
  wondering why the tutor is vague.
- It costs nothing at inference time: the digest is already persisted in
  `messages.metadata`, so this is a rendering and a route, not new model work.
- It is a natural place to later allow **editing** the digest, which would let a
  teacher correct a bad extraction rather than re-uploading. Not in scope here,
  but the shape should not preclude it.

Design notes for whoever picks this up:

- The digest is plain text by contract (`AttachmentDigest.text`), including for
  images, where `textIsDescription: true` marks it as model-written rather than
  extracted. The UI should distinguish those two cases: "this is what the
  document says" and "this is what Mr. F saw" are different claims.
- Attachments are currently invisible in the transcript entirely — the message
  renders as if nothing were attached. Even before the click-through exists,
  showing the name would be an improvement.
- The stored digest is truncated to `maxDigestChars` (4,000). If the UI shows it
  as "what the system understood", the truncation has to be visible too, or the
  UI is lying by omission.

### 1.14.2 Analyze The Defects Found While Building This

Recorded 2026-08-30 so they are not lost. Each was found during implementation
and is **understood but not resolved**.

- [x] **Represent an attachment as a processed user input, not a model block.**
  Founder direction, 2026-08-30 (refined the same day). This supersedes the
  original problem it was raised against: a ~350-token untrusted-data warning
  appended to the system prompt on every turn for the rest of the conversation,
  long after the material stopped being relevant.

  The design:

  - When the user attaches a file or URL, it is processed **up front, on its
    own**, by a dedicated inference that turns it into clean text.
  - The result enters the conversation as **part of the user's own turn** — an
    attachment element carrying light metadata (file name, source type, page
    count, source URL) plus the processed text.
  - It is deliberately **not** heavily structured. It travels as user input, not
    as model output, so it does not need to satisfy an output schema.
  - Its framing travels with it: the element itself says it is a document the
    user attached rather than something the user wrote. That replaces the
    standing paragraph in the system prompt.
  - The extraction inference receives **the user's own prompt from when they
    attached the file**. "Make a quiz about the past tense from this" tells the
    extractor what matters in a six-page document, and is context we currently
    throw away.

  Being user input rather than a model block settles, by construction, the
  concern raised when this was first sketched as a tutor block: every one of the
  18 existing blocks is something the tutor *emits*, validated by
  `tutorAgentResponseSchema`, so an attachment joining that union could have
  been **fabricated by the model** — a document the user never uploaded,
  rendered as though they had. On the user side there is no such union and
  nothing to guard.

  **Security posture (founder decision, 2026-08-30):** an attachment is one more
  form of user text input and gets no special threat handling beyond the
  element's own framing. The tutor already receives untrusted user prose every
  turn. The distinction worth remembering, without acting on it now, is
  authorship: text the user typed is theirs, whereas a PDF they found is a third
  party's. That changes who is trying to influence the model, not whether the
  input is untrusted.

  **The priority is fidelity.** The element must faithfully reflect what the
  attachment actually contains. That, not sanitization, is the bar this work is
  measured against.

  Deferred, 2026-08-30: a second context parameter that the main model could
  fill to steer the extraction. Worth revisiting only if extraction quality
  turns out to need steering the user's own prompt cannot provide — it forces a
  choice between exposing the attachment as a model-callable tool and running a
  second, model-triggered extraction, and neither is worth paying for yet.

  One consequence to keep in view: this makes §1.14.1 truthful. That item
  promises the user sees what the system sees, which is only exactly true if the
  model sees text too. Today images and PDFs reach the model as bytes on the
  first turn and as text afterwards, so the one turn the user cannot inspect is
  the one where the model had the most information. Extracting to text up front
  collapses both into a single artifact. What it costs is visual fidelity on
  layout-heavy material — recoverable in large part, since extraction for images
  and PDFs is itself a vision inference, but it must be checked against real
  teacher worksheets before the byte path is removed — and some added latency at
  attach time.

- [ ] **Attachment observability is thin.** Audited 2026-08-30: the only events
  the feature emits are `attachment_ingestion_failed` (unexpected 500s only) and
  `attachment_image_description_failed`, plus the `llm_cost` line for the digest
  inference. Nothing is logged for a **successful** upload (type, size, pages,
  warnings, duration), for a **rejection** (`too_many_pages`,
  `content_mismatch`, `unsupported_type` — so we cannot see what users actually
  hit), for **URL fetches** (target, redirects, blocked-by-SSRF, extracted
  length), for **staging pressure** against the byte cap, or for whether a
  staged attachment was ever actually **claimed** by an inference rather than
  abandoned. The upload rate limiter's `shouldLogLimit` return value — which
  exists precisely so callers log once — is discarded. Without these, the first
  questions anyone asks about this feature in production are unanswerable.

- [ ] **Investigate the process's memory growth.** Founder direction,
  2026-08-30: 190 MB looked exaggerated, and on re-measurement it is not the
  baseline at all.

  Measured on 2026-08-30, same machine, same build:

  | Moment | Resident memory |
  | --- | ---: |
  | Immediately after a clean `pm2` restart | **29 MB** |
  | After one short QA session (a few image uploads, a handful of inferences) | **190 MB** |

  So the process grows roughly 160 MB from light use and does not give it back.
  The SQLite file is 1.4 MB and the largest generated module is 303 KB, so
  neither explains it. Candidates to rule out, cheapest first:

  - **`sharp` / libvips caching.** `sharp` is used by both scene media and the
    new attachment path, and its cache defaults to holding tens of MB of
    decoded image data. `sharp.cache(...)` and `sharp.concurrency(...)` are the
    knobs; this is the first thing to measure.
  - **V8 simply not collecting.** Growth is not a leak if the heap is mostly
    garbage awaiting GC under no pressure. Compare RSS against
    `process.memoryUsage().heapUsed` before concluding anything.
  - **A genuine retention leak** in staging, conversation state, or a cache that
    never evicts.

  This matters beyond tidiness: `max_memory_restart: '300M'` means unexplained
  growth is not a slow degradation but an abrupt restart, and a restart during a
  tutor turn drops the learner's conversation.

- [ ] **Re-size the staging byte cap once the above is understood.** The global
  cap is 48 MB (`maxStagedBytesTotal`), chosen against the 300 MB ceiling on the
  assumption of ample headroom. Whether that assumption holds depends entirely
  on the growth question above. If the 160 MB turns out to be real retention,
  16–24 MB is likely ample for the actual use case of one teacher attaching one
  document.

- [ ] **Trace logging dumped attachment bytes into the log.** Fixed 2026-08-30
  in the same pass (`redactModelMessageContent` in `llmTutor/logging.ts`, with
  `tests/attachments/traceRedaction.test.ts`), but recorded here because the
  failure mode generalizes: `LLM_TRACE_MODE` defaults to `full` in development,
  and a 37 KB image was being serialized byte by byte as
  `{"35026":47,"35027":0,...}`. Worse, `summarizeModelMessages` stringified the
  raw content merely to measure its length, so **metadata mode paid the same
  cost in production**. Any future non-text content in a model message needs the
  same treatment; consider a guard test that fails when a new part type reaches
  the logger unredacted.

### 1.14.3 Attaching Is A Stepped, Approved Process

Founder direction, 2026-08-30. Closely tied to §1.14.1: that item makes the
processed text inspectable after the fact, this one makes it approvable
before anything is sent.

- [x] **Attaching is a stepped wizard the user approves.** Founder direction,
  2026-08-30. Nothing reaches the conversation until the user has seen the
  processed text and said yes.

  Steps: **process → review → approve.** Reuse the existing shared controller
  `src/client/shared/modificationModal.js` (phases `describe` → `preview`, with
  generate / retry / apply) rather than introducing a second modal idiom; this
  is that pattern with a processing phase in the middle. Follow
  `bootstrap-modal-conventions` for markup and button semantics.

  **Phase 1 — Choose.** File picker or URL field, the accepted formats, and the
  size limit. Footer: `Cancelar` (secondary) and `Procesar` (primary).

  **Phase 2 — Processing.** Spinner with a label naming the actual step
  ("Leyendo el PDF…", "Describiendo la imagen…"), not a generic "Cargando".
  `aria-live="polite"` so it is announced. Static backdrop so a stray click
  cannot dismiss mid-extraction, but keep an explicit `Cancelar` in the footer —
  extraction is an inference and can be slow, and the conventions' no-close rule
  for pending modals assumes an uninterruptible operation, which this is not.

  **Phase 3 — Review.** The step that carries the whole feature. It must answer
  one question without the user having to infer it: *what will Mr. F actually
  receive?*

  - Heading states it plainly — "Esto es lo que Mr. F va a leer" — rather than
    labelling the panel "Vista previa", which says nothing about whose view it
    is.
  - The processed text in full, in a scrollable region, monospace or plain, with
    the file name and page count beside it.
  - **Distinguish transcription from description.** The `textIsDescription`
    flag already exists on the digest. "Esto es lo que dice el documento" and
    "Esto es lo que Mr. F vio en la imagen" are different claims and the user
    must be able to tell which one they are approving.
  - **Surface truncation.** The digest is capped at `maxDigestChars`. If the UI
    presents this as what the system understood while silently dropping the
    tail, it lies by omission.
  - Existing warnings (scanned PDF, image downscaled, thin URL extraction)
    render here, where they can still change the user's decision, instead of as
    a chip they already dismissed.

  Footer, in convention order: `Cancelar` (secondary) and `Aceptar` (primary).

  **Two outcomes, and the text is editable — founder decision, 2026-08-30,
  revised the same day after seeing the flow work.** No reprocess button: a user
  who wants a different extraction cancels and attaches the document again. But
  the review text **is** the input field, so a teacher who spots a misread word
  or a column read out of order fixes it in place instead of re-shooting the
  photo.

  Editing was initially rejected as scope and then adopted, which turned out to
  be the right order — the review step had to exist and be trusted before it was
  obvious that reading without being able to correct is frustrating.

  What this does not change: there is still no reprocess endpoint and no
  versioning. A digest is written once, at approval, and never changes
  afterwards, so §1.14.1's click-through remains a read-only view of something
  immutable. A corrected digest is marked `edited` and the viewer says
  "corrected by you", because "what the extraction read" and "what the user
  decided it should say" are different claims about the same document.

  Accepting edited text is not a new trust boundary: an attachment is already
  treated as one more form of user input, and a user who wants the model to read
  a particular sentence can simply type it into the message box.

  **Failure state.** Rejections already return a translated message; show it in
  the modal and return the user to the choose step so they can pick a different
  file, and never leave a half-attached entry behind in the composer.

  Notes: run the wizard per attachment rather than batching, so the review
  stays about one document. On approval the staged id goes into the composer as
  today. On cancel, discard the staged attachment server-side rather than
  letting it expire.

### 1.14.4 QA Matrix — What There Is To Test

Added 2026-08-30 at the founder's request, to make the testing surface
explicit. Every cell below is a real path in the shipped code, verified against
`sniffing.ts`, `limits.ts`, and the four claim sites on 2026-08-30.

**Every attachment costs one extraction inference**, charged to the tester's own
credit, and processing happens the moment `Procesar` is pressed — before any
resource or message is created. Budget accordingly: the full matrix below is
roughly 60 extractions.

#### The four surfaces where a document can be attached

| # | Surface | Where | What the attachment feeds | Status |
| --- | --- | --- | --- | --- |
| S1 | New quiz | `/quizzes/new` | `generateQuizDraft` | **PDF confirmed working 2026-08-30** |
| S2 | New roleplay | `/roleplays/new` | `generateRoleplayDraft` | untested |
| S3 | New practice guide | `/practice-guides/new` | `generatePracticeGuideDraft` | **PDF confirmed working 2026-09-05** |
| S4 | Tutor chat | `/chat` composer | `runTutorAgentLoop` | **PDF confirmed working 2026-08-30** |
| S5 | Quiz `Modify with AI` | `/quizzes/:id/edit` | `generateQuiz*Revision` | **not implemented** — see §1.15 |

S1–S3 share one call site (`resourceDrafts.ts`), so a bug in one is very likely
in all three; S4 is a genuinely separate path (socket, message metadata,
persistence across turns) and deserves the most attention.

**Founder QA, 2026-08-30:** PDF attachment confirmed working end to end on S1
and S4. **2026-09-05:** S3 confirmed with PDF as well; its image path was also
exercised while fixing the provenance leak below. S2 is the only creation
surface still untested, and since it runs through the same call site as S1 and
S3, the remaining risk there is in its own prompt and draft rather than in the
attachment path.

**S5 is a gap, not a bug.** The attach control was wired into the three `new`
pages and the chat composer, but **not** into the quiz `Modify with AI`
operations — so an author can create a quiz from a worksheet and then cannot
hand that same worksheet to a revision. It is listed here so the matrix is
honest about its own coverage; the work itself belongs with §1.15, which is
already rebuilding those modals.

There is a **fifth inference** that is not a surface but runs on every single
attachment: extraction itself
(`services/attachmentExtraction.ts`). It is what the review step shows, so
every row below exercises it whether or not the resource is ever created.

#### The five accepted formats

| Format | Sniffed as | Size limit | Path |
| --- | --- | ---: | --- |
| PNG | `image/png` | 8 MB | vision extraction |
| JPEG | `image/jpeg` | 8 MB | vision extraction |
| WebP | `image/webp` | 8 MB | vision extraction |
| PDF | `application/pdf` | 10 MB, 30 pages | vision extraction |
| DOCX | `…wordprocessingml.document` | 10 MB | mechanical (mammoth) |
| URL | fetched HTML | 1 MB response | mechanical (html-to-text) |

#### Content worth testing per format

The point is not to attach six files. It is to attach the *kinds* of material a
teacher actually has, because that is where fidelity fails.

- **Images** — a phone photo of a printed worksheet (the primary case); a
  screenshot with crisp text; **handwriting**; a photo taken rotated, to confirm
  EXIF orientation is applied and not just stripped; a deliberately blurry or
  badly lit shot, to see what a bad digest looks like and whether the wording
  admits it; something with no text at all, like a photograph of a scene.
- **PDF** — a text PDF with selectable text; a **scanned** PDF (fires the
  `pdf_probably_scanned` warning); a **multi-column** layout, which is where
  reading order goes wrong; a page with **tables**; a worksheet with an answer
  key, to see whether the extraction drags the answers in.
- **DOCX** — headings and numbered lists; **tables**; a document with embedded
  **images**, whose content is silently lost on this path and should be checked
  against expectations; a document written in Spanish.
- **URL** — a plain article; a page that is mostly navigation and ads, to judge
  the boilerplate stripping; a **JavaScript-rendered** page, which is expected
  to come back thin and should say so; a page in a non-Latin script.

#### Rejection and limit paths

These cost nothing — they never reach an inference — so run them freely.

| Case | Expected |
| --- | --- |
| `.txt` renamed to `.png` | `unsupported_type`, translated message |
| PDF bytes sent as `image/png` | `content_mismatch` |
| Empty file | `empty_file` |
| Image over 8 MB / PDF or DOCX over 10 MB | `too_large` with the limit named |
| PDF over 30 pages | `too_many_pages`, naming both page count and limit |
| Password-protected PDF | `decode_failed` |
| A `.zip` that is not an Office file | `unsupported_type` |
| `http://localhost…`, `http://192.168.…`, `169.254.169.254` | `url_blocked` |
| `file:///etc/passwd`, `ftp://…` | `url_blocked` |
| URL that 404s or times out | `url_fetch_failed` |
| A 4th attachment in one composer | `staging_full` (limit is 3) |
| Emptying the review text and accepting | `empty_text` |
| Waiting >10 minutes before accepting | entry expired, must re-attach |

#### Behaviour that only shows up in chat (S4)

- The attachment name appears in the transcript, and clicking it opens the
  processed text.
- **Turn 2 and beyond**: the tutor still knows the document. This is the whole
  digest design and the thing most likely to disappoint.
- The same text the user approved is what the viewer shows later — no drift.
- A **corrected** attachment shows "corregido por ti", not "leído del documento".
- Truncation over 4,000 characters is visible in both the review step and the
  viewer.
- Several attachments on one message.
- Cancelling mid-processing leaves nothing behind in the composer.

#### Cross-cutting

- All three instruction languages (`es`, `en`, `ht`) — every warning, rejection,
  and label is translated, and `ht` is the least exercised.
- Mobile width, where the wizard is a full-height modal and the review textarea
  is the bulk of it.
- The credit-exhausted path during processing (402 → credits modal), which is
  the one failure mode a real teacher will actually meet.

## 1.15 Rethink AI Editing On The Quiz Edit Page

Founder observation, 2026-08-30, from using the page. **Implemented the same
day.**

### The two problems

- [x] **The AI buttons sit in different places on each tab.** **Done 2026-08-30:** one `Modificar con IA` button now sits directly under the tab strip, in the same position on both tabs. On `General` the
  `Modify with AI` button is at the **bottom**, in the form's action row next to
  `Save details`. On `Bloques` it is at the **top**, in the header row beside
  the section heading and `Add block`. Switching tabs moves the control from one
  end of the page to the other.

  The cause is structural rather than careless: `General` is a form whose
  actions belong after its fields, while `Bloques` is a list with a header
  toolbar. That explains it but does not excuse it — the user is looking for the
  same control in both places.

- [x] **A whole-quiz change cannot be expressed.** **Done 2026-08-30:** one operation with two scope flags, both on by default. Verified live — "baja el quiz a nivel A2" changed `level` (Intermediate → A2), the description, and all 5 blocks in a single approved proposal. The two operations are
  deliberately scoped and mutually exclusive: `general` revises only the six
  metadata fields through a schema that *cannot* emit block content, and
  `blocks-modify` revises blocks and sections. So "take this B1 quiz down to
  A2" — which means the level field *and* every question — cannot be asked for.
  It has to be done as two separate requests, each with its own inference, its
  own preview, and its own approval, and nothing keeps the two consistent with
  each other. The author is left coordinating by hand what is conceptually one
  edit.

- [x] **A revision cannot take an attachment.** **Done 2026-08-30:** the attach wizard is reused inside the modal, its trigger row inside and the wizard modal as a sibling to avoid nesting modals. Founder direction, 2026-08-30:
  build this together with the unification above rather than as its own pass.

  Source attachments (§1.14) were wired into the three `new` pages and the chat
  composer, but not into any `Modify with AI` operation. So an author can create
  a quiz from a photographed worksheet and then, one screen later, cannot hand
  that same worksheet to a revision — "align these questions with page 2 of the
  book" is unaskable, which is precisely the request a teacher revising a quiz
  has.

  Doing it inside the unification is the cheaper order: the attach control and
  the staged-id plumbing get added once, to one modal, instead of two or four
  times to modals that are about to be replaced.

  Scope is deliberately small. The attachment is **part of that revision
  request** and shares its fate: used once, then gone. It does not carry over to
  the next operation, and a revision cannot refer to a document attached to an
  earlier one — exactly as it cannot refer to an earlier prompt. Nothing to
  store, nothing to list, nothing to re-open.

### Proposed direction

One `Modify with AI` button, in one consistent place, with an explicit **scope**
choice in the modal: `General`, `Bloques`, or `Global`, **and an attach control
alongside the request field**, using the same wizard as everywhere else.

This also collapses two near-identical modals into one, which is the direction
the shared modal controller (`src/client/shared/modificationModal.js`) and the
shared preview store (`src/server/resources/modificationPreviewStore.ts`)
already point in.

### Implementation notes, 2026-08-30

- `/edit/modify` is now the single endpoint; `/edit/blocks-modify` and the
  second modal are gone. The per-block `⋮` operations and `Add block` were left
  untouched, as planned.
- The schema is assembled from the selected flags, so `general`-only still
  cannot emit a block and `blocks`-only still cannot rewrite the title — the
  isolation the old scoping bought is preserved, now as a consequence of the
  author's choice rather than of having two endpoints.
- Whatever the model returns is assembled with the parts it was not allowed to
  touch and validated as a whole draft, so cross-references are caught in the
  correction loop rather than at save.
- Two naming collisions worth remembering: `/edit/revise` and
  `system-prompts/resources/quiz-revision.md` are names of the **retired
  conversational authoring chat**, and `routeArchitecture.test.ts` guards them
  as deleted. The new work uses `/edit/modify` and `quiz-modification.md`
  instead of resurrecting names a guard exists to keep buried.

### What still needs care

- **A global scope gives up the isolation guarantee that scoping bought.** The
  authoring conventions require, and tests assert, that a metadata operation
  cannot touch blocks and a per-block operation leaves every other block
  byte-identical. That property is what makes approving a proposal safe without
  reading all of it. A `Global` scope deliberately removes it, so the preview
  has to carry the weight instead: the diff must show every changed field and
  every changed block together, legibly, or the author is approving something
  they cannot actually check.
- **Whether `Global` needs its own prompt and schema**, or is the full-draft
  schema the blocks operation already validates against. The latter is cheaper
  but was never asked to revise metadata.
- **The per-block `⋮` operations and `Add block` stay as they are.** They are
  well-scoped and this item is not about them. Whether *they* should also accept
  an attachment is a separate question worth deferring — a per-block revision
  taking a whole worksheet is a strange fit, and answering it now would widen
  this item for no clear gain.
- **The preview needs no special treatment for attachments.** The author
  attached the material seconds earlier and approved its extracted text in the
  wizard, so the diff shows the proposed change as it does for any other
  request. Persisting or re-displaying the attachment afterwards would
  contradict the governing principle in §1.14.
- **Keep the scope explicit and visible in the modal**, not inferred from what
  the author typed. Inferring it would put the model in charge of how much of
  the resource it is allowed to rewrite, which is the opposite of what the
  proposal-and-approval design is for.

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

## 2.3 Resource And Media Navigation Consistency (Breadcrumbs)

Added 2026-07-21 (founder observation); transferred in full from V3 on
2026-07-26 because it includes the Media Library. Navigation across the
resources area and the media library is inconsistent — several views ship no
breadcrumb, so the user loses the trail back to the list/folder they came from.
Two idioms coexist today and are applied unevenly: a breadcrumb (`app-page-copy`
with links back to `/resources` or `/media-library`) on list/detail pages,
and a close-button `X` (`app-page-header-has-close`) on focused
attempt/result pages. Some views have neither.

Snapshot of the gap on 2026-07-21 (breadcrumb present vs missing):

- Have it: `resources-list`, `resources-shared`, `quizzes-show`,
  `quizzes-participation`, `roleplays-show`, `roleplays-new`, `media-library`.
  (Correction 2026-07-23: `media-library-show` does *not* have a breadcrumb —
  it uses a close-`X` (`app-page-header-has-close`) with plain intro copy, so it
  belongs under "missing it".)
- Missing it: `media-library-show`, `quizzes-authoring`, `quizzes-new`, `practice-guides` (detail),
  `practice-guides-authoring`, `practice-guides-new`, `roleplays-edit`,
  `media-library-authoring`, `media-library-new`,
  `media-library-variation-new`. Focused attempt/result/evaluating pages
  (`quizzes-attempt`, `quizzes-result`, `quizzes-evaluating`,
  `roleplays-attempt`, `roleplays-result`) use the close-`X` instead — decide
  whether that is the intended pattern there or whether they should also carry
  a breadcrumb.

- [x] Define one navigation convention for the resources + media area: when a
  page shows a breadcrumb, when it shows a close-`X`, what the trail contains
  (including folder ancestry for foldered resources), and how shared/detail/
  authoring/creation pages differ. Capture it in the
  `resource-page-conventions` project skill. **Done 2026-07-23:** uniform
  breadcrumb on every page (incl. attempt/result/evaluating); media library trail
  is flat (no folders); `-new` pages point to the origin folder if any, else the
  area root; close-`X` stays only as an optional immersive exit and must link
  deterministically. Skill's `description` broadened to name the media library.
- [x] Apply it across every resources and media-library view, filling the
  gaps above. Reuse a shared breadcrumb partial rather than repeating the
  markup per view. **Done 2026-07-23:** shared `views/partials/breadcrumb.ejs`
  (generic `crumbs` array; last crumb is the plain current page). Migrated the
  views that already had a breadcrumb and added one to every gap: media-library
  detail/authoring/new/variation-new, quizzes authoring/new/attempt/evaluating/
  result, roleplays edit/new/attempt/result, practice-guides detail/authoring/
  new. Attempt/evaluating/result render it only for authenticated viewers (guests
  on shared quiz links keep the close-`X`). `-new` origin-folder plumbing added
  end-to-end (`resolveOriginFolderContext` helper + `addResourceToFolder` on
  create) for quizzes, roleplays, and practice guides; verified in-browser
  (detail, folder list, `/quizzes/new?folder=…` breadcrumb + hidden field + close
  target, media-library flat trail). Snapshot corrections: `media-library-show`,
  `roleplays-new`, and `practice-guides` detail were mis-listed above.
- [x] Add a lightweight guard (render/architecture test) that a resources/
  media page exposes the expected back-navigation, so new views can't silently
  ship without it. **Done 2026-07-23:**
  `tests/server/resourceBreadcrumbArchitecture.test.ts` asserts every required
  area view includes the breadcrumb partial and forces any newly added area view
  to be classified as required, delegating, or explicitly exempt (list roots and
  external share-landing pages).

---
