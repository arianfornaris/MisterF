import { describe, expect, it } from 'vitest';
import {
  persistedTutorResponseSchema,
  tutorAgentResponseSchema,
} from '../../src/server/services/llmTutor/schemas.js';
import { validateTutorResponseBlocks } from '../../src/server/services/llmTutor/validation.js';

describe('normal tutor response schema', () => {
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
