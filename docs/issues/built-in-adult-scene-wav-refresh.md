# Built-In Adult Scene WAV Refresh Handoff

Date: 2026-07-12

Status: **Ready for implementation.** The visual assets and English transcripts
are approved. Live TTS generation, listening QA, and runtime promotion remain.

Roadmap: [V4, Scene Media Library](../roadmap/roadmap-v4.md#13-scene-media-library)

## Objective

Regenerate the per-turn WAV clips for the three built-in scenes that were revised
from child/teen speaking casts to adult-only speaking casts:

- `shared-umbrella-bus-stop-01`
- `shared-lunch-classroom-01`
- `pancake-practice-kitchen-01`

The revision covers three CEFR variants per scene, for **9 scripts and 45 WAV
clips**. Do not rewrite the approved transcripts or change the revised images as
part of this task.

## Current State

The source of truth is
[`design/scene-scripts/scene-scripts.json`](../../design/scene-scripts/scene-scripts.json).

- All 9 affected scripts have `status: "pending_audio"`.
- None of the 9 affected entries has an `audio` object.
- The registry summary reports 141 audio-ready scripts and 9 pending scripts.
- The previous WAV files remain under `design/scene-scripts/audio/`, but they
  correspond to the old child/teen transcripts and must not be reused.
- No affected media item should be promoted to runtime until its new transcript
  and audio clips are aligned.
- The focused visual/script review is
  [`design/scene-scripts/child-voice-review.html`](../../design/scene-scripts/child-voice-review.html).

The approved provider contract is:

- provider: `openrouter`
- model: `google/gemini-3.1-flash-tts-preview`
- format: `wav`
- voice strategy: `per_turn_clips`
- PCM/WAV format: 24 kHz, mono, 16-bit

## Target Scripts And Voices

| Scene | Script id | Level | Speakers and voices | Expected clips |
| --- | --- | --- | --- | ---: |
| Shared umbrella | `shared-umbrella-bus-stop-01-a1-a2` | A1-A2 | Leo — Puck; Ms. Clark — Kore | 5 |
| Shared umbrella | `shared-umbrella-bus-stop-01-b1-b2` | B1-B2 | Leo — Puck; Ms. Clark — Kore | 5 |
| Shared umbrella | `shared-umbrella-bus-stop-01-c1` | C1 | Leo — Puck; Ms. Clark — Kore | 5 |
| Adult education lunch | `shared-lunch-classroom-01-a1-a2` | A1-A2 | Mina — Kore; Sam — Puck | 5 |
| Adult education lunch | `shared-lunch-classroom-01-b1-b2` | B1-B2 | Mina — Kore; Sam — Puck | 5 |
| Adult education lunch | `shared-lunch-classroom-01-c1` | C1 | Mina — Kore; Sam — Puck | 5 |
| Pancake practice | `pancake-practice-kitchen-01-a1-a2` | A1-A2 | Grandma Rosa — Kore; Leo — Puck | 5 |
| Pancake practice | `pancake-practice-kitchen-01-b1-b2` | B1-B2 | Grandma Rosa — Kore; Leo — Puck | 5 |
| Pancake practice | `pancake-practice-kitchen-01-c1` | C1 | Grandma Rosa — Kore; Leo — Puck | 5 |

Expected output directories:

```text
design/scene-scripts/audio/a1-a2/<script-id>/turn-01.wav ... turn-05.wav
design/scene-scripts/audio/b1-b2/<script-id>/turn-01.wav ... turn-05.wav
design/scene-scripts/audio/c1/<script-id>/turn-01.wav ... turn-05.wav
```

## Required Generator Correction

Before making live TTS calls, update
[`design/scene-scripts/generate_clip_audio.py`](../../design/scene-scripts/generate_clip_audio.py)
so the pending-audio workflow is completed atomically after successful synthesis:

1. Set each successfully regenerated entry to `status: "generated"` only after
   every turn has produced a valid clip and its `audio` object has been attached.
2. Recompute `batchSummary.audioGenerated`, `audioReadyCount`, and
   `audioPendingCount` before writing the registry.
3. Preserve `pending_audio` and omit partial `audio` metadata if any turn fails.

After all nine scripts succeed, the expected summary is:

```json
{
  "audioGenerated": true,
  "audioReadyCount": 150,
  "audioPendingCount": 0
}
```

This correction should be verified without real inference where practical. Do
not add tests that call OpenRouter.

## Execution Procedure

Run all commands from the repository root.

### 1. Confirm the pending set

```bash
jq -r '.scripts[] | select(.status == "pending_audio") | .id' \
  design/scene-scripts/scene-scripts.json
```

The output must contain exactly the 9 ids listed above.

### 2. Preview the generation scope

```bash
python3 design/scene-scripts/generate_clip_audio.py \
  --scene-id shared-umbrella-bus-stop-01 \
  --scene-id shared-lunch-classroom-01 \
  --scene-id pancake-practice-kitchen-01 \
  --dry-run
```

Expected result: 9 scripts and 45 clips.

### 3. Regenerate every affected clip

This step makes 45 live OpenRouter TTS calls. `OPENROUTER_API_KEY` must be set
in the environment or available through the local Mister F environment files
loaded by `generate_batch_01.py`.

```bash
python3 design/scene-scripts/generate_clip_audio.py \
  --scene-id shared-umbrella-bus-stop-01 \
  --scene-id shared-lunch-classroom-01 \
  --scene-id pancake-practice-kitchen-01 \
  --force
```

**`--force` is mandatory.** Without it, the generator will reuse the old files
that still exist at the target paths and attach stale child/teen audio to the new
adult transcripts.

Do not run `apply_adult_scene_revisions.py` after successful synthesis; that
script intentionally detaches audio and returns these entries to
`pending_audio`.

### 4. Regenerate review and runtime artifacts

```bash
python3 design/scene-scripts/build_review_index.py
cd misterf-web
pnpm run build:scene-media
```

`build:scene-media` should return the runtime catalog to 150 built-in media
items and copy the regenerated clips into `misterf-web/public/scene-media/audio/`.

## Automated Validation

Verify the registry contract:

```bash
jq '[.scripts[] | select(
  .sceneImageId == "shared-umbrella-bus-stop-01" or
  .sceneImageId == "shared-lunch-classroom-01" or
  .sceneImageId == "pancake-practice-kitchen-01"
)] | {
  scripts: length,
  generated: map(select(.status == "generated")) | length,
  withAudio: map(select(has("audio"))) | length,
  clips: map(.audio.clips | length) | add
}' design/scene-scripts/scene-scripts.json
```

Expected output:

```json
{
  "scripts": 9,
  "generated": 9,
  "withAudio": 9,
  "clips": 45
}
```

Also verify:

- every clip path exists;
- every file begins with a valid RIFF/WAVE header;
- every clip is 24 kHz, mono, and 16-bit;
- clip `turn` values match transcript turns 1 through 5;
- clip `speakerId` values match the transcript and speaker metadata;
- each `bytes` value matches the file on disk;
- no affected transcript or speaker role refers to a child or teenager;
- no unrelated WAV file changed.

Run the complete project verification after rebuilding runtime assets:

```bash
cd misterf-web
pnpm run typecheck
pnpm run test:typecheck
pnpm test
```

## Listening QA

Listen to at least one clip for every speaker in every scene. Because the same
speaker can have different phrasing by level, also listen to all five turns of
at least one level per scene.

Reject and regenerate a clip if it contains:

- clipped beginnings or endings;
- skipped, added, or mispronounced words that change meaning;
- a voice inconsistent with the assigned adult character;
- unexplained noise, long silence, or unstable volume;
- pacing that makes the CEFR-level script difficult to follow;
- a different speaker identity from adjacent turns.

Confirm that names are audible where the transcript establishes identity and
that all six speaking roles sound adult. Gemini does not provide child voices;
do not try to recreate the former child/teen delivery through style prompting.

## Completion Checklist

- [ ] Generator correctly promotes successful pending entries and updates the batch summary.
- [ ] Dry run reports 9 scripts and 45 clips.
- [ ] All 45 WAV files were regenerated with `--force`.
- [ ] All 9 registry entries are `generated` and have valid `audio.clips` metadata.
- [ ] Batch summary is 150 ready / 0 pending.
- [ ] Focused listening QA passed for every adult speaker and scene.
- [ ] Full review index was regenerated.
- [ ] Runtime built-in media was rebuilt and contains 150 items.
- [ ] Typecheck, test typecheck, and tests pass.
- [ ] No unrelated audio or source artifacts changed.
