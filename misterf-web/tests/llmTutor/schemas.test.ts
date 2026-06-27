import { describe, expect, it } from 'vitest';
import {
  persistedTutorResponseSchema,
  tutorAgentResponseSchema,
} from '../../src/server/services/llmTutor/schemas.js';
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
});
