#!/usr/bin/env python3
"""Generate Batch 1 scene scripts and Gemini TTS audio."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import wave
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[1]
SCENE_IMAGE_REGISTRY = REPO_ROOT / "design" / "scene-images" / "scene-images.json"
OUTPUT_REGISTRY = ROOT / "scene-scripts.json"
AUDIO_ROOT = ROOT / "audio"
MODEL = "google/gemini-3.1-flash-tts-preview"
PROVIDER = "openrouter"
SAMPLE_RATE = 24000
CHANNELS = 1
SAMPLE_WIDTH_BYTES = 2
SILENCE_SECONDS = 0.38
ESTIMATED_GEMINI_TTS_USD_PER_SECOND = 0.00931 / 19.5


LEVELS = [
    {
        "id": "A1-A2",
        "cefrRange": ["A1", "A2"],
        "description": "Short, concrete, high-frequency English for beginner and elementary learners.",
    },
    {
        "id": "B1-B2",
        "cefrRange": ["B1", "B2"],
        "description": "Natural everyday English with reasons, reactions, and moderate detail.",
    },
    {
        "id": "C1",
        "cefrRange": ["C1"],
        "description": "Richer, more nuanced English with inference and natural social phrasing.",
    },
]


SCRIPTS = [
    {
        "sceneImageId": "lost-wallet-cafe-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "The Wallet On The Floor",
        "teachingFocus": ["lost_and_found", "thanks", "simple_past"],
        "speakers": [
            {"id": "maria", "name": "Maria", "role": "person_who_lost_item", "voice": "Kore"},
            {"id": "mr_james", "name": "Mr. James", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maria", "Oh no, my wallet is not in my bag."),
            ("mr_james", "Excuse me. Is this brown wallet yours?"),
            ("maria", "Yes, it is. Thank you so much."),
            ("mr_james", "You are welcome. It was near the door."),
            ("maria", "I am very lucky today."),
        ],
    },
    {
        "sceneImageId": "lost-wallet-cafe-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "A Helpful Stranger",
        "teachingFocus": ["lost_and_found", "past_sequence", "relief"],
        "speakers": [
            {"id": "maria", "name": "Maria", "role": "person_who_lost_item", "voice": "Kore"},
            {"id": "mr_james", "name": "Mr. James", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maria", "I just ordered coffee, but I cannot find my wallet anywhere."),
            ("mr_james", "I think this may be yours. It fell from your bag when you came in."),
            ("maria", "That is it. I was sure I had lost it outside in the rain."),
            ("mr_james", "I saw it before anyone stepped on it, so I picked it up right away."),
            ("maria", "Thank you. You saved me a lot of trouble."),
        ],
    },
    {
        "sceneImageId": "lost-wallet-cafe-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Relief At The Cafe Door",
        "teachingFocus": ["narrative_detail", "social_language", "gratitude"],
        "speakers": [
            {"id": "maria", "name": "Maria", "role": "person_who_lost_item", "voice": "Kore"},
            {"id": "mr_james", "name": "Mr. James", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maria", "I have checked every pocket twice, and my wallet has somehow disappeared."),
            ("mr_james", "Before you panic, take a look at this. I noticed it sliding out of your bag as you stepped away from the entrance."),
            ("maria", "That is mine. I honestly thought it had fallen outside, and with this rain I would never have found it."),
            ("mr_james", "Luckily, it landed just inside the door. I picked it up before the next customer walked in."),
            ("maria", "I really appreciate your honesty. You turned a very stressful moment into a small reminder that strangers can be kind."),
        ],
    },
    {
        "sceneImageId": "shared-umbrella-bus-stop-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Under The Umbrella",
        "teachingFocus": ["weather", "transportation", "offers"],
        "speakers": [
            {"id": "leo", "name": "Leo", "role": "adult_commuter_needing_help", "voice": "Puck"},
            {"id": "ms_clark", "name": "Ms. Clark", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("leo", "It is raining hard, and I left my umbrella at home."),
            ("ms_clark", "Come under mine. I am Ms. Clark."),
            ("leo", "Thank you, Ms. Clark. I am Leo. I do not want my work papers to get wet."),
            ("ms_clark", "You are welcome, Leo. The bus is almost here."),
            ("leo", "Great. You saved my morning."),
        ],
    },
    {
        "sceneImageId": "shared-umbrella-bus-stop-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Waiting In The Rain",
        "teachingFocus": ["weather", "offers", "public_transport"],
        "speakers": [
            {"id": "leo", "name": "Leo", "role": "adult_commuter_needing_help", "voice": "Puck"},
            {"id": "ms_clark", "name": "Ms. Clark", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("leo", "I checked the forecast before leaving for work, but it said the rain would start later."),
            ("ms_clark", "That happens all the time. Come closer, or your laptop bag will get completely wet. I am Ms. Clark, by the way."),
            ("leo", "Thanks, Ms. Clark. I am Leo. My laptop and work papers are in there."),
            ("ms_clark", "No problem, Leo. The bus is turning the corner, so we only need to wait another minute."),
            ("leo", "I appreciate it. Next time I will keep an umbrella in my office bag."),
        ],
    },
    {
        "sceneImageId": "shared-umbrella-bus-stop-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "A Small Courtesy In Bad Weather",
        "teachingFocus": ["polite_offers", "reflection", "natural_dialogue"],
        "speakers": [
            {"id": "leo", "name": "Leo", "role": "adult_commuter_needing_help", "voice": "Puck"},
            {"id": "ms_clark", "name": "Ms. Clark", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("leo", "I should have known better than to trust a clear morning forecast. Now my laptop bag is taking the worst of the storm."),
            ("ms_clark", "Step in a little closer. There is enough room, and it would be a shame to let your work equipment get soaked. I am Ms. Clark."),
            ("leo", "Thank you, Ms. Clark. I am Leo. I did not want to impose, but I was running out of dry places to stand."),
            ("ms_clark", "It is no imposition, Leo. The daily commute is easier when people look out for one another."),
            ("leo", "That is true. A small courtesy can make a miserable journey feel almost pleasant."),
        ],
    },
    {
        "sceneImageId": "torn-grocery-bag-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "The Broken Bag",
        "teachingFocus": ["shopping", "food_vocabulary", "help"],
        "speakers": [
            {"id": "dad", "name": "Dad", "role": "parent", "voice": "Puck"},
            {"id": "clerk", "name": "Clerk", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("dad", "Oh no. The bag broke."),
            ("clerk", "I can help you pick up the apples."),
            ("dad", "Thank you. The bread is on the ground too."),
            ("clerk", "Here is a stronger bag."),
            ("dad", "That is much better. Thanks for your help."),
        ],
    },
    {
        "sceneImageId": "torn-grocery-bag-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "A Stronger Bag",
        "teachingFocus": ["shopping_problem", "offers", "problem_solution"],
        "speakers": [
            {"id": "dad", "name": "Dad", "role": "parent", "voice": "Puck"},
            {"id": "clerk", "name": "Clerk", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("dad", "Careful, Mia. The bottom of the bag just tore, and the apples are rolling everywhere."),
            ("clerk", "Do not worry. I will grab them before they go into the street."),
            ("dad", "Thanks. I should have used two bags because these groceries are heavier than I thought."),
            ("clerk", "Here, put everything in this reusable one. It is stronger and easier to carry."),
            ("dad", "Perfect. Now we can get home without losing dinner on the sidewalk."),
        ],
    },
    {
        "sceneImageId": "torn-grocery-bag-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Saving Dinner From The Sidewalk",
        "teachingFocus": ["problem_solving", "humor", "natural_sequence"],
        "speakers": [
            {"id": "dad", "name": "Dad", "role": "parent", "voice": "Puck"},
            {"id": "clerk", "name": "Clerk", "role": "helper", "voice": "Kore"},
        ],
        "transcript": [
            ("dad", "Well, that was dramatic. One second we had groceries, and the next second dinner was escaping across the sidewalk."),
            ("clerk", "I saw the bag give way. Let me help before the apples roll any farther."),
            ("dad", "I appreciate it. My daughter is trying to rescue the bread, but I think the bag has officially retired."),
            ("clerk", "This reusable one should survive the trip home. It has wider handles and can hold quite a bit more weight."),
            ("dad", "Excellent. Next time I will not underestimate a harmless-looking bag full of apples."),
        ],
    },
    {
        "sceneImageId": "shared-lunch-classroom-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Lunch Between Classes",
        "teachingFocus": ["food", "adult_education", "sharing"],
        "speakers": [
            {"id": "mina", "name": "Mina", "role": "adult_learner_sharing_food", "voice": "Kore"},
            {"id": "sam", "name": "Sam", "role": "adult_learner_without_lunch", "voice": "Puck"},
        ],
        "transcript": [
            ("sam", "Mina, I left my lunch at home before class."),
            ("mina", "You can have half of my sandwich, Sam."),
            ("sam", "Really? Thank you, Mina."),
            ("mina", "Of course. I also brought some fruit."),
            ("sam", "That is very kind. I will bring coffee tomorrow."),
        ],
    },
    {
        "sceneImageId": "shared-lunch-classroom-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Sharing During The Course",
        "teachingFocus": ["adult_education", "food", "gratitude"],
        "speakers": [
            {"id": "mina", "name": "Mina", "role": "adult_learner_sharing_food", "voice": "Kore"},
            {"id": "sam", "name": "Sam", "role": "adult_learner_without_lunch", "voice": "Puck"},
        ],
        "transcript": [
            ("sam", "I came straight from work, Mina, and left my lunch on the kitchen table."),
            ("mina", "That is okay, Sam. I packed more than I need, so we can share during the break."),
            ("sam", "Are you sure? We still have another two hours of class this afternoon."),
            ("mina", "I am sure. You can have half the sandwich, and we can split the fruit."),
            ("sam", "Thanks, Mina. I will bring coffee for both of us next time."),
        ],
    },
    {
        "sceneImageId": "shared-lunch-classroom-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "A Generous Break Between Classes",
        "teachingFocus": ["adult_education", "reciprocity", "natural_dialogue"],
        "speakers": [
            {"id": "mina", "name": "Mina", "role": "adult_learner_sharing_food", "voice": "Kore"},
            {"id": "sam", "name": "Sam", "role": "adult_learner_without_lunch", "voice": "Puck"},
        ],
        "transcript": [
            ("sam", "I managed to bring every course handout, Mina, but somehow left my lunch sitting on the counter."),
            ("mina", "That sounds like the result of rushing here after work, Sam. Take half of my sandwich."),
            ("sam", "I appreciate it, Mina, but I do not want your generosity to become your afternoon hunger."),
            ("mina", "Do not worry. I packed more than enough, and our instructor will not mind if we finish the fruit during the break."),
            ("sam", "Fair point. I will provide the coffee next week as both a thank-you and emergency insurance."),
        ],
    },
    {
        "sceneImageId": "pancake-practice-kitchen-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Making Pancakes For Friends",
        "teachingFocus": ["cooking", "family", "sequence"],
        "speakers": [
            {"id": "grandma", "name": "Grandma Rosa", "role": "grandmother", "voice": "Kore"},
            {"id": "leo", "name": "Leo", "role": "adult_grandson_learning_to_cook", "voice": "Puck"},
        ],
        "transcript": [
            ("leo", "Grandma Rosa, I promised to make pancakes for my friends, but this one is too dark."),
            ("grandma", "That is okay, Leo. Turn down the heat."),
            ("leo", "I will use less batter this time."),
            ("grandma", "Good. Wait for small bubbles before you turn it."),
            ("leo", "This one looks much better. Brunch may be saved."),
        ],
    },
    {
        "sceneImageId": "pancake-practice-kitchen-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Preparing For Brunch",
        "teachingFocus": ["instructions", "cooking_sequence", "improvement"],
        "speakers": [
            {"id": "grandma", "name": "Grandma Rosa", "role": "grandmother", "voice": "Kore"},
            {"id": "leo", "name": "Leo", "role": "adult_grandson_learning_to_cook", "voice": "Puck"},
        ],
        "transcript": [
            ("leo", "I invited my friends for brunch, Grandma Rosa, but the first pancake burned."),
            ("grandma", "That is how everyone learns, Leo. Lower the heat and watch for bubbles on top."),
            ("leo", "So I should wait until the edges look dry before I flip it?"),
            ("grandma", "Exactly. Then slide the spatula underneath and turn it over quickly."),
            ("leo", "This one is golden. I think my guests will actually get breakfast."),
        ],
    },
    {
        "sceneImageId": "pancake-practice-kitchen-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Learning Before Hosting Brunch",
        "teachingFocus": ["process_language", "encouragement", "precise_instructions"],
        "speakers": [
            {"id": "grandma", "name": "Grandma Rosa", "role": "grandmother", "voice": "Kore"},
            {"id": "leo", "name": "Leo", "role": "adult_grandson_learning_to_cook", "voice": "Puck"},
        ],
        "transcript": [
            ("leo", "I volunteered to host brunch, Grandma Rosa, and my first pancake looks like evidence from a kitchen disaster."),
            ("grandma", "It looks like practice, Leo. Pancakes are good teachers because they reveal every mistake immediately."),
            ("leo", "So the heat was too high, and I waited too long before turning it."),
            ("grandma", "Right. Keep the pan medium-hot, use less batter, and flip when bubbles appear and the edges begin to set."),
            ("leo", "This one is actually golden. Perhaps my friends will trust me with brunch after all."),
        ],
    },
    {
        "sceneImageId": "late-meeting-workplace-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Late For The Meeting",
        "teachingFocus": ["workplace", "apologies", "time"],
        "speakers": [
            {"id": "emma", "name": "Emma", "role": "late_employee", "voice": "Kore"},
            {"id": "noah", "name": "Noah", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("emma", "I am sorry I am late."),
            ("noah", "It is okay. The meeting just started."),
            ("emma", "Did I miss anything important?"),
            ("noah", "Not yet. We are looking at the plan."),
            ("emma", "Thanks. I will sit down quietly."),
        ],
    },
    {
        "sceneImageId": "late-meeting-workplace-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Catching Up Quickly",
        "teachingFocus": ["workplace_apologies", "meeting_language", "catching_up"],
        "speakers": [
            {"id": "emma", "name": "Emma", "role": "late_employee", "voice": "Kore"},
            {"id": "noah", "name": "Noah", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("emma", "Sorry I am late. The elevator stopped on almost every floor."),
            ("noah", "Do not worry. We have only reviewed the schedule so far."),
            ("emma", "Good. I was afraid I had missed the decision about the client presentation."),
            ("noah", "That part is next. I saved you a seat and opened the notes on my laptop."),
            ("emma", "Thanks, Noah. I will catch up quickly and add my comments after the overview."),
        ],
    },
    {
        "sceneImageId": "late-meeting-workplace-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Arriving After The Agenda Begins",
        "teachingFocus": ["professional_language", "repairing_delay", "meeting_context"],
        "speakers": [
            {"id": "emma", "name": "Emma", "role": "late_employee", "voice": "Kore"},
            {"id": "noah", "name": "Noah", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("emma", "I apologize for slipping in late. The elevator queue downstairs was worse than I expected."),
            ("noah", "You are fine. We have covered the timeline, but the main discussion has not started yet."),
            ("emma", "That is a relief. I was worried I had missed the part where we divide the presentation tasks."),
            ("noah", "Not yet. I put the shared notes in front of you, and I marked the section where your input will matter most."),
            ("emma", "Perfect. I will listen for a minute, then jump in once I understand where the group has landed."),
        ],
    },
    {
        "sceneImageId": "printer-help-workplace-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "The Printer Problem",
        "teachingFocus": ["office", "technology", "asking_for_help"],
        "speakers": [
            {"id": "maya", "name": "Maya", "role": "person_needing_help", "voice": "Kore"},
            {"id": "liam", "name": "Liam", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maya", "The printer is not working."),
            ("liam", "Let me look. Is there paper inside?"),
            ("maya", "Yes, but the light is red."),
            ("liam", "The paper is stuck. I can fix it."),
            ("maya", "Great. I need these pages for the meeting."),
        ],
    },
    {
        "sceneImageId": "printer-help-workplace-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Fixing The Jam",
        "teachingFocus": ["office_technology", "instructions", "workplace_help"],
        "speakers": [
            {"id": "maya", "name": "Maya", "role": "person_needing_help", "voice": "Kore"},
            {"id": "liam", "name": "Liam", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maya", "The printer stopped halfway through my report, and now it keeps flashing a red light."),
            ("liam", "That usually means there is a paper jam. Open this tray and pull the page out slowly."),
            ("maya", "I see it. The corner is folded, so it must have gone in at an angle."),
            ("liam", "Exactly. Once we remove it, press this button and send the file again."),
            ("maya", "Thanks. I still have time to bring the copies to the meeting."),
        ],
    },
    {
        "sceneImageId": "printer-help-workplace-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "A Paper Jam Before The Meeting",
        "teachingFocus": ["technical_explanation", "workplace_pressure", "step_by_step_help"],
        "speakers": [
            {"id": "maya", "name": "Maya", "role": "person_needing_help", "voice": "Kore"},
            {"id": "liam", "name": "Liam", "role": "helper", "voice": "Puck"},
        ],
        "transcript": [
            ("maya", "Of course the printer waits until ten minutes before the meeting to become mysterious."),
            ("liam", "It is not being mysterious, just dramatic. The red light usually means a page is trapped somewhere inside the tray."),
            ("maya", "I can see the edge, but I am afraid if I pull too hard I will tear it and make things worse."),
            ("liam", "Good instinct. Hold both sides and ease it out slowly. Then we will reset the tray before you print the report again."),
            ("maya", "Thank you. If this works, the meeting will never know how close it came to being paperless."),
        ],
    },
    {
        "sceneImageId": "team-deadline-workplace-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Finishing Together",
        "teachingFocus": ["teamwork", "deadlines", "work_tasks"],
        "speakers": [
            {"id": "sofia", "name": "Sofia", "role": "team_member", "voice": "Kore"},
            {"id": "omar", "name": "Omar", "role": "team_member", "voice": "Puck"},
        ],
        "transcript": [
            ("sofia", "We have a lot of work today."),
            ("omar", "Yes, but we can finish together."),
            ("sofia", "I will check the pictures."),
            ("omar", "I will write the last notes."),
            ("sofia", "Good. Then we can send the project."),
        ],
    },
    {
        "sceneImageId": "team-deadline-workplace-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "The Final Hour",
        "teachingFocus": ["teamwork", "planning", "deadline_language"],
        "speakers": [
            {"id": "sofia", "name": "Sofia", "role": "team_member", "voice": "Kore"},
            {"id": "omar", "name": "Omar", "role": "team_member", "voice": "Puck"},
        ],
        "transcript": [
            ("sofia", "The deadline is in one hour, so we need to choose what matters most."),
            ("omar", "I can finish the summary while you check the images and numbers."),
            ("sofia", "That works. After that, we should read the whole project once more."),
            ("omar", "Agreed. If we find small mistakes, we can fix them before sending it."),
            ("sofia", "I was nervous before, but now the plan feels possible."),
        ],
    },
    {
        "sceneImageId": "team-deadline-workplace-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Making The Deadline Manageable",
        "teachingFocus": ["prioritization", "collaboration", "professional_tone"],
        "speakers": [
            {"id": "sofia", "name": "Sofia", "role": "team_member", "voice": "Kore"},
            {"id": "omar", "name": "Omar", "role": "team_member", "voice": "Puck"},
        ],
        "transcript": [
            ("sofia", "We are not going to polish every detail before the deadline, so we need to be strategic."),
            ("omar", "Agreed. I will tighten the conclusion and remove anything that repeats information from the chart."),
            ("sofia", "Good. I will verify the numbers and make sure the visuals support the main argument instead of distracting from it."),
            ("omar", "Once those pieces are done, we can read the project aloud. That usually reveals awkward sentences faster than staring at the screen."),
            ("sofia", "Exactly. The deadline still feels close, but at least the work now has a shape we can finish."),
        ],
    },
    {
        "sceneImageId": "messy-desk-clean-desk-01",
        "level": "A1-A2",
        "scriptType": "narration",
        "title": "A Clean Desk",
        "teachingFocus": ["before_after", "office_objects", "organization"],
        "speakers": [
            {"id": "narrator", "name": "Narrator", "role": "narrator", "voice": "Kore"},
        ],
        "transcript": [
            ("narrator", "In the morning, the desk is messy. Papers, pens, and cups are everywhere. The worker cleans the desk. Now the papers are in one pile, the cup is away, and the desk is ready for work."),
        ],
    },
    {
        "sceneImageId": "messy-desk-clean-desk-01",
        "level": "B1-B2",
        "scriptType": "narration",
        "title": "Before And After The Cleanup",
        "teachingFocus": ["before_after", "organization", "work_habits"],
        "speakers": [
            {"id": "narrator", "name": "Narrator", "role": "narrator", "voice": "Kore"},
        ],
        "transcript": [
            ("narrator", "At first, the desk is covered with papers, sticky notes, pens, and an empty cup. It is hard to find anything quickly. After a short cleanup, the space looks calmer. The papers are sorted, the pens are together, and the worker can start the next task without feeling distracted."),
        ],
    },
    {
        "sceneImageId": "messy-desk-clean-desk-01",
        "level": "C1",
        "scriptType": "narration",
        "title": "Turning Visual Noise Into Focus",
        "teachingFocus": ["contrast", "workplace_routine", "descriptive_language"],
        "speakers": [
            {"id": "narrator", "name": "Narrator", "role": "narrator", "voice": "Kore"},
        ],
        "transcript": [
            ("narrator", "The desk begins as a small map of unfinished tasks: loose papers, scattered pens, a forgotten cup, and notes competing for attention. After the cleanup, the same space sends a different message. The documents are grouped, the tools are easy to reach, and the worker has removed enough visual noise to think clearly again."),
        ],
    },
    {
        "sceneImageId": "office-break-room-01",
        "level": "A1-A2",
        "scriptType": "dialogue",
        "title": "Break Time",
        "teachingFocus": ["workplace", "small_talk", "food_and_drink"],
        "speakers": [
            {"id": "anna", "name": "Anna", "role": "coworker", "voice": "Kore"},
            {"id": "marco", "name": "Marco", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("anna", "Hi Marco. Are you on a break?"),
            ("marco", "Yes. I need some water."),
            ("anna", "I have coffee and a snack."),
            ("marco", "Nice. The morning was busy."),
            ("anna", "Yes, but five quiet minutes help."),
        ],
    },
    {
        "sceneImageId": "office-break-room-01",
        "level": "B1-B2",
        "scriptType": "dialogue",
        "title": "Five Quiet Minutes",
        "teachingFocus": ["small_talk", "workday_routine", "wellbeing"],
        "speakers": [
            {"id": "anna", "name": "Anna", "role": "coworker", "voice": "Kore"},
            {"id": "marco", "name": "Marco", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("anna", "You look relieved to be away from your desk for a moment."),
            ("marco", "I am. The morning was full of calls, and I needed a short break before the next one."),
            ("anna", "Same here. I made coffee, but I am mostly enjoying the quiet."),
            ("marco", "Sometimes five minutes in the break room makes the rest of the day easier."),
            ("anna", "Exactly. After this, I can go back with a clearer head."),
        ],
    },
    {
        "sceneImageId": "office-break-room-01",
        "level": "C1",
        "scriptType": "dialogue",
        "title": "Resetting In The Break Room",
        "teachingFocus": ["workplace_wellbeing", "natural_small_talk", "reflection"],
        "speakers": [
            {"id": "anna", "name": "Anna", "role": "coworker", "voice": "Kore"},
            {"id": "marco", "name": "Marco", "role": "coworker", "voice": "Puck"},
        ],
        "transcript": [
            ("anna", "You have the expression of someone who has survived a very long morning."),
            ("marco", "That is accurate. Three calls, two urgent messages, and one spreadsheet that refused to make sense."),
            ("anna", "Then this is a well-earned pause. I came in for coffee, but honestly I needed a few minutes without notifications."),
            ("marco", "There is something useful about stepping away before frustration starts making decisions for you."),
            ("anna", "Exactly. A short break does not solve the work, but it makes us better company for the work when we return."),
        ],
    },
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_api_key() -> str:
    load_env_file(REPO_ROOT / "misterf-web" / ".env.development")
    load_env_file(REPO_ROOT / "misterf-web" / ".env.production")
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set and was not found in local env files.")
    return key


def level_slug(level: str) -> str:
    return level.lower().replace("-", "-")


def script_id(scene_id: str, level: str) -> str:
    return f"{scene_id}-{level.lower()}"


def plain_text(turns: list[tuple[str, str]]) -> str:
    return "\n".join(text for _, text in turns)


def synthesize_turn(
    text: str, voice: str, api_key: str, retry_count: int = 2, response_format: str = "pcm"
) -> bytes:
    url = "https://openrouter.ai/api/v1/audio/speech"
    payload = {
        "model": MODEL,
        "input": text,
        "voice": voice,
        "response_format": response_format,
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://misterf.us",
        "X-Title": "Mister F Scene Script Asset Generation",
    }
    for attempt in range(retry_count + 1):
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            if attempt >= retry_count:
                raise RuntimeError(f"TTS request failed with HTTP {exc.code}: {error_body}") from exc
        except urllib.error.URLError as exc:
            if attempt >= retry_count:
                raise RuntimeError(f"TTS request failed: {exc}") from exc
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("TTS request failed unexpectedly.")


def pcm_silence(seconds: float) -> bytes:
    sample_count = int(seconds * SAMPLE_RATE)
    return b"\x00" * sample_count * CHANNELS * SAMPLE_WIDTH_BYTES


def write_wav(path: Path, pcm_chunks: list[bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(SAMPLE_WIDTH_BYTES)
        wav.setframerate(SAMPLE_RATE)
        for chunk in pcm_chunks:
            wav.writeframes(chunk)


def convert_wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "64k",
            str(mp3_path),
        ],
        check=True,
    )


def audio_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(result.stdout.strip()), 2)


def build_script_entry(script: dict, scene_by_id: dict, audio_metadata: dict | None) -> dict:
    scene = scene_by_id[script["sceneImageId"]]
    turns = [
        {"turn": index, "speakerId": speaker_id, "text": text}
        for index, (speaker_id, text) in enumerate(script["transcript"], start=1)
    ]
    text = plain_text(script["transcript"])
    char_count = len(text)
    word_count = len(text.replace("\n", " ").split())
    entry = {
        "id": script_id(script["sceneImageId"], script["level"]),
        "sceneImageId": script["sceneImageId"],
        "sceneImageFile": f"../scene-images/{scene['file']}",
        "title": script["title"],
        "status": "generated" if audio_metadata else "text_ready",
        "level": script["level"],
        "cefrRange": next(level["cefrRange"] for level in LEVELS if level["id"] == script["level"]),
        "scriptType": script["scriptType"],
        "source": "codex-authored",
        "teachingFocus": script["teachingFocus"],
        "speakers": script["speakers"],
        "transcript": turns,
        "plainText": text,
        "stats": {
            "characterCount": char_count,
            "wordCount": word_count,
            "turnCount": len(turns),
        },
        "qaNotes": [
            "Script is tied to visible actions from the approved scene image.",
            "No panel numbers are spoken in the transcript.",
        ],
    }
    if audio_metadata:
        entry["audio"] = audio_metadata
    return entry


def generate_audio(script: dict, api_key: str, force: bool) -> dict:
    sid = script_id(script["sceneImageId"], script["level"])
    audio_dir = AUDIO_ROOT / level_slug(script["level"])
    mp3_path = audio_dir / f"{sid}.mp3"
    relative_mp3 = mp3_path.relative_to(ROOT).as_posix()
    if mp3_path.exists() and not force:
        duration = audio_duration(mp3_path)
        return {
            "provider": PROVIDER,
            "model": MODEL,
            "file": relative_mp3,
            "format": "mp3",
            "bitrateKbps": 64,
            "durationSeconds": duration,
            "bytes": mp3_path.stat().st_size,
            "generatedAt": date.today().isoformat(),
            "voiceStrategy": "turn_by_turn_concatenation",
            "estimatedCostUsd": round(duration * ESTIMATED_GEMINI_TTS_USD_PER_SECOND, 6),
            "costEstimationMethod": "Estimated from prior Gemini TTS demo cost per second; OpenRouter usage receipts may lag.",
        }

    chunks: list[bytes] = []
    voice_by_speaker = {speaker["id"]: speaker["voice"] for speaker in script["speakers"]}
    for index, (speaker_id, text) in enumerate(script["transcript"]):
        if index > 0:
            chunks.append(pcm_silence(SILENCE_SECONDS))
        chunks.append(synthesize_turn(text, voice_by_speaker[speaker_id], api_key))

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = Path(tmpdir) / f"{sid}.wav"
        write_wav(wav_path, chunks)
        convert_wav_to_mp3(wav_path, mp3_path)

    duration = audio_duration(mp3_path)
    return {
        "provider": PROVIDER,
        "model": MODEL,
        "file": relative_mp3,
        "format": "mp3",
        "bitrateKbps": 64,
        "durationSeconds": duration,
        "bytes": mp3_path.stat().st_size,
        "generatedAt": date.today().isoformat(),
        "voiceStrategy": "turn_by_turn_concatenation",
        "estimatedCostUsd": round(duration * ESTIMATED_GEMINI_TTS_USD_PER_SECOND, 6),
        "costEstimationMethod": "Estimated from prior Gemini TTS demo cost per second; OpenRouter usage receipts may lag.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-audio", action="store_true", help="Write metadata without calling Gemini TTS.")
    parser.add_argument("--force-audio", action="store_true", help="Regenerate existing audio files.")
    args = parser.parse_args()

    scene_registry = json.loads(SCENE_IMAGE_REGISTRY.read_text())
    scene_by_id = {scene["id"]: scene for scene in scene_registry["images"]}

    api_key = None if args.no_audio else get_api_key()
    entries = []
    total_estimated_cost = 0.0
    total_duration = 0.0

    for index, script in enumerate(SCRIPTS, start=1):
        if script["sceneImageId"] not in scene_by_id:
            raise RuntimeError(f"Missing scene image id: {script['sceneImageId']}")
        print(f"[{index}/{len(SCRIPTS)}] {script_id(script['sceneImageId'], script['level'])}")
        audio_metadata = None
        if api_key:
            audio_metadata = generate_audio(script, api_key, args.force_audio)
            total_estimated_cost += audio_metadata["estimatedCostUsd"]
            total_duration += audio_metadata["durationSeconds"]
        entries.append(build_script_entry(script, scene_by_id, audio_metadata))

    output = {
        "version": 1,
        "description": "Design registry for curated text-and-audio scripts attached to approved Mister F scene images.",
        "generatedAt": date.today().isoformat(),
        "defaultProvider": PROVIDER,
        "defaultTtsModel": MODEL,
        "levels": LEVELS,
        "batchSummary": {
            "batch": 1,
            "sceneCount": 10,
            "scriptCount": len(entries),
            "levelsPerScene": 3,
            "audioGenerated": not args.no_audio,
            "totalAudioDurationSeconds": round(total_duration, 2),
            "estimatedTotalCostUsd": round(total_estimated_cost, 6),
        },
        "scripts": entries,
    }
    OUTPUT_REGISTRY.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUTPUT_REGISTRY}")


if __name__ == "__main__":
    main()
