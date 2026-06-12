import { z } from 'zod';

function hasExplanation(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

const inlineTextPartSchema = z
  .object({
    text: z.string().trim().min(1).max(2400),
    status: z.enum(['correct', 'improve', 'error']),
    explanation: z.string().trim().max(800).optional(),
  })
  .strict()
  .superRefine((part, ctx) => {
    if (part.status !== 'correct' && !hasExplanation(part.explanation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'explanation is required when status is improve or error.',
        path: ['explanation'],
      });
    }
  });

const inlineBlankReviewSchema = z
  .object({
    status: z.enum(['correct', 'improve', 'error']),
    explanation: z.string().trim().max(800).optional(),
  })
  .strict()
  .superRefine((blank, ctx) => {
    if (blank.status !== 'correct' && !hasExplanation(blank.explanation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'explanation is required when status is improve or error.',
        path: ['explanation'],
      });
    }
  });

const inlineMultipleChoiceOptionReviewSchema = z
  .object({
    text: z.string().trim().min(1).max(400),
    selectedByUser: z.boolean(),
    status: z.enum(['correct', 'neutral', 'missed', 'error']),
    explanation: z.string().trim().max(800).optional(),
  })
  .strict()
  .superRefine((option, ctx) => {
    if ((option.status === 'missed' || option.status === 'error') && !hasExplanation(option.explanation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'explanation is required when status is missed or error.',
        path: ['explanation'],
      });
    }
  });

const inlineMatchingPairReviewSchema = z
  .object({
    left: z.string().trim().min(1).max(600),
    right: z.string().trim().min(1).max(600),
    status: z.enum(['correct', 'error']),
    explanation: z.string().trim().max(800).optional(),
  })
  .strict()
  .superRefine((pair, ctx) => {
    if (pair.status === 'error' && !hasExplanation(pair.explanation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'explanation is required when status is error.',
        path: ['explanation'],
      });
    }
  });

export const genericTutorResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blocks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
  required: ['blocks'],
} as const;

export const translationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedLanguage: {
      type: 'string',
    },
    translatedText: {
      type: 'string',
    },
  },
  required: ['detectedLanguage', 'translatedText'],
} as const;

export const translationResultSchema = z
  .object({
    detectedLanguage: z.string().trim().min(1).max(160),
    translatedText: z.string().trim().min(1).max(8000),
  })
  .strict();

export const messageBlockSchema = z
  .object({
    type: z.literal('message'),
    markdown: z.string().trim().min(1).max(5000),
  })
  .strict();

export const practiceModuleLinkBlockSchema = z
  .object({
    type: z.literal('practice_module_link'),
    practiceModuleId: z.string().trim().min(1),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const dialogueCharacterMessageBlockSchema = z
  .object({
    type: z.literal('dialogue_character_message'),
    name: z.string().trim().min(1).max(120),
    markdown: z.string().trim().min(1).max(3000),
  })
  .strict();

export const dialogueTranscriptBlockSchema = z
  .object({
    type: z.literal('dialogue_transcript'),
    turns: z
      .array(
        z
          .object({
            speaker: z.string().trim().min(1).max(120),
            markdown: z.string().trim().min(1).max(3000),
          })
          .strict(),
      )
      .min(2)
      .max(40),
  })
  .strict();

export const matchingPairsBlockSchema = z
  .object({
    type: z.literal('matching_pairs'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    pairs: z
      .array(
        z
          .object({
            left: z.string().trim().min(1).max(600),
            right: z.string().trim().min(1).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();

const quizOpenTextItemSchema = z
  .object({
    kind: z.literal('quiz_open_text'),
    placeholder: z.string().trim().min(1).max(240).optional(),
    prompt: z.string().trim().min(1).max(1600),
    rubric: z.string().trim().min(1).max(1600).optional(),
  })
  .strict();

const quizTranslateToEnglishItemSchema = z
  .object({
    acceptableAnswers: z.array(z.string().trim().min(1).max(320)).min(1).max(16).optional(),
    kind: z.literal('quiz_translate_to_english'),
    prompt: z.string().trim().min(1).max(1600),
    rubric: z.string().trim().min(1).max(1600).optional(),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

const quizUnderstandInSpanishItemSchema = z
  .object({
    acceptableAnswers: z.array(z.string().trim().min(1).max(320)).min(1).max(16).optional(),
    kind: z.literal('quiz_understand_in_spanish'),
    prompt: z.string().trim().min(1).max(1600),
    rubric: z.string().trim().min(1).max(1600).optional(),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

const quizFillInTheBlankInputItemSchema = z
  .object({
    blanks: z
      .array(
        z
          .object({
            acceptableAnswers: z.array(z.string().trim().min(1).max(240)).min(1).max(16).optional(),
            rubric: z.string().trim().min(1).max(800).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    kind: z.literal('quiz_fill_in_the_blank_input'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict()
  .refine((item) => countSentencePlaceholders(item.sentence, '___') === item.blanks.length, {
    message: 'sentence must contain exactly one ___ placeholder per blanks entry.',
    path: ['sentence'],
  });

const quizFillInTheBlankChoiceItemSchema = z
  .object({
    blanks: z
      .array(
        z
          .object({
            acceptableAnswers: z.array(z.string().trim().min(1).max(240)).min(1).max(16).optional(),
            choices: z.array(z.string().trim().min(1).max(240)).min(2).max(20),
            rubric: z.string().trim().min(1).max(800).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    kind: z.literal('quiz_fill_in_the_blank_choice'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict()
  .refine((item) => countSentencePlaceholders(item.sentence, '{{blank}}') === item.blanks.length, {
    message: 'sentence must contain exactly one {{blank}} placeholder per blanks entry.',
    path: ['sentence'],
  });

const quizMultipleChoiceItemSchema = z
  .object({
    correctOptions: z.array(z.string().trim().min(1).max(400)).min(1).max(16),
    kind: z.literal('quiz_multiple_choice'),
    options: z.array(z.string().trim().min(1).max(400)).min(2).max(16),
    prompt: z.string().trim().min(1).max(1600),
    rubric: z.string().trim().min(1).max(1600).optional(),
    selectionMode: z.enum(['single', 'multiple']),
  })
  .strict()
  .refine((item) => item.correctOptions.every((option) => item.options.includes(option)), {
    message: 'correctOptions must be a subset of options.',
    path: ['correctOptions'],
  })
  .refine((item) => item.selectionMode === 'multiple' || item.correctOptions.length === 1, {
    message: 'multiple_choice with selectionMode "single" must include exactly one correct option.',
    path: ['selectionMode'],
  });

const quizMatchingPairsItemSchema = z
  .object({
    correctPairs: z
      .array(
        z
          .object({
            left: z.string().trim().min(1).max(600),
            right: z.string().trim().min(1).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(24),
    kind: z.literal('quiz_matching_pairs'),
    leftItems: z.array(z.string().trim().min(1).max(600)).min(1).max(24),
    prompt: z.string().trim().min(1).max(1600),
    rightItems: z.array(z.string().trim().min(1).max(600)).min(1).max(24),
    rubric: z.string().trim().min(1).max(1600).optional(),
  })
  .strict()
  .refine((item) => item.correctPairs.every((pair) => item.leftItems.includes(pair.left)), {
    message: 'Every correctPairs.left value must exist in leftItems.',
    path: ['correctPairs'],
  })
  .refine((item) => item.correctPairs.every((pair) => item.rightItems.includes(pair.right)), {
    message: 'Every correctPairs.right value must exist in rightItems.',
    path: ['correctPairs'],
  })
  .refine((item) => item.leftItems.length === item.rightItems.length, {
    message: 'leftItems and rightItems must have the same length.',
    path: ['rightItems'],
  })
  .refine((item) => item.correctPairs.length === item.leftItems.length, {
    message: 'correctPairs must cover the full set of visible left/right items.',
    path: ['correctPairs'],
  });

const quizUnscrambleSentenceItemSchema = z
  .object({
    acceptableAnswers: z.array(z.string().trim().min(1).max(1600)).min(1).max(16).optional(),
    kind: z.literal('quiz_unscramble_sentence'),
    prompt: z.string().trim().min(1).max(1600),
    rubric: z.string().trim().min(1).max(1600).optional(),
    tokens: z.array(z.string().trim().min(1).max(120)).min(2).max(32),
  })
  .strict();

const quizItemSchema = z.union([
  quizOpenTextItemSchema,
  quizTranslateToEnglishItemSchema,
  quizUnderstandInSpanishItemSchema,
  quizFillInTheBlankInputItemSchema,
  quizFillInTheBlankChoiceItemSchema,
  quizMultipleChoiceItemSchema,
  quizMatchingPairsItemSchema,
  quizUnscrambleSentenceItemSchema,
]);

export const quizBlockSchema = z
  .object({
    type: z.literal('quiz'),
    title: z.string().trim().min(1).max(200).optional(),
    prompt: z.string().trim().min(1).max(2000),
    rubric: z.string().trim().min(1).max(3000).optional(),
    items: z.array(quizItemSchema).min(1).max(24),
  })
  .strict();

const quizResultOpenTextItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        parts: z
          .array(inlineTextPartSchema)
          .min(1)
          .max(64),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_open_text'),
    prompt: z.string().trim().min(1).max(1600),
    userResponse: z
      .object({
        text: z.string().trim().max(2400),
      })
      .strict(),
  })
  .strict();

const quizResultTranslateToEnglishItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        parts: z
          .array(inlineTextPartSchema)
          .min(1)
          .max(64),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_translate_to_english'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
    userResponse: z
      .object({
        text: z.string().trim().max(2400),
      })
      .strict(),
  })
  .strict();

const quizResultUnderstandInSpanishItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        parts: z
          .array(inlineTextPartSchema)
          .min(1)
          .max(64),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_understand_in_spanish'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
    userResponse: z
      .object({
        text: z.string().trim().max(2400),
      })
      .strict(),
  })
  .strict();

const quizResultFillInTheBlankInputItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        blanks: z
          .array(inlineBlankReviewSchema)
          .max(20),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_fill_in_the_blank_input'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
    userResponse: z
      .object({
        completedSentence: z.string().trim().max(1600).optional(),
        values: z.array(z.string().trim().max(240)).max(20),
      })
      .strict(),
  })
  .strict();

const quizResultFillInTheBlankChoiceItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        blanks: z
          .array(inlineBlankReviewSchema)
          .max(20),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_fill_in_the_blank_choice'),
    prompt: z.string().trim().min(1).max(1600),
    sentence: z.string().trim().min(1).max(1600),
    blanks: z
      .array(
        z
          .object({
            choices: z.array(z.string().trim().min(1).max(240)).min(2).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    userResponse: z
      .object({
        completedSentence: z.string().trim().max(1600).optional(),
        values: z.array(z.string().trim().max(240)).max(20),
      })
      .strict(),
  })
  .strict();

const quizResultMultipleChoiceItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        options: z
          .array(inlineMultipleChoiceOptionReviewSchema)
          .max(16),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_multiple_choice'),
    prompt: z.string().trim().min(1).max(1600),
    selectionMode: z.enum(['single', 'multiple']),
    options: z.array(z.string().trim().min(1).max(400)).min(2).max(16),
    userResponse: z
      .object({
        selectedOptions: z.array(z.string().trim().min(1).max(400)).max(16),
      })
      .strict(),
  })
  .strict();

const quizResultMatchingPairsItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        pairs: z
          .array(inlineMatchingPairReviewSchema)
          .max(24),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_matching_pairs'),
    prompt: z.string().trim().min(1).max(1600),
    leftItems: z.array(z.string().trim().min(1).max(600)).min(1).max(24),
    rightItems: z.array(z.string().trim().min(1).max(600)).min(1).max(24),
    userResponse: z
      .object({
        pairs: z
          .array(
            z
              .object({
                left: z.string().trim().min(1).max(600),
                right: z.string().trim().min(1).max(600),
              })
              .strict(),
          )
          .max(24),
      })
      .strict(),
  })
  .strict();

const quizResultUnscrambleSentenceItemSchema = z
  .object({
    evaluation: z
      .object({
        feedback: z.string().trim().min(1).max(1200),
        status: z.enum(['correct', 'partial', 'incorrect']),
      })
      .strict(),
    inlineReview: z
      .object({
        parts: z
          .array(inlineTextPartSchema)
          .min(1)
          .max(64),
      })
      .strict()
      .optional(),
    kind: z.literal('quiz_unscramble_sentence'),
    prompt: z.string().trim().min(1).max(1600),
    tokens: z.array(z.string().trim().min(1).max(120)).min(2).max(32),
    userResponse: z
      .object({
        selectedTokens: z.array(z.string().trim().min(1).max(120)).max(32),
        sentence: z.string().trim().max(1600).optional(),
      })
      .strict(),
  })
  .strict();

const quizResultItemSchema = z.union([
  quizResultOpenTextItemSchema,
  quizResultTranslateToEnglishItemSchema,
  quizResultUnderstandInSpanishItemSchema,
  quizResultFillInTheBlankInputItemSchema,
  quizResultFillInTheBlankChoiceItemSchema,
  quizResultMultipleChoiceItemSchema,
  quizResultMatchingPairsItemSchema,
  quizResultUnscrambleSentenceItemSchema,
]);

export const quizResultBlockSchema = z
  .object({
    type: z.literal('quiz_result'),
    title: z.string().trim().min(1).max(200).optional(),
    prompt: z.string().trim().min(1).max(2000).optional(),
    items: z.array(quizResultItemSchema).min(1).max(24),
  })
  .strict();

export const quizResultEvaluationsSchema = z
  .object({
    items: z
      .array(
        z.union([
          z
            .object({
              feedback: z.string().trim().min(1).max(1200),
              status: z.enum(['correct', 'partial', 'incorrect']),
              inlineReview: z
                .object({
                  parts: z.array(inlineTextPartSchema).min(1).max(64),
                })
                .strict()
                .optional(),
            })
            .strict(),
          z
            .object({
              feedback: z.string().trim().min(1).max(1200),
              status: z.enum(['correct', 'partial', 'incorrect']),
              inlineReview: z
                .object({
                  blanks: z.array(inlineBlankReviewSchema).max(20),
                })
                .strict()
                .optional(),
            })
            .strict(),
          z
            .object({
              feedback: z.string().trim().min(1).max(1200),
              status: z.enum(['correct', 'partial', 'incorrect']),
              inlineReview: z
                .object({
                  options: z.array(inlineMultipleChoiceOptionReviewSchema).max(16),
                })
                .strict()
                .optional(),
            })
            .strict(),
          z
            .object({
              feedback: z.string().trim().min(1).max(1200),
              status: z.enum(['correct', 'partial', 'incorrect']),
              inlineReview: z
                .object({
                  pairs: z.array(inlineMatchingPairReviewSchema).max(24),
                })
                .strict()
                .optional(),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(24),
  })
  .strict();

export const fillInTheBlankInputBlockSchema = z
  .object({
    type: z.literal('fill_in_the_blank_input'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    sentence: z.string().trim().min(1).max(1600),
    blanks: z
      .array(
        z
          .object({
            answers: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine((block) => countSentencePlaceholders(block.sentence, '___') === block.blanks.length, {
    message: 'sentence must contain exactly one ___ placeholder per blanks entry.',
    path: ['sentence'],
  });

export const fillInTheBlankChoiceBlockSchema = z
  .object({
    type: z.literal('fill_in_the_blank_choice'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    sentence: z.string().trim().min(1).max(1600),
    blanks: z
      .array(
        z
          .object({
            choices: z.array(z.string().trim().min(1).max(240)).min(2).max(20),
            answers: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine((block) => countSentencePlaceholders(block.sentence, '{{blank}}') === block.blanks.length, {
    message: 'sentence must contain exactly one {{blank}} placeholder per blanks entry.',
    path: ['sentence'],
  });

export const multipleChoiceBlockSchema = z
  .object({
    type: z.literal('multiple_choice'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    question: z.string().trim().min(1).max(1600),
    selectionMode: z.enum(['single', 'multiple']),
    options: z
      .array(
        z
          .object({
            isCorrect: z.boolean(),
            text: z.string().trim().min(1).max(400),
          })
          .strict(),
      )
      .min(2)
      .max(16),
  })
  .strict()
  .refine((block) => block.options.some((option) => option.isCorrect), {
    message: 'multiple_choice must include at least one correct option.',
    path: ['options'],
  })
  .refine((block) => {
    if (block.selectionMode === 'multiple') {
      return true;
    }

    return block.options.filter((option) => option.isCorrect).length === 1;
  }, {
    message:
      'multiple_choice with selectionMode "single" must include exactly one correct option.',
    path: ['selectionMode'],
  });

export const unscrambleSentenceBlockSchema = z
  .object({
    type: z.literal('unscramble_sentence'),
    prompt: z.string().trim().min(1).max(1000).optional(),
    tokens: z.array(z.string().trim().min(1).max(120)).min(2).max(32),
  })
  .strict();

const tutorPlanStepIdSchema = z.string().trim().min(1).max(48).regex(
  /^[a-z][a-z0-9_-]*$/,
  'step id must start with a lowercase letter and contain only lowercase letters, numbers, underscores, or hyphens.',
);

const tutorPlanStepSchema = z
  .object({
    id: tutorPlanStepIdSchema,
    label: z.string().trim().min(1).max(160),
    status: z.enum(['pending', 'active', 'done']),
  })
  .strict();

export const tutorPlanBlockSchema = z
  .object({
    type: z.literal('tutor_plan'),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(500).optional(),
    steps: z.array(tutorPlanStepSchema).min(2).max(10),
  })
  .strict()
  .superRefine((block, ctx) => {
    const ids = new Set<string>();
    for (const [index, step] of block.steps.entries()) {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'tutor_plan step ids must be unique.',
          path: ['steps', index, 'id'],
        });
      }
      ids.add(step.id);
    }

    const activeCount = block.steps.filter((step) => step.status === 'active').length;
    if (activeCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tutor_plan must include exactly one active step.',
        path: ['steps'],
      });
    }
  });

const tutorPlanUpdateStepOperationSchema = z
  .object({
    action: z.literal('update_step'),
    id: tutorPlanStepIdSchema,
    label: z.string().trim().min(1).max(160).optional(),
    status: z.enum(['pending', 'active', 'done', 'skipped']).optional(),
  })
  .strict()
  .refine((operation) => Boolean(operation.label || operation.status), {
    message: 'update_step must include label or status.',
  });

const tutorPlanAddStepOperationSchema = z
  .object({
    action: z.literal('add_step'),
    afterId: tutorPlanStepIdSchema.optional(),
    id: tutorPlanStepIdSchema,
    label: z.string().trim().min(1).max(160),
    status: z.enum(['pending', 'active']).optional(),
  })
  .strict();

export const tutorPlanUpdateBlockSchema = z
  .object({
    type: z.literal('tutor_plan_update'),
    operations: z
      .array(z.union([
        tutorPlanUpdateStepOperationSchema,
        tutorPlanAddStepOperationSchema,
      ]))
      .min(1)
      .max(8),
  })
  .strict();

export const translateToEnglishPromptBlockSchema = z
  .object({
    type: z.literal('translate_to_english_prompt'),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

function countSentencePlaceholders(sentence: string, placeholder: string): number {
  if (!placeholder) {
    return 0;
  }

  return sentence.split(placeholder).length - 1;
}

export const understandInSpanishPromptBlockSchema = z
  .object({
    type: z.literal('understand_in_spanish_prompt'),
    sentence: z.string().trim().min(1).max(1600),
  })
  .strict();

export const sentenceEvaluationBlockSchema = z
  .object({
    type: z.literal('sentence_evaluation'),
    parts: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(2400),
            status: z.enum(['correct', 'improve', 'error']),
            explanation: z.string().trim().max(800).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict();

export const conversationTitleBlockSchema = z
  .object({
    type: z.literal('conversation_title'),
    title: z.string().trim().min(1).max(160),
  })
  .strict();

const tutorAgentResponseBlockSchema = z.union([
  messageBlockSchema,
  practiceModuleLinkBlockSchema,
  dialogueCharacterMessageBlockSchema,
  dialogueTranscriptBlockSchema,
  matchingPairsBlockSchema,
  quizBlockSchema,
  translateToEnglishPromptBlockSchema,
  understandInSpanishPromptBlockSchema,
  fillInTheBlankInputBlockSchema,
  fillInTheBlankChoiceBlockSchema,
  multipleChoiceBlockSchema,
  unscrambleSentenceBlockSchema,
  tutorPlanBlockSchema,
  tutorPlanUpdateBlockSchema,
  sentenceEvaluationBlockSchema,
  conversationTitleBlockSchema,
]);

export const persistedTutorResponseBlockSchema = z.union([
  tutorAgentResponseBlockSchema,
  quizResultBlockSchema,
]);

export const tutorAgentResponseSchema = z
  .object({
    blocks: z
      .array(tutorAgentResponseBlockSchema)
      .min(1)
      .max(16),
  })
  .strict();

export const persistedTutorResponseSchema = z
  .object({
    blocks: z
      .array(persistedTutorResponseBlockSchema)
      .min(1)
      .max(16),
  })
  .strict();
