# Built-In Scene Media Block

Status: proposal (not implemented) - Planned for Roadmap V3 as the first media block for curated, built-in Mister F scene assets. Dynamically generated media will use a separate future block and is intentionally out of scope here.

## Purpose

Mister F needs a tutor response block that can show a curated learning scene with image, audio, and script layers. The first version should serve the pre-generated scene library under `design/scene-images/` and `design/scene-scripts/`, where assets are reviewed before product use.

This block is for built-in system media only. The tutor should not invent external URLs, upload files, request generation, or point to arbitrary media. It should reference approved asset identifiers, and the server should resolve those identifiers through a runtime registry.

## Core Distinction

There are two different product problems:

- Built-in media: curated assets shipped with Mister F, selected by id and rendered safely in tutor chat.
- Dynamic media: images, audio, or scripts generated on demand for a specific learner/session.

This feature covers only built-in media. Dynamic media should get its own later block because it will need different validation, credit behavior, generation lifecycle, storage rules, moderation, retries, and pending/loading UI.

## Proposed Block Shape

Use one flexible block rather than separate image, audio, and script blocks. The block represents one curated pedagogical scene, and each media layer is optional.

Implementation decision: use `built_in_scene_media` as the discriminator for
the V3 implementation. The explicit built-in prefix is intentional because a
future dynamic media block will have different lifecycle, validation, storage,
credit, and UI semantics.

```ts
interface BuiltInSceneMediaBlock {
  /** Literal discriminator. */
  type: "built_in_scene_media";
  /** Stable id from the approved runtime scene registry. */
  sceneId: string;
  /**
   * Optional script/listening level to attach when audio or script should be
   * rendered. The server resolves this to an approved script variant.
   */
  level?: "A1-A2" | "B1-B2" | "C1";
  /**
   * Optional learner-facing prompt that frames the activity without embedding
   * the asset payload itself.
   */
  prompt?: string;
  /**
   * Which layers the tutor wants visible. Omitted layers are not rendered even
   * when the asset registry has data for them.
   */
  layers?: {
    image?: boolean;
    audio?: boolean;
    script?: boolean;
  };
}
```

Block rules:

- The model emits references and rendering intent, not raw file paths.
- `sceneId` must be a real id from the approved runtime scene registry. Never
  invent, slugify, translate, or guess ids.
- `layers` defaults to `{ image: true }` when omitted.
- `level` is required when `layers.audio` or `layers.script` is `true`.
- `level` is optional for image-only use.
- `prompt` is learner-facing activity framing. It must not contain raw asset
  paths, generated media instructions, or hidden implementation details.

## Runtime Resolution

Approved design assets should be promoted into product runtime assets before this block ships:

- scene images under `misterf-web/public/scene-media/images/`;
- listening audio under `misterf-web/public/scene-media/audio/`;
- a generated server-side runtime registry derived from approved entries in
  `design/scene-images/scene-images.json` and
  `design/scene-scripts/scene-scripts.json`.

Do not put the master registry JSON under `misterf-web/public/` if it contains
script/transcript data. Public files are directly fetchable by the browser. Keep
the master registry in a non-public server/runtime data location, load it into
memory at startup, and expose only resolved render payloads to the client.

The runtime registry should contain only approved product-safe fields:

- `sceneId`;
- title;
- visual format: `four_panel_wordless_story`, `two_panel_contrast`, or `single_panel_scene`;
- public image URL and alt text;
- available script levels;
- public audio URL, duration, and structured script data for each level;
- teaching tags/use cases needed for selection.

Source prompts, QA notes, source images, cost estimates, flattened transcript text, and other design-only fields should stay out of the runtime registry unless there is a product reason to expose them.

Recommended server module responsibilities:

- load and validate the registry once at startup with Zod;
- build `Map<sceneId, BuiltInSceneMediaAsset>`;
- expose `getBuiltInSceneMediaAsset(sceneId)`;
- expose `resolveBuiltInSceneMediaBlock(block)` to validate layer/level
  availability and produce the safe client render payload;
- expose the compact resolver catalog separately from the full render registry.

Resolved client payloads may include public image/audio URLs. They should include
script data only when the block requested script visibility or a later exercise
state explicitly reveals it.

The persisted tutor message should keep the compact id-based block. The resolved
client render payload is a delivery detail, not the canonical stored block.

## Runtime Registry Shape

The generated registry should be explicit enough that an implementation agent
does not need to inspect the design JSON shape while wiring the runtime.

```ts
interface BuiltInSceneMediaRegistry {
  version: 1;
  generatedAt: string;
  scenes: BuiltInSceneMediaAsset[];
}

interface BuiltInSceneMediaAsset {
  id: string;
  title: string;
  format:
    | "four_panel_wordless_story"
    | "two_panel_contrast"
    | "single_panel_scene";
  setting: string;
  image: {
    src: string;
    alt: string;
    width: 720;
    height: 720;
  };
  tags: string[];
  skills: string[];
  useCases: string[];
  visualSummary: string[];
  levels: Partial<Record<"A1-A2" | "B1-B2" | "C1", BuiltInSceneMediaLevel>>;
}

interface BuiltInSceneMediaLevel {
  audio?: {
    src: string;
    durationSeconds: number;
    format: "mp3";
  };
  script?: BuiltInSceneScript;
}

type BuiltInSceneScript =
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

## Runtime Script Shape

The runtime registry should not carry a duplicated `plainText` transcript. It should keep only the smallest structured script form needed to render the requested layer.

Use `turns` for dialogue:

```json
{
  "scriptType": "dialogue",
  "turns": [
    {
      "speaker": "Maria",
      "text": "Oh no, my wallet is not in my bag."
    },
    {
      "speaker": "Mr. James",
      "text": "Excuse me. Is this brown wallet yours?"
    }
  ]
}
```

Use `text` for narration or monologue:

```json
{
  "scriptType": "narration",
  "text": "Maria walks into the cafe on a rainy afternoon. Her wallet falls from her bag near the door."
}
```

This keeps the product registry small and avoids two sources of truth for the same script.

## Media Resolver Service

The tutor should not need the full built-in media catalog in the main system prompt. The first 50 scene assets can be selected through a separate resolver step that receives a natural-language selection criterion and a compact catalog, then returns the best approved scene reference.

The current design metadata is too large for routine prompt injection:

- `design/scene-images/scene-images.json`: about 110 KB;
- `design/scene-scripts/scene-scripts.json`: about 377 KB;
- combined design metadata: about 487 KB.

A compact resolver catalog is much smaller. With the current 50 scenes, a line-oriented catalog containing `id`, `title`, `format`, `setting`, available script/audio levels, tags, skills, and a short visual sequence is about 22 KB, roughly 5k-6k tokens. That is viable for a separate resolver call, but should still be kept out of every normal tutor turn.

Implementation decision: build the resolver as an application service, not as
tutor-only logic. The core service should be usable by tutor chat, resource
authoring, quizzes, practice guides, and future media-aware flows. The tutor can
expose a thin internal tool adapter named `resolve_builtin_scene_media`, but
that tool should delegate to the shared resolver service.

The main tutor model calls the tool adapter when a built-in scene could help,
passing natural-language criteria instead of receiving the whole catalog in the
main prompt. Quiz/resource flows can call the same service directly from server
code when they need to attach built-in media to a resource draft. The resolver
is not a learner-visible feature and must not be described to the learner.

Compact resolver catalog fields:

- `id`;
- `title`;
- `format`;
- `setting`;
- available levels with script type, approximate word count, audio duration,
  and audio availability;
- `tags`;
- `skills`;
- `useCases`;
- short `visualSummary` sequence.

Do not include image/audio paths, full scripts, flattened transcript text,
generation prompts, QA notes, source files, provider names, costs, or generated
dates in the compact resolver catalog.

Shared service contract:

```ts
interface ResolveBuiltInSceneMediaRequest {
  /**
   * Natural-language selection criterion generated from the learner request,
   * current tutoring goal, level, and activity plan.
   */
  criteria: string;
  /** Optional learner CEFR band or practical level to prefer. */
  learnerLevel?: "A1-A2" | "B1-B2" | "C1";
  /** Optional requested media layers. Omit when any layer mix is acceptable. */
  desiredLayers?: Array<"image" | "audio" | "script">;
  /** Optional scene ids already used recently, so the resolver can avoid repetition. */
  recentSceneIds?: string[];
}
```

The tutor tool adapter should expose the same meaningful fields, with `.describe(...)`
documentation for every input parameter.

Parameter documentation required for the tool adapter:

- `criteria`: transient model-facing selection request generated from the
  learner's latest need and current tutoring plan. Use English internally even
  when the learner's instruction language is Spanish or Haitian Creole. Do not
  copy private system prompt text into this field.
- `learnerLevel`: optional preferred level. Omit only when the current tutor
  context has no usable level signal.
- `desiredLayers`: optional layer preference. Omit when the resolver may decide
  whether image, audio, or script is pedagogically best.
- `recentSceneIds`: optional real scene ids already used in the current
  conversation or recent session context. Never invent ids.

Shared service result:

```ts
interface ResolveBuiltInSceneMediaRecommendation {
  strategy:
    | "built_in_scene"
    | "built_in_image_dynamic_script"
    | "no_good_match";
  sceneId?: string;
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

- The resolver may use model judgment over the compact catalog instead of a vector database for the first 50 scenes.
- The shared service must deterministically validate resolver output before any
  caller receives it. Invalid ids, invalid levels, or unavailable requested
  layers become `no_good_match` or a lower-ranked valid alternate.
- The resolver may return `no_good_match` when the built-in library does not fit the requested context.
- The resolver may recommend `built_in_image_dynamic_script` when an approved image fits the visual context but the built-in script/audio does not fit the learner's requested grammar, vocabulary, or topic.
- The resolver must not silently generate dynamic media inside the built-in block flow. Dynamic script, audio, or image generation should happen in a separate future flow with its own validation, credit handling, storage, and UI states.
- Resolver choices should be logged with `criteria`, selected `sceneId`, `confidence`, and `reason` so poor matches can be audited later.
- When the resolver uses LLM inference in a user-scoped flow, the caller must
  provide a checked model credential or the service must perform an explicit
  credit check before calling the resolver model. Tutor socket credit exhaustion
  must surface through the normal tutor credit UI. HTTP resource flows must
  redirect or render product UI instead of a raw error.
- Tests must not run live resolver inference. Mock the resolver model call and
  test catalog validation, fallback behavior, and malformed resolver outputs.

This approach is intentionally simple. It can later be replaced or augmented by lexical filters, explicit linguistic indexes, semantic embeddings, or a deterministic ranking service without changing the visible `built_in_scene_media` block contract.

Recommended module boundary:

- `sceneMediaRegistry`: loads/validates assets and exposes lookups plus compact
  catalog data.
- `sceneMediaResolver`: shared selection service that accepts a
  `ResolveBuiltInSceneMediaRequest` and returns a validated recommendation.
- `resolve_builtin_scene_media`: tutor tool adapter that documents model-facing
  parameters and delegates to `sceneMediaResolver`.
- Resource/quiz services should call `sceneMediaResolver` directly rather than
  going through the tutor tool adapter.

## Tutor Behavior

The tutor can use this block when a curated scene helps the learner practice English through visual description, listening, reading support, story sequencing, vocabulary, or comprehension.

Valid examples:

- image only: show a wordless story and ask the learner to describe what happened;
- image plus audio: play a listening story after the learner sees the scene;
- image plus script: support reading or transcript review;
- audio plus script: listening/reading support when the image is not needed;
- image plus audio plus script: full multimodal review.

The tutor should choose the scene by pedagogical fit, learner level, and available metadata. It should not request or imply live generation inside this block.

## UI Expectations

The renderer should use a single card-like tutor block surface that fits the existing Bootstrap/Bootswatch Flatly chat style.

Expected behavior:

- show the image responsively without overflowing the chat column;
- respect the scene format instead of assuming every scene is a four-panel story;
- render audio controls when audio is requested and available;
- show the script/transcript only when requested by the block or when a later exercise flow reveals it;
- provide clear fallback text if a referenced built-in asset is unavailable;
- keep the block usable on mobile.

## Relationship To Comprehension Exercises

This block is not the same as a comprehension quiz. It is a media stimulus block for tutor chat. It can support comprehension exercises, writing prompts, speaking prompts, story sequencing, and listening practice.

Roadmap V3's comprehension work may later embed or compose this block with quiz-style questions, but this proposal intentionally starts with the media display primitive so the tutor has a safe way to show built-in scenes before the full stimulus-plus-questions model is complete.

## Implementation Plan

Recommended implementation order:

1. Generate runtime assets and registry:
   - copy approved final images into `misterf-web/public/scene-media/images/`;
   - copy approved audio into `misterf-web/public/scene-media/audio/`;
   - generate a non-public runtime registry from approved design metadata;
   - generate the compact resolver catalog from the same source.
2. Add a server-side built-in scene media registry module:
   - validate registry JSON with Zod at startup;
   - expose lookup and block-resolution helpers;
   - fail fast in development/test if the registry is malformed.
3. Add the tutor block contract:
   - add `built_in_scene_media` to the prompt block protocol;
   - add Zod schema, persisted schema, TypeScript types, validation, repair
     prompt support, and markdown/history conversion support;
   - ensure the model cannot emit raw URLs or paths in the block.
4. Add the reusable media resolver:
   - implement `sceneMediaResolver` as a shared server service;
   - expose `resolve_builtin_scene_media` as an internal tutor tool adapter;
   - document the tool adapter and every input parameter in code with `.describe(...)`;
   - update `docs/architecture/architecture.md` and `docs/tutor/runtime.md`
     when the actual tool is added;
   - use credit-gated inference in user-scoped flows and mock it in tests;
   - call the shared service directly from future quiz/resource flows.
5. Render the block in tutor chat:
   - resolve the persisted id-based block into a safe client render payload;
   - render image, audio, and script layers according to `layers`;
   - keep script hidden unless the block or exercise state requests it.
6. Add focused tests and prompt fixtures.

## Testing Requirements

Add or update tests for:

- schema acceptance for valid `built_in_scene_media` blocks;
- schema rejection for raw paths, unknown layers, invalid levels, and invalid
  block shapes;
- registry validation against a minimal fixture;
- resolver fallback when the model returns a non-existent `sceneId`, unavailable
  level, malformed strategy, or low-quality no-match result;
- client rendering for image-only, image plus audio, image plus script, and
  missing resolved asset fallback;
- prompt-contract behavior so the tutor knows to call the resolver instead of
  inventing ids.
- direct service usage from non-tutor callers, using mocked inference and a
  compact catalog fixture.

Tests must not call real image, TTS, or resolver inference providers.

## Deferred Enhancements

These are intentionally not part of the first V3 implementation:

- dynamic image/script/audio generation;
- silently mixing generated script/audio into `built_in_scene_media`;
- vector databases;
- semantic embeddings;
- automatic grammar-feature extraction, such as indexing irregular verbs;
- teacher-authored media uploads;
- storing learner-specific generated media.

The first implementation may still return the resolver strategy
`built_in_image_dynamic_script`, but that result should only inform future
product work until the dynamic media flow exists.
