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

Gemini TTS is the default for approved listening assets because previous local tests found it clearer and more natural than the cheaper Kokoro baseline. Audio is generated one clip per spoken turn, each turn synthesized with its speaker's own voice.

## Audio Packaging

**Decision: ship one WAV clip per spoken turn, in playback order. Do not concatenate turns into a single file.**

Each turn is synthesized as PCM and stored as its own WAV clip. (Gemini TTS via OpenRouter returns PCM only — a direct `mp3` request is rejected — so each turn's PCM is wrapped in a WAV header in code, with no encoding step.) A narration/monologue is a single clip; a dialogue is one clip per turn. The client plays the clips back to back through one sequencer, and the small gap between clips reads as the natural pause between speakers.

This reverses the earlier "single concatenated file + per-turn timing marks (`segments`)" decision. Why per-turn clips win:

- **No server-side audio processing.** A WAV clip is just the returned PCM plus a ~44-byte header written in code — nothing is decoded, stitched, or re-encoded. Runtime generation (a user creating audio in the app) needs no `ffmpeg`, no encoding queue, and no separate worker droplet — the deciding factor. Concatenating turns *server-side* into one compressed file would require exactly that infrastructure.
- **Distinct voices are guaranteed.** Each turn is a separate single-voice call, so speakers never collapse to a shared timbre (the failure mode of native multi-speaker TTS).
- **Single-line replay is trivial.** Replaying turn *N* is playing `clips[N].src` — no seeking, no timing marks to compute or keep in sync with the audio.
- **One playback path everywhere.** Built-in listening, runtime-generated audio, and roleplay (feature 1.3, which already wanted turn-level audio) all consume the same clip list.

Trade-off accepted: more objects (≈150 scripts × several turns), and WAV is uncompressed (24 kHz / 16-bit mono ≈ 48 KB/s), so the library is larger on disk than the old MP3s. This is fine for a single format with zero encoding on any path; clips are static and cache well, and the client preloads them before playback.

> **Storage note (interim):** while the built-in generation approach is still being worked out, the generated WAV clips are committed to the repo alongside `scene-scripts.json` for convenience. This is deliberately temporary — the full library is on the order of ~130 MB and does not belong in version control long-term. Once there is a stable protocol for generating built-in media, these assets should move to DigitalOcean Spaces (object storage) and be referenced from there rather than versioned in the repo, matching how user-generated media is stored (see `docs/features/scene-media-library.md`, "Storage").

Durations are **not** stored on the `audio` object. Playback does not need them (the client reads a clip's duration on load if it ever needs one), and computing them offline would only re-introduce an `ffprobe`/`ffmpeg` dependency for no product gain.

```json
"audio": {
  "provider": "openrouter",
  "model": "google/gemini-3.1-flash-tts-preview",
  "format": "wav",
  "voiceStrategy": "per_turn_clips",
  "generatedAt": "2026-07-11",
  "clips": [
    { "turn": 1, "speakerId": "maria",    "file": "audio/a1-a2/lost-wallet-cafe-01-a1-a2/turn-01.wav", "bytes": 186284 },
    { "turn": 2, "speakerId": "mr_james", "file": "audio/a1-a2/lost-wallet-cafe-01-a1-a2/turn-02.wav", "bytes": 149804 }
  ]
}
```

Generated by `generate_clip_audio.py`, which reads `scene-scripts.json`, synthesizes each transcript turn (PCM), wraps it as `audio/<level>/<scriptId>/turn-NN.wav`, and rewrites each `audio` object to the `clips` shape above.

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

> **Status:** Fixed. All 27 dialogue scripts previously named their speakers in metadata but never spoke those names. They were rewritten (24 named in-dialogue, 3 reclassified to `role_only`) and their audio regenerated via `apply_script_rewrites.py`. Each now carries `identityStrategy` and per-speaker `nameSpokenInAudio`.

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

### P7 — Visual character and voice audit

Schema validation cannot establish whether a speaker actually matches the person
shown in an image. Before approving dialogue audio, inspect the image and compare
each visible participant against the scene metadata, speaker id, display name,
role, transcript turns, and assigned TTS voice.

- Treat names, family relationships, ages, and gender presentation as one identity
  contract. Do not validate any one of those fields in isolation.
- Trace each transcript turn back to the visible character who performs that role.
  This catches cases where two valid speaker definitions were assigned to the
  opposite people.
- Listen to at least one generated turn per speaker. A voice label alone does not
  prove how the current provider/model renders that voice.
- Record visible identity facts explicitly in `scene-images.json` when they are
  needed to make future audits reproducible, but do not turn uncertain visual
  presentation into a stronger factual claim.
- After changing a speaker id, name, role, transcript reference, or voice, regenerate
  every affected level with per-turn WAV clips, rebuild the review index, and rebuild
  the runtime registry. JSON/schema validation alone is not sufficient.

The July 2026 full-library audit found four concrete mismatches. The corrected
MP3 assets remain available in the audit branch history, but they must not replace
the current per-turn WAV package. Apply the approved metadata changes and regenerate
the affected WAV clips together during a future audio refresh.

| Scene | Finding | Approved correction for the next audio refresh |
| --- | --- | --- |
| `late-meeting-workplace-01` | The late worker shown is a man, but the scripts used Emma with the Kore voice. | Use Diego with the Charon voice. |
| `pancake-practice-kitchen-01` | The grandmother is teaching her teenage grandson, but the helper and learner identities were reversed. | Use Grandma Rosa/Kore as the helper and Leo/Puck as the learner. |
| `torn-grocery-bag-01` | The store clerk shown is a man, but the clerk turns used the Kore voice. | Keep the role-only clerk identity and use the Charon voice. |
| `airport-security-line-01` | The original dialogue described the mother's child as her son but assigned a female-presenting voice. | The current script is narration, so there is no child voice to correct; preserve the explicit `family_child` image metadata if dialogue is authored again. |

Do not apply the metadata changes without regenerating the corresponding audio;
that would make the registry disagree with what learners hear. When an audio refresh
is explicitly authorized, apply the audit and then repeat `--scene-id` as needed
instead of regenerating the full library:

```bash
python3 design/scene-scripts/apply_visual_identity_audit.py
OPENROUTER_API_KEY=... python3 design/scene-scripts/generate_clip_audio.py \
  --scene-id late-meeting-workplace-01 \
  --scene-id pancake-practice-kitchen-01 \
  --scene-id torn-grocery-bag-01 \
  --force
```

## Identity & Audio Metadata (schema)

These fields are the contract the comprehension/tutor layer and the UI consume. They are added by `apply_script_rewrites.py` when a rewrite is approved. **This is the source of truth for the code-agent handoff.**

**Script entry — `identityStrategy`** (string enum, present on **every** script):

| Value | Applies to | Meaning | How the tutor/UI must refer to the people |
| --- | --- | --- | --- |
| `named_in_dialogue` | dialogue | Speakers name each other aloud. | By name (e.g. "Maria", "Mr. James"). |
| `named_in_narration` | narration/monologue | The narration names its character(s) with a proper name. | By the name spoken in the text. |
| `role_only` | either | No proper name is spoken; the people are roles or a collective subject. | By role/generic only (e.g. "the father", "the store clerk", "the neighbors"). Never invent a name. |

**Speaker — `speakers[].nameSpokenInAudio`** (boolean, present on **every** speaker): whether *this speaker's* name is actually spoken in the audio.

- Dialogue: `true` for named speakers, `false` for `role_only` speakers. A question may use a speaker's name only when this is `true`. For `role_only` dialogue the speaker's `name`/`role` are also rewritten to the spoken role (e.g. `name: "the store clerk"`, `role: "store_staff"`).
- Narration/monologue narrator: always `false` — **the narrator is a voice, not a character.** Whether the *story's* character is nameable is carried by `identityStrategy` (`named_in_narration` vs `role_only`), not by the narrator's flag. Do not read the narrator's `nameSpokenInAudio` to decide whether to name the protagonist; read `identityStrategy` and take the name from the transcript text.

**Audio — `audio.clips`** (array): one WAV clip per spoken turn, in playback order (see "Audio Packaging"). Each clip is `{ turn, speakerId, file, bytes }`. A narration/monologue has a single clip; a dialogue has one clip per turn. The client plays them back to back; single-line replay, transcript-highlight sync, shadowing, and tutor "replay line N" all key off the individual clip rather than an offset into a larger file. No durations or timing marks are stored.

The runtime-facing shape of these fields lives in `docs/features/scene-media-library.md`; a consumer-oriented summary for the UI/tutor work lives in `docs/features/scene-media-metadata-v3.md`.

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
