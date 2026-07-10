# Scene Media Library

Status: partially implemented - V3 has a first built-in media library slice with
flat built-in scene media items, runtime image/audio assets, a server-side
registry, and `/media-library` list/detail pages. The `scene_media` tutor block,
resolver, user-generated media persistence, and resource derivation remain
planned.

## Purpose

Mister F needs a reusable way to show pedagogical scene media with image, audio, and script layers. The first implementation should promote the pre-generated scene library under `design/scene-images/` and `design/scene-scripts/` into runtime assets. The same architecture should later store user-generated scripts/audio and expose them through a personal media library.

The important design shift: the block should not be named after the asset source. Built-in versus generated is a media library concern. The visible block should reference a media library item and let the server resolve the right image/audio/script payload.

## Core Model

Use a unified media library with a common item contract:

- `built_in`: curated assets shipped with Mister F and available globally.
- `user_generated`: assets created for a user or organization, private by default.
- hybrid generated items: user-generated script-and-audio layers that reuse a
  built-in image without duplicating that image.

All three should be renderable through the same `scene_media` block.

```ts
interface SceneMediaBlock {
  /** Literal discriminator. */
  type: "scene_media";
  /** Stable id from the server-side scene media library. */
  mediaId: string;
  /** Optional learner-facing activity framing. */
  prompt?: string;
  /** Which layers the caller wants visible. */
  layers?: {
    image?: boolean;
    audio?: boolean;
    script?: boolean;
  };
}
```

Block rules:

- The model emits `mediaId` and rendering intent, not raw file paths.
- `mediaId` must be a real id from a resolver result, current context, or saved media library item. Never invent, slugify, translate, or guess ids.
- `layers` defaults to `{ image: true }` when omitted.
- The block does not carry a separate level selector. The media item already
  represents one concrete level/script/audio combination.
- `prompt` is learner-facing activity framing. It must not contain raw asset paths, generation instructions, or hidden implementation details.

The source (`built_in` or `user_generated`) must not be encoded in the block type. Source lives in the media library item metadata.

## Media Library Item Shape

The server-side media library should expose one normalized shape to renderers and resource builders. Built-in items can be derived from design JSON. User-generated items can be persisted in the database and backed by object storage for binary files.

```ts
interface SceneMediaLibraryItem {
  id: string;
  source: "built_in" | "user_generated";
  ownerUserId?: string;
  /**
   * Shared visual asset id. Several flat media items may reuse the same image
   * while carrying different scripts, audio, or learner levels.
   */
  visualAssetId?: string;
  title: string;
  format:
    | "four_panel_wordless_story"
    | "two_panel_contrast"
    | "single_panel_scene";
  level?: "A1-A2" | "B1-B2" | "C1";
  setting?: string;
  image?: SceneMediaImageLayer;
  audio?: SceneMediaAudioLayer;
  script?: SceneMediaScript;
  tags: string[];
  skills: string[];
  useCases: string[];
  visualSummary: string[];
  createdFrom?: {
    baseBuiltInMediaId?: string;
    baseVisualAssetId?: string;
    conversationId?: string;
    resourceId?: string;
    prompt?: string;
  };
  status: "ready" | "archived";
}

interface SceneMediaImageLayer {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  source?: "built_in" | "user_generated";
  mediaId?: string;
}

interface SceneMediaAudioLayer {
  src: string;
  durationSeconds: number;
  format: "mp3";
  storageKey?: string;
  provider?: "openrouter";
  model?: string;
  voices?: Array<{
    speaker: string;
    voice: string;
  }>;
}

type SceneMediaScript =
  | {
      scriptType: "dialogue";
      turns: Array<{
        speaker: string;
        text: string;
      }>;
    }
  | {
      scriptType: "narration" | "monologue";
      text: string;
    };
```

Media items are flat by design. A media item should represent one concrete
renderable asset selection: one image layer, optional one script, optional one
audio layer, and at most one learner level. If the same visual scene has
`A1-A2`, `B1-B2`, and `C1` listening variants, promote those as separate media
items with distinct `id` values and the same `visualAssetId`.

This keeps built-in and user-generated media on the same contract. A user
generated item normally has one chosen level and, when complete-scene audio is
requested, one atomic script-and-audio layer. It should not need to mimic a
built-in matrix of variants to be usable by tutor, resource, or quiz flows.

The runtime registry should not carry duplicated `plainText` transcripts. Use `turns` for dialogue and `text` for narration or monologue.

## Built-In Assets

Approved design assets should be promoted before the first implementation ships:

- scene images under `misterf-web/public/scene-media/images/`;
- listening audio under `misterf-web/public/scene-media/audio/`;
- a generated server-side registry derived from approved entries in `design/scene-images/scene-images.json` and `design/scene-scripts/scene-scripts.json`.

Do not put the master registry JSON under `misterf-web/public/` if it contains script/transcript data. Public files are directly fetchable by the browser. Keep the master registry in a non-public server/runtime data location, load it into memory at startup, and expose only resolved render payloads to the client.

The built-in registry should contain only product-safe fields:

- media item id;
- title;
- visual format;
- optional single learner level;
- public image URL and alt text;
- optional public audio URL, duration, and format;
- optional structured script data for that media item;
- teaching tags/use cases needed for selection.

Design metadata may still contain multiple script/audio variants per scene
image. The runtime promotion step should flatten those variants: for example,
`lost-wallet-cafe-01-a1-a2`, `lost-wallet-cafe-01-b1-b2`, and
`lost-wallet-cafe-01-c1` are separate built-in media items that share the same
`visualAssetId` and image file.

Source prompts, QA notes, source images, cost estimates, flattened transcript text, and other design-only fields should stay out of the runtime registry unless there is a product reason to expose them.

## User-Generated Media

Generated media should enter the same library instead of creating a separate block type.
User-generated media files use the shared
[User File Storage](../architecture/user-file-storage.md) bucket/prefix design.

Example: if the tutor starts from a built-in airport image but creates a new
irregular-verb script-and-audio layer, store that as a `user_generated` media
item:

```ts
{
  id: "media_user_123",
  source: "user_generated",
  ownerUserId: "user_abc",
  title: "Airport Story With Irregular Verbs",
  visualAssetId: "airport-security-line-01",
  level: "A1-A2",
  image: {
    source: "built_in",
    mediaId: "airport-security-line-01",
    src: "/public/scene-media/images/airport-security-line-01.png",
    alt: "..."
  },
  script: { scriptType: "narration", text: "..." },
  audio: { src: "...", durationSeconds: 32.4, format: "mp3" },
  createdFrom: {
    baseBuiltInMediaId: "airport-security-line-01",
    baseVisualAssetId: "airport-security-line-01",
    conversationId: "..."
  },
  status: "ready"
}
```

Generated item rules:

- Generated items are private to their owner by default.
- Content should be immutable once referenced by a quiz, practice guide, assignment, or shared resource. Editing title/tags is fine; replacing audio/script should create a new item or version.
- Metadata and scripts can live in the database. Large binary files should not be stored in SQLite.
- Store generated audio/images through a storage abstraction so the first implementation can use local disk if needed, while DigitalOcean Spaces or another object store can replace it without changing the media domain.
- Generated media should have lifecycle states in the generation flow (`pending`, `generating`, `ready`, `failed`, `archived`), even if the library only exposes ready/archived items for normal use.
- Any OpenRouter-backed generation path must run through the normal user credit
  gate before provider calls. Insufficient credit is a product state, not an
  exception page.

Recommended storage boundary:

```ts
interface MediaStorageProvider {
  putObject(input: {
    key: string;
    contentType: string;
    body: Uint8Array | Buffer;
  }): Promise<{ storageKey: string; publicUrl: string }>;
  deleteObject(storageKey: string): Promise<void>;
}
```

Do not design the application domain around the droplet filesystem. A local-disk adapter is acceptable for local development or a first constrained deployment, but the interface should be object-storage-compatible from the start.

## Creating User Media

User-generated media can enter the library through two product flows: creating a
new media item from a prompt, or creating a variation from an existing media
item. Both flows create media through an asynchronous job/lifecycle, not a
synchronous form submit that assumes all assets are ready immediately.

The asynchronous job should be represented by persistent database rows plus a
worker. The first implementation can run the worker in the main Node process,
but HTTP requests must not wait for generation to complete. Persisted jobs let
the app recover from restarts, show in-progress states, and later move the
worker to a dedicated process or queue without changing the product model.

The job record should include at least:

- owner user id;
- owner profile id;
- job type (`new_media` or `variation`);
- prompt or variation instruction;
- selected level;
- selected visual format;
- selected script type preference when applicable;
- requested generation mode;
- source media id for variations;
- layer decisions for variations;
- status (`pending`, `generating`, `ready`, `failed`, `archived`);
- friendly failure reason code;
- created media id when ready;
- timestamps.

### New Media From The Library

The authenticated media library should expose a primary `Create media` action.
The action opens a Bootstrap modal for creating a new media item.

The first version of the modal should collect:

- a free-form prompt describing the scene or learning goal;
- prompt guidance that helps the user write effective prompts, for example:
  describe the scene, who appears, where it happens, and what English skill it
  should practice;
- a required level selector:
  - `A1-A2`;
  - `B1-B2`;
  - `C1`;
- a required visual format selector:
  - `single_panel_scene`;
  - `two_panel_contrast`;
  - `four_panel_wordless_story`;
- a radio-button generation mode selection:
  - `Image only` — generate a visual scene without script or audio;
  - `Complete scene` — generate image, structured script, and listening audio;
- a script type selector shown only for `Complete scene`:
  - unspecified;
  - dialogue;
  - narration;
  - monologue.

The modal does not ask for a title. A variation receives a provisional title
based on its source media, never a verbatim copy of the generation prompt. When
the generation flow produces a new metadata/script package, its concise title
replaces the provisional title. Users can still suggest a desired title inside
the prompt.

The prompt is stored as private provenance for the owner profile. It must not be
used in object storage keys and must not be exposed to other users or shared
resource viewers.

The modal should communicate that generation consumes credits. The server must
check credits before starting any user-scoped OpenRouter-backed generation. If
credit is insufficient, the modal/page should show the normal credits purchase
UI with a return path to the media library.

The MVP credit behavior is:

- verify that the user has enough credit to attempt generation before creating
  the job;
- do not implement credit reservation/preauthorization yet;
- each provider call during job execution still goes through the normal credit
  gate and usage accounting;
- if credit is exhausted during execution, the job fails with a credit-specific
  reason and the UI shows the product credits flow.

New-media generation should create a database record immediately with a
lifecycle state such as `pending` or `generating`. The library can then show the
item as in-progress, failed, or ready instead of blocking the request until all
provider calls finish.

Image is required for user-generated scene media in this phase. Valid user media
shapes are:

- image only;
- image plus script-and-audio.

The MVP does not allow script-only, audio-only, or script-plus-audio without an
image.

Script and audio are one atomic functional layer for user-generated media:
`Script and audio`. If this layer exists, both structured script and generated
audio exist. If it does not exist, neither script nor audio exists. Audio is
always generated from the script; the app does not generate standalone audio.

For `Complete scene`, the pipeline should generate:

1. image;
2. structured script;
3. audio from that script.

Generated user media should include the same conceptual metadata as built-in
media:

- title;
- format;
- level;
- setting;
- visual summary;
- tags;
- skills;
- use cases;
- image layer;
- optional script-and-audio layer;
- source and ownership fields;
- lifecycle status;
- provenance.

For `Image only`, the prompt can still include a pedagogical goal. The system
should still generate/searchable metadata such as tags, skills, use cases,
setting, and visual summary.

Audio and script generation rules:

- voice selection is automatic in the MVP;
- dialogue uses a different voice per speaker when possible;
- dialogue may have at most three speakers;
- if the prompt asks for more than three speakers, the generator should simplify
  or merge roles;
- narration and monologue use one voice;
- voice/provider metadata should be stored as provenance;
- `A1-A2` audio should target roughly 20-45 seconds;
- `B1-B2` audio should target roughly 35-75 seconds;
- `C1` audio should target roughly 60-120 seconds.

The selected level does not impose strict visual-complexity limits on
`Image only` media in the MVP. It is stored for metadata, resolver behavior, and
future resource generation, and it strongly guides script/audio when present.

### Variations From Existing Media

The media detail page for either built-in or user-generated media should expose
a portable action such as `Create variation`. This action opens a modal that
starts from the selected media item.

The variation modal should collect:

- a free-form instruction describing what should change;
- a level selector that defaults to the source media level and can be changed;
- a visual format selector that defaults to the source media format;
- a script type selector when script-and-audio will be generated;
- a per-layer decision for image:
  - keep existing;
  - generate new;
- a per-layer decision for the `Script and audio` layer:
  - keep existing, when the source has script-and-audio;
  - generate new;
  - do not include.

Image is required. The variation UI must not offer `Do not include image`.

If the source does not have script-and-audio, the variation UI must not offer
`Keep existing` for that layer. It should offer `Generate new` or
`Do not include`.

If the user keeps the image, the visual format is locked to the source media
format because format describes the image structure. If the user generates a new
image, the visual format can be changed.

Changing level while keeping the image is allowed without warning. Changing
level while keeping script-and-audio is allowed, but the modal should show a
warning that the existing script-and-audio may not match the new level.

Variation generation must preserve layer references whenever a layer is kept.
If the user keeps the image, the new user-generated media item references the
same image layer or `visualAssetId`; it must not copy the image object into
user storage. The same reuse principle applies to kept script-and-audio layers
when the source layer can be referenced safely. This keeps storage use low and
avoids duplicating built-in or already-generated assets.

When script-and-audio is generated, it must align with the selected level,
visual format, prompt, image, and visual summary:

- `four_panel_wordless_story` should follow the panel sequence;
- `two_panel_contrast` should reflect the contrast between both scenes;
- `single_panel_scene` should describe or dramatize the central scene.

Generation for a variation must receive one structured source-media context for
every generated layer. The context includes the source title, setting, level,
format, image alt text, visual summary, tags, skills, use cases, script when
present, and the user's layer decisions. The image and script generators use
the same context contract. The user's variation prompt defines the requested
changes, kept layers are immutable compatibility anchors, and source traits not
explicitly changed should remain continuous. Source context is delimited as
reference data and must not be treated as model instructions. Audio metadata is
not included because generated audio is derived directly from the resulting
script.

The created item should record provenance:

- source media id;
- source visual asset id when present;
- user prompt/instruction;
- which layers were kept;
- which layers were generated;
- provider/model ids used for generated layers;
- speaker-to-voice mapping when audio is generated;
- storage keys for any new binary layers.

### Library Display Rules

The library should merge user-generated and built-in media into one list backed
by the same normalized item contract.

Ordering:

- user-generated media visible to the current user should appear before built-in
  media;
- within each source group, sort by most recently updated/created first for
  user media and by the built-in catalog order or title for built-ins.

Cards should make the source visible without creating a separate UI vocabulary.
Use restrained Bootstrap/Flatly styling, such as a compact card header or source
badge:

- `Your media` for user-generated items;
- `Built-in` for curated global items.

Pending and failed user media should have clear states. Ready items behave like
other media. Failed items can expose retry/archive actions once those flows
exist.

User-generated media belongs to the active profile that created it. It should be
visible only to that user/profile pair. Other profiles under the same user do
not see it. Sharing user media directly is out of scope for this phase; sharing
will happen later through media resources or derived resources that grant access
to the referenced media without exposing the owner's whole media library.

Pending, generating, failed, and ready user media should all appear in the
library as cards. Cards should carry a status badge. `Archived` items should not
appear by default unless a future filter asks for archived media.

Generating cards remain navigable. Their detail page can show status, prompt,
selected level/format/mode, requested layers, and a generating state. Ready and
failed updates should arrive in the UI through realtime socket events rather
than polling.

Realtime updates should be scoped by profile id. Clients should join a room such
as `profile:{profileId}`. Media generation jobs emit updates to the owner
profile room, not to the entire user account.

Suggested events:

- `media_generation:created`;
- `media_generation:updated`;
- `media_generation:completed`;
- `media_generation:failed`.

### Generation Failure And Retry

Generation can partially fail. The first implementation should prefer a single
job state over exposing incomplete ready media. For example, if image and script
succeed but audio fails for a `Complete scene`, the item should remain `failed`
or `needs_retry` until the missing required layer is generated or the user
archives it.

Retry should reuse completed layers instead of regenerating them unless the user
explicitly asks to regenerate. This avoids extra credits and duplicate storage.

User-facing failure messages:

- generic failure: `Unable to generate this media`;
- policy/safety failure: `This media could not be created because the content
  does not comply with our content policy`.

The user-facing message should appear on the failed card. Technical provider
errors stay in logs and internal failure reason codes. Prompts that violate
policy should not expose technical policy details to the user.

## Resolver Service

The tutor should not need the full built-in media catalog in the main system prompt. Built-in media can be selected through a reusable resolver service that receives a natural-language criterion and a compact catalog, then returns the best approved media library reference.

The current design metadata is too large for routine prompt injection:

- `design/scene-images/scene-images.json`: about 110 KB;
- `design/scene-scripts/scene-scripts.json`: about 377 KB;
- combined design metadata: about 487 KB.

A compact resolver catalog is much smaller. With the current built-in scene set,
a line-oriented catalog containing `id`, `visualAssetId`, `title`, `format`,
`level`, `setting`, script/audio availability, tags, skills, and a short visual
sequence is viable for a separate resolver call, but should still be kept out of
every normal tutor turn.

Implementation decision: build the resolver as an application service, not as tutor-only logic. The core service should be usable by tutor chat, resource authoring, quizzes, practice guides, and future media-aware flows. The tutor can expose a thin internal tool adapter named `resolve_scene_media`, but that tool should delegate to the shared resolver service.

Quiz/resource flows should call the same service directly from server code when they need to attach media to a draft. The resolver is not learner-visible and must not be described to the learner.

Compact resolver catalog fields:

- `id`;
- `source`;
- `visualAssetId`;
- `title`;
- `format`;
- optional single `level`;
- `setting`;
- script type, approximate word count, audio duration, and audio availability;
- `tags`;
- `skills`;
- `useCases`;
- short `visualSummary` sequence.

Do not include image/audio paths, full scripts, flattened transcript text, generation prompts, QA notes, source files, provider names, costs, or generated dates in the compact resolver catalog.

Shared service contract:

```ts
interface ResolveSceneMediaRequest {
  /** Natural-language selection criterion generated from the learner request, resource draft goal, level, and activity plan. */
  criteria: string;
  /** Optional learner CEFR band or practical level to prefer. */
  learnerLevel?: "A1-A2" | "B1-B2" | "C1";
  /** Optional requested media layers. Omit when any layer mix is acceptable. */
  desiredLayers?: Array<"image" | "audio" | "script">;
  /** Optional media ids already used recently, so the resolver can avoid repetition. */
  recentMediaIds?: string[];
  /** Optional ownership boundary for user-generated media. */
  ownerUserId?: string;
  /** Whether to include user-generated items available to the caller. Defaults to true for user-scoped flows. */
  includeUserGenerated?: boolean;
}
```

Shared service result:

```ts
interface ResolveSceneMediaRecommendation {
  strategy:
    | "existing_media"
    | "built_in_image_dynamic_script"
    | "no_good_match";
  mediaId?: string;
  layers?: {
    image?: boolean;
    audio?: boolean;
    script?: boolean;
  };
  confidence?: "high" | "medium" | "low";
  reason: string;
  alternates?: string[];
}
```

Resolver rules:

- The resolver may use model judgment over the compact catalog instead of a vector database for the first 50 built-in scenes.
- The shared service must deterministically validate resolver output before any caller receives it. Invalid ids, unavailable requested layers, or unauthorized user-generated ids become `no_good_match` or a lower-ranked valid alternate.
- The resolver may return `no_good_match` when the library does not fit the requested context.
- The resolver may recommend `built_in_image_dynamic_script` when an approved image fits the visual context but no existing script/audio fits the learner's requested grammar, vocabulary, or topic.
- The resolver must not silently generate dynamic media. Dynamic script, audio, or image generation should happen in a separate generation flow with its own validation, credit handling, storage, and UI states.
- Resolver choices should be logged with `criteria`, selected `mediaId`, `confidence`, and `reason` so poor matches can be audited later.
- When the resolver uses LLM inference in a user-scoped flow, the caller must provide a checked model credential or the service must perform an explicit credit check before calling the resolver model. Tutor socket credit exhaustion must surface through the normal tutor credit UI. HTTP resource flows must redirect or render product UI instead of a raw error.
- Tests must not run live resolver inference. Mock the resolver model call and test catalog validation, authorization, fallback behavior, and malformed resolver outputs.

Recommended module boundary:

- `sceneMediaLibrary`: loads built-in assets, reads user-generated items, validates access, and resolves render payloads.
- `sceneMediaResolver`: shared selection service that accepts a `ResolveSceneMediaRequest` and returns a validated recommendation.
- `resolve_scene_media`: tutor tool adapter that documents model-facing parameters and delegates to `sceneMediaResolver`.
- Resource/quiz services should call `sceneMediaResolver` directly rather than going through the tutor tool adapter.

## Runtime Rendering

The persisted tutor/resource payload should keep the compact id-based `scene_media` block. The resolved client render payload is a delivery detail, not the canonical stored block.

Resolved client payloads may include public image/audio URLs. They should include script data only when the block requested script visibility or a later exercise state explicitly reveals it.

Expected renderer behavior:

- show the image responsively without overflowing the chat or resource column;
- respect the scene format instead of assuming every scene is a four-panel story;
- render audio controls when audio is requested and available;
- show the script/transcript only when requested by the block or when a later exercise flow reveals it;
- provide clear fallback text if a referenced media item is unavailable or unauthorized;
- keep the block usable on mobile;
- use Bootstrap/Bootswatch Flatly-compatible surfaces.

## Relationship To Resources

The media library should be usable from:

- tutor chat responses;
- quiz authoring and quiz attempts;
- practice guides;
- future teacher-assigned activities;
- future media library browsing/search UI.

Resources should reference `mediaId`, not copy media payloads. If a user-generated item is attached to a quiz or practice guide, access checks must ensure that students can render the asset through that resource without receiving broad access to the owner's whole media library.

## Deriving Resources From Media

A media item should be a starting point for creating other resources, not only a
thing to render. Any media detail surface or media action menu can expose
resource-creation actions such as:

- Create quiz from this media;
- Create practice guide from this media;
- Create roleplay from this media, when the scene supports a roleplay setup;
- Create another future resource type from this media.

The expected workflow:

1. The user opens a media item or uses its action menu.
2. The user chooses `Create resource...` and then a target resource type.
3. A modal asks how the user wants the resource to turn out: focus, level,
   language support, number of questions/steps, grammar target, classroom use,
   or any other resource-specific instruction.
4. The server creates a draft resource that references the source `mediaId` and
   passes the user's instruction plus the resolved media context into the
   existing AI authoring flow.
5. The created resource keeps a stable media reference so later rendering,
   sharing, attempts, and follow-up conversations can load the same source
   media.

The user instruction in this modal is not the same as the media resolver
criterion. The resolver selects or validates media. The derivation prompt tells
the resource generator what to build from already selected media.

Resource derivation rules:

- Derived resources should store `sourceMediaId` or an equivalent media
  reference in their draft metadata.
- Generated resource content should include the media by reference, not by
  copying image/audio/script payloads into the resource.
- If the media is user-generated, access checks must grant the derived resource
  enough permission to render that media for students, guests, shared links, and
  follow-up tutor conversations without exposing the owner's whole media
  library.
- If a media item changes title/tags later, derived resources may show updated
  display metadata, but they should not silently change the underlying script,
  audio, or image content used by an existing attempt or assignment.
- The generated resource should record enough provenance to answer "created from
  this media" in history and future authoring chat context.

## Media As A Resource

The resource catalog may need a new resource type that is essentially a media
item wrapped as a resource. Possible product names:

- `Media`: broad and source-neutral, but a little generic.
- `Scene`: more specific to the current asset type and easier for learners to
  understand.
- `Media Scene`: explicit, but heavier as UI copy.

Recommendation for implementation naming: use a resource kind such as `media`
or `scene_media` internally, then choose the learner-facing label after product
copy review. The important part is that this resource should reference a
`mediaId`; it should not duplicate the library item.

A media resource would let users:

- place a media item in folders;
- share it through existing resource-sharing flows;
- assign it or include it in a sequence;
- open it from `/resources`;
- use common resource actions such as move, share, archive, and restore;
- launch "create resource from this media" actions from the resource detail page.

This wrapper is useful because the media library is an asset system, while
`/resources` is the user's teaching/practice workspace. A media item can exist
without being a resource, but making it a resource gives it folder placement,
sharing, and workflow affordances.

## Relationship To Comprehension Exercises

This feature is not the same as a comprehension quiz. It is the media primitive that can support comprehension exercises, writing prompts, speaking prompts, story sequencing, and listening practice.

Roadmap V3's comprehension work may later embed or compose `scene_media` with quiz-style questions, but this proposal intentionally starts with the media display and library foundation.

## Implementation Plan

Recommended implementation order:

1. Generate built-in runtime assets and registry:
   - copy approved final images into `misterf-web/public/scene-media/images/`;
   - copy approved audio into `misterf-web/public/scene-media/audio/`;
   - generate a non-public flat built-in registry from approved design metadata,
     with one media item per concrete level/script/audio variant;
   - generate the compact resolver catalog from the same source.
2. Add the server-side scene media library:
   - validate built-in registry JSON with Zod at startup;
   - expose lookup and block-resolution helpers;
   - represent built-in and user-generated items through one normalized shape;
   - fail fast in development/test if the built-in registry is malformed.
3. Add the `scene_media` block contract:
   - add `scene_media` to the prompt block protocol;
   - add Zod schema, persisted schema, TypeScript types, validation, repair prompt support, and markdown/history conversion support;
   - ensure the model cannot emit raw URLs or paths in the block.
4. Add the reusable media resolver:
   - implement `sceneMediaResolver` as a shared server service;
   - expose `resolve_scene_media` as an internal tutor tool adapter;
   - document the tool adapter and every input parameter in code with `.describe(...)`;
   - update `docs/architecture/architecture.md` and `docs/tutor/runtime.md` when the actual tool is added;
   - use credit-gated inference in user-scoped flows and mock it in tests;
   - call the shared service directly from quiz/resource flows.
5. Add user-generated media persistence:
   - create database tables for generated media metadata, scripts, ownership, origin, status, and storage keys;
   - use a storage provider abstraction for generated audio/images;
   - keep generated items private by default;
   - support lifecycle states for pending/generating/ready/failed/archived media.
6. Add user media creation flows:
   - add a primary media library `New` action and modal for prompt-based media creation;
   - support `Image only` and `Complete scene` generation modes;
   - add a media detail `Create variation` action and modal for deriving from existing media;
   - let the variation modal choose whether image and script-and-audio are kept, generated, or omitted where allowed;
   - preserve references for kept layers instead of copying binary assets;
   - run all OpenRouter-backed generation through the user credit gate;
   - emit realtime job updates to the owner profile room.
7. Add source-aware library display:
   - show current-user media before built-in media;
   - visually distinguish `Your media` from `Built-in` with restrained Bootstrap/Flatly card styling;
   - show pending and failed user media states without mixing them up with ready media.
8. Add resource derivation from media:
   - add media action-menu entries for creating target resources;
   - collect resource-specific generation instructions in a modal;
   - pass `sourceMediaId` plus resolved media context into the selected resource authoring flow;
   - preserve provenance so the resource can show it was created from media.
9. Decide whether to ship a first-class media resource wrapper:
   - if included in V3, add the resource kind, detail page, folder/share/archive integration, and resource catalog card;
   - if deferred, keep media library items usable by derived resources without appearing directly in `/resources`.
10. Render the block in tutor chat and resource surfaces.
11. Add focused tests and prompt fixtures.

## Testing Requirements

Add or update tests for:

- schema acceptance for valid `scene_media` blocks;
- schema rejection for raw paths, unknown layers, unsupported layer requests, and invalid block shapes;
- built-in registry validation against a minimal fixture;
- media library access checks for private user-generated items;
- user media creation job lifecycle, including pending, ready, failed, retry, and archive states;
- credit exhaustion paths for image-only, complete-scene, and variation generation;
- policy/safety failure paths that render the content-policy message on the failed card;
- layer reuse when creating a variation, especially keeping a built-in image without copying it to object storage;
- script-and-audio atomicity: no user-generated media with only script or only audio in the MVP;
- realtime profile-scoped socket updates for media generation jobs;
- library ordering and source styling when user-generated and built-in items are listed together;
- resolver fallback when the model returns a non-existent `mediaId`, unavailable
  layer request, unauthorized media item, malformed strategy, or low-quality
  no-match result;
- direct service usage from non-tutor callers, using mocked inference and a compact catalog fixture;
- client rendering for image-only, image plus audio, image plus script, and missing/unauthorized resolved asset fallback;
- prompt-contract behavior so the tutor knows to call the resolver instead of inventing ids;
- derived resource creation preserving `sourceMediaId` and access to the referenced media;
- if a media resource wrapper ships, route/render tests for resource catalog,
  folder placement, sharing, archive/restore, and the media detail action row.

Tests must not call real image, TTS, object storage, or resolver inference providers.

## Deferred Enhancements

These are intentionally not part of the first V3 built-in implementation, but the architecture should not block them:

- dynamic image generation;
- full user-facing media library browsing UI;
- DigitalOcean Spaces production storage if a local adapter ships first;
- vector databases;
- semantic embeddings;
- automatic grammar-feature extraction, such as indexing irregular verbs;
- teacher-authored media uploads;
- organization/classroom shared media libraries.

The first implementation may still return the resolver strategy `built_in_image_dynamic_script`, but that result should only trigger a future generation flow once generated media persistence exists.

## Future Discussion: Video And Distribution

These ideas are not part of the V3 implementation plan, but the media library
should leave room for them:

- Generate short videos from a scene media item. A video could combine the scene
  image, generated or built-in audio, captions, simple camera motion, and a short
  educational intro/outro.
- Let users publish generated videos to YouTube from inside Mister F, subject to
  explicit user authorization, review, and platform policy constraints.
- Create an official Mister F YouTube channel with original media-based English
  learning videos as an acquisition channel. Each video could link back to a
  Mister F quiz or practice activity based on that video.

Open questions for later product design:

- Whether video generation should be available to all users or only teachers/admins.
- Whether generated videos should use user-owned channels, an official Mister F
  channel, or both.
- How to moderate generated scripts/audio/images before publication.
- How to create stable public quiz links tied to a video while respecting access,
  payments, and guest/claim flows.
- Whether YouTube publishing requires a separate consent, OAuth integration,
  audit log, and revocation flow.
