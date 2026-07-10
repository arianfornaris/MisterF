#!/usr/bin/env python3
"""Apply approved dialogue rewrites to scene-scripts.json and regenerate audio.

This is a surgical, in-place update: it only touches the script ids present in
proposed-script-rewrites.json (the 27 dialogue identity fixes). Every other
entry in the registry is left byte-for-byte unchanged. It deliberately does NOT
call generate_batch_01.py, which would overwrite the whole 150-entry registry
with only the 10 batch-1 scenes.

For each rewritten script it:
  - replaces the transcript turn text and recomputes plainText + stats;
  - applies the agreed identity metadata (see the "Identity & audio metadata"
    section in README.md): entry.identityStrategy and per-speaker
    nameSpokenInAudio, plus a role reclassification for role_only scripts;
  - regenerates the concatenated MP3 (turn-by-turn, same pipeline as batch 1)
    and records per-turn timing marks in audio.segments + audio.interTurnSilenceMs.

Usage:
  OPENROUTER_API_KEY=... python3 design/scene-scripts/apply_script_rewrites.py --dry-run
  OPENROUTER_API_KEY=... python3 design/scene-scripts/apply_script_rewrites.py
"""

from __future__ import annotations

import argparse
import json
import tempfile
from datetime import date
from pathlib import Path

import generate_batch_01 as g

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "scene-scripts.json"
REWRITES = HERE / "proposed-script-rewrites.json"

BYTES_PER_MS = g.SAMPLE_RATE * g.CHANNELS * g.SAMPLE_WIDTH_BYTES / 1000.0
INTER_TURN_SILENCE_MS = round(g.SILENCE_SECONDS * 1000)

# role_only scripts drop proper names in favor of stable roles the tutor can use.
ROLE_ONLY_REMAP = {
    "dad": {"name": "the father", "role": "parent"},
    "clerk": {"name": "the store clerk", "role": "store_staff"},
}


def reorder_speaker(sp: dict) -> dict:
    keys = ["id", "name", "role", "voice", "nameSpokenInAudio"]
    return {k: sp[k] for k in keys if k in sp}


def reorder_entry(entry: dict) -> dict:
    """Keep identityStrategy next to scriptType for readable diffs."""
    order = [
        "id", "sceneImageId", "sceneImageFile", "title", "status", "level",
        "cefrRange", "scriptType", "identityStrategy", "source", "teachingFocus",
        "speakers", "transcript", "plainText", "stats", "qaNotes", "audio",
    ]
    return {k: entry[k] for k in order if k in entry}


def regenerate_audio(entry: dict, turns: list[dict], api_key: str) -> dict:
    """Synthesize each turn, concatenate with silence, and record segments."""
    voice_by_speaker = {sp["id"]: sp["voice"] for sp in entry["speakers"]}
    silence = g.pcm_silence(g.SILENCE_SECONDS)

    turn_pcms = [
        g.synthesize_turn(t["text"], voice_by_speaker[t["speakerId"]], api_key)
        for t in turns
    ]

    chunks: list[bytes] = []
    segments = []
    offset_bytes = 0
    for i, (t, pcm) in enumerate(zip(turns, turn_pcms)):
        if i > 0:
            chunks.append(silence)
            offset_bytes += len(silence)
        start_ms = round(offset_bytes / BYTES_PER_MS)
        chunks.append(pcm)
        offset_bytes += len(pcm)
        end_ms = round(offset_bytes / BYTES_PER_MS)
        segments.append({
            "turn": t["turn"],
            "speakerId": t["speakerId"],
            "startMs": start_ms,
            "endMs": end_ms,
        })

    mp3_path = g.AUDIO_ROOT / g.level_slug(entry["level"]) / f"{entry['id']}.mp3"
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / f"{entry['id']}.wav"
        g.write_wav(wav_path, chunks)
        g.convert_wav_to_mp3(wav_path, mp3_path)

    duration = g.audio_duration(mp3_path)
    audio = dict(entry.get("audio", {}))
    audio.update({
        "provider": g.PROVIDER,
        "model": g.MODEL,
        "file": mp3_path.relative_to(HERE).as_posix(),
        "format": "mp3",
        "bitrateKbps": 64,
        "durationSeconds": duration,
        "bytes": mp3_path.stat().st_size,
        "generatedAt": date.today().isoformat(),
        "voiceStrategy": "turn_by_turn_concatenation",
        "interTurnSilenceMs": INTER_TURN_SILENCE_MS,
        "segments": segments,
        "estimatedCostUsd": round(duration * g.ESTIMATED_GEMINI_TTS_USD_PER_SECOND, 6),
        "costEstimationMethod": (
            "Estimated from prior Gemini TTS demo cost per second; "
            "OpenRouter usage receipts may lag."
        ),
    })
    return audio


def apply(dry_run: bool) -> None:
    registry = json.loads(REGISTRY.read_text())
    rewrites = json.loads(REWRITES.read_text())
    by_id = {e["id"]: e for e in registry["scripts"]}

    api_key = None if dry_run else g.get_api_key()
    total_cost = 0.0

    for i, (sid, rw) in enumerate(rewrites.items(), start=1):
        entry = by_id.get(sid)
        if entry is None:
            raise RuntimeError(f"Rewrite target not found in registry: {sid}")

        strategy = rw["identityStrategy"]
        turns = [
            {"turn": idx, "speakerId": t["speakerId"], "text": t["text"]}
            for idx, t in enumerate(rw["turns"], start=1)
        ]
        plain = "\n".join(t["text"] for t in turns)

        # transcript + derived fields
        entry["transcript"] = turns
        entry["plainText"] = plain
        entry["stats"] = {
            "characterCount": len(plain),
            "wordCount": len(plain.replace("\n", " ").split()),
            "turnCount": len(turns),
        }
        entry["identityStrategy"] = strategy

        # identity metadata on speakers
        named = strategy != "role_only"
        new_speakers = []
        for sp in entry["speakers"]:
            sp = dict(sp)
            if strategy == "role_only" and sp["id"] in ROLE_ONLY_REMAP:
                sp.update(ROLE_ONLY_REMAP[sp["id"]])
            sp["nameSpokenInAudio"] = named
            new_speakers.append(reorder_speaker(sp))
        entry["speakers"] = new_speakers

        # audio
        if dry_run:
            note = "(dry-run: audio not regenerated)"
        else:
            entry["audio"] = regenerate_audio(entry, turns, api_key)
            total_cost += entry["audio"]["estimatedCostUsd"]
            note = f'{entry["audio"]["durationSeconds"]}s, {len(entry["audio"]["segments"])} segments'

        by_id[sid] = reorder_entry(entry)
        print(f"[{i}/{len(rewrites)}] {sid}  strategy={strategy}  {note}")

    if dry_run:
        print("\nDry run complete. No files written, no audio generated.")
        return

    registry["scripts"] = [by_id.get(e["id"], e) for e in registry["scripts"]]
    REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {REGISTRY.name}  |  regenerated {len(rewrites)} audios  |  "
          f"est. cost ${total_cost:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Apply transforms in memory and print a summary; no writes, no TTS.")
    args = parser.parse_args()
    apply(args.dry_run)
