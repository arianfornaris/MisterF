#!/usr/bin/env python3
"""Regenerate Gemini TTS audio for scene scripts, in place.

Unlike `generate_all_scene_scripts.py` / `rewrite_scene_stories.py`, this script
NEVER rewrites transcript text. It only (re)synthesizes audio from the scripts
already stored in `scene-scripts.json`, using each speaker's assigned voice, and
then attaches the audio metadata and flips `status` to `generated`.

By default it targets every script with `status == "pending_audio"` (the v2
rewrite). It is resumable: re-running continues with whatever is still pending.

Usage:
  python3 design/scene-scripts/regenerate_scene_audio.py            # all pending
  python3 design/scene-scripts/regenerate_scene_audio.py --limit 1  # smoke test
  python3 design/scene-scripts/regenerate_scene_audio.py --only <script-id>
  python3 design/scene-scripts/regenerate_scene_audio.py --force    # also redo 'generated'
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_batch_01 import (  # noqa: E402  (reuse the proven TTS helpers)
    AUDIO_ROOT,
    ESTIMATED_GEMINI_TTS_USD_PER_SECOND,
    MODEL,
    PROVIDER,
    ROOT,
    SILENCE_SECONDS,
    audio_duration,
    convert_wav_to_mp3,
    get_api_key,
    level_slug,
    pcm_silence,
    synthesize_turn,
    write_wav,
)

REGISTRY = ROOT / "scene-scripts.json"
IMAGES = ROOT.parent / "scene-images" / "scene-images.json"


def synthesize_script(script: dict, api_key: str) -> dict:
    sid = script["id"]
    mp3_path = AUDIO_ROOT / level_slug(script["level"]) / f"{sid}.mp3"
    voice_by_speaker = {sp["id"]: sp["voice"] for sp in script["speakers"]}

    chunks: list[bytes] = []
    for index, turn in enumerate(script["transcript"]):
        if index > 0:
            chunks.append(pcm_silence(SILENCE_SECONDS))
        chunks.append(synthesize_turn(turn["text"], voice_by_speaker[turn["speakerId"]], api_key))

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = Path(tmpdir) / f"{sid}.wav"
        write_wav(wav_path, chunks)
        convert_wav_to_mp3(wav_path, mp3_path)

    duration = audio_duration(mp3_path)
    return {
        "provider": PROVIDER,
        "model": MODEL,
        "file": mp3_path.relative_to(ROOT).as_posix(),
        "format": "mp3",
        "bitrateKbps": 64,
        "durationSeconds": duration,
        "bytes": mp3_path.stat().st_size,
        "generatedAt": date.today().isoformat(),
        "voiceStrategy": "turn_by_turn_concatenation",
        "estimatedCostUsd": round(duration * ESTIMATED_GEMINI_TTS_USD_PER_SECOND, 6),
        "costEstimationMethod": "Estimated from prior Gemini TTS demo cost per second; OpenRouter usage receipts may lag.",
    }


def refresh_summary(data: dict) -> None:
    scripts = data["scripts"]
    with_audio = [s for s in scripts if isinstance(s.get("audio"), dict)]
    data["batchSummary"]["audioReadyCount"] = len(with_audio)
    data["batchSummary"]["audioPendingCount"] = len(scripts) - len(with_audio)
    data["batchSummary"]["audioReadyDurationSeconds"] = round(
        sum(s["audio"].get("durationSeconds", 0) for s in with_audio), 2
    )


def save(data: dict) -> None:
    refresh_summary(data)
    REGISTRY.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Only process the first N targets.")
    parser.add_argument("--only", action="append", default=[], help="Only this script id (repeatable).")
    parser.add_argument("--force", action="store_true", help="Also regenerate scripts already 'generated'.")
    args = parser.parse_args()

    data = json.loads(REGISTRY.read_text())
    scripts = data["scripts"]

    if args.only:
        targets = [s for s in scripts if s["id"] in set(args.only)]
    else:
        wanted = {"pending_audio", "generated"} if args.force else {"pending_audio"}
        targets = [s for s in scripts if s.get("status") in wanted]
    if args.limit:
        targets = targets[: args.limit]

    if not targets:
        print("Nothing to do.")
        return

    voices = Counter(sp["voice"] for s in targets for sp in s["speakers"])
    print(f"Targets: {len(targets)} scripts. Voices in play: {dict(voices)}", flush=True)

    api_key = get_api_key()
    done = 0
    for i, script in enumerate(targets, start=1):
        print(f"[{i}/{len(targets)}] {script['id']} ({len(script['transcript'])} turns)…", flush=True)
        audio = synthesize_script(script, api_key)
        script["audio"] = audio
        script["status"] = "generated"
        save(data)  # persist after each so progress is durable / resumable
        done += 1
        print(f"    ok · {audio['durationSeconds']}s · {audio['bytes']} bytes", flush=True)

    print(f"Done. Generated audio for {done} scripts.", flush=True)


if __name__ == "__main__":
    main()
