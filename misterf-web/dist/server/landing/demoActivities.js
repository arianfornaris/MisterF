const evaluationInstructions = [
    'Evaluate meaning and usefulness before form. Accept minor spelling and',
    'punctuation slips when the sentence is understandable, and say what was',
    'good before what needs work. Keep feedback short, concrete, and encouraging;',
    'these are adult learners practicing situations they meet in real life.',
].join(' ');
export const landingDemoActivities = [
    {
        slug: 'first-day-personal-information',
        draft: {
            title: 'Your first day: personal information',
            description: 'The questions you answer on your first day at a new job, and how to answer them clearly.',
            targetTopic: 'Giving personal information at work',
            level: 'A1',
            instructions: 'Four short exercises about the questions people ask you on your first day at work.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_name',
                    item: {
                        kind: 'quiz_fill_in_the_blank_choice',
                        prompt: 'Complete the sentence.',
                        sentence: 'My {{blank}} name is Maria and my {{blank}} name is Perez.',
                        blanks: [
                            { choices: ['first', 'last', 'other'], acceptableAnswers: ['first'] },
                            { choices: ['first', 'last', 'other'], acceptableAnswers: ['last'] },
                        ],
                    },
                },
                {
                    id: 'block_phone',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: "Your manager asks: “What's your phone number?” Which answer is correct?",
                        selectionMode: 'single',
                        options: [
                            "It's 305-555-0142.",
                            "I'm 305-555-0142.",
                            'My phone is number 305-555-0142.',
                            'Phone 305-555-0142 is.',
                        ],
                        correctOptions: ["It's 305-555-0142."],
                    },
                },
                {
                    id: 'block_questions',
                    item: {
                        kind: 'quiz_matching_pairs',
                        prompt: 'Match each question with a natural answer.',
                        leftItems: [
                            'Where are you from?',
                            'How do you spell your last name?',
                            "What's your address?",
                            'When can you start?',
                        ],
                        rightItems: [
                            "I'm from Haiti.",
                            'P-E-R-E-Z.',
                            '1420 NW 7th Street.',
                            'Next Monday.',
                        ],
                        correctPairs: [
                            { left: 'Where are you from?', right: "I'm from Haiti." },
                            { left: 'How do you spell your last name?', right: 'P-E-R-E-Z.' },
                            { left: "What's your address?", right: '1420 NW 7th Street.' },
                            { left: 'When can you start?', right: 'Next Monday.' },
                        ],
                    },
                },
                {
                    id: 'block_ready',
                    item: {
                        kind: 'quiz_unscramble_sentence',
                        prompt: 'Put the words in order to tell your manager when you can begin.',
                        tokens: ['I', 'am', 'ready', 'to', 'start', 'on', 'Monday'],
                        acceptableAnswers: ['I am ready to start on Monday.'],
                    },
                },
            ],
        },
    },
    {
        slug: 'bus-and-directions',
        draft: {
            title: 'Taking the bus and asking for directions',
            description: 'Ask whether a bus goes where you need, and understand the directions people give you.',
            targetTopic: 'Public transport and directions',
            level: 'A1',
            instructions: 'Four exercises about getting somewhere by bus and asking for directions in the street.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_ask_bus',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'You want to know if this bus goes downtown. What do you ask?',
                        selectionMode: 'single',
                        options: [
                            'Does this bus go downtown?',
                            'This bus go downtown?',
                            'Is this bus goes downtown?',
                            'Do this bus goes downtown?',
                        ],
                        correctOptions: ['Does this bus go downtown?'],
                    },
                },
                {
                    id: 'block_stop',
                    item: {
                        kind: 'quiz_fill_in_the_blank_choice',
                        prompt: 'Complete the directions.',
                        sentence: 'The bus stop is {{blank}} the pharmacy, {{blank}} 8th Street.',
                        blanks: [
                            {
                                choices: ['in front of', 'inside', 'under'],
                                acceptableAnswers: ['in front of'],
                            },
                            { choices: ['on', 'in', 'at'], acceptableAnswers: ['on'] },
                        ],
                    },
                },
                {
                    id: 'block_meaning',
                    item: {
                        kind: 'quiz_matching_pairs',
                        prompt: 'Match each direction with what it means.',
                        leftItems: [
                            'Turn right at the light.',
                            'Go two blocks and stop.',
                            "It's across from the bank.",
                            "It's on the corner.",
                        ],
                        rightItems: [
                            'Change direction at the traffic light.',
                            'Walk two streets, then stop.',
                            'It is on the other side of the street from the bank.',
                            'It is where two streets meet.',
                        ],
                        correctPairs: [
                            {
                                left: 'Turn right at the light.',
                                right: 'Change direction at the traffic light.',
                            },
                            {
                                left: 'Go two blocks and stop.',
                                right: 'Walk two streets, then stop.',
                            },
                            {
                                left: "It's across from the bank.",
                                right: 'It is on the other side of the street from the bank.',
                            },
                            {
                                left: "It's on the corner.",
                                right: 'It is where two streets meet.',
                            },
                        ],
                    },
                },
                {
                    id: 'block_dialogue',
                    item: {
                        kind: 'quiz_order_sentences',
                        prompt: 'Put the conversation with the bus driver in order.',
                        sentences: [
                            'Excuse me, does this bus go to the hospital?',
                            'Yes, it does.',
                            'How many stops is it?',
                            "Four stops. I'll tell you when we get there.",
                            'Thank you very much.',
                        ],
                    },
                },
            ],
        },
    },
    {
        slug: 'clinic-appointment',
        draft: {
            title: 'Making a clinic appointment',
            description: 'Call a clinic, ask for an appointment, and explain when you can come and why you need it.',
            targetTopic: 'Health appointments by phone',
            level: 'A2',
            instructions: 'Four exercises about calling a clinic and booking an appointment for yourself.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_request',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete the polite request.',
                        sentence: 'I ___ like to make an appointment with Dr. Ramirez.',
                        blanks: [{ acceptableAnswers: ['would', "'d", 'would '] }],
                    },
                },
                {
                    id: 'block_new_patient',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'The receptionist asks: “Have you been here before?” You are a new patient. Which answer is correct?',
                        selectionMode: 'single',
                        options: [
                            'No, this is my first time.',
                            'No, I am not been here.',
                            'Yes, I am new.',
                            "No, I don't have been here.",
                        ],
                        correctOptions: ['No, this is my first time.'],
                    },
                },
                {
                    id: 'block_afternoon',
                    item: {
                        kind: 'quiz_unscramble_sentence',
                        prompt: 'Put the words in order to ask for a different time.',
                        tokens: ['Can', 'I', 'come', 'in', 'the', 'afternoon', 'instead'],
                        acceptableAnswers: ['Can I come in the afternoon instead?'],
                    },
                },
                {
                    id: 'block_explain',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Write two or three sentences explaining why you need the appointment and when you can come.',
                        placeholder: 'I need to see the doctor because…',
                        rubric: 'Look for a clear reason and a clear time. Present tenses are enough at this level.',
                    },
                },
            ],
        },
    },
    {
        slug: 'grocery-shopping',
        draft: {
            title: 'At the grocery store',
            description: 'Understand quantities, ask an employee for help, and check a price without hesitating.',
            targetTopic: 'Shopping for food',
            level: 'A2',
            instructions: 'Four exercises about shopping for food and asking staff for help.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_quantities',
                    item: {
                        kind: 'quiz_matching_pairs',
                        prompt: 'Match each quantity with what it means.',
                        leftItems: ['a dozen', 'half a pound', 'a bunch', 'a gallon'],
                        rightItems: [
                            'twelve of something',
                            'about 225 grams',
                            'a group of bananas tied together',
                            'the big container milk usually comes in',
                        ],
                        correctPairs: [
                            { left: 'a dozen', right: 'twelve of something' },
                            { left: 'half a pound', right: 'about 225 grams' },
                            { left: 'a bunch', right: 'a group of bananas tied together' },
                            {
                                left: 'a gallon',
                                right: 'the big container milk usually comes in',
                            },
                        ],
                    },
                },
                {
                    id: 'block_find',
                    item: {
                        kind: 'quiz_fill_in_the_blank_choice',
                        prompt: 'Complete what you say to an employee.',
                        sentence: "Excuse me, {{blank}} is the rice? I can't {{blank}} it.",
                        blanks: [
                            { choices: ['where', 'what', 'how'], acceptableAnswers: ['where'] },
                            { choices: ['find', 'found', 'finding'], acceptableAnswers: ['find'] },
                        ],
                    },
                },
                {
                    id: 'block_polite',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'Which two sentences are polite ways to ask an employee for help?',
                        selectionMode: 'multiple',
                        options: [
                            'Could you help me find the rice, please?',
                            'Where the rice is?',
                            'Excuse me, do you know where the rice is?',
                            'Give me the rice.',
                        ],
                        correctOptions: [
                            'Could you help me find the rice, please?',
                            'Excuse me, do you know where the rice is?',
                        ],
                    },
                },
                {
                    id: 'block_price',
                    item: {
                        kind: 'quiz_unscramble_sentence',
                        prompt: 'Put the words in order to ask for a price.',
                        tokens: ['How', 'much', 'does', 'this', 'cost'],
                        acceptableAnswers: ['How much does this cost?'],
                    },
                },
            ],
        },
    },
    {
        slug: 'daily-routine-and-shifts',
        draft: {
            title: 'Your routine and your work schedule',
            description: 'Talk about your day and your shift: when you start, what you do, and when you finish.',
            targetTopic: 'Daily routine and work schedules',
            level: 'A2',
            instructions: 'Four exercises about describing your day and your working hours to someone new.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_morning',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete the sentence about your morning.',
                        sentence: 'I ___ up at six o’clock and I ___ to work at seven.',
                        blanks: [
                            { acceptableAnswers: ['get', 'wake'] },
                            { acceptableAnswers: ['go', 'drive', 'walk'] },
                        ],
                    },
                },
                {
                    id: 'block_week',
                    item: {
                        kind: 'quiz_unscramble_sentence',
                        prompt: 'Put the words in order to describe your week.',
                        tokens: ['I', 'work', 'from', 'Monday', 'to', 'Friday'],
                        acceptableAnswers: ['I work from Monday to Friday.'],
                    },
                },
                {
                    id: 'block_finish',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'A coworker asks: “What time do you finish?” Which answer is correct?',
                        selectionMode: 'single',
                        options: [
                            'I finish at four thirty.',
                            'I am finish at four thirty.',
                            'I finishing at four thirty.',
                            'I do finish four thirty.',
                        ],
                        correctOptions: ['I finish at four thirty.'],
                    },
                },
                {
                    id: 'block_describe_day',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Describe a normal day at work: what time you start, what you do, and what time you finish.',
                        placeholder: 'I start at…',
                        rubric: 'Look for present simple, clear times, and at least three activities in order.',
                    },
                },
            ],
        },
    },
    {
        slug: 'apartment-rental-call',
        draft: {
            title: 'Calling about an apartment',
            description: 'Ask the right questions about rent, utilities, and deposits, then follow up in writing.',
            targetTopic: 'Renting a place to live',
            level: 'B1',
            instructions: 'Two parts: the phone call first, then the message you send afterwards.',
            evaluationInstructions,
            sections: [
                {
                    id: 'section_call',
                    title: 'The phone call',
                    instructions: 'You are calling about an apartment you saw advertised.',
                },
                {
                    id: 'section_message',
                    title: 'The message afterwards',
                    instructions: 'Now put your request in writing.',
                },
            ],
            blocks: [
                {
                    id: 'block_call_order',
                    sectionId: 'section_call',
                    item: {
                        kind: 'quiz_order_sentences',
                        prompt: 'Put the phone call in order.',
                        sentences: [
                            "Hi, I'm calling about the apartment on Flagler Street. Is it still available?",
                            'Yes, it is. Are you looking for a one bedroom or a two bedroom?',
                            'A one bedroom, please. How much is the rent?',
                            "It's 1,450 a month, and utilities are not included.",
                            'Could I see it this weekend?',
                        ],
                    },
                },
                {
                    id: 'block_deposit',
                    sectionId: 'section_call',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete the question about the deposit.',
                        sentence: 'Is the deposit ___ in the first month’s rent, or do I pay it ___?',
                        blanks: [
                            { acceptableAnswers: ['included'] },
                            { acceptableAnswers: ['separately', 'apart', 'separate'] },
                        ],
                    },
                },
                {
                    id: 'block_monthly',
                    sectionId: 'section_call',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'Which question asks about what you pay every month besides the rent?',
                        selectionMode: 'single',
                        options: [
                            'What utilities do I have to pay?',
                            'How many bedrooms does it have?',
                            'When was the building built?',
                            'Is there parking on the street?',
                        ],
                        correctOptions: ['What utilities do I have to pay?'],
                    },
                },
                {
                    id: 'block_message',
                    sectionId: 'section_message',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Write a short message to the landlord asking to see the apartment. Say who you are, when you can visit, and ask them to confirm.',
                        placeholder: 'Hello, my name is…',
                        rubric: 'Look for a greeting, a clear request, a specific time, and a polite closing.',
                    },
                },
            ],
        },
    },
    {
        slug: 'billing-problem',
        draft: {
            title: 'A problem with a bill',
            description: 'Report a charge that is wrong without sounding aggressive, and ask for what you need.',
            targetTopic: 'Complaining politely about a service',
            level: 'B1',
            instructions: 'Four exercises about explaining a billing mistake and asking the company to fix it.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_opening',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'You were charged twice. Which sentence is the best way to start the call?',
                        selectionMode: 'single',
                        options: [
                            'I think there may be a mistake on my bill.',
                            "You charged me twice, that's wrong.",
                            'Your company stole my money.',
                            'Fix my bill now.',
                        ],
                        correctOptions: ['I think there may be a mistake on my bill.'],
                    },
                },
                {
                    id: 'block_refund',
                    item: {
                        kind: 'quiz_fill_in_the_blank_choice',
                        prompt: 'Complete the explanation.',
                        sentence: 'I {{blank}} charged twice for the same service, so I would like a {{blank}}.',
                        blanks: [
                            { choices: ['was', 'were', 'am'], acceptableAnswers: ['was'] },
                            {
                                choices: ['refund', 'discount', 'receipt'],
                                acceptableAnswers: ['refund'],
                            },
                        ],
                    },
                },
                {
                    id: 'block_check',
                    item: {
                        kind: 'quiz_unscramble_sentence',
                        prompt: 'Put the words in order to ask them to check.',
                        tokens: ['Could', 'you', 'check', 'my', 'account', 'please'],
                        acceptableAnswers: ['Could you check my account, please?'],
                    },
                },
                {
                    id: 'block_explain_problem',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Explain the problem in three or four sentences: what happened, when, and what you would like the company to do.',
                        placeholder: 'I am calling because…',
                        rubric: 'Look for past tenses for what happened, a clear request, and a polite tone throughout.',
                    },
                },
            ],
        },
    },
    {
        slug: 'job-interview-experience',
        draft: {
            title: 'Talking about your experience in an interview',
            description: 'Answer the questions that open almost every interview, including the difficult one.',
            targetTopic: 'Job interviews',
            level: 'B1',
            instructions: 'Four exercises about presenting your experience to an interviewer.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_interview_order',
                    item: {
                        kind: 'quiz_order_sentences',
                        prompt: 'Put the beginning of the interview in order.',
                        sentences: [
                            'Thanks for coming in. Tell me a little about yourself.',
                            "I've been working in construction for six years, mostly on houses.",
                            'What made you apply for this position?',
                            "I'm looking for a team where I can use my experience and keep learning.",
                            "That's good to hear. Do you have any questions for me?",
                        ],
                    },
                },
                {
                    id: 'block_experience',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete the answer.',
                        sentence: 'I ___ worked as a cook for five years, and I ___ still learning new recipes.',
                        blanks: [
                            { acceptableAnswers: ['have', "'ve"] },
                            { acceptableAnswers: ['am', "'m"] },
                        ],
                    },
                },
                {
                    id: 'block_weakness',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'The interviewer asks about a weakness. Which answer works best?',
                        selectionMode: 'single',
                        options: [
                            'I used to have trouble asking for help, so now I check in with my supervisor early.',
                            "I don't have any weaknesses.",
                            "I'm always late, but everybody is.",
                            "I don't like working with people.",
                        ],
                        correctOptions: [
                            'I used to have trouble asking for help, so now I check in with my supervisor early.',
                        ],
                    },
                },
                {
                    id: 'block_story',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Answer in four or five sentences: “Tell me about a time you solved a problem at work.”',
                        placeholder: 'Last year, at my previous job…',
                        rubric: 'Look for a situation, an action, and a result, told in past tenses.',
                    },
                },
            ],
        },
    },
    {
        slug: 'school-meeting',
        draft: {
            title: 'A meeting at your child’s school',
            description: 'Understand the words the school uses, and ask the teacher for something concrete.',
            targetTopic: 'Talking with your child’s teacher',
            level: 'B2',
            instructions: 'Two parts: first the vocabulary the school uses, then what you say in the meeting.',
            evaluationInstructions,
            sections: [
                {
                    id: 'section_words',
                    title: 'The words they use',
                    instructions: 'These come up in every message the school sends home.',
                },
                {
                    id: 'section_meeting',
                    title: 'In the meeting',
                    instructions: 'You have fifteen minutes with the teacher. Use them well.',
                },
            ],
            blocks: [
                {
                    id: 'block_school_words',
                    sectionId: 'section_words',
                    item: {
                        kind: 'quiz_matching_pairs',
                        prompt: 'Match each term with its meaning.',
                        leftItems: [
                            'report card',
                            'attendance',
                            'tutoring',
                            'parent-teacher conference',
                        ],
                        rightItems: [
                            "the document that shows your child's grades",
                            'how often your child comes to school',
                            'extra help outside normal class time',
                            "a scheduled meeting about your child's progress",
                        ],
                        correctPairs: [
                            {
                                left: 'report card',
                                right: "the document that shows your child's grades",
                            },
                            {
                                left: 'attendance',
                                right: 'how often your child comes to school',
                            },
                            {
                                left: 'tutoring',
                                right: 'extra help outside normal class time',
                            },
                            {
                                left: 'parent-teacher conference',
                                right: "a scheduled meeting about your child's progress",
                            },
                        ],
                    },
                },
                {
                    id: 'block_falling_behind',
                    sectionId: 'section_words',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete what the teacher told you.',
                        sentence: 'The teacher said my son is falling ___ in math and suggested extra ___.',
                        blanks: [
                            { acceptableAnswers: ['behind'] },
                            { acceptableAnswers: ['help', 'support', 'tutoring', 'practice'] },
                        ],
                    },
                },
                {
                    id: 'block_concrete',
                    sectionId: 'section_meeting',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'Which two questions ask the teacher for something concrete?',
                        selectionMode: 'multiple',
                        options: [
                            'Could you tell me exactly what he needs to improve?',
                            'What can we do at home to help him?',
                            "He's a good boy.",
                            'School is difficult.',
                        ],
                        correctOptions: [
                            'Could you tell me exactly what he needs to improve?',
                            'What can we do at home to help him?',
                        ],
                    },
                },
                {
                    id: 'block_say_to_teacher',
                    sectionId: 'section_meeting',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Write what you would say to the teacher: describe one thing you have noticed at home, and ask for one specific suggestion.',
                        placeholder: "I've noticed that at home he…",
                        rubric: 'Look for one concrete observation and one clear, answerable question.',
                    },
                },
            ],
        },
    },
    {
        slug: 'workplace-safety-and-time-off',
        draft: {
            title: 'Reporting a problem and asking for time off',
            description: 'Raise a safety problem with your supervisor and request a day off without losing the shift.',
            targetTopic: 'Speaking up at work',
            level: 'B2',
            instructions: 'Four exercises about two conversations every worker eventually needs.',
            evaluationInstructions,
            sections: [],
            blocks: [
                {
                    id: 'block_report',
                    item: {
                        kind: 'quiz_fill_in_the_blank_input',
                        prompt: 'Complete the sentence.',
                        sentence: 'I’d like to ___ a safety problem: the floor near the freezer is always ___.',
                        blanks: [
                            { acceptableAnswers: ['report', 'mention', 'raise'] },
                            { acceptableAnswers: ['wet', 'slippery'] },
                        ],
                    },
                },
                {
                    id: 'block_supervisor_talk',
                    item: {
                        kind: 'quiz_order_sentences',
                        prompt: 'Put the conversation with your supervisor in order.',
                        sentences: [
                            "Do you have a minute? I'd like to talk about something at work.",
                            "Sure, what's going on?",
                            'The floor near the freezer is wet most of the day, and someone almost fell yesterday.',
                            "Thanks for telling me. I'll ask maintenance to look at it today.",
                            'I appreciate it. Should I write a report as well?',
                        ],
                    },
                },
                {
                    id: 'block_time_off',
                    item: {
                        kind: 'quiz_multiple_choice',
                        prompt: 'You need Friday off for a medical appointment. Which request works best at work?',
                        selectionMode: 'single',
                        options: [
                            'Would it be possible to take Friday off? I have a medical appointment.',
                            "I'm not coming on Friday.",
                            'I need Friday, okay?',
                            'Can I no work Friday?',
                        ],
                        correctOptions: [
                            'Would it be possible to take Friday off? I have a medical appointment.',
                        ],
                    },
                },
                {
                    id: 'block_email',
                    item: {
                        kind: 'quiz_open_text',
                        prompt: 'Write a short email to your supervisor asking for a day off. Give the reason, the date, and offer a solution for your shift.',
                        placeholder: 'Hi Sandra, I’m writing to ask…',
                        rubric: 'Look for a clear subject in the first line, a specific date, and an offer that solves the shift.',
                    },
                },
            ],
        },
    },
];
//# sourceMappingURL=demoActivities.js.map