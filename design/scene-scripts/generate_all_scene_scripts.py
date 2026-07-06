#!/usr/bin/env python3
"""Generate scene scripts and Gemini TTS audio for the full image library."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from generate_batch_01 import (
    LEVELS,
    MODEL,
    OUTPUT_REGISTRY,
    PROVIDER,
    SCENE_IMAGE_REGISTRY,
    SCRIPTS as CURATED_BATCH_01_SCRIPTS,
    build_script_entry,
    generate_audio,
    get_api_key,
    script_id,
)


BATCH_01_SCENE_IDS = {script["sceneImageId"] for script in CURATED_BATCH_01_SCRIPTS}
NARRATOR = {"id": "narrator", "name": "Narrator", "role": "narrator", "voice": "Kore"}


FOCUS_BY_LEVEL = {
    "A1-A2": ["scene_sequence", "everyday_vocabulary", "basic_listening"],
    "B1-B2": ["story_sequence", "reasons_and_reactions", "problem_solution"],
    "C1": ["nuanced_description", "inference", "natural_listening"],
}


LEVEL_TITLES = {
    "A1-A2": "Simple Story",
    "B1-B2": "Detailed Story",
    "C1": "Nuanced Story",
}


def sentence_case(text: str) -> str:
    text = text.strip().rstrip(".")
    if not text:
        return text
    return text[0].upper() + text[1:] + "."


def simple_topic(title: str) -> str:
    title = re.sub(r"\bAt The\b", "at the", title)
    title = re.sub(r"\bIn The\b", "in the", title)
    title = re.sub(r"\bAnd\b", "and", title)
    return title


def visible_objects(scene: dict) -> str:
    tags = [
        tag.replace("-", " ")
        for tag in scene.get("tags", [])
        if tag not in {"problem", "solution", "problem-solution", "before", "after", "before-after"}
    ]
    if not tags:
        return "the people and objects in the scene"
    selected = tags[:4]
    if len(selected) == 1:
        return selected[0]
    return ", ".join(selected[:-1]) + f", and {selected[-1]}"


def a1_text(scene: dict) -> str:
    title = simple_topic(scene["title"]).lower()
    sequence = scene.get("panelSequence", [])
    if scene.get("panelCount") == 1:
        return (
            f"This scene shows {title}. "
            f"{sentence_case(sequence[0]) if sequence else 'People are doing everyday activities.'} "
            "The people are calm. The learner can name the place, the people, and the actions."
        )
    if scene.get("panelCount") == 2:
        first = sentence_case(sequence[0]) if sequence else "First, the scene shows one situation."
        second = sentence_case(sequence[1]) if len(sequence) > 1 else "Then the situation changes."
        return f"This picture has two parts. {first} {second} The learner can say what changed."
    steps = " ".join(sentence_case(step) for step in sequence)
    return f"This is a short story about {title}. {steps} In the end, the problem is easier."


def b1_text(scene: dict) -> str:
    title = simple_topic(scene["title"]).lower()
    objects = visible_objects(scene)
    sequence = scene.get("panelSequence", [])
    if scene.get("panelCount") == 1:
        base = sentence_case(sequence[0]) if sequence else "The scene shows people in an everyday place."
        return (
            f"The image presents {title}. {base} "
            f"The listener can notice {objects}, then describe what each person is doing and why the moment feels useful for practice."
        )
    if scene.get("panelCount") == 2:
        first = sentence_case(sequence[0]) if sequence else "The first part introduces the situation."
        second = sentence_case(sequence[1]) if len(sequence) > 1 else "The second part shows the result."
        return (
            f"The two panels show a clear change. {first} {second} "
            "The contrast helps the learner compare the beginning and the result using simple reasons and details."
        )
    steps = " ".join(sentence_case(step) for step in sequence)
    return (
        f"The story shows {title}. {steps} "
        "The situation works because the people stay calm, ask for help when they need it, and move toward a practical solution."
    )


def c1_text(scene: dict) -> str:
    title = simple_topic(scene["title"]).lower()
    objects = visible_objects(scene)
    sequence = scene.get("panelSequence", [])
    if scene.get("panelCount") == 1:
        base = sentence_case(sequence[0]) if sequence else "The scene captures a familiar public moment."
        return (
            f"This scene turns {title} into a compact listening prompt. {base} "
            f"The useful details are not only the visible items, such as {objects}, but also the relationships between the people: "
            "who is waiting, who is helping, who is focused, and who may need to respond next."
        )
    if scene.get("panelCount") == 2:
        first = sentence_case(sequence[0]) if sequence else "The first panel establishes the initial state."
        second = sentence_case(sequence[1]) if len(sequence) > 1 else "The second panel shows the changed state."
        return (
            f"The contrast in {title} is simple, but it invites precise description. {first} {second} "
            "A stronger listener can explain not just what changed, but what probably happened between the two moments and why the result matters."
        )
    steps = " ".join(sentence_case(step) for step in sequence)
    return (
        f"This wordless story presents {title} as a small social problem with a visible resolution. {steps} "
        "The most important listening challenge is to follow the shift from uncertainty to action: someone notices the problem, another person responds, "
        "and the final moment suggests relief, cooperation, or a better plan."
    )


TEXT_BY_LEVEL = {
    "A1-A2": a1_text,
    "B1-B2": b1_text,
    "C1": c1_text,
}


def generated_script(scene: dict, level: str) -> dict:
    return {
        "sceneImageId": scene["id"],
        "level": level,
        "scriptType": "narration",
        "title": f"{scene['title']} - {LEVEL_TITLES[level]}",
        "teachingFocus": FOCUS_BY_LEVEL[level],
        "speakers": [NARRATOR],
        "transcript": [("narrator", TEXT_BY_LEVEL[level](scene))],
    }


def build_all_scripts(scenes: list[dict]) -> list[dict]:
    scripts = list(CURATED_BATCH_01_SCRIPTS)
    for scene in scenes:
        if scene["id"] in BATCH_01_SCENE_IDS:
            continue
        for level in ("A1-A2", "B1-B2", "C1"):
            scripts.append(generated_script(scene, level))
    return scripts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-audio", action="store_true", help="Write metadata without calling Gemini TTS.")
    parser.add_argument("--force-audio", action="store_true", help="Regenerate existing audio files.")
    args = parser.parse_args()

    scene_registry = json.loads(SCENE_IMAGE_REGISTRY.read_text())
    scenes = scene_registry["images"]
    scene_by_id = {scene["id"]: scene for scene in scenes}
    scripts = build_all_scripts(scenes)

    api_key = None if args.no_audio else get_api_key()
    entries = []
    total_estimated_cost = 0.0
    total_duration = 0.0

    for index, script in enumerate(scripts, start=1):
        if script["sceneImageId"] not in scene_by_id:
            raise RuntimeError(f"Missing scene image id: {script['sceneImageId']}")
        print(f"[{index}/{len(scripts)}] {script_id(script['sceneImageId'], script['level'])}", flush=True)
        audio_metadata = None
        if api_key:
            audio_metadata = generate_audio(script, api_key, args.force_audio)
            total_estimated_cost += audio_metadata["estimatedCostUsd"]
            total_duration += audio_metadata["durationSeconds"]
        entries.append(build_script_entry(script, scene_by_id, audio_metadata))

    scene_counts = {}
    level_counts = {}
    for entry in entries:
        scene_counts[entry["sceneImageId"]] = scene_counts.get(entry["sceneImageId"], 0) + 1
        level_counts[entry["level"]] = level_counts.get(entry["level"], 0) + 1

    output = {
        "version": 1,
        "description": "Design registry for curated text-and-audio scripts attached to approved Mister F scene images.",
        "generatedAt": date.today().isoformat(),
        "defaultProvider": PROVIDER,
        "defaultTtsModel": MODEL,
        "levels": LEVELS,
        "batchSummary": {
            "batch": "all-scenes",
            "sceneCount": len(scene_counts),
            "scriptCount": len(entries),
            "levelsPerScene": 3,
            "audioGenerated": not args.no_audio,
            "totalAudioDurationSeconds": round(total_duration, 2),
            "estimatedTotalCostUsd": round(total_estimated_cost, 6),
            "levelCounts": level_counts,
            "sceneCounts": scene_counts,
        },
        "scripts": entries,
    }
    OUTPUT_REGISTRY.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUTPUT_REGISTRY}", flush=True)


if __name__ == "__main__":
    main()
