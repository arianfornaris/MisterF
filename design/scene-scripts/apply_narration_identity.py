#!/usr/bin/env python3
"""Backfill identity metadata onto narration scripts (metadata only, no audio).

This gives every script the same shape the dialogue rewrites established:
`identityStrategy` on the entry and `nameSpokenInAudio` on each speaker. It does
NOT touch audio — narration text is unchanged, and all current narrations are
single-turn so they carry no per-turn segments.

Classification (one-time backfill for the current 123 narrations):
  - named_in_narration: the narrated text names its character(s) with a proper
    person name. The tutor may use that name (read it from the transcript).
  - role_only: the story's subject is collective/generic ("the neighbors",
    "the science group", "children"); no proper name is spoken, so the tutor
    refers to the subject generically.

The narrator is a voice, not a character, so its nameSpokenInAudio is always
False; whether the *story's* character is nameable is carried by identityStrategy.

NOTE: the person-name set below is a curated allowlist for the existing corpus.
New scripts should set `identityStrategy` at authoring/generation time rather
than relying on this backfill.

Usage:
  python3 design/scene-scripts/apply_narration_identity.py --dry-run
  python3 design/scene-scripts/apply_narration_identity.py
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "scene-scripts.json"

# Curated person names/surnames present in the current narration corpus, plus
# the Mr/Mrs titles that always precede a named person.
PERSON_NAMES = {
    "Aiden", "Ana", "Ava", "Ben", "Chen", "Diego", "Eli", "Ella", "Emma",
    "Grace", "Iris", "Jon", "Kai", "Lee", "Lena", "Leo", "Lily", "Lina",
    "Luis", "Marco", "Marta", "Mateo", "Maya", "Mia", "Mila", "Nina", "Noah",
    "Nora", "Omar", "Patel", "Rivera", "Rosa", "Ruben", "Sam", "Sara", "Tara",
    "Tom", "Green",
}
NAME_SIGNALS = PERSON_NAMES | {"Mr", "Mrs"}


def reorder_speaker(sp: dict) -> dict:
    keys = ["id", "name", "role", "voice", "nameSpokenInAudio"]
    return {k: sp[k] for k in keys if k in sp}


def reorder_entry(entry: dict) -> dict:
    order = [
        "id", "sceneImageId", "sceneImageFile", "title", "status", "level",
        "cefrRange", "scriptType", "identityStrategy", "source", "teachingFocus",
        "speakers", "transcript", "plainText", "stats", "qaNotes", "audio",
    ]
    return {k: entry[k] for k in order if k in entry}


def has_person_name(entry: dict) -> bool:
    text = " ".join(t["text"] for t in entry["transcript"])
    tokens = set(re.findall(r"[A-Z][a-z]+", text))
    return bool(tokens & NAME_SIGNALS)


def apply(dry_run: bool) -> None:
    registry = json.loads(REGISTRY.read_text())
    scripts = registry["scripts"]

    named = role_only = 0
    new_scripts = []
    for entry in scripts:
        if entry.get("scriptType") != "narration":
            new_scripts.append(entry)
            continue

        strategy = "named_in_narration" if has_person_name(entry) else "role_only"
        entry["identityStrategy"] = strategy
        entry["speakers"] = [
            reorder_speaker({**sp, "nameSpokenInAudio": False})
            for sp in entry["speakers"]
        ]
        new_scripts.append(reorder_entry(entry))

        if strategy == "named_in_narration":
            named += 1
        else:
            role_only += 1
            print(f"  role_only: {entry['id']}")

    print(f"\nnarrations tagged: named_in_narration={named}  role_only={role_only}")

    if dry_run:
        print("Dry run: no file written.")
        return

    registry["scripts"] = new_scripts
    REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {REGISTRY.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    apply(parser.parse_args().dry_run)
