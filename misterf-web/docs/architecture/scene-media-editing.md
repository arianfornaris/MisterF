# Scene Media Editing — Inference Inputs

Status: implemented (V3). Covers how user-generated scene media is edited after
creation: manual title edits plus five AI-assisted flows, each of which feeds a
different slice of the media into its model call.

This document is the reference for **what data each edit inference actually
sees**. Keep it aligned with `sceneMedia/sceneMediaPreview.ts` (the generation
entry points), `sceneMedia/handlers.ts` (the routes), and the generators in
`sceneMedia/imageGeneration.ts`, `services/sceneMediaScripts.ts`, and
`sceneMedia/audioGeneration.ts`.

## Edit flows and lifecycle

Layer edits use one modal (`partials/scene-media-change-modal.ejs`) with a
describe → generate → preview → apply flow. Generation streams NDJSON progress;
the result is held as a not-yet-applied preview (`sceneMediaPreviewStore`, in
memory) and only committed on approval. Title generation is an inline helper:
it fills the title input but does not persist anything.

| Flow | Generate endpoint | Apply |
| --- | --- | --- |
| Change image | `POST /preview/image` | `POST /preview/apply` (quick) |
| Change script | `POST /preview/script` | `POST /preview/script/apply` (generates audio, streamed) |
| Regenerate description (metadata) | `POST /preview/metadata` | `POST /preview/apply` (quick) |
| Suggest title | `POST /generate-title` | Fills the manual form only |
| Manual title | — (form) | `POST /edit/save` |

Approving a script is the point where audio is generated (script and audio are
one atomic layer). Image and metadata apply are quick DB commits.

## Input matrix

What each inference receives as input:

| Input | 🖼️ Image | 📝 Script | 🔊 Audio | 🏷️ Metadata | Title |
| --- | :--: | :--: | :--: | :--: | :--: |
| User prompt | ✓ required | ✓ unless level/type changes | — | ✓ optional (guidance) | Fixed request |
| Current image (bytes) | ✓ img2img reference | ✓ vision | — | ✓ vision | ✓ vision |
| Current/base script | ✓ compatibility when kept | ✓ live or last draft | ✓ **sole input** | ✓ | ✓ continuity |
| Descriptive metadata (title, setting, visual summary) | ✓ continuity | ✓ continuity | — | ✓ continuity | ✓ continuity |
| Level | ✓ | ✓ | — | ✓ | — |
| Format | ✓ | ✓ | — | ✓ | ✓ |
| Script-type preference | ✓ | ✓ | — | ✓ | — |
| Speaker genders | — | — | ✓ (voice choice) | — | — |
| Current audio summary (clip count, speakers) | ✓ compatibility when kept | ✓ | — | ✓ | ✓ continuity |

The script/metadata "continuity" fields reach the model through
`SceneMediaGenerationSourceContext` (`sceneMedia/generationContext.ts`), which
instructs the model to preserve unrelated traits and only apply the requested
change.

## Per-inference detail

### 🖼️ Change image — `generateSceneMediaImagePreview` → `generateSceneMediaImage`

Inputs: the change prompt (required), the previous image as an image-to-image
reference (the last pending preview when iterating, otherwise the live image),
plus format, level, and script-type preference. It also receives the source
context: title, setting, visual summary, and any kept script/audio facts. The
image remains the visual reference, while kept script identities and facts are
compatibility anchors so a visual edit does not silently contradict the
listening layer. The prompt requires scene-only output: no editorial captions,
labels, arrows, callouts, panel numbers, speech bubbles, diagram marks, UI, or
watermarks. Real-world text/signage is permitted only when intrinsic to the
requested setting or specifically requested as a natural in-world object.

### 📝 Change script — `generateSceneMediaScriptDraft` → `generateSceneMediaScriptPackage`

The most contextualized flow. Inputs: the change prompt (optional when level or
script type changes), the current image (vision), the base script (live, or the
last draft when iterating), and the full descriptive metadata as continuity
context, plus format and the manually selected target level and script-type
preference. Generates the script text only; no audio. The target level and
script type remain pending with the draft and are persisted only when the
author approves the script and its regenerated audio.

### 🔊 Generate audio — `generateAndStoreSceneMediaAudio` → `generateSceneMediaAudio`

Not a language inference — deterministic TTS. It takes the approved script and
synthesizes one clip per turn. The only thing it considers beyond the text is
each speaker's gender (dialogue) or the monologue/narration gender, used to pick
a stable voice. Nothing else (no image, prompt, or metadata).

### 🏷️ Regenerate description — `generateSceneMediaMetadataDraft` → `generateSceneMediaMetadataPackage`

Inputs: the current image (vision), the current script, the current descriptive
metadata (continuity), plus optional guidance. With empty guidance the effective
prompt falls back to the media's `generationPrompt`, then `createdFrom.prompt`,
then the title. Regenerates the whole descriptive bundle (title, setting, and
visual summary) to resync it with the current scene.

### Suggest title — `generateSceneMediaTitleDraft` → `generateSceneMediaTitlePackage`

Inputs: the current image (vision) and the source context containing the current
title, script, descriptive metadata, and audio summary. Returns one distinct
English title. The browser places it in the existing input and enables Save;
the endpoint never writes to the repository.

## Dependency direction

```
prompt / stored level / format ─▶ IMAGE ─┬─▶ SCRIPT ──▶ AUDIO
                                        ├─▶ DESCRIPTION (metadata)
                                        └─▶ TITLE SUGGESTION
selected target level / script type ───────▶ SCRIPT
```

- A fresh image depends on the request; an edited image also depends on its
  image reference and any kept script/audio continuity constraints.
- The script and the description depend on the image.
- The title suggestion depends on the image and current scene context.
- The audio depends only on the script.

Implication: the descriptive metadata is derived, so it goes stale after an
image or script edit; the "Regenerate description" flow is the resync tool.
Changing a script regenerates its audio on approval. The old creation
`generationPrompt` is no longer shown in the editor (it froze at creation and
drifted stale); the column is retained only as the metadata-resync fallback.
Level and script type cannot be relabeled independently: they change through
the script preview so the stored parameters, script, and audio stay coherent.
