#!/usr/bin/env python3
"""Regenerate scene-script audio as per-turn WAV clips.

This replaces the old single-concatenated-file pipeline (turn-by-turn synthesis
joined with `ffmpeg`) with one WAV clip per spoken turn. Gemini TTS via
OpenRouter only returns PCM (`response_format="pcm"`; it rejects `"mp3"`), so
each turn's PCM is wrapped in a WAV header with the stdlib `wave` module — pure
code, no `ffmpeg`/`ffprobe` dependency and no stored durations. The same
zero-encoding approach is what the runtime user-generation path uses. See
design/scene-scripts/README.md ("Audio Packaging") and
docs/features/scene-media-library.md (`SceneMediaLevel.audio.clips`).

For each script in scene-scripts.json it:
  - synthesizes every transcript turn (PCM) using that speaker's voice;
  - writes audio/<level>/<scriptId>/turn-NN.wav;
  - rewrites the entry's `audio` object to the `clips` shape;
  - deletes the obsolete single-file audio/<level>/<scriptId>.mp3 if present.

A narration/monologue has a single turn -> a single clip. A dialogue has one
clip per turn. The interface is uniform: consumers always read `audio.clips`.

Usage:
  OPENROUTER_API_KEY=... python3 design/scene-scripts/generate_clip_audio.py --dry-run
  OPENROUTER_API_KEY=... python3 design/scene-scripts/generate_clip_audio.py --limit 1
  OPENROUTER_API_KEY=... python3 design/scene-scripts/generate_clip_audio.py
  OPENROUTER_API_KEY=... python3 design/scene-scripts/generate_clip_audio.py --force
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

import generate_batch_01 as g

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "scene-scripts.json"

# Keep audio last and identityStrategy next to scriptType for readable diffs.
ENTRY_ORDER = [
    "id", "sceneImageId", "sceneImageFile", "title", "status", "level",
    "cefrRange", "scriptType", "identityStrategy", "source", "teachingFocus",
    "speakers", "transcript", "plainText", "stats", "qaNotes", "audio",
]


def reorder_entry(entry: dict) -> dict:
    ordered = {k: entry[k] for k in ENTRY_ORDER if k in entry}
    # preserve any unexpected keys rather than dropping them
    for k, v in entry.items():
        if k not in ordered:
            ordered[k] = v
    return ordered


def clip_dir(entry: dict) -> Path:
    return g.AUDIO_ROOT / g.level_slug(entry["level"]) / entry["id"]


def regenerate_clips(entry: dict, api_key: str, force: bool) -> dict:
    voice_by_speaker = {sp["id"]: sp["voice"] for sp in entry["speakers"]}
    out_dir = clip_dir(entry)
    out_dir.mkdir(parents=True, exist_ok=True)

    clips = []
    for turn in entry["transcript"]:
        n = turn["turn"]
        speaker_id = turn["speakerId"]
        clip_path = out_dir / f"turn-{n:02d}.wav"
        if not (clip_path.exists() and not force):
            pcm = g.synthesize_turn(turn["text"], voice_by_speaker[speaker_id], api_key)
            g.write_wav(clip_path, [pcm])
        clips.append({
            "turn": n,
            "speakerId": speaker_id,
            "file": clip_path.relative_to(HERE).as_posix(),
            "bytes": clip_path.stat().st_size,
        })

    # Drop the obsolete single concatenated file, if it still exists.
    old_file = g.AUDIO_ROOT / g.level_slug(entry["level"]) / f"{entry['id']}.mp3"
    if old_file.exists():
        old_file.unlink()

    return {
        "provider": g.PROVIDER,
        "model": g.MODEL,
        "format": "wav",
        "voiceStrategy": "per_turn_clips",
        "generatedAt": date.today().isoformat(),
        "clips": clips,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="List what would be generated; no writes, no TTS.")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate clips that already exist on disk.")
    parser.add_argument("--limit", type=int, default=0,
                        help="Only process the first N scripts (0 = all).")
    args = parser.parse_args()

    registry = json.loads(REGISTRY.read_text())
    scripts = registry["scripts"]
    if args.limit:
        scripts = scripts[: args.limit]

    api_key = None if args.dry_run else g.get_api_key()
    total_clips = 0

    for i, entry in enumerate(scripts, start=1):
        turn_count = len(entry["transcript"])
        if args.dry_run:
            print(f"[{i}/{len(scripts)}] {entry['id']}  ({turn_count} clip(s))")
            total_clips += turn_count
            continue
        entry["audio"] = regenerate_clips(entry, api_key, args.force)
        idx = next(j for j, e in enumerate(registry["scripts"]) if e["id"] == entry["id"])
        registry["scripts"][idx] = reorder_entry(entry)
        total_clips += len(entry["audio"]["clips"])
        print(f"[{i}/{len(scripts)}] {entry['id']}  {len(entry['audio']['clips'])} clip(s)")

    if args.dry_run:
        print(f"\nDry run: {len(scripts)} scripts, {total_clips} clips would be generated.")
        return

    REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {REGISTRY.name}  |  {len(scripts)} scripts  |  {total_clips} clips")


if __name__ == "__main__":
    main()
