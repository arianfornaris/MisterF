---
name: roleplay-character-avatar
description: Generate or update Mister F roleplay character avatar assets and their registry metadata. Use when creating small transparent PNG character portraits for roleplay chat/runtime UI, adding entries to roleplay character metadata, updating `characters.json`, or preparing reusable character assets under `misterf-web/public/roleplay-characters/`.
---

# Roleplay Character Avatar

Use this skill to create one reusable roleplay character avatar and keep its
metadata synchronized with the project registry.

## Required Inputs

Start from explicit metadata. If the user does not provide every field, choose
reasonable values and state them before finalizing:

- `id`: stable kebab-case id, such as `postal-worker`.
- `name`: display name.
- `shortDescription`: one short sentence describing the character role/persona.
- `age`: approximate numeric age.
- `gender`: short display/category value.
- `imageFile`: final PNG filename, normally `${id}.png`.

## Project Paths

Use these paths for runtime assets:

- final images: `misterf-web/public/roleplay-characters/*.png`
- metadata registry: `misterf-web/src/server/roleplays/characters.json`
- future registry loader: `misterf-web/src/server/roleplays/characterRegistry.ts`

Generated-image cache files are not project assets. Copy the final transparent
PNG into the workspace before finishing.

## Visual Standard

Generate original characters only. Do not request or imitate a named studio,
franchise, celebrity, public figure, or existing character.

Avatar requirements:

- transparent PNG
- exported at 128x128 pixels and still readable if the UI scales it down
- square composition
- centered head-and-shoulders or waist-up character
- generous padding around the silhouette
- friendly 2D cartoon look similar to modern language-learning textbook
  characters
- casual everyday clothing, not profession-specific uniforms
- visible variety across the set: skin tones, ages, genders, body shapes, hair
  textures, hairstyles, and accessories
- no text, no logos, no watermark
- no cast shadow or ground contact shadow

## Generation Workflow

1. Use the `imagegen` skill/tool for the raster image.
2. Generate the character on a perfectly flat chroma-key background, usually
   `#00ff00`; use `#ff00ff` if green appears in the character.
3. Copy the generated source image into a working/project path.
4. Remove the chroma-key background with:

   ```bash
   python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
     --input <source.png> \
     --out <final.png> \
     --auto-key border \
     --soft-matte \
     --transparent-threshold 12 \
     --opaque-threshold 220 \
     --despill
   ```

   If system `python` lacks Pillow, use the bundled Codex runtime Python when
   available.

5. Export the runtime asset at 128x128 from the larger transparent source.
6. Validate alpha:
   - PNG mode includes alpha.
   - corner pixels are transparent.
   - subject edges do not show obvious chroma-key fringe.
   - the subject remains readable as a small avatar.
7. Save the final runtime asset under
   `misterf-web/public/roleplay-characters/${imageFile}`.
8. Add or update the matching `characters.json` entry.

## Prompt Template

Adapt this prompt for the specific metadata:

```text
Use case: stylized-concept
Asset type: small roleplay chat avatar sprite, intended to be exported at 128x128 px
Primary request: Create one original friendly animated character portrait for a language-learning roleplay chat.
Subject: <name>, <age>, <gender>, <shortDescription>. Show the character as a centered waist-up bust with an expressive face and clear readable silhouette.
Style/medium: 2D cartoon illustration for a modern language-learning textbook, clean ink outlines, flat friendly colors, simple shading, expressive eyes, not 3D, not based on any existing franchise, studio, celebrity, public figure, or character.
Composition/framing: square composition, centered, full head and shoulders visible, generous padding, icon/avatar readability at 128x128 and smaller.
Lighting/mood: soft studio lighting, bright optimistic mood.
Constraints: Create the subject on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No cast shadow, no contact shadow, no reflection, no watermark, no text.
Avoid: 3D render, named animation studios, existing characters, copyrighted designs, logos, realistic photo look, profession-specific uniforms.
```

## Registry Entry

Use this shape:

```json
{
  "id": "postal-worker",
  "name": "Maya",
  "shortDescription": "A cheerful postal worker who helps customers ship packages.",
  "age": 29,
  "gender": "woman",
  "imageFile": "postal-worker.png"
}
```

Keep registry entries sorted by `id` once the registry exists.
