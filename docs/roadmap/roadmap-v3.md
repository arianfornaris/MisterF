# Roadmap V3

Date: 2026-07-06 (last updated: 2026-07-18)

Status: **In progress.** V3's headline is the **Teacher Pilot MVP**: the
smallest product that lets a real teacher run the full assigned-practice
cycle — create a quiz from their own material, share it by link, students
complete it and get evaluated, students practice their difficulties, and the
teacher sees the attempts and a next-class report. Refocused on 2026-07-18 to
align with the approved business focus (independent teachers of adult
immigrant learners); decision record:
[Roadmap V3/V4 MVP Adjustment Proposal](roadmap-v3-v4-mvp-adjustment-proposal.md)
and [Propuesta de MVP](../business/propuesta-mvp.md).

The previous headline pillar, comprehension exercises (carried from
[Roadmap V2](roadmap-v2.md)), was downgraded on the same date: Phase 1
(reading) stays as an optional stretch goal and the remaining phases moved to
[Roadmap V4](roadmap-v4.md), along with the remaining scene-media work, voice
messages in roleplays, and CEFR standardization. Remaining product-feature
candidates stay in the idea inbox,
[issues/incomming.md](../issues/incomming.md), until they are promoted here.

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

Downgraded on 2026-07-18 (MVP refocus): Phase 1 (reading) is an **optional
stretch goal** for V3 — it reuses the `quiz`/`quiz_result` pipeline and gives
pilot teachers one more activity type, but it must not delay the MVP. Phase 2
(listening), Phase 3 (image), and availability in teacher quizzes moved to
[Roadmap V4](roadmap-v4.md).

- [ ] Detailed block design decision: `stimulus` field on the existing
  `quiz` block versus dedicated stimulus blocks (the design doc leans to
  the former).
- [ ] Phase 1 — Reading comprehension: LLM-generated passage at the
  learner's level, questions in the same card, results through the
  `quiz_result` pipeline and progress events. No new infrastructure;
  validates the pattern.
- Phases 2 (listening) and 3 (image), and availability in teacher quizzes:
  moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18.
- [ ] Manual QA against live inference for any phase that ships in V3.

Interaction with the V2 i18n work: comprehension stimuli are always in
English (the target language); question wording and feedback follow the
user's instruction language. The i18n prompt parametrization shipped in V2,
so Phase 1 can proceed without double work on prompt copy.

## 1.2 Scene Media Library

Promoted to V3 on 2026-07-07. Design:
[Scene Media Library](../features/scene-media-library.md) - one source-neutral
`scene_media` block backed by a shared library of built-in and user-generated
scene media. V3 starts by promoting curated built-in assets, while the library
shape leaves room for generated scripts/audio and later dynamic media flows.

**Frozen for V3 on 2026-07-18 (MVP refocus).** The shipped work below stays
as the V3 record, but every remaining unchecked item — and the pending parts
of the `[~]` items — is no longer V3 scope; it is tracked in
[Roadmap V4](roadmap-v4.md) ("Scene Media Library — Remaining Work"). The
checklist is preserved here for context and history only.

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

## 1.3 Review Resource AI Editing Chats

Added 2026-07-14 after replacing the media library's generic authoring chat
with contextual, layer-specific edit actions. Review every remaining resource
editing chat to confirm that conversation is still the clearest interaction
for the resource and that it is not hiding parameters better expressed next to
the content being changed.

- [x] Review the quiz `Chat IA` edit tab, including the add-block shortcut and
  whether block-level changes should use contextual controls with preview and
  explicit parameters. Reviewed 2026-07-17: the chat should be replaced by
  scoped per-unit operations. All six implementation phases below are
  code-complete as of 2026-07-17 (typecheck/tests/build green). **Done
  2026-07-20: live logged-in click-through of all four operations against real
  inference passed** — fresh account, new quiz generated from a prompt, then
  metadata modify (only changed fields in the preview; apply persisted),
  per-block modify with an explicit kind change (`fill_in_the_blank_input` →
  `multiple_choice`; only the target block changed), add block with
  explicit placement (`start`; preview shown before insert; unique id
  collision handled), and blocks+sections modify ("Nuevo: 1 · Movido: 5" diff;
  two sections created and persisted correctly). The discard path was also
  exercised (preview generated, cancelled, no persistence). Server error log
  clean across the session (6 LLM calls, 4 previews, 4 applies). Observation,
  not a bug: the first inserted block gets the id `block` (base id without
  suffix); later inserts get `block_5` etc. — ids stay unique. Design:
  [Quiz AI Modifications](../features/quiz-ai-modifications.md). The review found
  that, unlike roleplays and practice guides, the quiz chat is the **only** editor
  for block content and the only manager of sections (design-mode block cards are
  read-only, `Agregar bloque` is a facade that delegates to `handleReviseQuiz`,
  and section headers are display-only), so the operations must be built before
  the chat is retired. Every chat turn also regenerates the whole draft, so today
  even a one-word fix pays whole-draft latency and lets untouched blocks drift.
  Decisions: scope operations by authoring tab (`General` button, `Bloques`
  button, per-block menu option) because that maps to what the author already
  sees; single-turn operations with no conversational history; manual per-kind
  block editing out of scope; item kind changeable through an explicit control.
  Note the tab split is a UX win rather than a cost win — blocks are
  substantially all of a quiz's content, so the `Bloques` operation costs about
  what a chat turn costs today. The real win is demoting the expensive call from
  the only path to the rare path, with a preview so drift is visible before it
  lands.
  - [x] Phase 1 — Extract the shared pending-modification store and client
    preview modal (today duplicated across roleplays and practice guides, keyed
    per resource; quizzes need per-operation/per-target keys), then ship the
    `General` tab button over the six metadata fields. Code complete 2026-07-17;
    live QA passed 2026-07-20. Delivered: generic
    server store `src/server/resources/modificationPreviewStore.ts` (keyed by
    operation + optional target, with a `listStringFieldChanges` diff helper);
    generic client `src/client/shared/modificationModal.js` (describe → preview →
    apply/retry/discard, plus `renderStringFieldChanges`); a metadata-only
    revision (`quizMetadataSchema`/`applyQuizMetadataToDraft` in
    `services/quizzes.ts`, `generateQuizMetadataRevision` in
    `services/resourceDrafts.ts`, prompts
    `system-prompts/resources/quiz-metadata-revision{,-correction}.md`) that can
    never emit block content; quiz preview/apply/discard handlers + routes
    (`/quizzes/:id/edit/modify{,/apply,/discard}`); a `Modify details with AI`
    button and modal on the `General` tab; i18n in es/en/ht; and the new prompts
    registered in `promptPlaceholders.test.ts`. Verified: `typecheck`,
    `test:typecheck`, full `tests/server` suite, and client build all pass; the
    new route is registered on the running dev server. Note: roleplays and
    practice guides still carry their own store/modal copies — migrating them
    onto the shared modules is a deferred cleanup, not required for later phases.
  - [x] Phase 2 — Per-block menu option: one item in, one item out, side-by-side
    preview through the existing `quizItemRenderer` and `preview` card mode, with
    item kind and level as explicit modal parameters. The intended default path.
    Code complete 2026-07-17; live QA passed 2026-07-20 (including an explicit
    kind change and the discard path). Delivered:
    block helpers `findQuizBlock`/`setQuizBlockItem` in `services/quizzes.ts`
    (item-only replacement, preserves id/section/other blocks); block-scoped
    revision `generateQuizBlockRevision` in `services/resourceDrafts.ts` (per-
    request schema refined so `item.kind` must equal the requested kind — kind
    change is an explicit control) with prompts
    `system-prompts/resources/quiz-block-revision{,-correction}.md` (quiz context
    passed as untrusted quoted data); handlers
    `handle{Preview,Apply,Discard}QuizBlockModification` keyed by
    operation `quiz-block` + block-id target; routes
    `/quizzes/:id/edit/blocks/:blockId/modify{,/apply,/discard}`; a `Modificar con
    IA` item in each design-mode block card `⋮` menu plus the item JSON embedded
    per card; a shared block modal with kind `<select>` + level input reusing the
    generic controller; client before/after render via `quizItemRenderer`
    (read-only) plus a per-kind answer-key summary. The generic client controller
    (`src/client/shared/modificationModal.js`) was extended to support multiple
    triggers on one modal with per-open `resolveContext(trigger)`, which phases 3
    and 4 reuse. i18n es/en/ht; new prompts registered in
    `promptPlaceholders.test.ts`. Verified: typecheck, test:typecheck, full
    `tests/server` (158), client build, and route registration on the running dev
    server. Answer key shows in the preview (a plus over EJS `preview` mode, which
    hides it).
  - [x] Phase 3 — Re-point `Agregar bloque` at the block-scoped generator with
    preview-before-insert and explicit placement, removing the chat facade.
    Code complete 2026-07-17; live QA passed 2026-07-20 (insert at `start`
    verified in the persisted draft). Delivered:
    `generateQuizBlockRevision` now doubles as creation when `currentItem` is
    omitted (same one-item-out schema with the kind refine; prompt updated to
    cover create-or-revise); `insertQuizBlock` in `services/quizzes.ts` (fresh
    unique id, explicit `sectionId` + `position` placement, canonicalized order);
    add-block handlers `handle{Preview,Apply,Discard}QuizAddBlock` (owner op
    `quiz-add-block`, placement stored in the pending record) on routes
    `/quizzes/:id/edit/add-block{,/apply,/discard}`; the `Agregar bloque` modal
    rebuilt as a describe→preview→insert flow with explicit kind, level, section,
    and position controls, previewing the proposed item card before it is added.
    Removed the chat facade: `handleAddQuizBlock`, `buildAddQuizBlockChatMessage`,
    the `/edit/blocks` POST route, and the client `stageAuthoringChatMessage`
    add-block shortcut. i18n es/en/ht. Verified: typecheck, test:typecheck, full
    `tests/server` (158), client build, and EJS compile of the changed templates.
    (Note: POST route registration cannot be probed by curl because CSRF 403s
    before routing; it is guaranteed by typecheck + explicit router wiring
    instead.) Leftover dead i18n keys `addBlockOfKind`/`bestFitKind` can be swept
    in Phase 5.
  - [x] Phase 4 — `Bloques` tab button over blocks and sections in one call, with
    a block-by-block preview covering changed, added, removed, reordered, and
    regrouped blocks. Code complete 2026-07-17; live QA passed 2026-07-20
    (sections created + regroup + new block in one call, diff labels correct,
    persistence verified). Delivered:
    `generateQuizBlocksRevision` returns `{ blocks, sections }` only (metadata
    injected + full-draft validated via `superRefine` so section cross-refs and
    unique ids are caught inside the correction loop) with prompts
    `quiz-blocks-revision{,-correction}.md`; `applyQuizBlocksAndSectionsToDraft`,
    `diffQuizBlocks`, and `quizBlocksDiffHasChanges` in `services/quizzes.ts`
    (per-block status added/changed/moved/unchanged + removed list + section
    diff); handlers `handle{Preview,Apply,Discard}QuizBlocksModification` (owner
    op `quiz-blocks`) on routes `/quizzes/:id/edit/blocks-modify{,/apply,/discard}`;
    a `Modificar con IA` button next to `Agregar bloque`, its modal, and a client
    diff renderer with a status summary + color-coded per-block cards. Verified:
    typecheck, test:typecheck, tests/server (158), client build, EJS compile.
  - [x] Phase 5 — Retire the chat tab. Done 2026-07-17. Removed: the `Chat IA`
    nav pill and panel, `POST /quizzes/:id/edit/revise` + `handleReviseQuiz` +
    `saveQuizAuthoringTurn`, the `generateQuizRevision` service with its schema,
    result type, conversation-history type, and normalizer, the
    `quiz-revision{,-correction}.md` prompts, and the `chat` authoring tab from
    the tab type/reader (legacy `?tab=chat` now redirects to `general`). Quizzes
    were the last consumer of the shared authoring chat, so
    `src/client/shared/authoringChatRevision.js` and `authoringChatScroll.js` were
    deleted and `authoring.css` reduced to the tab layout. The
    `authoring_messages_json` column and its `updateQuizAuthoringMessages`
    repository function are retained for backward-compatible reads (no destructive
    migration), per the practice-guide/roleplay precedent. Dead chat i18n keys
    (`quizzes.tabChat`, `modifyWithAi`, `authoringChat*`, `msg.writeChange`,
    `msg.addBlockOfKind`, `msg.bestFitKind`, …) were left in place: harmless at
    runtime, and a mechanical key sweep across three locales is a low-priority
    follow-up not worth risking at the end of the change.
  - [x] Phase 6 — Tests and documentation. Done 2026-07-17. Added service
    contract tests for the metadata, per-block (revise + create + kind-mismatch
    recovery), and blocks (parse + cross-ref recovery) operations in
    `quizAuthoringContracts.test.ts`; pure-logic unit tests for `setQuizBlockItem`
    isolation, `insertQuizBlock` placement, and `diffQuizBlocks`/
    `quizBlocksDiffHasChanges` in `quizzesService.test.ts`; a route-architecture
    guard in `routeArchitecture.test.ts` asserting the chat is gone and the four
    modals + scoped routes exist; and prompt↔placeholder registration for the four
    new prompts. Full suite: `tests/server`+`tests/db` 181 passing, typecheck and
    test:typecheck clean, client build clean, dev server healthy (200).
  - [x] Follow-up — Update the `ai-authoring-chat-conventions` skill and the chat
    references in
    [Teacher-Assigned Practice](../features/teacher-assigned-practice.md) to match
    the retired-chat reality. Done 2026-07-20: the skill was rewritten around
    the proposal-and-approval model with the four scoped quiz operations as
    the reference implementation (chat sections removed, retirement history
    noted); the feature doc got a prominent supersedence note and an updated
    Implementation Status, keeping the original chat design as historical
    record.
- [ ] Migrate roleplay and practice-guide modification modals onto the shared
  controller. Optional for V3 (2026-07-18, MVP refocus): keep only if it stays
  cheap; otherwise it moves to Roadmap V4. Split out of the quiz work on
  2026-07-17: Phase 1 extracted a
  generic pending-modification store (`server/resources/modificationPreviewStore.ts`)
  and a generic client modal controller (`client/shared/modificationModal.js`,
  with multi-trigger + per-open `resolveContext`), and all four quiz operations
  use them. Roleplays and practice guides still carry their own near-duplicate
  `modificationPreviewStore.ts` and their own copies of the modal logic inside
  `client/roleplays/index.js` and `client/practiceGuides/index.js`. Port them to
  the shared store and controller (roleplay avatar diffs and practice-guide
  Markdown fields become custom `renderChanges` implementations), then delete the
  duplicates. Low risk but touches two shipped flows, so it needs its own
  before/after click-through.
- [x] Sweep the dead chat i18n keys left by the quiz chat retirement
  (`quizzes.tabChat`, `modifyWithAi`, `modifyWithAiCopy`, `authoringChat*`,
  `quizzes.message`, `describeChangesPlaceholder`, `applyChanges`, `blockTypeAria`,
  `msg.writeChange`, `msg.applyChangeError`, `msg.addBlockOfKind`,
  `msg.bestFitKind`, `msg.describeBlock`, `clientMisc.addBlock`/`addBlockOfKind`)
  across es/en/ht. Done 2026-07-17: removed from all three locales; the shared
  translation-map type enforced parity (typecheck stays green), and
  `quizzes.addBlock` (the button label) was deliberately kept. Verified:
  typecheck, test:typecheck, `tests/server` (168), client build.
- [ ] Add manual block editing to quiz authoring. **Rescoped 2026-07-18 for
  the Teacher Pilot MVP:** V3 ships only minimal manual editing for the most
  common item kinds — fixing a typo must not cost an inference, because a
  pilot teacher will hit typos and losing trust there is expensive. The full
  per-kind editor across all nine item kinds and deterministic section
  rename/delete/reassign move to Roadmap V4. Original context (split out of
  the quiz chat review on 2026-07-17): a typo in one option cannot be fixed
  without spending an inference, because design-mode block cards are
  read-only; the same gap applies to sections, which are creatable and
  regroupable only through the `Bloques` AI operation. The block change modal
  with preview makes the gap survivable meanwhile.
- [x] Retire the practice-guide `Chat IA` edit tab. Practice guides now use the
  roleplay proposal pattern: one page-level `Modify with AI` action receives
  the complete unsaved title, description, and tutor instructions; shows only
  changed fields in a before/after comparison; and persists atomically only
  after explicit approval. Superseded routes, history writes, and client hooks
  were removed while the legacy data column remains readable.
- [x] Retire the roleplay `Chat IA` edit tab. Roleplay now exposes one
  page-level `Modify with AI` action that can reach every authoring field, uses
  the complete unsaved form as context, shows only proposed field differences
  in a before/after comparison, and persists atomically only after explicit
  approval.
- [x] For each remaining resource, decide whether to keep, redesign, or retire the chat;
  document the chosen ownership boundary and remove any superseded routes,
  prompts, history writes, client hooks, and unused persistence safely.
  Done 2026-07-17: every resource has been decided and all chats retired —
  scene media (2026-07-14), roleplays and practice guides (2026-07-16), quizzes
  (2026-07-17). No authoring chat surface remains in `src/` or `views/`, and the
  shared chat client modules were deleted with the quiz work. Ownership
  boundaries are documented per resource in
  [Quiz AI Modifications](../features/quiz-ai-modifications.md) and the roadmap
  entries above. Legacy `authoring_messages_json` columns remain readable by
  design; no destructive migration was introduced.

## 1.4 Voice Messages in Roleplays

Added 2026-07-08. **Moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18 (MVP
refocus):** the character-audio half is sequenced after the TTS
infrastructure that also moved to V4, and neither half is needed for the
teacher pilot. Full scope and notes now live in Roadmap V4.

## 1.5 CEFR Level Standardization

Added 2026-07-14. **Moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18 (MVP
refocus):** the pilot runs with the existing `A1-A2`/`B1-B2`/`C1` authoring
bands. Full scope now lives in Roadmap V4.

## 1.6 Quiz Results & Next-Class Report

Added 2026-07-18. **The MVP centerpiece** and the only wholly missing piece of
the approved teacher promise ("reach the next class knowing where each
student needs help"). Business context:
[Propuesta de MVP](../business/propuesta-mvp.md).

Design decision (2026-07-18, with the founder): no teacher/student profiles,
no role-aware homes, no dashboards, no classroom entity. Authorization is
resource-scoped — the quiz owner sees the attempts of their quiz — and the
surface is the existing quiz page. The long-term classroom/packages/
organization shape is designed in [Classrooms](../features/classrooms.md) and
stays out of V3.

- [x] Results-feedback flag on sharing (added 2026-07-20, founder decision):
  when sharing a quiz, the owner chooses whether they want to receive the
  results of the people who complete it. Each attempt snapshots the flag
  at start time: turning the flag on later never exposes attempts made
  without the disclosure notice, and turning it off stops collection for new
  attempts without hiding legitimately collected ones. Default on for the
  teacher flow. Done 2026-07-20: migration 24 adds
  `resource_share_links.collect_results` (default on; resource-generic, so
  roleplay/guide shares reuse it as-is) and `quiz_attempts.collect_results`
  (default off, so pre-flag attempts are never exposed);
  `POST /resources/:resourceId/share/collect-results` (owner-only) backs a
  switch in the quiz share-link modal that reopens the modal after saving.
  Note vs the original sketch: the sharing model is one live link per
  resource, so "one link with feedback, another without" became "one
  toggleable flag per share link" — sequential, not simultaneous, control.
- [x] Attempts visibility for the quiz owner. Done 2026-07-20: a
  `Resultados de estudiantes` section on the quiz page (owner-only) lists
  collected attempts — student account name or `Invitado`, status badge,
  correct/total summary, relative time — and evaluated ones link to a
  read-only owner view of the result page (banner with the student label; no
  learner actions; the guest token is never embedded). Only attempts whose
  share had the flag on at start appear; the owner's own attempts (`Probar`
  or self-taken) are excluded by query. The owner path in the result handler
  runs before the normal attempt resolver, so it can never claim or evaluate
  a student's attempt. Route/repository/migration tests added; live
  click-through verified (including the frozen-visibility rule). Also fixed
  in passing: a latent 500 in `resolveAccessibleAttempt` on GETs without a
  body (`request.body.guestToken` on `undefined`), and the retired-chat
  leftover in `promptContracts.test.ts` that still loaded
  `quiz-revision-correction.md`.
- [x] Disclosure-at-start consent: when the share collects results, the
  shared-link page states clearly — before answering — that the person who
  shared the activity will see the student's answers and evaluation;
  starting the attempt constitutes consent. Shown only when the flag is on
  (no collection, no notice needed). Adults-only pilot policy. (Per-student
  opt-in was considered and rejected: an incomplete report breaks the
  teacher promise. Voluntary sharing is reserved for the student's own
  follow-up practice, deferred past the MVP.) Done 2026-07-20: notice on the
  shared page (es/en/ht), gated on the share flag; the flag rides the
  attempt through the guest → signup → claim flow via the start-time
  snapshot. Verified live and by route tests (notice shown/hidden per flag).
- [x] Responses summary per quiz. Done 2026-07-21. Renamed away from the
  teacher-framed "next-class report" to a general "Resumen de respuestas" on
  the quiz page (founder decision: use "participants", not "students", while
  the sharing primitive stays general). Two layers:
  (1) a **live deterministic aggregation** — per-question correct/partial/
  incorrect tallies keyed by prompt (survives block reordering), plus
  responded/evaluated counts — recomputed on every view, never persisted, so
  it can never go stale;
  (2) an **optional AI summary** the owner generates on their own credit-gated
  key, persisted in `quiz_response_summaries` (migration 26) with an input
  fingerprint (`evaluatedCount:maxUpdatedAt`). When new responses arrive the
  fingerprint diverges and the card shows a "Hay respuestas nuevas desde este
  resumen" badge with an "Actualizar resumen" action. Generation shows the
  pending modal (§1.8 rule). `POST /quizzes/:id/summary`, owner-only, empty
  state guarded before inference. Prompts
  `resources/quiz-responses-summary{,-correction}.md`; generator reuses the
  shared `generateStructuredDraft` (no new `generateText` site). Verified live
  end to end (aggregation, AI generation, staleness on a new response).
  The per-participant list was renamed "Participantes" and anonymous attempts
  labeled "Anónimo".
- [ ] "Shared by me" aggregated view (added 2026-07-18): one page listing the
  user's shared resources — quizzes, practice guides, and roleplays, since
  sharing already exists for all three — with attempt counts and who
  practiced each, as the guide's entry point. Same primitive, no roles and no
  new entities — serves the teacher, the private tutor, and a parent with
  their own account (the parent-child case runs through learning profiles
  inside the parent's account). Full formula:
  [Classrooms](../features/classrooms.md).
- Design constraint (2026-07-18): the MVP returns results for **quizzes
  only**, but the cross-cutting pieces — disclosure/consent copy, the
  "Shared by me" view, and the naming of results routes/storage — are built
  resource-generic, because the same feedback loop extends to roleplays
  (attempt evaluation + transcript) and practice guides (the session's
  finalized report, not the raw chat) in the next iteration. Disclosure
  follows assignment, not resource type.
- [x] Make the feedback flag uniform across both share kinds. Done 2026-07-20:
  the share link carried the flag but `Compartir con perfil` did not, so the
  interim parent→child (same-account) case never collected. Added
  `collect_results` to `resource_access_grants` (migration 25), a toggle on
  the quiz profile-share modal (default on), grant-flag snapshot when a
  non-author profile starts a `Probar` attempt, link grants inheriting the
  link's flag (so repeats from Resources also collect), and re-keyed the
  owner's collected-attempts list on the **author profile** (not the owner
  user) so sibling profiles surface, labeled by profile name. Verified live
  end to end: a child-profile attempt shared with the flag on appears in the
  owner's `Resultados de estudiantes` as "Hijo QA" while the author's own
  `Probar` runs stay out. Note: taking an owned quiz auto-switches the active
  profile back to the author profile on navigation, so the child must have
  their own profile active to attempt as a student — a known interim-model
  wrinkle, not a blocker.
- [ ] Funnel instrumentation check: verify each pilot funnel step (invited →
  started → completed → reviewed → practiced → report viewed) is recorded and
  queryable, adding minimal events where missing. Manual SQL is acceptable
  for the pilot.
- [x] Fix the guest evaluation hand-off. Done 2026-07-20: evaluation used to
  run inside the result page's GET, so a student who had just signed up sat on
  a blank navigation for the whole inference. Evaluation moved to
  `POST /quiz-attempts/:id/evaluate` behind a new
  `GET /quiz-attempts/:id/evaluating` page that renders instantly with the
  spinner and self-posts (visible button as the no-JS fallback); the result
  page now redirects there instead of blocking, and signup returns to it.
  Verified live: result redirect 29 ms, evaluating page 22 ms, then the normal
  evaluated-result experience.
- [ ] Manual QA of the full teacher cycle against live inference (create →
  share → guest attempt → signup/claim → evaluation → follow-up practice →
  owner report).

## 1.7 Pilot Readiness

Added 2026-07-18. Operational items that make the pilot runnable within the
business constraints ([Presupuesto inicial](../business/presupuesto-inicial.md)).

- [ ] Pilot credit mechanics: document the existing superadmin per-user
  OpenRouter limit flow as the way to fund pilot teachers/students, and
  define the pilot credit policy with the founder (cap per participant, total
  pilot budget, behavior when a cap is hit). No new payment infrastructure.
- [ ] Measure the real AI cost and latency of one full teacher cycle per
  operation (quiz generation/modification, evaluation, follow-up tutoring,
  report summary), feeding the contribution-margin input the business docs
  need. (This is the slice of section 2.1 kept in V3.)

---

## 1.8 Inference Wait-State Coverage

Added 2026-07-20 after the guest-evaluation hang. **Rule: every operation that
runs an inference must show a wait or progress affordance** — a pending modal,
an inline spinner, a streamed progress log, or at minimum a disabled button
with a loading label. A blank navigation or an unresponsive button is a bug,
because inferences routinely take several seconds and the learner cannot tell
the app apart from a freeze.

- [x] Audit every inference entry point against its UI surface. Done
  2026-07-20; covered surfaces confirmed: quiz creation, the four quiz AI
  modification operations (`data-modify-phase="generating"`), quiz submit,
  guest evaluation (section 1.6), practice-guide creation and modification,
  roleplay creation/modification/turns/finish, scene-media creation,
  variations, title generation and the streamed preview flows, chat finalize,
  report-practice, and the create-resource-from-context actions. Follow-up
  practice buttons (`/quiz-attempts/:id/practice`,
  `/roleplay-attempts/:id/practice`) and the shared practice-guide start run
  no inference — they create a conversation and hand off to the chat, whose
  own typing indicator covers the tutor's first message.
- [x] Fix the two gaps the audit found, both in roleplay opening-turn
  generation. Done 2026-07-20: (1) starting a roleplay from its detail page
  posted with no pending wiring at all; (2) starting a shared roleplay is a
  plain link navigation, so it waited on a blank page. Both now show the
  pending modal, which was also extracted to
  `views/partials/roleplay-pending-modal.ejs` instead of being duplicated per
  page.
- [ ] Consider a guard test that keeps this rule from regressing: assert every
  route whose handler resolves a credit-gated key has a UI trigger carrying a
  known pending marker. Non-trivial because triggers live in EJS and client
  JS, so it is tracked but not yet scoped.

---

## 1.9 In-Tutor Platform Awareness

Added 2026-07-23 (founder request). In regular conversations with Mister F, the
tutor currently has no knowledge of the platform itself, so if a learner or
teacher asks about a feature ("how do I create a quiz?", "where are my shared
resources?", "can I make a roleplay?"), the tutor cannot help. Goal: give the
tutor enough general product knowledge to answer feature questions and point
users to the right place, without bloating every prompt or letting the tutor
drift off its pedagogical role.

Open design questions (to consider, not yet decided):

- **Delivery mechanism.** Two candidates: (a) a compact, always-present
  "About the platform" section in the system prompt, or (b) an on-demand tool
  the tutor calls only when the user asks about the platform (keeps the base
  prompt small and the knowledge in one maintainable place). The founder leans
  toward considering the tool approach. A hybrid is possible: a one-line pointer
  in the prompt plus a tool for detail.
- **Scope of knowledge.** Which features to describe (quizzes, roleplays,
  practice guides, media library, resources/folders, sharing, progress) and at
  what depth. Keep it feature-level and navigational, not a full manual.
- **Freshness/maintenance.** Where the canonical platform description lives so it
  does not drift from the actual product as features change.
- **Role boundaries.** Ensure platform answers do not derail tutoring; the tutor
  should answer briefly and return to the learning task.

- [ ] Decide delivery mechanism (prompt section vs. tool vs. hybrid).
- [ ] Draft the canonical platform-feature description and decide where it lives.
- [ ] Wire it into regular tutor conversations and verify the tutor answers a
  feature question correctly without losing its pedagogical framing.

Relevant skills when this is picked up: `system-prompt-coherence`,
`llm-tool-documentation`.

---

# Part 2: Engineering And Quality

## 2.1 LLM Inference Portfolio Audit And Governance

Added 2026-07-15 after investigating practice-guide draft latency and finding
that resource authoring operations can inherit a global model tier and reasoning
effort even when their output contract does not require the same quality/latency
tradeoff as a tutor conversation.

**Rescoped 2026-07-18 (MVP refocus):** only the pilot-cycle cost/latency
measurement stays in V3, tracked as part of
[1.7 Pilot Readiness](#17-pilot-readiness). The full inventory, model-selection
policy, governing artifact, CI enforcement, and evaluation sets moved to
[Roadmap V4](roadmap-v4.md).

## 2.2 Structured Block Post-Processing

Deferred from V2 on 2026-07-06. **Moved to [Roadmap V4](roadmap-v4.md) on
2026-07-18** (unchanged: still gated on quantifying the deterministic
linter's miss rate from production block-repair logs first).

## 2.3 Resource And Media Navigation Consistency (Breadcrumbs)

Added 2026-07-21 (founder observation). Navigation across the resources area
and the media library is inconsistent — several views ship no breadcrumb,
so the user loses the trail back to the list/folder they came from. Two
idioms coexist today and are applied unevenly: a breadcrumb (`app-page-copy`
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

# V3 Exit Criteria

Replaced on 2026-07-18 (MVP refocus). With this scope, shipping V3 makes the
product pilot-ready; running the pilot itself is business-roadmap work
([negocio-roadmap](../business/negocio-roadmap.md), Fases 2–4), not a
technical exit criterion.

- [ ] A real teacher can run the full cycle in production: create a quiz from
  their own material, share it, students complete it and get evaluated,
  students can start follow-up practice, and the teacher sees the attempts
  and the next-class report.
- [ ] Live logged-in QA of the quiz AI modification operations (section 1.3)
  is done.
- [ ] The pilot funnel is measurable end to end, and the AI cost of one full
  cycle is known.
- [ ] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass; new
  surfaces (attempts views, next-class report) have regression coverage.
- [ ] Deployed to production per the versioning policy
  (`versioning-and-releases` skill).
