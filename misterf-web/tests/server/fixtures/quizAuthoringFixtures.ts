/**
 * Representative model outputs for the quiz authoring/evaluation LLM flows.
 *
 * These fixtures stand in for live inference: the valid ones mirror what the
 * system prompts in `system-prompts/resources/quiz-*.md` and
 * `system-prompts/tutor/quiz-result-evaluation.md` ask the model to emit; the
 * broken ones reproduce failure patterns observed in real responses (markdown
 * fences, leaked prose, schema drift). Keep them in sync with
 * `quizDraftSchema` and `quizResultEvaluationsSchema` when the contract
 * changes.
 */

export const quizItemKinds = [
  'quiz_open_text',
  'quiz_translate_to_english',
  'quiz_understand_in_spanish',
  'quiz_fill_in_the_blank_input',
  'quiz_fill_in_the_blank_choice',
  'quiz_multiple_choice',
  'quiz_matching_pairs',
  'quiz_unscramble_sentence',
  'quiz_order_sentences',
] as const;

export const validQuizDraft: Record<string, unknown> = {
  blocks: [
    {
      id: 'open-1',
      item: {
        kind: 'quiz_open_text',
        placeholder: 'I wake up at...',
        prompt: 'Describe your morning routine in two sentences.',
      },
      sectionId: 'routines',
    },
    {
      id: 'translate-1',
      item: {
        acceptableAnswers: ['I wake up at seven.'],
        kind: 'quiz_translate_to_english',
        prompt: 'Traduce la oración al inglés.',
        sentence: 'Me despierto a las siete.',
      },
      sectionId: 'routines',
    },
    {
      id: 'understand-1',
      item: {
        acceptableAnswers: ['Se cepilla los dientes después del desayuno.'],
        kind: 'quiz_understand_in_spanish',
        prompt: 'Explica en español qué significa la oración.',
        sentence: 'She brushes her teeth after breakfast.',
      },
    },
    {
      id: 'blank-input-1',
      item: {
        blanks: [{ acceptableAnswers: ['goes', 'walks'] }],
        kind: 'quiz_fill_in_the_blank_input',
        prompt: 'Complete the sentence.',
        sentence: 'He ___ to work every day.',
      },
    },
    {
      id: 'blank-choice-1',
      item: {
        blanks: [{ acceptableAnswers: ['have'], choices: ['have', 'has'] }],
        kind: 'quiz_fill_in_the_blank_choice',
        prompt: 'Choose the correct word.',
        sentence: 'They {{blank}} dinner at eight.',
      },
    },
    {
      id: 'choice-1',
      item: {
        correctOptions: ['She goes to school.'],
        kind: 'quiz_multiple_choice',
        options: ['She go to school.', 'She goes to school.'],
        prompt: 'Which sentence is correct?',
        selectionMode: 'single',
      },
    },
    {
      id: 'pairs-1',
      item: {
        correctPairs: [
          { left: 'wake up', right: '7:00' },
          { left: 'have lunch', right: '12:30' },
        ],
        kind: 'quiz_matching_pairs',
        leftItems: ['wake up', 'have lunch'],
        prompt: 'Match each routine with its time.',
        rightItems: ['7:00', '12:30'],
      },
    },
    {
      id: 'unscramble-1',
      item: {
        acceptableAnswers: ['I wake up at seven'],
        kind: 'quiz_unscramble_sentence',
        prompt: 'Order the words to build a sentence.',
        tokens: ['I', 'at', 'seven', 'wake', 'up'],
      },
    },
    {
      id: 'order-1',
      item: {
        kind: 'quiz_order_sentences',
        prompt: 'Order the steps of the morning routine.',
        sentences: ['I wake up.', 'I take a shower.', 'I have breakfast.'],
      },
    },
  ],
  description: 'Practice present simple with daily routines.',
  evaluationInstructions: 'Accept minor spelling mistakes in open answers.',
  instructions: 'Answer every question in English.',
  level: 'A2',
  sections: [
    {
      id: 'routines',
      instructions: 'Use vocabulary about daily routines.',
      title: 'Routines',
    },
  ],
  targetTopic: 'daily routines',
  title: 'Daily Routines Quiz',
};

/** The extra block a single-block generation request would add. */
export const additionalOrderSentencesBlock: Record<string, unknown> = {
  id: 'order-2',
  item: {
    kind: 'quiz_order_sentences',
    prompt: 'Order the steps of the evening routine.',
    sentences: ['I have dinner.', 'I brush my teeth.', 'I go to bed.'],
  },
};

export const validQuizRevision: Record<string, unknown> = {
  assistantMessage: 'Cambié la pregunta de opción múltiple como pediste.',
  draft: validQuizDraft,
};

/**
 * Revision response that adds one block: the shape single-block generation
 * produces, since block additions travel through the revision contract.
 */
export const blockAdditionQuizRevision: Record<string, unknown> = {
  assistantMessage: 'Agregué un nuevo ejercicio de ordenar oraciones.',
  draft: {
    ...validQuizDraft,
    blocks: [
      ...(validQuizDraft.blocks as unknown[]),
      additionalOrderSentencesBlock,
    ],
  },
};

/** Two-item draft used to build the evaluation input quiz block. */
export const smallQuizDraft: Record<string, unknown> = {
  blocks: [
    (validQuizDraft.blocks as Record<string, unknown>[])[0],
    (validQuizDraft.blocks as Record<string, unknown>[])[5],
  ].map((block) => ({ ...block, sectionId: undefined })),
  description: 'Short quiz.',
  evaluationInstructions: '',
  instructions: 'Answer in English.',
  level: 'A2',
  sections: [],
  targetTopic: 'daily routines',
  title: 'Short Routines Quiz',
};

export const validQuizEvaluation: Record<string, unknown> = {
  items: [
    {
      feedback: 'Buena descripción, verbos en presente bien usados.',
      status: 'correct',
    },
    {
      feedback: 'Elegiste la oración con el verbo mal conjugado.',
      status: 'incorrect',
    },
  ],
};

/** Missing required `feedback` on the first item. */
export const invalidQuizEvaluation: Record<string, unknown> = {
  items: [
    { status: 'correct' },
    {
      feedback: 'Elegiste la oración con el verbo mal conjugado.',
      status: 'incorrect',
    },
  ],
};

/** Valid JSON wrapped in markdown fences: JSON.parse must fail. */
export const markdownFencedDraftText = [
  '```json',
  JSON.stringify(validQuizDraft, null, 2),
  '```',
].join('\n');

/** Prose mixed with the JSON payload: JSON.parse must fail. */
export const proseWrappedDraftText = [
  'Aquí tienes el quiz que pediste:',
  JSON.stringify(validQuizDraft, null, 2),
].join('\n\n');

/** Parses as JSON but uses an item kind that does not exist. */
export const unknownKindQuizDraft: Record<string, unknown> = {
  ...validQuizDraft,
  blocks: [
    {
      id: 'essay-1',
      item: { kind: 'quiz_essay', prompt: 'Write an essay about your day.' },
    },
    (validQuizDraft.blocks as Record<string, unknown>[])[0],
  ],
};

/** Parses as JSON but repeats a block id. */
export const duplicateBlockIdsQuizDraft: Record<string, unknown> = {
  ...validQuizDraft,
  blocks: [
    (validQuizDraft.blocks as Record<string, unknown>[])[0],
    (validQuizDraft.blocks as Record<string, unknown>[])[0],
  ],
};

/** References a section id that is not declared in sections. */
export const danglingSectionQuizDraft: Record<string, unknown> = {
  ...validQuizDraft,
  blocks: [
    {
      ...(validQuizDraft.blocks as Record<string, unknown>[])[3],
      sectionId: 'missing-section',
    },
    (validQuizDraft.blocks as Record<string, unknown>[])[4],
  ],
};
