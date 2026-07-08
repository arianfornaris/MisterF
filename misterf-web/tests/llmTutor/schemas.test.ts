import { describe, expect, it } from 'vitest';
import {
  persistedTutorResponseSchema,
  tutorAgentResponseSchema,
} from '../../src/server/services/llmTutor/schemas.js';
import { TutorResponseValidationError } from '../../src/server/services/llmTutor/errors.js';
import { validateTutorResponseBlocks } from '../../src/server/services/llmTutor/validation.js';

describe('normal tutor response schema', () => {
  it('accepts open text prompt blocks with an optional submit label', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'open_text_prompt',
          prompt: 'Escribe una oración usando in para hablar de un lugar cerrado.',
          placeholder: 'I live in...',
          submitLabel: 'Enviar respuesta',
          rubric: 'Evalúa si el estudiante usa in correctamente.',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects answer keys on open text prompt blocks', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'open_text_prompt',
          prompt: 'Escribe una oración usando in.',
          answer: 'I live in Miami.',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts free-form fill-in-the-blank input blocks without an answer key', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'fill_in_the_blank_input',
          prompt: 'Completa la oración con una opción natural.',
          sentence: 'I usually ___ coffee in the morning.',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects answer keys on free-form fill-in-the-blank input blocks', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'fill_in_the_blank_input',
          prompt: 'Completa la oración.',
          sentence: 'I usually ___ coffee in the morning.',
          blanks: [
            {
              answers: ['drink'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('strips legacy answer keys from persisted free-form fill-in-the-blank input blocks', () => {
    const result = persistedTutorResponseSchema.safeParse({
      blocks: [
        {
          type: 'fill_in_the_blank_input',
          prompt: 'Completa la oración.',
          sentence: 'I usually ___ coffee in the morning.',
          blanks: [
            {
              answers: ['drink'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.blocks[0]).toEqual({
      type: 'fill_in_the_blank_input',
      prompt: 'Completa la oración.',
      sentence: 'I usually ___ coffee in the morning.',
    });
  });

  it('rejects quiz_result from normal tutor output', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'quiz_result',
          title: 'Resultado',
          items: [
            {
              evaluation: {
                feedback: 'Bien.',
                status: 'correct',
              },
              kind: 'quiz_open_text',
              prompt: 'Escribe una frase.',
              userResponse: {
                text: 'I like coffee.',
              },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects legacy conversation_title blocks from normal tutor output', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'conversation_title',
          title: 'Práctica de updates técnicos',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts registered avatars on dialogue blocks', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'dialogue_character_message',
          avatarId: 'amara',
          name: 'Emma',
          markdown: 'Good morning. How can I help you today?',
        },
        {
          type: 'dialogue_transcript',
          turns: [
            {
              avatarId: 'amara',
              speaker: 'Emma',
              markdown: 'Good morning. How can I help you today?',
            },
            {
              avatarId: 'lucas',
              speaker: 'Leo',
              markdown: 'I need to send this package.',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects unregistered avatars on dialogue blocks', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'dialogue_character_message',
          avatarId: 'made-up-avatar',
          name: 'Emma',
          markdown: 'Good morning. How can I help you today?',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('still accepts quiz_result in persisted/renderable history', () => {
    const result = persistedTutorResponseSchema.safeParse({
      blocks: [
        {
          type: 'quiz_result',
          title: 'Resultado',
          items: [
            {
              evaluation: {
                feedback: 'Bien.',
                status: 'correct',
              },
              kind: 'quiz_open_text',
              prompt: 'Escribe una frase.',
              userResponse: {
                text: 'I like coffee.',
              },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects conversation_title from persisted/renderable history', () => {
    const result = persistedTutorResponseSchema.safeParse({
      blocks: [
        {
          type: 'conversation_title',
          title: 'Práctica de updates técnicos',
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('order_sentences schema', () => {
  it('accepts an order_sentences block with sentences in the correct order', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'order_sentences',
          prompt: 'Pon estos pasos en el orden correcto.',
          sentences: [
            'Write the address on your box.',
            'Tell the worker what mail service you want.',
            'Pay for sending your mail.',
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects an order_sentences block with fewer than two sentences', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'order_sentences',
          sentences: ['Only one step.'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects extra answer metadata on order_sentences blocks', () => {
    const result = tutorAgentResponseSchema.safeParse({
      blocks: [
        {
          type: 'order_sentences',
          sentences: ['First.', 'Second.'],
          correctOrder: [0, 1],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('multiple_choice answer-key validation', () => {
  it('rejects a single-selection block where every option is marked correct, with menu guidance', () => {
    let caught: unknown;
    try {
      validateTutorResponseBlocks({
        blocks: [
          {
            options: [
              { isCorrect: true, text: 'Practicar conversación' },
              { isCorrect: true, text: 'Repasar vocabulario' },
              { isCorrect: true, text: 'Hacer una prueba' },
            ],
            question: '¿Cómo prefieres continuar?',
            selectionMode: 'single',
            type: 'multiple_choice',
          },
        ],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TutorResponseValidationError);
    const issues = (caught as TutorResponseValidationError).issues;
    expect(issues[0].message).toMatch(/exactly one correct option/);
    expect(issues[0].message).toMatch(/preference or menu question/);
  });
});

describe('plan-only response validation', () => {
  const planBlock = {
    steps: [
      { id: 'step-1', label: 'Repasar vocabulario', status: 'active' },
      { id: 'step-2', label: 'Practicar frases', status: 'pending' },
    ],
    title: 'Plan de práctica',
    type: 'tutor_plan',
  };
  const planUpdateBlock = {
    operations: [{ action: 'update_step', id: 'step-1', status: 'done' }],
    type: 'tutor_plan_update',
  };

  it('rejects responses made only of plan blocks as a correctable error', () => {
    const expectPlanOnlyRejection = (blocks: unknown[]) => {
      let caught: unknown;
      try {
        validateTutorResponseBlocks({ blocks });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(TutorResponseValidationError);
      const issues = (caught as TutorResponseValidationError).issues;
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toMatch(/only plan blocks/);
    };

    expectPlanOnlyRejection([planBlock]);
    expectPlanOnlyRejection([planUpdateBlock]);
    expectPlanOnlyRejection([planBlock, planUpdateBlock]);
  });

  it('accepts plan blocks paired with a visible block', () => {
    const blocks = validateTutorResponseBlocks({
      blocks: [
        { markdown: 'Aquí tienes el plan para hoy.', type: 'message' },
        planBlock,
      ],
    });

    expect(blocks.map((block) => block.type)).toEqual(['message', 'tutor_plan']);
  });
});

describe('sentence_evaluation schema', () => {
  it('rejects parts that do not reconstruct sourceText', () => {
    expect(() =>
      validateTutorResponseBlocks({
        blocks: [
          {
            type: 'sentence_evaluation',
            sourceText: 'I has a cat.',
            parts: [
              {
                status: 'correct',
                text: 'I ',
              },
              {
                explanation: 'Con "I" usamos "have", no "has".',
                status: 'error',
                text: 'has',
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts a complete standalone sentence_evaluation block', () => {
    const blocks = validateTutorResponseBlocks({
      blocks: [
        {
          type: 'sentence_evaluation',
          sourceText: 'I has a cat.',
          parts: [
            {
              status: 'correct',
              text: 'I ',
            },
            {
              explanation: 'Con "I" usamos "have", no "has".',
              status: 'error',
              text: 'has',
            },
            {
              status: 'correct',
              text: ' a cat.',
            },
          ],
        },
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('sentence_evaluation');
  });

  it('accepts a sentence_evaluation with an optional correction invite', () => {
    const blocks = validateTutorResponseBlocks({
      blocks: [
        {
          type: 'sentence_evaluation',
          sourceText: 'I has a cat.',
          parts: [
            { status: 'correct', text: 'I ' },
            {
              explanation: 'Con "I" usamos "have", no "has".',
              status: 'error',
              text: 'has',
            },
            { status: 'correct', text: ' a cat.' },
          ],
          correction: {
            prompt: 'Reescribe la oración ya corregida.',
          },
        },
      ],
    });

    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block?.type === 'sentence_evaluation' && block.correction?.prompt).toBe(
      'Reescribe la oración ya corregida.',
    );
  });

  it('rejects a correction invite when every part is correct', () => {
    expect(() =>
      validateTutorResponseBlocks({
        blocks: [
          {
            type: 'sentence_evaluation',
            sourceText: 'I have a cat.',
            parts: [{ status: 'correct', text: 'I have a cat.' }],
            correction: {},
          },
        ],
      }),
    ).toThrow();
  });
});
