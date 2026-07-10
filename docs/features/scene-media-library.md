# Scene Media Library

Status: proposal (not implemented) - Planned for Roadmap V3 as the shared media foundation for curated built-in scenes first, then user-generated scene media. The visible tutor/resource block should be source-neutral so built-in, generated, and hybrid media can all render through the same contract.

## Purpose

Mister F needs a reusable way to show pedagogical scene media with image, audio, and script layers. The first implementation should promote the pre-generated scene library under `design/scene-images/` and `design/scene-scripts/` into runtime assets. The same architecture should later store user-generated scripts/audio and expose them through a personal media library.

The important design shift: the block should not be named after the asset source. Built-in versus generated is a media library concern. The visible block should reference a media library item and let the server resolve the right image/audio/script payload.

## Core Model

Use a unified media library with a common item contract:

- `built_in`: curated assets shipped with Mister F and available globally.
- `user_generated`: assets created for a user or organization, private by default.
- hybrid generated items: user-generated script/audio that reuse a built-in image without duplicating that image.

All three should be renderable through the same `scene_media` block.

```ts
interface SceneMediaBlock {
  /** Literal discriminator. */
  type: "scene_media";
  /** Stable id from the server-side scene media library. */
  mediaId: string;
  /**
   * Optional script/listening level to attach when audio or script should be
   * rendered. The server resolves this to an available media item variant.
   */
  level?: "A1-A2" | "B1-B2" | "C1";
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
- `level` is required when `layers.audio` or `layers.script` is `true` and the media item has leveled variants.
- `level` is optional for image-only use or for generated items that have a single un-leveled script/audio variant.
- `prompt` is learner-facing activity framing. It must not contain raw asset paths, generation instructions, or hidden implementation details.

The source (`built_in` or `user_generated`) must not be encoded in the block type. Source lives in the media library item metadata.

## Media Library Item Shape

The server-side media library should expose one normalized shape to renderers and resource builders. Built-in items can be derived from design JSON. User-generated items can be persisted in the database and backed by object storage for binary files.

```ts
interface SceneMediaLibraryItem {
  id: string;
  source: "built_in" | "user_generated";
  ownerUserId?: string;
  title: string;
  format:
    | "four_panel_wordless_story"
    | "two_panel_contrast"
    | "single_panel_scene";
  setting?: string;
  image?: SceneMediaImageLayer;
  tags: string[];
  skills: string[];
  useCases: string[];
  visualSummary: string[];
  levels: Partial<Record<"A1-A2" | "B1-B2" | "C1", SceneMediaLevel>>;
  createdFrom?: {
    baseBuiltInMediaId?: string;
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

interface SceneMediaLevel {
  audio?: {
    src: string;
    durationSeconds: number;
    format: "mp3";
    storageKey?: string;
    // Per-turn timing marks into the single concatenated file (dialogue only).
    // Marks the spoken region of each turn; inter-turn silence is the gap
    // between one turn's endMs and the next turn's startMs.
    segments?: Array<{
      turn: number;
      speaker: string;
      startMs: number;
      endMs: number;
    }>;
    interTurnSilenceMs?: number;
  };
  script?: SceneMediaScript;
}

// How speakers are identified to the listener. Drives whether the tutor may
// refer to a speaker by name or must use their role. See
// design/scene-scripts/README.md ("Identity & Audio Metadata").
type IdentityStrategy = "named_in_dialogue" | "role_only" | "narrator_intro";

type SceneMediaScript =
  | {
      scriptType: "dialogue";
      identityStrategy: IdentityStrategy;
      // One descriptor per distinct speaker. `nameSpokenInAudio` gates whether
      // a question/tutor line may use this speaker's name; when false, refer to
      // them by `role` only (for role_only scripts `name` is itself the role,
      // e.g. "the store clerk").
      speakers: Array<{
        name: string;
        role: string;
        nameSpokenInAudio: boolean;
      }>;
      turns: Array<{
        speaker: string; // matches speakers[].name
        text: string;
      }>;
    }
  | {
      scriptType: "narration" | "monologue";
      text: string;
    };
```

The runtime registry should not carry duplicated `plainText` transcripts. Use `turns` for dialogue and `text` for narration or monologue.

`audio.segments[].speaker` (runtime) corresponds to the design registry's `speakerId`; the runtime uses the display name to line up with `turns[].speaker`.

### Audio Packaging

Each script level exposes a **single** concatenated audio file, not one file per turn. Dialogue audio is synthesized turn by turn but joined into one asset for delivery and playback. When per-turn playback is needed — replaying a single line, syncing transcript highlight, shadowing, or the tutor pointing at one turn — use the `audio.segments` timing marks to seek within the single file rather than fetching separate clips. Mark only the spoken region of each turn; the inter-turn pause is the gap between turns. See `design/scene-scripts/README.md` ("Audio Packaging & Segmentation") for the generation-side rationale and how offsets are derived. Roleplay (feature 1.3), which assembles turns dynamically at runtime, is the one flow that may consume turn-level audio directly instead of this packaged asset.

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
- public image URL and alt text;
- available script levels;
- public audio URL, duration, per-turn timing segments, and structured script data for each level;
- teaching tags/use cases needed for selection.

Source prompts, QA notes, source images, cost estimates, flattened transcript text, and other design-only fields should stay out of the runtime registry unless there is a product reason to expose them.

## User-Generated Media

Generated media should enter the same library instead of creating a separate block type.

Example: if the tutor starts from a built-in airport image but creates a new irregular-verb script and audio, store that as a `user_generated` media item:

```ts
{
  id: "media_user_123",
  source: "user_generated",
  ownerUserId: "user_abc",
  title: "Airport Story With Irregular Verbs",
  image: {
    source: "built_in",
    mediaId: "airport-security-line-01",
    src: "/public/scene-media/images/airport-security-line-01.png",
    alt: "..."
  },
  levels: {
    "A1-A2": {
      script: { scriptType: "narration", text: "..." },
      audio: { src: "...", durationSeconds: 32.4, format: "mp3" }
    }
  },
  createdFrom: {
    baseBuiltInMediaId: "airport-security-line-01",
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

## Resolver Service

The tutor should not need the full built-in media catalog in the main system prompt. Built-in media can be selected through a reusable resolver service that receives a natural-language criterion and a compact catalog, then returns the best approved media library reference.

The current design metadata is too large for routine prompt injection:

- `design/scene-images/scene-images.json`: about 110 KB;
- `design/scene-scripts/scene-scripts.json`: about 377 KB;
- combined design metadata: about 487 KB.

A compact resolver catalog is much smaller. With the current 50 scenes, a line-oriented catalog containing `id`, `title`, `format`, `setting`, available script/audio levels, tags, skills, and a short visual sequence is about 22 KB, roughly 5k-6k tokens. That is viable for a separate resolver call, but should still be kept out of every normal tutor turn.

Implementation decision: build the resolver as an application service, not as tutor-only logic. The core service should be usable by tutor chat, resource authoring, quizzes, practice guides, and future media-aware flows. The tutor can expose a thin internal tool adapter named `resolve_scene_media`, but that tool should delegate to the shared resolver service.

Quiz/resource flows should call the same service directly from server code when they need to attach media to a draft. The resolver is not learner-visible and must not be described to the learner.

Compact resolver catalog fields:

- `id`;
- `source`;
- `title`;
- `format`;
- `setting`;
- available levels with script type, approximate word count, audio duration, and audio availability;
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
  level?: "A1-A2" | "B1-B2" | "C1";
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
- The shared service must deterministically validate resolver output before any caller receives it. Invalid ids, invalid levels, unavailable requested layers, or unauthorized user-generated ids become `no_good_match` or a lower-ranked valid alternate.
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
   - generate a non-public built-in registry from approved design metadata;
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
   - keep generated items private by default.
6. Add resource derivation from media:
   - add media action-menu entries for creating target resources;
   - collect resource-specific generation instructions in a modal;
   - pass `sourceMediaId` plus resolved media context into the selected resource authoring flow;
   - preserve provenance so the resource can show it was created from media.
7. Decide whether to ship a first-class media resource wrapper:
   - if included in V3, add the resource kind, detail page, folder/share/archive integration, and resource catalog card;
   - if deferred, keep media library items usable by derived resources without appearing directly in `/resources`.
8. Render the block in tutor chat and resource surfaces.
9. Add focused tests and prompt fixtures.

## Testing Requirements

Add or update tests for:

- schema acceptance for valid `scene_media` blocks;
- schema rejection for raw paths, unknown layers, invalid levels, and invalid block shapes;
- built-in registry validation against a minimal fixture;
- media library access checks for private user-generated items;
- resolver fallback when the model returns a non-existent `mediaId`, unavailable level, unauthorized media item, malformed strategy, or low-quality no-match result;
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
