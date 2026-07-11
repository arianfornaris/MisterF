# Scene Media Metadata — V3 Additions (handoff)

Status: data layer applied. The 27 dialogue scripts have been rewritten, tagged with the new
metadata, and their audio regenerated with per-turn segments in `scene-scripts.json`. This note is
the handoff for the code work that adapts the runtime, tutor, and UI to the new fields.

## Why

A comprehension/practice session exposes the learner to the **audio** (plus the still image),
not the script text or its metadata. So the tutor and UI must only rely on what the learner can
actually perceive. Two new pieces of metadata make that safe:

1. **Speaker identity** — dialogue audio never spoke the character names (only distinct voices).
   A question like "What did Maria order?" was unanswerable by ear. Fixed by naming characters in
   the audio and recording who is nameable.
2. **Per-turn audio timing** — the audio is one concatenated file; timing marks let the UI replay
   a single line, sync a transcript highlight, or let the tutor point at one turn.

Full rules: `design/scene-scripts/README.md` (Script & Audio Quality Requirements, Identity &
Audio Metadata). Runtime types: `docs/features/scene-media-library.md`.

## New fields

### Script level

- `identityStrategy: "named_in_dialogue" | "named_in_narration" | "role_only"` — present on
  **every** script.
  - `named_in_dialogue` — dialogue; speakers name each other aloud. Use names.
  - `named_in_narration` — narration/monologue whose text names its character(s). Use the name from
    the transcript.
  - `role_only` — no proper name is spoken; the people are roles or a collective subject. Refer by
    role/generic only ("the father", "the store clerk", "the neighbors"); never invent a name. For
    role_only *dialogue*, `speakers[].name` is itself the role text (e.g. `"the store clerk"`).

### Speaker level (`speakers[]`)

- `nameSpokenInAudio: boolean` — present on **every** speaker; whether this speaker's name is
  actually spoken. A question or tutor turn may use a speaker's name **only when true**.
- **Narration caveat:** the narrator is a voice, not a character, so its `nameSpokenInAudio` is
  always `false`. Do **not** use it to decide whether the story's protagonist is nameable — read the
  script's `identityStrategy` instead. The character name, when nameable, comes from the transcript
  text (a narration has no character in `speakers[]`).

### Audio object (`audio`)

- `segments: Array<{ turn, speakerId, startMs, endMs }>` — per-turn marks into the single MP3.
  `startMs`/`endMs` bound the **spoken** region of each turn; the inter-turn pause is the gap
  between one turn's `endMs` and the next turn's `startMs`.
- `interTurnSilenceMs: number` — the pause inserted between turns (currently 380).
- (Runtime flattens `speakerId` to `speaker` = display name to match `turns[].speaker`.)

## What the code work must do

- **Tutor / question generation:** pass the identity contract into the prompt. Reference a speaker
  by name only if `nameSpokenInAudio` is true; for `role_only` scripts use the role. Never surface
  a name that was not spoken.
- **Runtime registry / resolver:** carry `identityStrategy`, per-speaker `nameSpokenInAudio`, and
  `audio.segments` + `interTurnSilenceMs` through to resolved render payloads. These are
  product-safe fields (already listed in `scene-media-library.md`).
- **Player UI:** use `segments` for single-line replay (`seek(startMs)` … stop at `endMs`),
  optional transcript-highlight sync, and shadowing/repeat-after-me. Fall back gracefully when a
  script has no `segments` (single-turn narration/monologue audio omits them by design).

## Current coverage

**All 150 scripts now carry `identityStrategy`, and every speaker carries `nameSpokenInAudio`** —
the interface is uniform; consumers never special-case by `scriptType`.

- **27 dialogues** via `apply_script_rewrites.py`: text rewrite + `identityStrategy` +
  `nameSpokenInAudio` + regenerated audio with `segments` (24 `named_in_dialogue`, 3 `role_only`).
- **123 narrations** via `apply_narration_identity.py` (metadata only, no audio change):
  115 `named_in_narration`, 8 `role_only` (collective/generic subjects). Narrations are single-turn,
  so they carry no `segments` — `segments` is optional and only present on multi-turn dialogue audio.

Distribution: `named_in_dialogue` 24, `named_in_narration` 115, `role_only` 11.

## Open items

- New scripts should set `identityStrategy` at authoring/generation time. The narration backfill
  used a curated person-name allowlist (`apply_narration_identity.py`) that will not recognize
  new names, so it is a one-time pass, not an ongoing classifier.
- Note for re-runs: the local `misterf-web/.env.{development,production}` OpenRouter key returned
  `401 "User not found"`; the working key was supplied out-of-band. Re-running
  `apply_script_rewrites.py` (audio) needs a valid `OPENROUTER_API_KEY` in the environment.
