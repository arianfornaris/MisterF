#!/usr/bin/env python3
"""Apply the approved adult-character script revisions without generating audio.

The affected WAV files are deliberately left on disk. Their registry metadata is
removed and each revised script is marked ``pending_audio`` so stale audio cannot
be paired with the new transcript.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
SCRIPT_REGISTRY = HERE / "scene-scripts.json"
PROPOSED_REWRITES = HERE / "proposed-script-rewrites.json"


REVISIONS = {
    "shared-umbrella-bus-stop-01-a1-a2": {
        "title": "Under The Umbrella",
        "teachingFocus": ["weather", "transportation", "offers"],
        "roles": {
            "leo": "adult_commuter_needing_help",
            "ms_clark": "helper",
        },
        "turns": [
            ("leo", "It is raining hard, and I left my umbrella at home."),
            ("ms_clark", "Come under mine. I am Ms. Clark."),
            ("leo", "Thank you, Ms. Clark. I am Leo. I do not want my work papers to get wet."),
            ("ms_clark", "You are welcome, Leo. The bus is almost here."),
            ("leo", "Great. You saved my morning."),
        ],
    },
    "shared-umbrella-bus-stop-01-b1-b2": {
        "title": "Waiting In The Rain",
        "teachingFocus": ["weather", "offers", "public_transport"],
        "roles": {
            "leo": "adult_commuter_needing_help",
            "ms_clark": "helper",
        },
        "turns": [
            ("leo", "I checked the forecast before leaving for work, but it said the rain would start later."),
            ("ms_clark", "That happens all the time. Come closer, or your laptop bag will get completely wet. I am Ms. Clark, by the way."),
            ("leo", "Thanks, Ms. Clark. I am Leo. My laptop and work papers are in there."),
            ("ms_clark", "No problem, Leo. The bus is turning the corner, so we only need to wait another minute."),
            ("leo", "I appreciate it. Next time I will keep an umbrella in my office bag."),
        ],
    },
    "shared-umbrella-bus-stop-01-c1": {
        "title": "A Small Courtesy In Bad Weather",
        "teachingFocus": ["polite_offers", "reflection", "natural_dialogue"],
        "roles": {
            "leo": "adult_commuter_needing_help",
            "ms_clark": "helper",
        },
        "turns": [
            ("leo", "I should have known better than to trust a clear morning forecast. Now my laptop bag is taking the worst of the storm."),
            ("ms_clark", "Step in a little closer. There is enough room, and it would be a shame to let your work equipment get soaked. I am Ms. Clark."),
            ("leo", "Thank you, Ms. Clark. I am Leo. I did not want to impose, but I was running out of dry places to stand."),
            ("ms_clark", "It is no imposition, Leo. The daily commute is easier when people look out for one another."),
            ("leo", "That is true. A small courtesy can make a miserable journey feel almost pleasant."),
        ],
    },
    "shared-lunch-classroom-01-a1-a2": {
        "title": "Lunch Between Classes",
        "teachingFocus": ["food", "adult_education", "sharing"],
        "roles": {
            "mina": "adult_learner_sharing_food",
            "sam": "adult_learner_without_lunch",
        },
        "turns": [
            ("sam", "Mina, I left my lunch at home before class."),
            ("mina", "You can have half of my sandwich, Sam."),
            ("sam", "Really? Thank you, Mina."),
            ("mina", "Of course. I also brought some fruit."),
            ("sam", "That is very kind. I will bring coffee tomorrow."),
        ],
    },
    "shared-lunch-classroom-01-b1-b2": {
        "title": "Sharing During The Course",
        "teachingFocus": ["adult_education", "food", "gratitude"],
        "roles": {
            "mina": "adult_learner_sharing_food",
            "sam": "adult_learner_without_lunch",
        },
        "turns": [
            ("sam", "I came straight from work, Mina, and left my lunch on the kitchen table."),
            ("mina", "That is okay, Sam. I packed more than I need, so we can share during the break."),
            ("sam", "Are you sure? We still have another two hours of class this afternoon."),
            ("mina", "I am sure. You can have half the sandwich, and we can split the fruit."),
            ("sam", "Thanks, Mina. I will bring coffee for both of us next time."),
        ],
    },
    "shared-lunch-classroom-01-c1": {
        "title": "A Generous Break Between Classes",
        "teachingFocus": ["adult_education", "reciprocity", "natural_dialogue"],
        "roles": {
            "mina": "adult_learner_sharing_food",
            "sam": "adult_learner_without_lunch",
        },
        "turns": [
            ("sam", "I managed to bring every course handout, Mina, but somehow left my lunch sitting on the counter."),
            ("mina", "That sounds like the result of rushing here after work, Sam. Take half of my sandwich."),
            ("sam", "I appreciate it, Mina, but I do not want your generosity to become your afternoon hunger."),
            ("mina", "Do not worry. I packed more than enough, and our instructor will not mind if we finish the fruit during the break."),
            ("sam", "Fair point. I will provide the coffee next week as both a thank-you and emergency insurance."),
        ],
    },
    "pancake-practice-kitchen-01-a1-a2": {
        "title": "Making Pancakes For Friends",
        "teachingFocus": ["cooking", "family", "sequence"],
        "roles": {
            "grandma": "grandmother",
            "leo": "adult_grandson_learning_to_cook",
        },
        "turns": [
            ("leo", "Grandma Rosa, I promised to make pancakes for my friends, but this one is too dark."),
            ("grandma", "That is okay, Leo. Turn down the heat."),
            ("leo", "I will use less batter this time."),
            ("grandma", "Good. Wait for small bubbles before you turn it."),
            ("leo", "This one looks much better. Brunch may be saved."),
        ],
    },
    "pancake-practice-kitchen-01-b1-b2": {
        "title": "Preparing For Brunch",
        "teachingFocus": ["instructions", "cooking_sequence", "improvement"],
        "roles": {
            "grandma": "grandmother",
            "leo": "adult_grandson_learning_to_cook",
        },
        "turns": [
            ("leo", "I invited my friends for brunch, Grandma Rosa, but the first pancake burned."),
            ("grandma", "That is how everyone learns, Leo. Lower the heat and watch for bubbles on top."),
            ("leo", "So I should wait until the edges look dry before I flip it?"),
            ("grandma", "Exactly. Then slide the spatula underneath and turn it over quickly."),
            ("leo", "This one is golden. I think my guests will actually get breakfast."),
        ],
    },
    "pancake-practice-kitchen-01-c1": {
        "title": "Learning Before Hosting Brunch",
        "teachingFocus": ["process_language", "encouragement", "precise_instructions"],
        "roles": {
            "grandma": "grandmother",
            "leo": "adult_grandson_learning_to_cook",
        },
        "turns": [
            ("leo", "I volunteered to host brunch, Grandma Rosa, and my first pancake looks like evidence from a kitchen disaster."),
            ("grandma", "It looks like practice, Leo. Pancakes are good teachers because they reveal every mistake immediately."),
            ("leo", "So the heat was too high, and I waited too long before turning it."),
            ("grandma", "Right. Keep the pan medium-hot, use less batter, and flip when bubbles appear and the edges begin to set."),
            ("leo", "This one is actually golden. Perhaps my friends will trust me with brunch after all."),
        ],
    },
}


ADULT_SPEAKERS_BY_SCENE = {
    "shared-umbrella-bus-stop-01": [
        {"id": "leo", "name": "Leo", "role": "adult_commuter_needing_help", "voice": "Puck"},
        {"id": "ms_clark", "name": "Ms. Clark", "role": "helper", "voice": "Kore"},
    ],
    "shared-lunch-classroom-01": [
        {"id": "mina", "name": "Mina", "role": "adult_learner_sharing_food", "voice": "Kore"},
        {"id": "sam", "name": "Sam", "role": "adult_learner_without_lunch", "voice": "Puck"},
    ],
    "pancake-practice-kitchen-01": [
        {"id": "grandma", "name": "Grandma Rosa", "role": "grandmother", "voice": "Kore"},
        {"id": "leo", "name": "Leo", "role": "adult_grandson_learning_to_cook", "voice": "Puck"},
    ],
}


def update_script_registry(data: dict) -> int:
    updated = 0
    for script in data["scripts"]:
        revision = REVISIONS.get(script["id"])
        if revision is None:
            continue

        script["title"] = revision["title"]
        script["teachingFocus"] = revision["teachingFocus"]
        script["speakers"] = [
            {**speaker, "nameSpokenInAudio": True}
            for speaker in ADULT_SPEAKERS_BY_SCENE[script["sceneImageId"]]
        ]

        transcript = [
            {"turn": index, "speakerId": speaker_id, "text": text}
            for index, (speaker_id, text) in enumerate(revision["turns"], start=1)
        ]
        plain_text = "\n".join(turn["text"] for turn in transcript)
        script["transcript"] = transcript
        script["plainText"] = plain_text
        script["stats"] = {
            "characterCount": len(plain_text),
            "wordCount": len(plain_text.split()),
            "turnCount": len(transcript),
        }
        script["status"] = "pending_audio"
        script.pop("audio", None)
        script["qaNotes"] = [
            "Script is tied to visible actions from the approved adult-character scene image.",
            "All speaking characters are adults and named naturally in the dialogue.",
            "Audio metadata was intentionally removed; existing WAV files were left untouched pending a future refresh.",
        ]
        updated += 1

    audio_ready_count = sum("audio" in script for script in data["scripts"])
    summary = data["batchSummary"]
    summary["audioGenerated"] = audio_ready_count == len(data["scripts"])
    summary["audioReadyCount"] = audio_ready_count
    summary["audioPendingCount"] = len(data["scripts"]) - audio_ready_count
    summary.pop("totalAudioDurationSeconds", None)
    summary.pop("estimatedTotalCostUsd", None)
    return updated


def update_proposed_rewrites(data: dict) -> int:
    updated = 0
    for script_id, revision in REVISIONS.items():
        proposal = data[script_id]
        proposal["criteria"] = ["P1", "P7"]
        proposal["metadataRec"] = "All speakers are adults; retain nameSpokenInAudio=true for each dialogue speaker."
        proposal["notes"] = "Adult-character rewrite approved in July 2026; audio remains pending."
        proposal["turns"] = [
            {"speakerId": speaker_id, "text": text}
            for speaker_id, text in revision["turns"]
        ]
        updated += 1
    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    registry = json.loads(SCRIPT_REGISTRY.read_text())
    proposals = json.loads(PROPOSED_REWRITES.read_text())
    registry_count = update_script_registry(registry)
    proposal_count = update_proposed_rewrites(proposals)

    if registry_count != len(REVISIONS) or proposal_count != len(REVISIONS):
        raise RuntimeError(
            f"Expected {len(REVISIONS)} revisions, updated registry={registry_count}, proposals={proposal_count}"
        )

    if not args.dry_run:
        SCRIPT_REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
        PROPOSED_REWRITES.write_text(json.dumps(proposals, indent=2, ensure_ascii=False) + "\n")

    action = "Would update" if args.dry_run else "Updated"
    print(f"{action} {registry_count} scripts and {proposal_count} proposal records without touching WAV files.")


if __name__ == "__main__":
    main()
