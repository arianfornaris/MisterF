# Scene Script Asset Planning

This folder stores curated text-and-audio scripts attached to approved Mister F scene images.

The goal is to turn each reusable image into a listening-ready learning asset without mixing script metadata into the visual image registry.

## Asset Layers

- `../scene-images/scene-images.json` remains the visual registry.
- `scene-scripts.json` stores learner-facing scripts, levels, speaker metadata, transcript turns, audio paths, and generation metadata.
- `audio/` stores generated listening audio grouped by CEFR range.

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

## Audio Packaging & Segmentation

**Decision: ship one audio file per script, plus per-turn timing marks. Do not ship one file per turn.**

Each script's canonical listening asset is a single concatenated MP3. A dialogue is still *synthesized* turn by turn (each turn with its speaker's voice, `SILENCE_SECONDS` between turns), but those turns are joined into one file for delivery and playback.

Rationale:

- A single file preserves natural flow across the passage, needs one request and one storage key, and caches well. One file per turn would explode into hundreds of tiny objects (≈150 scripts × several turns each) with worse caching and audible seams on playback.
- Per-turn timing marks recover everything separate files would give — without those downsides. With start/end offsets the client can replay a single line (`seek(startMs)` … stop at `endMs`), highlight the transcript in sync, drive shadowing/repeat-after-me, and let the tutor point at and replay one turn (which pairs with the P1 identity work below).
- The marks are nearly free to produce. `generate_audio` already holds each turn's PCM in order before concatenation; per-turn offsets come from summing PCM lengths (`bytes / (sampleRate * channels * bytesPerSample)`). Today those boundaries are discarded — persist them.

Persist the marks on the `audio` object. Mark the **spoken** region only, so single-line replay does not drag the trailing pause; the inter-turn silence is implied by the gap between one turn's `endMs` and the next turn's `startMs`:

```json
"audio": {
  "file": "audio/a1-a2/lost-wallet-cafe-01-a1-a2.mp3",
  "durationSeconds": 12.4,
  "interTurnSilenceMs": 380,
  "segments": [
    { "turn": 1, "speakerId": "maria",    "startMs": 0,    "endMs": 2100 },
    { "turn": 2, "speakerId": "mr_james", "startMs": 2480, "endMs": 5300 }
  ]
}
```

**Roleplay exception:** the single-file-plus-marks asset is canonical for *listening/comprehension* (fixed passages). Roleplay (Roadmap V3, feature 1.3) is different: the learner takes one character, so only the other character's turns play, often generated at runtime — that flow wants turn-level audio. Since the pipeline already synthesizes each turn separately, retain those per-turn PCM/segments as a cheap optional artifact for roleplay rather than making them the primary scene-script asset.

## Script & Audio Quality Requirements

These rules exist because a comprehension exercise will generate questions from the script, but the learner only experiences the **audio** (plus the still image). The governing principle:

> **Answerability rule:** Anything a question can ask about must be recoverable from what the learner actually perceives — the spoken audio and the image. If a fact lives only in metadata (a speaker's `name`, `role`, or the image description) and is never spoken, no question may depend on it.

Every script must satisfy the checks below before its audio is approved.

### P1 — Character identity is established in the audio

This is the highest-priority requirement. Speaker `name` and `role` are authoring metadata; they are **not** spoken by the turn-by-turn TTS. Distinct voices tell the learner *that* the speaker changed, not *who* each speaker is. So:

- **Every named character in a dialogue must be named aloud in the audio.** Weave the name into natural speech in the first one or two turns — a greeting or direct address (`"Hi, Maria!"`, `"Thanks, Mr. James."`, `"Can you help me, Leo?"`). If a name is never spoken, the character must not carry a name in metadata that a question could reference — downgrade it to a role (`"the customer"`, `"the clerk"`).
- **Narration** may name characters directly (third person) or use a stable role (`"a young man"`). Either is fine as long as the reference the questions will use is present in the audio.
- **Keep the cast small and trackable by ear:** two speakers for A1-A2, at most three for higher levels. Learners cannot follow more voices reliably without names.
- **One voice per character, consistent for the whole script**, and clearly distinguishable voices between characters (and, where relevant, a voice that fits the character). This is what lets a learner separate speakers without labels.
- **Record identity coverage in metadata** so the tutor knows who it may name. Add a per-speaker `nameSpokenInAudio: true|false` flag (or a script-level `identityStrategy: "named_in_dialogue" | "narrator_intro" | "role_only"`). The comprehension/tutor layer must reference role-only speakers by role, never by name.

> **Current state:** 24 of 27 dialogue scripts name their speakers in metadata but never speak those names in the audio. These must be fixed (add in-dialogue naming) or reclassified to role-only before comprehension questions are generated from them.

### P2 — Grounding and answerability

- Every concrete fact a question could target — who, what, where, when, why, how — must be **spoken**, not merely implied by metadata or visible only in the image description text.
- The script must not contradict its scene image. Spoken details should be consistent with, and ideally reinforced by, what the learner sees.
- No meta or descriptive narration in the audio: never say `"this image shows"`, `"the learner can"`, `"the listener can"`, `"this wordless story"`. (Enforced by `validate_no_description_phrases`.)

### P3 — Self-contained narrative

- Each script stands alone as listening input with a clear arc: setup, complication, action, resolution.
- Enough concrete detail to support a variety of questions: literal recall, sequence/order, cause and reaction, and level-appropriate inference and vocabulary-in-context.
- The content actually exercises the declared `teachingFocus`.

### P4 — Level-appropriate for listening

- Follow `script-levels.md` for length, grammar, and vocabulary bands.
- Remember that **listening load is higher than reading load**: prefer shorter sentences and cleaner clause structure than a reading text at the same CEFR band. Turns should be parseable in a single pass by ear.
- Keep language internationally reusable: avoid slang and region-specific idioms that reduce reuse.

### P5 — Audio production quality

- Clear pronunciation, consistent loudness across concatenated turns, no clipping, natural pacing for the level.
- Predictable, sufficient pauses between turns (currently 0.38s) so speaker changes are perceptible.
- TTS-safe text: names, numbers, and abbreviations must be pronounced correctly (verify items like `"Mr. James"`, times, and figures are read as intended; spell out where the model mishandles them).
- Audio must be regenerated whenever the transcript changes.

### P6 — Representation consistency

- `transcript`, `plainText`, and the generated audio must all correspond to the same content. `plainText` is derived from `transcript`; the audio is generated from `transcript`. Any drift means questions could reference text the learner never heard.

## Batch 1 Scope

Batch 1 covers the first ten approved scene images:

- five everyday problem-solution stories;
- five workplace situations.

Each scene receives one script at each level, for a total of 30 scripts and 30 generated audio files.

## Full Library Scope

The full scene script registry targets all 50 approved scene images. Each image receives three level variants:

- `A1-A2`
- `B1-B2`
- `C1`

This produces 150 scripts and 150 generated listening audio files. The first ten scenes use hand-authored mixed dialogue/narration scripts; the remaining scenes use structured narration generated from the approved visual metadata so every scene has a reusable listening layer.

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
