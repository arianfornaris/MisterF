#!/usr/bin/env python3
"""Rewrite descriptive scene scripts into real leveled microstories."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from generate_batch_01 import (
    MODEL,
    OUTPUT_REGISTRY,
    PROVIDER,
    build_script_entry,
    generate_audio,
    get_api_key,
    script_id,
)


ROOT = Path(__file__).resolve().parent
SCENE_IMAGES_PATH = ROOT.parent / "scene-images" / "scene-images.json"
INDEX_BUILDER = ROOT / "build_review_index.py"
NARRATOR = {"id": "narrator", "name": "Narrator", "role": "narrator", "voice": "Kore"}


STORY_TEXTS = {
    "messy-desk-clean-desk-01": {
        "A1-A2": "Ben came to work early, but his desk was full of papers and cups. He could not find one important note. He stopped, put everything in order, and found the note under a book. When his boss arrived, Ben was ready to start.",
        "B1-B2": "Ben arrived before the office was busy because he wanted a quiet start. His desk, however, looked like yesterday had never ended. He needed one small note for a morning call, but it was hidden under papers, pens, and an empty cup. Ben took ten minutes to sort the mess. By the time the phone rang, the note was in front of him and his mind felt clear.",
        "C1": "Ben planned to spend the first hour finishing a proposal, but his desk told a different story. Every paper seemed urgent, every note seemed unfinished, and the one detail he needed had vanished. Instead of pretending the chaos was harmless, he paused and rebuilt the space piece by piece. When the missing note finally appeared, the proposal no longer felt impossible. The clean desk had not done the work for him, but it had given him room to think.",
    },
    "doctor-visit-cough-01": {
        "A1-A2": "Rosa had a cough all weekend, so she went to the clinic on Monday. The receptionist helped her check in. The doctor listened to her chest and asked simple questions. Rosa went home with clear advice, warm tea, and a plan to rest.",
        "B1-B2": "Rosa tried to ignore her cough during the weekend, but by Monday morning she sounded worse. At the clinic, the receptionist helped her check in and told her to wait for the doctor. The doctor listened carefully, checked her breathing, and explained that she needed rest and water. Rosa left relieved because the problem was not serious and she knew what to do next.",
        "C1": "Rosa had been telling herself the cough was nothing, mostly because she disliked missing work. By Monday, even her short sentences ended in a rough sound, so she finally went to the clinic. The doctor examined her, asked about sleep and fever, and spoke calmly enough to make the visit feel less frightening. Rosa left without dramatic news, but with something better: a practical plan, permission to rest, and the quiet confidence that she had acted in time.",
    },
    "pharmacy-instructions-01": {
        "A1-A2": "Eli picked up medicine for his mother, but he did not understand the instructions. He asked the pharmacist for help. She showed him the bottle and a glass of water. Eli listened carefully and went home ready to help his mother safely.",
        "B1-B2": "Eli wanted to help his mother, so he went to the pharmacy after school. When the pharmacist gave him the medicine, he realized he was not sure how she should take it. Instead of guessing, he asked for the instructions again. The pharmacist explained slowly and used gestures to make everything clear. Eli wrote down the important details and left feeling responsible, not confused.",
        "C1": "Eli had promised his mother he would handle the pharmacy errand, and at first it felt simple. Then the pharmacist placed the medicine on the counter and explained the schedule faster than he expected. Eli almost nodded and left, but he imagined giving the wrong instructions at home. He took a breath and asked her to repeat everything. The pharmacist smiled, clarified the timing, and showed him exactly what mattered. By asking one careful question, Eli turned a nervous errand into a useful act of care.",
    },
    "minor-sprain-clinic-01": {
        "A1-A2": "Nina was walking in the park when her ankle turned. Her friend Luis helped her sit on a bench. Later, a nurse wrapped the ankle at the clinic. Nina walked slowly home, happy that Luis stayed with her.",
        "B1-B2": "Nina and Luis were taking a quick walk before lunch when Nina stepped on a loose stone. Her ankle hurt, and she tried to laugh, but Luis could see she needed help. He helped her sit down, then walked with her to the clinic. The nurse wrapped the ankle and told Nina to rest. The walk ended early, but the friendship felt stronger.",
        "C1": "Nina wanted the park walk to feel ordinary after a stressful week, so she was annoyed when one small stone changed the plan. Her ankle twisted, and for a moment she was more embarrassed than hurt. Luis did not make a big scene; he simply offered his arm, found a bench, and helped her get to the clinic. The nurse wrapped the sprain and explained how to care for it. Nina left moving slowly, but she also left grateful that an inconvenient accident had revealed such steady friendship.",
    },
    "before-after-resting-01": {
        "A1-A2": "Marco came home tired and quiet. He wanted to finish many chores, but his body needed a break. He rested on the sofa and drank water. After a short time, he felt better and made dinner slowly.",
        "B1-B2": "Marco came home with a headache and a long list of things to do. He almost started cleaning right away, but he noticed he was moving too slowly to do anything well. He sat on the sofa, closed his eyes, and drank a glass of water. After twenty minutes, the room looked the same, but Marco did not. He made dinner calmly and saved the chores for later.",
        "C1": "Marco was proud of being useful, which is why resting felt strangely difficult. He came home exhausted, saw the laundry basket, and immediately felt guilty. Then he caught himself staring at the same sock for almost a minute. Instead of forcing his way through the evening, he sat down, drank water, and allowed the day to slow. The pause did not erase his responsibilities, but it changed his relationship to them. When he stood up again, he chose one small task and did it well.",
    },
    "waiting-room-check-in-01": {
        "A1-A2": "Sam arrived early for his appointment, but he felt nervous. The receptionist smiled and helped him check in. In the waiting room, he saw other people reading and talking quietly. When the nurse called his name, Sam stood up feeling calmer.",
        "B1-B2": "Sam had never visited this clinic before, so he arrived twenty minutes early. He was worried about missing a form or sitting in the wrong place. The receptionist checked his name and pointed to a chair near the window. As Sam waited, he watched a nurse help an older man and a mother comfort her child. The room was busy, but kind. When his name was called, he was ready.",
        "C1": "Sam entered the clinic with the small fear that everyone else understood the system except him. The receptionist, however, made the first step easy: name, appointment time, and a calm gesture toward the waiting area. As he sat down, Sam noticed the quiet choreography of the room. People arrived uncertain, staff guided them, and each small instruction reduced the confusion. By the time the nurse called his name, the appointment had already become less intimidating.",
    },
    "missed-train-platform-01": {
        "A1-A2": "Maya ran to the platform, but the train left without her. She looked at the empty tracks and felt upset. A station worker showed her another way. Maya took a deep breath and walked to the next train.",
        "B1-B2": "Maya thought she had five minutes, but the station clock disagreed. She ran down the stairs just as the train doors closed. For a moment, she wanted to blame the rain, her alarm, and the slow ticket machine. Then a station worker pointed her toward another platform. The next train was not perfect, but it would still get her there. Maya changed plans and kept moving.",
        "C1": "Maya reached the platform just in time to watch her train become part of the distance. The missed train felt personal at first, as if the whole morning had chosen to work against her. A station employee noticed her panic and explained a different route with two transfers. It was not the simple trip she had planned, but it was still a trip. Maya put away her frustration, followed the signs, and discovered that a ruined schedule did not have to ruin the day.",
    },
    "lost-luggage-hotel-01": {
        "A1-A2": "Omar arrived at the hotel after a long trip. His blue suitcase was not beside him. A hotel worker helped him look near the desk and the cart. They found the suitcase, and Omar finally smiled.",
        "B1-B2": "Omar was tired when he reached the hotel, and he wanted only a shower and sleep. Then he noticed that his blue suitcase was missing. He checked near the door, near the elevator, and beside the luggage cart. A hotel worker listened carefully and helped him search. The suitcase had been placed behind another bag at reception. Omar thanked her and went upstairs feeling lucky.",
        "C1": "After nine hours of travel, Omar had very little patience left, so the missing suitcase felt like the final insult of the day. The hotel lobby was busy, and every bag seemed almost, but not quite, like his. A staff member asked him to describe it, then began searching with a calmness Omar did not feel. They found the suitcase hidden behind a larger one near reception. Omar laughed with relief, suddenly aware that the disaster he imagined had lasted only ten minutes.",
    },
    "ticket-machine-help-01": {
        "A1-A2": "Mr. Lee wanted to buy a train ticket, but the machine confused him. A young traveler saw the problem and offered help. She showed him where to press. Soon Mr. Lee had his ticket and walked to the platform.",
        "B1-B2": "Mr. Lee needed a ticket for the city train, but the machine had too many choices. He stepped back and looked worried. A young traveler asked if he needed help, then showed him the correct button and where to pay. Mr. Lee thanked her twice because he had been afraid of missing the train. With the ticket in his hand, he walked toward the platform with a lighter step.",
        "C1": "Mr. Lee had traveled by train for years, but the new ticket machine made him feel suddenly out of place. The screen changed faster than he expected, and the people behind him seemed impatient. A younger traveler noticed his hesitation and offered help without making him feel foolish. She guided him through each step, then stepped aside as if it were the most ordinary kindness in the world. Mr. Lee boarded with his ticket and a little more trust in asking for help.",
    },
    "packed-unpacked-suitcase-01": {
        "A1-A2": "Lena packed her suitcase carefully before her trip. She folded shirts, socks, and a small gift. At the hotel, she opened the suitcase and found everything in the right place. The gift was safe, so she called her sister with a smile.",
        "B1-B2": "Lena usually packed in a hurry, but this trip mattered. She folded her clothes carefully and placed a small birthday gift between two soft sweaters. When she arrived at the hotel, she opened the suitcase with a little fear. Nothing was broken, and the gift was still wrapped. Lena unpacked slowly, then called her sister to say she would be there on time.",
        "C1": "Lena treated the suitcase like a promise. She packed each item with unusual care because the trip was not just a vacation; it was the first family birthday she had attended in years. At the hotel, she opened the bag and found the gift exactly where she had placed it, protected between layers of clothes. The sight made her unexpectedly emotional. For once, nothing had been forgotten, crushed, or delayed. She unpacked, breathed out, and prepared to show up.",
    },
    "airport-security-line-01": {
        "A1-A2": "Jon stood in the airport security line with his backpack. He was worried because the line moved fast. A worker showed him where to put his shoes and bag. Jon followed the steps and reached his gate on time.",
        "B1-B2": "Jon had flown before, but airport security still made him nervous. The line moved quickly, and everyone seemed to know what to do. When he hesitated with his backpack, a staff member pointed to an empty tray and gave simple directions. Jon placed his things inside, walked through the scanner, and collected everything on the other side. He reached his gate with enough time to buy water.",
        "C1": "Airport security always made Jon feel as if he were taking a test no one had explained. The people around him removed shoes, opened bags, and moved trays with practiced speed. When he paused, a staff member noticed and guided him with a calm gesture. Jon followed the sequence step by step, then watched his backpack emerge from the scanner. Nothing dramatic happened, which felt like the victory. He left the line more confident than when he had entered it.",
    },
    "wrong-size-return-01": {
        "A1-A2": "Tara bought a sweater, but it was too big. She took it back to the store with her receipt. The clerk helped her find a smaller size. Tara tried it on, smiled, and went home happy.",
        "B1-B2": "Tara loved the color of the sweater, but at home she saw that it was much too large. The next day, she returned to the store and showed the receipt to the clerk. She was afraid the return would be difficult, but the clerk simply asked what size she needed. Together they found the right one. Tara left with the same sweater, only now it actually fit.",
        "C1": "Tara had bought the sweater because the color made a gray afternoon feel brighter. Unfortunately, the mirror at home told the truth: it hung on her like someone else's coat. She returned to the store expecting a complicated conversation, but the clerk listened, checked the receipt, and guided her to the correct size. When Tara tried it on again, the sweater looked the way she had imagined. The purchase was no longer a mistake; it had simply needed one more step.",
    },
    "wrong-cafe-order-01": {
        "A1-A2": "Ava ordered tea and a muffin, but the barista gave her coffee and cake. Ava spoke politely and showed the mistake. The barista made the right order. Ava thanked him and enjoyed her snack.",
        "B1-B2": "Ava was tired after class and wanted her usual tea and muffin. When the barista handed her coffee and cake, she almost stayed quiet because the cafe was busy. Then she remembered she had paid for something else. She explained the mistake politely. The barista apologized and made the correct order. Ava sat by the window, glad she had spoken up kindly.",
        "C1": "Ava had practiced difficult conversations in class, but correcting a real order still made her nervous. The cafe was crowded, the barista looked busy, and the wrong drink was already in her hand. She considered accepting it just to avoid trouble. Instead, she used a calm voice and explained what she had ordered. The barista thanked her for being patient and fixed it quickly. Ava carried the right tea to her table, pleased that politeness had worked without making her invisible.",
    },
    "phone-repair-pickup-01": {
        "A1-A2": "Diego broke his phone screen on Tuesday. On Friday, he went back to the repair shop. The technician brought out the phone, and Diego tested it. The screen worked again, so he left with a big smile.",
        "B1-B2": "Diego had spent three days borrowing his sister's phone, so he was eager to pick up his repaired one. At the shop, the technician checked his claim slip and brought out the phone. Diego turned it on, tried the camera, and sent a quick message. Everything worked. He thanked the technician because the small device suddenly felt important again.",
        "C1": "Diego did not realize how much he used his phone until the screen broke and every simple task became complicated. When he returned to the repair shop, he tried not to look too hopeful. The technician placed the phone on the counter, clean and working, and invited him to test it. Diego opened the camera, checked his messages, and laughed when the screen responded perfectly. The repair had not only fixed a device; it had returned a little order to his week.",
    },
    "empty-full-cart-01": {
        "A1-A2": "Grace entered the supermarket with an empty cart and a short list. She bought bread, fruit, milk, and rice. At the end, the cart was full. Grace checked her list and felt proud because she had not forgotten anything.",
        "B1-B2": "Grace promised herself she would buy only what her family needed. She started with an empty cart and a list in her hand. In each aisle, she chose carefully: fruit for breakfast, rice for dinner, and milk for the children. By the time she reached the checkout, the cart was full but organized. Grace smiled because every item had a purpose.",
        "C1": "Grace had learned that a full cart could mean planning, not waste. She entered the supermarket with a list, a budget, and the memory of last week's forgotten dinner ingredients. This time, she moved through the aisles slowly, choosing food for real meals instead of sudden cravings. When the cart was full, it looked like the week ahead: breakfast, lunches, dinners, and a few small treats. Grace checked the list one last time and felt quietly prepared.",
    },
    "market-checkout-line-01": {
        "A1-A2": "Leo waited in the market line with a basket of food. The line was long, and he felt impatient. Then he helped an older woman pick up an orange. Soon it was his turn, and the wait felt shorter.",
        "B1-B2": "Leo chose the slowest checkout line by mistake. He had only a few groceries, but every cart in front of him seemed full. While he waited, an orange rolled from an older woman's bag. Leo picked it up and handed it back. She thanked him, and they talked for a minute. By the time the cashier called him forward, Leo was surprised that the line no longer felt annoying.",
        "C1": "Leo entered the market in a hurry and immediately regretted choosing the longest checkout line. He watched the cashier scan groceries, heard bags rustle, and felt his patience disappear. Then an orange escaped from the bag of the woman ahead of him and rolled to his shoe. Leo picked it up, and the small act opened a conversation. They talked about recipes, rainy weather, and busy afternoons. The line did not move faster, but Leo did. He left the market less rushed than he had entered it.",
    },
    "forgotten-keys-home-01": {
        "A1-A2": "Mia closed her apartment door and then touched her empty pocket. Her keys were inside. She asked her neighbor for help. The neighbor had a spare key, and Mia got back inside before the rain started.",
        "B1-B2": "Mia was carrying two bags when the door closed behind her. The sound was small, but the problem was big: her keys were still on the table. She knocked on her neighbor's door and explained what happened. Luckily, the neighbor kept a spare key for emergencies. Mia opened the door again, thanked her, and decided to put a key hook by the entrance.",
        "C1": "Mia knew the mistake the second the door clicked shut. Her keys were visible through the small window, sitting calmly on the table as if they had chosen to stay home. For a moment, she stood in the hallway with grocery bags cutting into her hands. Then she remembered the spare key she had given her neighbor months ago. One embarrassed knock later, the crisis was over. Mia stepped back inside, grateful for past planning and determined to build better habits.",
    },
    "laundry-color-mistake-01": {
        "A1-A2": "Noah washed his white shirt with a red sock. The shirt came out pink. His sister laughed, but then she helped him sort the clothes. They washed the next load carefully, and Noah learned to check pockets and colors.",
        "B1-B2": "Noah wanted to finish the laundry quickly, so he put everything into one machine. When the cycle ended, his favorite white shirt had turned pale pink. His sister laughed for a second, then showed him how to separate colors. They sorted the next basket together and folded the clean clothes. Noah still had a pink shirt, but now he also had a useful lesson.",
        "C1": "Noah believed laundry was simple until one red sock quietly changed the color of his favorite shirt. At first, he stared at the pink fabric as if it might apologize. His sister found the situation funny, but she did not leave him alone with the problem. She showed him how to sort colors, check pockets, and read the labels he had always ignored. The shirt never became white again, but Noah kept it as a reminder that speed is not the same as efficiency.",
    },
    "morning-rush-family-01": {
        "A1-A2": "Ella and her son were late for school. He could not find one shoe. They looked under the bed, beside the door, and near the sofa. Ella found it under a jacket, and they left together just in time.",
        "B1-B2": "Ella's morning plan was simple: breakfast, shoes, backpack, bus. Then one shoe disappeared. Her son looked worried because he did not want to be late. Ella stopped rushing and turned the search into a game. They checked the bedroom, the hallway, and finally the sofa. The shoe was hiding under a jacket. They ran to the bus laughing, a little late but still together.",
        "C1": "The morning began with the usual race against the clock. Ella packed lunch while her son searched for his shoes, and then the whole schedule collapsed over one missing sneaker. Instead of shouting, Ella forced herself to slow down. They retraced his steps, lifted a jacket near the sofa, and found the shoe waiting there. The bus arrived just as they reached the stop. It was not a perfect morning, but it became a small victory in patience.",
    },
    "messy-room-tidy-room-01": {
        "A1-A2": "Lily wanted to invite a friend over, but her room was very messy. She picked up clothes, books, and toys. After one hour, the room was tidy. When her friend arrived, Lily opened the door proudly.",
        "B1-B2": "Lily invited her friend to visit after school, then looked around her room and panicked. Clothes were on the chair, books were on the floor, and one sock was on the desk. She almost canceled the visit, but instead she made a quick plan. First books, then clothes, then trash. By the time the doorbell rang, the room looked welcoming and Lily felt ready.",
        "C1": "Lily's room had become a record of every rushed morning that week. When her friend asked to come over, Lily saw the mess differently: not as a private problem, but as a story she did not want the room to tell. She sorted books, rescued clothes from the floor, and cleared the desk one small area at a time. The room did not become perfect, but it became honest and comfortable. When her friend arrived, Lily felt she had made space for both of them.",
    },
    "family-dinner-table-01": {
        "A1-A2": "The Rivera family sat down for dinner after a busy day. Ana passed the rice, and her brother poured water. Everyone shared one good thing from the day. By the end of dinner, the room felt warm and quiet.",
        "B1-B2": "The Rivera family almost ate dinner at different times because everyone was tired. Then Ana's father asked them to sit together for just twenty minutes. They passed food, told small stories, and laughed about a mistake at work. Nobody checked a phone. When the plates were empty, the family was still at the table, enjoying a little more time together.",
        "C1": "Dinner at the Rivera house nearly became another rushed stop between homework, work messages, and bedtime. Ana's father, however, placed the food in the middle of the table and asked everyone to stay until they had shared one detail from the day. At first the stories were small: a late bus, a funny answer in class, a difficult customer. Then the room softened. The meal did not solve anyone's problems, but it reminded them they did not have to carry those problems alone.",
    },
    "group-project-library-01": {
        "A1-A2": "Three students met at the library for a group project. At first, they did not know what to do. They chose jobs: one read, one drew, and one wrote. The next day, they presented their poster together.",
        "B1-B2": "At the beginning of the project, the group felt lost. There were too many books, too many ideas, and not enough time. Sara suggested that each person choose one job. Mateo found facts, Lina made the poster, and Sara organized the notes. When they practiced in the library, the presentation finally made sense. The group walked into class nervous but prepared.",
        "C1": "The group project began with polite confusion. Everyone had ideas, but no one knew how to turn them into a presentation. In the library, Sara finally drew three columns on a sheet of paper and divided the work. Mateo searched for evidence, Lina designed the poster, and Sara connected the pieces into a clear order. Their first practice sounded awkward, but each round improved. By presentation day, they had not only finished the project; they had learned how to become a team.",
    },
    "forgotten-homework-01": {
        "A1-A2": "Tom reached school and opened his backpack. His homework was not there. He remembered it was on the kitchen table. After school, he brought it to his teacher and promised to pack his bag at night.",
        "B1-B2": "Tom felt confident until the teacher asked for the homework. He opened his backpack and found only books. Then he remembered the paper sitting on the kitchen table beside his breakfast plate. His teacher gave him one day to bring it. That evening, Tom put the homework in his bag before dinner. The next morning, he handed it in and felt the lesson more than the assignment.",
        "C1": "Tom had completed the homework carefully, which made forgetting it feel especially unfair. At school, his empty folder seemed to accuse him. The teacher listened, then gave him one chance to bring it the next day. Tom went home annoyed at himself, found the paper exactly where he had left it, and changed his routine. He packed his bag before he relaxed. The next morning, handing in the assignment felt less like fixing a mistake and more like becoming reliable.",
    },
    "science-project-spill-01": {
        "A1-A2": "The science group mixed colored water for a project. One cup fell, and blue water spread across the table. The students stopped and cleaned it together. Then they started again more carefully.",
        "B1-B2": "The science project was going well until Ben reached across the table and knocked over a cup of blue water. Everyone froze. For a second, the group looked at the spill instead of the solution. Then Maya grabbed paper towels, and Ben moved the papers away. The teacher checked that everyone was safe. After cleaning up, they restarted the experiment with slower hands and a better plan.",
        "C1": "The spill happened at the worst possible moment, just as the group thought their science project was finally working. Blue water ran across the table toward their notes, and Ben's face turned red with embarrassment. Maya moved first, lifting the papers while another student found towels. Their teacher reminded them that safe scientists respond before they complain. Ten minutes later, the table was clean and the experiment began again. The project survived because the group chose teamwork over blame.",
    },
    "empty-full-backpack-01": {
        "A1-A2": "Aiden's backpack was empty on Sunday night. He put in books, pencils, a notebook, and his lunch box. In the morning, he checked the bag again. At school, he had everything he needed.",
        "B1-B2": "Aiden usually packed his backpack five minutes before leaving, and something was always missing. This Sunday, he tried a new plan. He opened the empty bag and placed each school item inside: notebook, pencils, book, water, and lunch. In the morning, he did not need to run around the house. He picked up the full backpack and left calmly.",
        "C1": "Aiden's empty backpack looked harmless, but it represented every rushed morning he wanted to stop repeating. On Sunday night, he packed it slowly, checking each item against the next day's schedule. The simple routine felt almost too small to matter. Yet the next morning, while his sister searched for a pencil, Aiden was already ready by the door. The full backpack gave him more than supplies; it gave him a quieter start.",
    },
    "classroom-presentation-01": {
        "A1-A2": "Mila stood in front of the class with her poster. Her hands felt cold, but she started speaking. Her friends listened and smiled. When she finished, the teacher clapped, and Mila felt brave.",
        "B1-B2": "Mila had practiced her presentation three times at home, but the classroom still looked very large. When she stood beside her poster, she forgot the first sentence. Then her friend smiled from the front row, and Mila remembered to breathe. She began again, slowly. By the end, her voice was stronger. The applause felt good, but finishing felt even better.",
        "C1": "Mila thought the hardest part of the presentation would be remembering the facts. She was wrong. The hardest part was standing in front of the class while everyone waited for her first word. For a few seconds, silence felt enormous. Then she saw her friend nod, took a breath, and trusted the practice she had done at home. The presentation was not perfect, but it was clear. When she sat down, Mila understood that courage could sound like a shaking voice that continues anyway.",
    },
    "restaurant-reservation-mixup-01": {
        "A1-A2": "Nora and her father arrived at the restaurant for dinner. The host could not find their reservation. Nora showed the confirmation on her phone. The host found a table, and dinner began with a laugh.",
        "B1-B2": "Nora had planned the dinner for her father's birthday, so her heart dropped when the host could not find the reservation. The restaurant was full, and her father tried to say it was fine. Nora checked her phone and found the confirmation. The host apologized and searched again. A table opened near the window. The evening started with a problem, but it became a story they would retell.",
        "C1": "Nora wanted the birthday dinner to feel effortless, which is exactly why the missing reservation felt so painful. The host searched the list twice while Nora's father pretended not to be disappointed. Then Nora found the confirmation message buried under a week of notifications. The host recognized the mistake, apologized, and found a quiet table near the window. The dinner was not flawless, but perhaps that helped. By dessert, the mix-up had become part of the celebration rather than a threat to it.",
    },
    "spilled-soup-restaurant-01": {
        "A1-A2": "A waiter brought soup to the table, but the bowl slipped. A little soup spilled near Emma's chair. The waiter cleaned it quickly and brought a new bowl. Emma thanked him, and dinner continued.",
        "B1-B2": "Emma was telling a story when the waiter arrived with hot soup. The bowl slipped slightly, and soup splashed onto the table. Everyone stopped. The waiter apologized, Emma moved her napkin, and another staff member came with towels. Nobody was hurt. A new bowl arrived a few minutes later, and the table relaxed again. The accident became a small interruption, not a ruined meal.",
        "C1": "The soup spill was small, but for one second the whole table went silent. Emma saw the waiter's face change from focus to panic, and she understood that he was more upset than anyone else. She moved her chair back, smiled, and said she was fine. The staff cleaned the table quickly and replaced the bowl. When dinner continued, the conversation returned slowly, then warmly. Emma later remembered the meal not for the spill, but for how kindly everyone let the mistake pass.",
    },
    "ordering-with-allergy-01": {
        "A1-A2": "Kai wanted lunch at a new restaurant. He told the server about his nut allergy. The server checked with the kitchen and helped him choose safe food. Kai ate carefully and enjoyed the meal.",
        "B1-B2": "Kai liked trying new restaurants, but his nut allergy meant he had to ask questions. When the server came to the table, Kai explained the allergy clearly. She did not guess. She checked with the kitchen and suggested a safe dish. Kai thanked her because asking can feel awkward. When the food arrived, he relaxed and enjoyed lunch with his friends.",
        "C1": "Kai had learned that eating out required both courage and clarity. At the new restaurant, he wanted to enjoy lunch without turning his allergy into a dramatic announcement. He explained it calmly to the server, who paused the order instead of rushing him. She checked with the kitchen, returned with safe options, and made sure the plate was prepared separately. Kai's friends barely noticed the extra steps, but he did. The meal tasted better because it came with trust.",
    },
    "empty-full-plate-01": {
        "A1-A2": "Sam sat at the restaurant with an empty plate and a hungry stomach. The server brought rice, chicken, and vegetables. Sam waited until everyone had food. Then he ate slowly and saved the last bite for his favorite sauce.",
        "B1-B2": "Sam arrived at the restaurant so hungry that the empty plate looked almost funny. He tried not to stare at the kitchen door. When the server brought the meal, the colors and smell made everyone at the table smile. Sam waited until his grandmother had been served, then began eating. By the end, the plate was empty again, but this time he felt happy and full.",
        "C1": "The empty plate in front of Sam made the wait feel longer than it was. He had skipped lunch, and every sound from the kitchen seemed meant for another table. Then the server arrived with a meal bright enough to change his mood before he even tasted it. Sam waited for his grandmother to begin, then took the first bite with theatrical seriousness. The plate emptied slowly, through conversation and shared jokes. What had started as impatience ended as the kind of meal people remember.",
    },
    "busy-restaurant-table-01": {
        "A1-A2": "The table was busy with plates, drinks, and many hands. Leo could not reach the bread. His cousin passed it to him and poured water for their aunt. Everyone talked, shared food, and left the restaurant smiling.",
        "B1-B2": "At first, the restaurant table felt too crowded. Plates arrived, glasses moved, and everyone talked at the same time. Leo wanted bread but could not reach it, so his cousin passed the basket across the table. That small action started a chain: someone poured water, someone shared salad, and someone made room for dessert. The table stayed busy, but it became friendly instead of confusing.",
        "C1": "The restaurant table looked chaotic from a distance: arms crossing, glasses filling, plates arriving, and conversations competing for space. Leo nearly stayed quiet because he could not reach anything without interrupting. Then his cousin noticed and passed the bread. The gesture seemed small, but it changed the rhythm of the meal. People began offering dishes before being asked, making jokes, and making space. The table remained crowded, yet it no longer felt disorganized. It felt like a family learning how to share the same moment.",
    },
    "library-card-help-01": {
        "A1-A2": "Mrs. Patel wanted a library card, but the form was new to her. A librarian helped her fill it out. Then Mrs. Patel chose two books. She walked home proud of her new card.",
        "B1-B2": "Mrs. Patel had passed the library many times but had never gone inside to borrow a book. One afternoon, she decided to ask for a card. The form looked confusing, and she almost left. A librarian noticed and offered help. Together they completed the application. Mrs. Patel borrowed two books and held the card carefully, as if it were a small key to a larger room.",
        "C1": "For years, Mrs. Patel had treated the library as a place for other people, even though she loved books. The application form seemed to confirm her worry: too many boxes, too many unfamiliar steps. A librarian approached before embarrassment could send her back to the door. She explained each part patiently, then helped Mrs. Patel choose her first books. When the new card slid across the desk, it felt less like plastic and more like permission. Mrs. Patel left with stories under her arm.",
    },
    "park-cleanup-01": {
        "A1-A2": "On Saturday, neighbors came to clean the park. They picked up bottles, bags, and paper. A little girl found a clean flower bed under the trash. By noon, the park looked bright again.",
        "B1-B2": "The park had looked sad for weeks, so a few neighbors planned a cleanup. At first, only five people arrived. Then more people came with gloves, bags, and water. They picked up trash, swept the path, and cleared the flower beds. A child found a hidden patch of yellow flowers. By lunchtime, the park felt like a place people wanted to protect.",
        "C1": "The neighborhood park had not become dirty all at once; it had changed slowly, one bottle and one forgotten bag at a time. On Saturday, the neighbors decided to reverse that story. They arrived with gloves, trash bags, and a little uncertainty about whether anyone else would help. By midmorning, strangers were working side by side. When a child uncovered yellow flowers near the path, everyone stopped to look. The cleanup gave the park back its color, and the neighbors back their sense of ownership.",
    },
    "post-office-package-01": {
        "A1-A2": "Ruben brought a package to the post office for his sister. He did not know which label to use. The clerk helped him choose one and weigh the box. Ruben mailed the package and sent his sister a happy message.",
        "B1-B2": "Ruben wanted to mail a birthday gift to his sister, but the post office had too many labels and choices. He held the box and looked confused. The clerk asked where it was going, weighed it, and showed him the right option. Ruben paid, watched the label go on the box, and felt relieved. His sister would not get the gift early, but it would arrive.",
        "C1": "Ruben had wrapped the gift carefully, but mailing it turned out to be the part that made him nervous. The post office counter was busy, and every label seemed designed for someone who already knew the answer. The clerk asked a few simple questions, weighed the package, and explained the delivery choices without rushing him. When the label finally stuck to the box, Ruben felt as if the gift had begun its own small journey. He stepped outside and texted his sister, not what he had sent, but that something was on the way.",
    },
    "empty-busy-playground-01": {
        "A1-A2": "In the morning, the playground was empty and quiet. After school, children ran to the swings and slide. One shy boy stood near the gate. A girl invited him to play, and soon the playground was full of noise.",
        "B1-B2": "The playground was silent before school ended. The swings moved only when the wind pushed them. Then the first children arrived, and the empty space changed quickly. One boy stayed near the gate because he did not know anyone. A girl saw him watching and asked if he wanted to join the game. By the time parents came to pick everyone up, the boy was laughing near the slide.",
        "C1": "In the morning, the playground looked almost forgotten: empty swings, a quiet slide, and a gate waiting for footsteps. After school, the space filled with movement, but not everyone entered the noise easily. A boy stood near the edge, unsure how to become part of a group that already seemed complete. A girl noticed him and made the invitation simple: one game, one turn, one chance. The playground grew busy, but the real change was smaller. One child stopped feeling invisible.",
    },
    "community-garden-01": {
        "A1-A2": "Neighbors met in the community garden on Sunday. Ana planted tomatoes, and Mr. Green watered the flowers. A child found the first small strawberry. Everyone smiled because the garden was growing.",
        "B1-B2": "The community garden began as an empty corner between two buildings. On Sunday, the neighbors met there with tools, seeds, and old gloves. Ana planted tomatoes while Mr. Green fixed a loose wooden box. A child found the first small strawberry and called everyone over. The garden was not finished, but it already felt alive. The neighbors left tired and happy.",
        "C1": "The community garden had started as a practical idea: turn unused land into something useful. Over time, it became more than vegetables. On Sunday, neighbors who rarely spoke in the hallway worked side by side, sharing tools and advice. Ana planted tomatoes, Mr. Green repaired a box, and a child discovered a strawberry so small everyone laughed. The harvest was still weeks away, but something had already grown. The garden gave the neighborhood a reason to meet.",
    },
    "video-call-problem-01": {
        "A1-A2": "Nora joined an important video call, but no one could hear her. She checked the button and looked worried. Her brother pointed to the microphone setting. Nora fixed it and said hello just in time.",
        "B1-B2": "Nora prepared for her video call all morning, but when the meeting started, her microphone did not work. She waved at the screen while everyone waited. Her brother noticed the problem from across the room and pointed to the settings. Nora clicked the right button, tested her voice, and finally joined the conversation. The call began late, but her idea was still heard.",
        "C1": "Nora had practiced her presentation until every sentence felt ready, which made the silent microphone especially cruel. On screen, her colleagues watched her smile, gesture, and slowly panic. Her brother, passing behind the desk, noticed the muted setting before she did. One click brought her voice back into the room. Nora apologized, took a breath, and began. The technical problem had stolen two minutes, but it had not stolen her preparation.",
    },
    "calendar-mistake-01": {
        "A1-A2": "Iris thought her appointment was on Thursday. Then she checked her calendar and saw it was today. She called quickly and changed her plan. Iris arrived on time because she fixed the mistake early.",
        "B1-B2": "Iris was drinking coffee when a reminder appeared on her phone. She stared at it twice. The appointment she thought was on Thursday was actually that afternoon. For one minute, she panicked. Then she called work, moved one task, and packed her bag. She reached the office with five minutes to spare. The calendar mistake became a warning, not a disaster.",
        "C1": "Iris trusted her memory until her phone quietly proved it wrong. The appointment she had been saving for Thursday was scheduled for that very afternoon. Panic arrived first, followed by the urge to blame the calendar. Instead, Iris checked the details, rearranged her work, and left earlier than planned. She arrived with only five minutes to spare, but five minutes was enough. The mistake did not disappear; it became the reason she started checking tomorrow before ending today.",
    },
    "online-form-help-01": {
        "A1-A2": "Mrs. Chen needed to finish an online form, but one question confused her. Her neighbor sat beside her and read it slowly. They filled in the answer together. Mrs. Chen clicked send and smiled.",
        "B1-B2": "Mrs. Chen had almost finished the online form when the final page asked for information she did not understand. She wanted to close the computer. Her neighbor Ben came over and helped her read each question. He did not type for her; he explained, and she chose the answers. When Mrs. Chen clicked send, she felt proud because the form was truly hers.",
        "C1": "Mrs. Chen disliked online forms because they made simple tasks feel suddenly official and unforgiving. She reached the final page, saw a question she did not understand, and nearly gave up. Her neighbor Ben pulled up a chair and slowed the process down. He explained the words, waited for her decisions, and let her control the keyboard. When the confirmation appeared, Mrs. Chen smiled with relief. The help had not taken independence away; it had returned it.",
    },
    "dead-charged-phone-01": {
        "A1-A2": "Leo wanted to call his mother, but his phone was dead. He found a charger and waited near the wall. After a few minutes, the screen turned on. Leo called his mother and told her he was safe.",
        "B1-B2": "Leo reached for his phone to call his mother and saw a black screen. The battery was dead, and he had promised to check in after school. He searched his backpack and found the charger at the bottom. While the phone charged, he watched the screen nervously. When it turned on, he called right away. His mother was not angry; she was just glad to hear his voice.",
        "C1": "Leo's dead phone turned a small promise into a small crisis. He had told his mother he would call after school, and the black screen made him imagine her worry growing minute by minute. He found the charger tangled at the bottom of his backpack and waited beside the outlet as if patience could speed electricity. When the phone finally woke up, he called before checking any messages. His mother's first words were simple relief, and Leo learned that staying connected sometimes begins with being prepared.",
    },
    "appointment-confirmation-01": {
        "A1-A2": "Marta sat at the kitchen table and checked her phone. Her appointment was tomorrow morning. She pressed confirm and wrote the time on a paper. Then she put her keys beside the door so she would be ready.",
        "B1-B2": "Marta almost ignored the appointment message because she was making dinner. Then she remembered missing an appointment once before. She sat at the table, read the time carefully, and pressed confirm. After that, she wrote the address on a paper and placed her keys near the door. The next morning would still be busy, but one important thing was already prepared.",
        "C1": "Marta was in the middle of an ordinary evening when the appointment reminder appeared. In the past, she might have trusted herself to remember it later, which usually meant remembering too late. This time, she stopped what she was doing, confirmed the appointment, wrote down the time, and placed her keys where she would see them in the morning. Nothing dramatic happened, and that was the point. A quiet decision at the kitchen table protected tomorrow from unnecessary stress.",
    },
}


LEVEL_METADATA = {
    "A1-A2": {
        "cefrRange": ["A1", "A2"],
        "teachingFocus": ["simple_story_sequence", "everyday_vocabulary", "basic_listening"],
    },
    "B1-B2": {
        "cefrRange": ["B1", "B2"],
        "teachingFocus": ["story_sequence", "reasons_and_reactions", "problem_solution"],
    },
    "C1": {
        "cefrRange": ["C1"],
        "teachingFocus": ["nuanced_storytelling", "inference", "natural_listening"],
    },
}


BAD_DESCRIPTION_PATTERNS = [
    "This scene shows",
    "This picture has two parts",
    "This is a short story about",
    "The image presents",
    "The two panels show",
    "The story shows",
    "This scene turns",
    "The contrast in",
    "This wordless story presents",
    "The listener can",
    "The learner can",
]


def clean_text(value: str) -> str:
    return " ".join(value.split())


def title_for_scene(scene_title: str, level: str) -> str:
    suffix = {
        "A1-A2": "Simple Story",
        "B1-B2": "Everyday Story",
        "C1": "Nuanced Story",
    }[level]
    return f"{scene_title} - {suffix}"


def update_script(script: dict, scene: dict, level: str, audio_metadata: dict | None) -> dict:
    text = clean_text(STORY_TEXTS[scene["id"]][level])
    words = text.split()
    script.update(
        {
            "title": title_for_scene(scene["title"], level),
            "status": "generated" if audio_metadata else "text_ready",
            "level": level,
            "cefrRange": LEVEL_METADATA[level]["cefrRange"],
            "scriptType": "narration",
            "source": "codex-authored-story-rewrite",
            "teachingFocus": LEVEL_METADATA[level]["teachingFocus"],
            "speakers": [NARRATOR],
            "transcript": [{"turn": 1, "speakerId": "narrator", "text": text}],
            "plainText": text,
            "stats": {
                "characterCount": len(text),
                "wordCount": len(words),
                "turnCount": 1,
            },
            "qaNotes": [
                "Rewritten as a microstory with setup, complication, action, and resolution.",
                "Avoids instructional phrases such as image, learner, listener, or panel references in the spoken transcript.",
            ],
        }
    )
    if audio_metadata:
        script["audio"] = audio_metadata
    else:
        script.pop("audio", None)
    return script


def validate_no_description_phrases(scripts: list[dict]) -> None:
    failures = []
    target_ids = set(STORY_TEXTS)
    for script in scripts:
        if script["sceneImageId"] not in target_ids:
            continue
        text = script["plainText"]
        if any(pattern in text for pattern in BAD_DESCRIPTION_PATTERNS):
            failures.append(script["id"])
    if failures:
        raise RuntimeError(f"Descriptive phrasing remains in rewritten scripts: {failures}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-audio", action="store_true", help="Only rewrite text metadata.")
    parser.add_argument("--force-audio", action="store_true", help="Regenerate audio even if it exists.")
    args = parser.parse_args()

    scene_registry = json.loads(SCENE_IMAGES_PATH.read_text())
    scene_by_id = {scene["id"]: scene for scene in scene_registry["images"]}
    registry = json.loads(OUTPUT_REGISTRY.read_text())
    scripts = registry["scripts"]

    api_key = None if args.no_audio else get_api_key()
    rewritten_count = 0
    rewritten_duration = 0.0
    rewritten_cost = 0.0

    for script in scripts:
        scene_id = script["sceneImageId"]
        level = script["level"]
        if scene_id not in STORY_TEXTS:
            continue
        scene = scene_by_id[scene_id]
        script_for_audio = {
            "sceneImageId": scene_id,
            "level": level,
            "scriptType": "narration",
            "title": title_for_scene(scene["title"], level),
            "teachingFocus": LEVEL_METADATA[level]["teachingFocus"],
            "speakers": [NARRATOR],
            "transcript": [("narrator", clean_text(STORY_TEXTS[scene_id][level]))],
        }
        audio_metadata = None
        if api_key:
            print(f"Regenerating {script_id(scene_id, level)}", flush=True)
            audio_metadata = generate_audio(script_for_audio, api_key, force=args.force_audio)
            rewritten_duration += audio_metadata["durationSeconds"]
            rewritten_cost += audio_metadata["estimatedCostUsd"]
        update_script(script, scene, level, audio_metadata)
        rewritten_count += 1

    validate_no_description_phrases(scripts)

    total_duration = sum(float(script.get("audio", {}).get("durationSeconds", 0)) for script in scripts)
    total_cost = sum(float(script.get("audio", {}).get("estimatedCostUsd", 0)) for script in scripts)
    registry["generatedAt"] = "2026-07-05"
    registry["defaultProvider"] = PROVIDER
    registry["defaultTtsModel"] = MODEL
    registry["batchSummary"]["scriptCount"] = len(scripts)
    registry["batchSummary"]["totalAudioDurationSeconds"] = round(total_duration, 2)
    registry["batchSummary"]["estimatedTotalCostUsd"] = round(total_cost, 6)
    registry["batchSummary"]["rewrittenStoryScriptCount"] = rewritten_count
    registry["batchSummary"]["rewrittenStoryAudioDurationSeconds"] = round(rewritten_duration, 2)
    registry["batchSummary"]["rewrittenStoryEstimatedCostUsd"] = round(rewritten_cost, 6)

    OUTPUT_REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    print(f"Rewritten scripts: {rewritten_count}", flush=True)
    print(f"Wrote {OUTPUT_REGISTRY}", flush=True)


if __name__ == "__main__":
    main()
