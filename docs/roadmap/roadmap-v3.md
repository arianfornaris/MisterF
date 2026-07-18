# Roadmap V3

Date: 2026-07-06 (last updated: 2026-07-15)

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

## 1.2 Scene Media Library

Promoted to V3 on 2026-07-07. Design:
[Scene Media Library](../features/scene-media-library.md) - one source-neutral
`scene_media` block backed by a shared library of built-in and user-generated
scene media. V3 starts by promoting curated built-in assets, while the library
shape leaves room for generated scripts/audio and later dynamic media flows.

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

- [~] Review the quiz `Chat IA` edit tab, including the add-block shortcut and
  whether block-level changes should use contextual controls with preview and
  explicit parameters. Reviewed 2026-07-17: the chat should be replaced by
  scoped per-unit operations. All six implementation phases below are
  code-complete as of 2026-07-17 (typecheck/tests/build green); the only
  remaining work is a live logged-in click-through of each operation against real
  inference before this item is marked done. Design:
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
  - [~] Phase 1 — Extract the shared pending-modification store and client
    preview modal (today duplicated across roleplays and practice guides, keyed
    per resource; quizzes need per-operation/per-target keys), then ship the
    `General` tab button over the six metadata fields. Code complete 2026-07-17;
    live click-through QA behind login still pending. Delivered: generic
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
  - [~] Phase 2 — Per-block menu option: one item in, one item out, side-by-side
    preview through the existing `quizItemRenderer` and `preview` card mode, with
    item kind and level as explicit modal parameters. The intended default path.
    Code complete 2026-07-17; live login click-through QA pending. Delivered:
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
  - [~] Phase 3 — Re-point `Agregar bloque` at the block-scoped generator with
    preview-before-insert and explicit placement, removing the chat facade.
    Code complete 2026-07-17; live login click-through QA pending. Delivered:
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
    regrouped blocks. Code complete 2026-07-17; live QA pending. Delivered:
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
  - [ ] Follow-up — Update the `ai-authoring-chat-conventions` skill and the chat
    references in
    [Teacher-Assigned Practice](../features/teacher-assigned-practice.md) to match
    the retired-chat reality (the skill still says "Quizzes currently use a
    `Chat IA` tab").
- [ ] Migrate roleplay and practice-guide modification modals onto the shared
  controller. Split out of the quiz work on 2026-07-17: Phase 1 extracted a
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
- [ ] Add manual block editing to quiz authoring. Split out of the quiz chat
  review on 2026-07-17: today a typo in one option cannot be fixed without
  spending an inference, because design-mode block cards are read-only. The same
  gap applies to sections, which after the quiz work will be creatable and
  regroupable only through the `Bloques` AI operation; deterministic section
  rename/delete/reassign belongs here too. Nine item
  kinds with different shapes make this a per-kind editor effort comparable to
  the scoped-operations work itself, so it is tracked on its own. The block
  change modal with preview makes the gap survivable meanwhile.
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

Added 2026-07-08. Idea: let the learner send **audio messages** in a
[Roleplay](../features/roleplays.md) attempt, and let the fictional character
reply with audio too when the learner turns that on. This deepens the
English-production goal of roleplays — practicing speaking and listening, not
only writing — while staying inside the existing roleplay resource shape
(snapshot attempt, evaluate, progress, follow-up).

- [ ] Learner audio input: record a spoken English turn in the roleplay-writing
  UI, transcribe it (speech-to-text), and feed the transcript into the same
  turn pipeline the written turns use, so evaluation and progress work
  unchanged. Decide whether the transcript, the audio, or both are persisted in
  the attempt for later evaluation.
- [ ] Character audio output (opt-in): when the learner enables it, the
  fictional character's turns are voiced with TTS. Reuses the shared audio
  infrastructure from [1.2 Scene Media Library](#12-scene-media-library) and the
  comprehension Phase 2 TTS work (server-side quality TTS, object-storage
  caching, voice selection, credit guardrails) — sequence this after that
  infrastructure exists.
- [ ] Evaluation of spoken turns: decide how pronunciation/fluency factor into
  Mr. F's turn-by-turn evaluation, or whether v1 evaluates only the transcript
  text (same as written turns) and defers spoken-specific feedback.
- [ ] Cost, latency, and guardrails: STT and TTS spend inside the existing
  credit guardrails; UX for record/playback limits mirrors the comprehension
  listening constraints where sensible.
- [ ] Manual QA against live inference (record → transcribe → character voice
  reply → evaluate).

Dependency note: the character-audio half leans on the shared media/TTS
infrastructure from [1.2 Scene Media Library](#12-scene-media-library) and 1.1
Phase 2 (Listening comprehension), so it is naturally sequenced after that
lands. The learner-audio (STT) half is more independent and could pilot the
speech surface earlier.

## 1.5 CEFR Level Standardization

Added 2026-07-14. Media and Roleplay authoring currently use the `A1-A2`,
`B1-B2`, and `C1` bands. Formalize how Mister F represents and uses learner
levels across the entire app without prematurely changing the remaining
free-form level fields.

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

---

# Part 2: Engineering And Quality

## 2.1 LLM Inference Portfolio Audit And Governance

Added 2026-07-15 after investigating practice-guide draft latency and finding
that resource authoring operations can inherit a global model tier and reasoning
effort even when their output contract does not require the same quality/latency
tradeoff as a tutor conversation.

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
