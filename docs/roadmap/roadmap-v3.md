# Roadmap V3

Date: 2026-07-06 (last updated: 2026-07-09)

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
- [ ] Improve the media-authoring AI chat to use tools and hold a more natural
  conversation, rather than a rigid form-like exchange: let the model drive the
  creation steps through tool calls and converse normally with the user.
- [ ] Allow a create-script, review, then create-audio flow: generate the
  structured script first, let the user review and edit it, and only then
  synthesize the per-turn audio clips from the approved script.
- [ ] Give authoring control over audio voice and delivery style. Today voices
  are hard-coded (`dialogueVoices = ['Kore', 'Puck', 'Aoede']`) and assigned by
  speaker order, the revision chat has no voice/style lever, and the OpenRouter
  TTS request sends only text + voice with no style prompt — so a request like
  "make Sam sound like a 7-year-old" cannot change anything. Add per-speaker
  voice selection from the Gemini prebuilt catalog and natural-language style
  direction (emotion, pace, register) passed through to the TTS call, surfaced
  in the authoring/revision flow. Note Gemini TTS has no true child voices and
  no voice cloning; this can only approximate a lighter/younger register, so a
  provider with real child voices would be a separate follow-up.

## 1.3 Voice Messages in Roleplays

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
