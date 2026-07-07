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

The final implementation can rename the discriminator, but the important rule is that the model emits references and rendering intent, not raw file paths.

## Runtime Resolution

Approved design assets should be promoted into product runtime assets before this block ships:

- scene images under a public runtime folder such as `misterf-web/public/scene-images/`;
- listening audio under a public runtime folder such as `misterf-web/public/scene-audio/`;
- a generated runtime registry derived from approved entries in `design/scene-images/scene-images.json` and `design/scene-scripts/scene-scripts.json`.

The runtime registry should expose only approved product-safe fields:

- `sceneId`;
- title;
- visual format: `four_panel_wordless_story`, `two_panel_contrast`, or `single_panel_scene`;
- image URL and alt text;
- available script levels;
- audio URL, duration, and structured script data for each level;
- teaching tags/use cases needed for selection.

Source prompts, QA notes, source images, cost estimates, flattened transcript text, and other design-only fields should stay out of the runtime payload unless there is a product reason to expose them.

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

## Media Resolver Tool

The tutor should not need the full built-in media catalog in the main system prompt. The first 50 scene assets can be selected through a separate resolver step that receives a natural-language selection criterion and a compact catalog, then returns the best approved scene reference.

The current design metadata is too large for routine prompt injection:

- `design/scene-images/scene-images.json`: about 110 KB;
- `design/scene-scripts/scene-scripts.json`: about 377 KB;
- combined design metadata: about 487 KB.

A compact resolver catalog is much smaller. With the current 50 scenes, a line-oriented catalog containing `id`, `title`, `format`, `setting`, available script/audio levels, tags, skills, and a short visual sequence is about 22 KB, roughly 5k-6k tokens. That is viable for a separate resolver call, but should still be kept out of every normal tutor turn.

Conceptual tool:

```ts
interface ResolveBuiltInSceneMediaInput {
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

Conceptual result:

```ts
interface ResolveBuiltInSceneMediaResult {
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
- The resolver must return only real `sceneId` and `level` values from the catalog. The server must validate them deterministically before any tutor block is persisted or rendered.
- The resolver may return `no_good_match` when the built-in library does not fit the requested context.
- The resolver may recommend `built_in_image_dynamic_script` when an approved image fits the visual context but the built-in script/audio does not fit the learner's requested grammar, vocabulary, or topic.
- The resolver must not silently generate dynamic media inside the built-in block flow. Dynamic script, audio, or image generation should happen in a separate future flow with its own validation, credit handling, storage, and UI states.
- Resolver choices should be logged with `criteria`, selected `sceneId`, `confidence`, and `reason` so poor matches can be audited later.

This approach is intentionally simple. It can later be replaced or augmented by lexical filters, explicit linguistic indexes, semantic embeddings, or a deterministic ranking service without changing the visible `built_in_scene_media` block contract.

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

## Open Decisions

- Final discriminator name: `built_in_scene_media`, `scene_media`, or another explicit built-in name.
- Whether the model should specify `layers` or whether layer visibility should be inferred from `level` and activity type.
- Whether scripts are initially visible or revealable by user action for listening practice.
- Whether the block should include a compact `activityKind` such as `describe`, `listen`, `read`, or `story_sequence`.
- Whether the media resolver should ship as a tutor-accessible tool, an internal server helper called before generation, or both.
- Whether the resolver should initially use only model judgment over the compact catalog, or combine that with deterministic filters for level, media layer availability, and recently used scenes.
