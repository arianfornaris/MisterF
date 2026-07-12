#!/usr/bin/env python3
"""Apply the approved July 2026 visual identity audit corrections.

This updates authored script metadata and transcript identity references only.
Run ``generate_clip_audio.py`` for the affected scene ids afterward so audio
matches the corrected speakers and voices.
"""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "scene-scripts.json"
REWRITES = HERE / "proposed-script-rewrites.json"

AUDIT_NOTE = "Visual character and voice audit passed (July 2026)."


def replace_identity(entry: dict, replacements: dict[str, dict]) -> None:
    for speaker in entry["speakers"]:
        replacement = replacements.get(speaker["id"])
        if replacement:
            speaker.update(replacement)

    id_replacements = {
        old_id: replacement["id"]
        for old_id, replacement in replacements.items()
        if replacement.get("id", old_id) != old_id
    }
    name_replacements = {
        replacement["replaceName"]: replacement["name"]
        for replacement in replacements.values()
        if "replaceName" in replacement
    }

    for speaker in entry["speakers"]:
        speaker.pop("replaceName", None)
    for turn in entry["transcript"]:
        turn["speakerId"] = id_replacements.get(turn["speakerId"], turn["speakerId"])
        for old_name, new_name in name_replacements.items():
            turn["text"] = turn["text"].replace(old_name, new_name)
    for clip in entry.get("audio", {}).get("clips", []):
        clip["speakerId"] = id_replacements.get(clip["speakerId"], clip["speakerId"])

    entry["plainText"] = "\n".join(turn["text"] for turn in entry["transcript"])
    entry["stats"] = {
        "characterCount": len(entry["plainText"]),
        "wordCount": len(entry["plainText"].replace("\n", " ").split()),
        "turnCount": len(entry["transcript"]),
    }
    if AUDIT_NOTE not in entry["qaNotes"]:
        entry["qaNotes"].append(AUDIT_NOTE)


def update_rewrite(rewrite: dict, id_replacements: dict[str, str], name_replacements: dict[str, str]) -> None:
    for turn in rewrite["turns"]:
        turn["speakerId"] = id_replacements.get(turn["speakerId"], turn["speakerId"])
        for old_name, new_name in name_replacements.items():
            turn["text"] = turn["text"].replace(old_name, new_name)


def main() -> None:
    registry = json.loads(REGISTRY.read_text())
    rewrites = json.loads(REWRITES.read_text())

    for entry in registry["scripts"]:
        if entry["sceneImageId"] == "late-meeting-workplace-01":
            replace_identity(entry, {
                "emma": {
                    "id": "diego",
                    "name": "Diego",
                    "replaceName": "Emma",
                    "role": "late_employee",
                    "voice": "Charon",
                },
            })
        elif entry["sceneImageId"] == "pancake-practice-kitchen-01":
            replace_identity(entry, {
                "uncle_ben": {
                    "id": "grandma",
                    "name": "Grandma Rosa",
                    "replaceName": "Uncle Ben",
                    "role": "grandmother",
                    "voice": "Kore",
                },
                "nina": {
                    "id": "leo",
                    "name": "Leo",
                    "replaceName": "Nina",
                    "role": "learner_cook",
                    "voice": "Puck",
                },
            })
        elif entry["sceneImageId"] == "torn-grocery-bag-01":
            replace_identity(entry, {
                "clerk": {
                    "id": "clerk",
                    "name": "the store clerk",
                    "role": "store_staff",
                    "voice": "Charon",
                },
            })

    for script_id, rewrite in rewrites.items():
        if script_id.startswith("late-meeting-workplace-01-"):
            update_rewrite(rewrite, {"emma": "diego"}, {"Emma": "Diego"})
            rewrite["metadataRec"] = "Set nameSpokenInAudio=true for Diego and Noah."
            rewrite["notes"] = "The coworkers address each other by name; Diego matches the late worker shown in the image."
        elif script_id.startswith("pancake-practice-kitchen-01-"):
            update_rewrite(
                rewrite,
                {"uncle_ben": "grandma", "nina": "leo"},
                {"Uncle Ben": "Grandma Rosa", "Nina": "Leo"},
            )
            rewrite["metadataRec"] = "Set nameSpokenInAudio=true for Grandma Rosa and Leo."
            rewrite["notes"] = "The grandmother teaches her teenage grandson; they name each other naturally."
        elif script_id.startswith("torn-grocery-bag-01-"):
            rewrite["notes"] = (
                "Dad and Clerk are role labels, not proper names. The clerk states that he works "
                "at the store, and the parent role is clear from context."
            )

    REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    REWRITES.write_text(json.dumps(rewrites, indent=2, ensure_ascii=False) + "\n")
    print("Applied visual identity audit corrections to the script registry and rewrite source.")


if __name__ == "__main__":
    main()
