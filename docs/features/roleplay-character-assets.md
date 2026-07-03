# Roleplay Character Assets

Date: 2026-07-03

This document describes a proposed process for creating, storing, and loading a
small library of roleplay character avatar assets for Mister F.

## Goal

Roleplay resources should be able to show reusable character portraits in the
chat/runtime UI. The first proposed library is about 50 original, consistent
character avatars that can cover common roleplay situations such as postal
services, restaurants, travel, school, health care, offices, stores, and public
services.

Each avatar should be:

- an original character, not based on a recognizable studio, franchise, actor,
  or public figure
- friendly and suitable for language-learning roleplays
- illustrated in a 2D cartoon style similar to modern language-learning
  textbook characters, not a 3D animated style
- shown in casual everyday clothing rather than profession-specific uniforms,
  so the same character can be reused across different contexts
- visibly varied across the library by skin tone, age, gender, body shape, hair
  texture, hairstyle, and accessories
- exported at 128x128 pixels and still readable if the UI scales it down
- exported as a transparent PNG
- visually consistent with the rest of the character library
- stored as a project asset, not as an external generated-image cache entry

## Asset Location

Proposed runtime asset paths:

- source/final image assets: `misterf-web/public/roleplay-characters/*.png`
- registry metadata: `misterf-web/src/server/roleplays/characters.json`
- loader/validator: `misterf-web/src/server/roleplays/characterRegistry.ts`

The public image path keeps avatars easy for the browser to render:

```text
/roleplay-characters/postal-worker.png
```

The server-side JSON registry keeps metadata validated and available to
authoring, runtime, and future recommendation flows.

## Registry Shape

The registry can start as a single JSON object:

```json
{
  "characters": [
    {
      "id": "postal-worker",
      "name": "Maya",
      "shortDescription": "A cheerful postal worker who helps customers ship packages.",
      "age": 29,
      "gender": "woman",
      "imageFile": "postal-worker.png"
    }
  ]
}
```

Recommended fields:

- `id`: stable kebab-case identifier used by roleplay drafts and UI selection.
- `name`: display name for the character.
- `shortDescription`: one short sentence describing the character role/persona.
- `age`: approximate age as a number.
- `gender`: short display/category value; keep flexible enough for future
  inclusive character options.
- `imageFile`: filename under `public/roleplay-characters/`.

Possible later fields:

- `tags`: searchable tags such as `travel`, `school`, `restaurant`, `service`.
- `voice`: future text-to-speech voice hint.
- `locale`: optional cultural or regional context when relevant.
- `altText`: explicit accessibility text if `shortDescription` is not enough.

## App Loading

At app startup, load the registry through a small server module:

1. Import or read `characters.json`.
2. Validate it with Zod.
3. Verify ids are unique.
4. Verify each `imageFile` is a safe filename and resolves to the public asset
   path.
5. Export helpers such as `listRoleplayCharacters()` and
   `findRoleplayCharacter(id)`.

Roleplay resources should store only the selected character id, plus any
resource-specific character name/description overrides that the teacher edits.
The shared registry stays reusable, while saved roleplay snapshots remain
stable.

## Generation Workflow

Use the project skill `roleplay-character-avatar` for each new character.

The repeatable workflow is:

1. Define metadata first: `id`, `name`, `shortDescription`, `age`, `gender`,
   and final `imageFile`.
2. Generate a full-size source image using a consistent prompt template.
3. Use a flat chroma-key background during generation.
4. Remove the chroma-key background locally to create a transparent PNG.
5. Resize the runtime asset to 128x128 and verify small-avatar readability.
6. Save the final transparent PNG under
   `misterf-web/public/roleplay-characters/`.
7. Add or update the matching entry in `characters.json`.
8. Validate that the PNG has an alpha channel and that transparent corners are
   actually transparent.

The current prototype generated during discussion lives outside runtime assets:

```text
design/roleplay-avatars/postal-worker-64.png
design/roleplay-avatars/postal-worker-transparent.png
```

Those files are useful as visual references, but runtime-ready assets should be
copied into `misterf-web/public/roleplay-characters/` when the feature is
implemented.

## Prompt Direction

Use a consistent prompt family rather than one-off art direction. The prompt
should ask for:

- a small roleplay chat avatar sprite
- an original friendly animated character portrait
- head-and-shoulders or waist-up framing
- generous padding for 128x128 avatar readability
- clean 2D cartoon styling suitable for language-learning materials
- casual clothes and reusable, non-profession-specific presentation
- deliberate variety in skin tone, body type, age, hair, and personal style
- no logos, no text, no watermark
- no recognizable franchise, studio, celebrity, or existing character
- a perfectly flat chroma-key background for background removal

Avoid asking for a specific copyrighted studio style. Use language such as
"2D cartoon illustration for a modern language-learning textbook" instead.

## Open Product Questions

- Should teachers pick from the shared character library, or should the app
  auto-select characters based on the generated roleplay scenario?
- Should a roleplay resource snapshot copy the image metadata, or only store the
  character id and resolve the current registry at render time?
- Should character images be allowed in public shared roleplays before login?
- Should the first batch be balanced by age, gender, profession, and scenario
  coverage?
- Should `gender` be a controlled enum or a flexible string?
