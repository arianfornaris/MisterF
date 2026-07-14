# Scene Media Editing — Inference Inputs

Status: implemented (V3). Covers how user-generated scene media is edited after
creation: manual metadata edits plus four AI edit flows, each of which feeds a
different slice of the media into its model call.

This document is the reference for **what data each edit inference actually
sees**. Keep it aligned with `sceneMedia/sceneMediaPreview.ts` (the generation
entry points), `sceneMedia/handlers.ts` (the routes), and the generators in
`sceneMedia/imageGeneration.ts`, `services/sceneMediaScripts.ts`, and
`sceneMedia/audioGeneration.ts`.

## Edit flows and lifecycle

All AI edits use one modal (`partials/scene-media-change-modal.ejs`) with a
describe → generate → preview → apply flow. Generation streams NDJSON progress;
the result is held as a not-yet-applied preview (`sceneMediaPreviewStore`, in
memory) and only committed on approval.

| Flow | Generate endpoint | Apply |
| --- | --- | --- |
| Change image | `POST /preview/image` | `POST /preview/apply` (quick) |
| Change script | `POST /preview/script` | `POST /preview/script/apply` (generates audio, streamed) |
| Regenerate description (metadata) | `POST /preview/metadata` | `POST /preview/apply` (quick) |
| Manual metadata (title/level/script type) | — (form) | `POST /edit/save` |

Approving a script is the point where audio is generated (script and audio are
one atomic layer). Image and metadata apply are quick DB commits.

## Input matrix

What each inference receives as input:

| Input | 🖼️ Image | 📝 Script | 🔊 Audio | 🏷️ Metadata |
| --- | :--: | :--: | :--: | :--: |
| User prompt | ✓ required | ✓ required | — | ✓ optional (guidance) |
| Current image (bytes) | ✓ img2img reference | ✓ vision | — | ✓ vision |
| Current/base script | — | ✓ live or last draft | ✓ **sole input** | ✓ |
| Descriptive metadata (title, setting, visual summary, tags, skills, use cases) | — | ✓ continuity | — | ✓ continuity |
| Level | ✓ | ✓ | — | ✓ |
| Format | ✓ | ✓ | — | ✓ |
| Script-type preference | ✓ | ✓ | — | ✓ |
| Speaker genders | — | — | ✓ (voice choice) | — |
| Current audio summary (clip count, speakers) | — | ✓ | — | ✓ |

The script/metadata "continuity" fields reach the model through
`SceneMediaGenerationSourceContext` (`sceneMedia/generationContext.ts`), which
instructs the model to preserve unrelated traits and only apply the requested
change.

## Per-inference detail

### 🖼️ Change image — `generateSceneMediaImagePreview` → `generateSceneMediaImage`

The most isolated flow. Inputs: the change prompt (required), the previous image
as an image-to-image reference (the last pending preview when iterating,
otherwise the live image), plus format, level, and script-type preference (which
tweaks the image prompt). It does **not** see the script or the metadata, so
changes are purely visual. No source context is passed.

### 📝 Change script — `generateSceneMediaScriptDraft` → `generateSceneMediaScriptPackage`

The most contextualized flow. Inputs: the change prompt (required), the current
image (vision), the base script (live, or the last draft when iterating), and
the full descriptive metadata as continuity context, plus level, format, and
script-type preference. Generates the script text only; no audio.

### 🔊 Generate audio — `generateAndStoreSceneMediaAudio` → `generateSceneMediaAudio`

Not a language inference — deterministic TTS. It takes the approved script and
synthesizes one clip per turn. The only thing it considers beyond the text is
each speaker's gender (dialogue) or the monologue/narration gender, used to pick
a stable voice. Nothing else (no image, prompt, or metadata).

### 🏷️ Regenerate description — `generateSceneMediaMetadataDraft` → `generateSceneMediaMetadataPackage`

Inputs: the current image (vision), the current script, the current descriptive
metadata (continuity), plus optional guidance. With empty guidance the effective
prompt falls back to the media's `generationPrompt`, then `createdFrom.prompt`,
then the title. Regenerates the whole descriptive bundle (title, setting, visual
summary, tags, skills, use cases) to resync it with the current scene.

## Dependency direction

```
prompt / level / format ─▶ IMAGE ─┬─▶ SCRIPT ──▶ AUDIO
                                  └─▶ DESCRIPTION (metadata)
```

- The image depends only on itself (as an img2img reference) plus the prompt.
- The script and the description depend on the image.
- The audio depends only on the script.

Implication: the descriptive metadata is derived, so it goes stale after an
image or script edit; the "Regenerate description" flow is the resync tool.
Changing a script regenerates its audio on approval. The old creation
`generationPrompt` is no longer shown in the editor (it froze at creation and
drifted stale); the column is retained only as the metadata-resync fallback.
