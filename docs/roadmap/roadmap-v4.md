# Roadmap V4

Date: 2026-07-07 (last updated: 2026-07-26)

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
