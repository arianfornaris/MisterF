# Scene Media Metadata — V3 Additions (handoff)

Status: design/data layer. Audio regeneration for the affected scripts is **pending a valid
OpenRouter key** (see "Open items"). This note is the handoff for the code work that adapts the
runtime, tutor, and UI to the new fields.

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

- `identityStrategy: "named_in_dialogue" | "role_only" | "narrator_intro"`
  - `named_in_dialogue` — every named speaker is named aloud; refer to speakers by name.
  - `role_only` — speakers are roles, no proper name is spoken; refer to them by role only, never
    invent a name. Their `speakers[].name` is the role text (e.g. `"the store clerk"`).
  - `narrator_intro` — a narrator names the characters; use the names the narrator speaks.

### Speaker level (`speakers[]`)

- `nameSpokenInAudio: boolean` — whether this speaker's name is actually spoken. A question or
  tutor turn may use the name **only when true**; otherwise use the role.

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
  script has no `segments` (narration/monologue single-turn audio does not carry them yet).

## Current coverage

- Applied to the **27 dialogue scripts** (the batch-1 hand-authored scenes) via
  `design/scene-scripts/apply_script_rewrites.py`: text rewrite + `identityStrategy` +
  `nameSpokenInAudio` + regenerated audio with `segments`.
- **Narrations (123)** do not yet carry `identityStrategy`/`nameSpokenInAudio`. Their characters
  are named inside the narrated text (or are generic "a man/woman"), so they are lower risk, but a
  follow-up pass should tag them for consistency (single-turn audio also does not carry `segments`).

## Open items

- **Audio regeneration is blocked:** the local `misterf-web/.env.{development,production}`
  OpenRouter key returns `401 "User not found"` (rotated/invalid). Once a valid key is available,
  run `OPENROUTER_API_KEY=… python3 design/scene-scripts/apply_script_rewrites.py` to write the
  transcript/metadata changes and regenerate the 27 audios with segments. Until then,
  `scene-scripts.json` is intentionally left unchanged so transcripts never drift from audio (P6).
- Decide whether narrations get the identity fields in the same pass.
