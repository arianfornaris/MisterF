---
name: generate-scene-assets
description: Use when generating or regenerating scene-media assets (images, scripts, or per-turn TTS audio) under design/scene-scripts/ with the standalone Python generators. Covers the local, gitignored .assts-gen-key OpenRouter key that decouples design/ asset generation from the misterf-web app env, how get_api_key() resolves the key, and the safe regeneration/verification flow.
---

# Generate Scene Assets

The `design/scene-scripts/` generators build the built-in scene-media library
(images, leveled scripts, and Gemini TTS audio) as standalone Python scripts —
they run outside the `misterf-web` app and do **not** boot it. They call
OpenRouter directly, so they need an OpenRouter key.

## The Key: `.assts-gen-key`

Asset generation uses a dedicated, **local-only** key so it stays decoupled from
the app's runtime env.

- File: `design/scene-scripts/.assts-gen-key` (raw key on one line, or an
  `OPENROUTER_API_KEY=...` assignment).
- It is **gitignored** (`.assts-gen-key` in the root `.gitignore`) and must
  never be committed. Confirm with `git check-ignore design/scene-scripts/.assts-gen-key`.
- It is a secret. Do not print it, paste it into logs, or move it into a tracked
  file. If it leaks, rotate it in the OpenRouter dashboard and replace the file.

### How the key resolves

`get_api_key()` in `generate_batch_01.py` (imported by the other generators)
resolves the key in this order:

1. `read_assets_gen_key()` → `design/scene-scripts/.assts-gen-key` (preferred).
2. `OPENROUTER_API_KEY` already in the environment.
3. `misterf-web/.env.development`, then `.env.production` (legacy app fallback).

So the local file wins whenever it exists. To force the env/app path for a run,
rename or remove the file; otherwise just keep it in place and the generators
pick it up automatically.

## The Generators

All live in `design/scene-scripts/` and share `generate_batch_01.py`'s helpers
(`get_api_key`, `synthesize_turn`, env loading). Run them from that directory.

- `generate_clip_audio.py` — (re)synthesize audio as **per-turn WAV clips**
  (24 kHz, mono, 16-bit; Gemini returns PCM, wrapped with the stdlib `wave`
  module — no ffmpeg). This is the current audio pipeline.
- `regenerate_scene_audio.py` — re-synthesize audio in place; **never** rewrites
  transcript text.
- `generate_all_scene_scripts.py` / `generate_batch_01.py` — generate scripts
  **and** audio for the image library.
- `build_review_index.py` — rebuild the standalone review page `index.html`
  from `scene-images.json` + `scene-scripts.json` (no key, no network).

Source of truth is `design/scene-scripts/scene-scripts.json`; the visual
registry is `design/scene-images/scene-images.json`.

## Safe Regeneration Flow

1. **Dry run first** to confirm scope (no network):
   ```bash
   python3 design/scene-scripts/generate_clip_audio.py --scene-id <id> --dry-run
   ```
2. **Generate.** Live TTS calls cost credits. Use `--scene-id` to scope and
   `--force` to overwrite existing clips (without `--force`, existing files at
   the target path are reused — stale audio can attach to a revised transcript):
   ```bash
   python3 design/scene-scripts/generate_clip_audio.py --scene-id <id> --force
   ```
3. **Rebuild derived artifacts:**
   ```bash
   python3 design/scene-scripts/build_review_index.py
   cd misterf-web && pnpm run build:scene-media
   ```
4. **Verify** the registry contract and files (see the handoff
   `docs/issues/built-in-adult-scene-wav-refresh.md` for the exact jq checks and
   listening-QA criteria).

## Cautions

- These scripts spend real OpenRouter credits — always `--dry-run` before a
  full generation, and scope with `--scene-id`.
- Do not add tests that call OpenRouter; verify generator logic offline.
- Keep `.assts-gen-key` out of git and out of any output you show the user.
