# Scene Script Asset Planning

This folder stores curated text-and-audio scripts attached to approved Mister F scene images.

The goal is to turn each reusable image into a listening-ready learning asset without mixing script metadata into the visual image registry.

## Asset Layers

- `../scene-images/scene-images.json` remains the visual registry.
- `scene-scripts.json` stores learner-facing scripts, levels, speaker metadata, transcript turns, audio paths, and generation metadata.
- `audio/` stores generated listening audio grouped by CEFR range.

The design registry may keep several script/audio variants for the same visual
scene. Runtime media library items should be promoted as flat records: one
media item has at most one level, one script, and one audio layer. When one
image has `A1-A2`, `B1-B2`, and `C1` variants, the runtime registry should
create three media items that share the same visual asset id instead of one
media item with nested level variants.

## Script Types

- `dialogue`: two or more in-scene speakers.
- `monologue`: one in-scene character speaking.
- `narration`: a narrator describes the scene or story.
- `mixed`: narration plus in-scene dialogue.

## Levels

The first version uses three practical CEFR bands:

- `A1-A2`: short sentences, common vocabulary, clear sequence, simple present or past.
- `B1-B2`: more natural phrasing, causes and reactions, useful connectors, moderate detail.
- `C1`: richer language, inference, tone, implied motivation, and more natural rhythm.

This keeps the assets useful before the platform finalizes a learner-level standard.

## Audio Direction

Gemini TTS is the default for approved listening assets because previous local tests found it clearer and more natural than the cheaper Kokoro baseline. Dialogue audio is generated turn by turn and concatenated with short pauses so speaker changes stay predictable.

## Batch 1 Scope

Batch 1 covers the first ten approved scene images:

- five everyday problem-solution stories;
- five workplace situations.

Each scene receives one script at each level, for a total of 30 scripts and 30
generated audio files. When promoted to runtime, those become 30 flat media
items that reuse ten visual assets.

## Full Library Scope

The full scene script registry targets all 50 approved scene images. Each image receives three level variants:

- `A1-A2`
- `B1-B2`
- `C1`

This produces 150 scripts and 150 generated listening audio files. In the
runtime media library, that means 150 flat media items grouped by 50 shared
visual asset ids. The first ten scenes use hand-authored mixed
dialogue/narration scripts; the remaining scenes use structured narration
generated from the approved visual metadata so every scene has a reusable
listening layer.

## Review Index

Use `index.html` to review images, leveled scripts, transcripts, audio, and local review notes in one place. The file is standalone and embeds the current JSON data, so it can be opened directly in a browser.

Regenerate it after script metadata changes:

```bash
python3 design/scene-scripts/build_review_index.py
```

## Story Rewrite Pass

The first full-library generation produced many descriptive scripts rather than true stories. Use `rewrite_scene_stories.py` to replace those scripts with leveled microstories and regenerate matching audio.

The spoken transcript should not say things such as `this image shows`, `the learner can`, `the listener can`, or `this wordless story`. Each script should work as a standalone story with setup, complication, action, and resolution.

```bash
python3 design/scene-scripts/rewrite_scene_stories.py --force-audio
python3 design/scene-scripts/build_review_index.py
```
