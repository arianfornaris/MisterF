import { describe, expect, it } from 'vitest';
import {
  getTutorHistoryContent,
  toTutorHistory,
} from '../../src/server/services/llmTutor/history.js';
import type { StoredMessage } from '../../src/server/db/repository.js';

function buildMessage(
  overrides: Partial<StoredMessage> = {},
): StoredMessage {
  return {
    content: 'fallback content',
    conversationId: 'conversation-1',
    createdAt: '2026-06-14 00:00:00',
    id: 1,
    metadata: null,
    role: 'model',
    ...overrides,
  };
}

describe('model-facing tutor history', () => {
  it('preserves accepted structured blocks for assistant history', () => {
    const message = buildMessage({
      content: 'Revisemos esta parte:',
      metadata: {
        blocks: [
          {
            markdown: 'Revisemos esta parte:',
            type: 'message',
          },
          {
            parts: [
              {
                status: 'correct',
                text: 'I ',
              },
              {
                explanation: 'Con "I" usamos "have".',
                status: 'error',
                text: 'has',
              },
              {
                status: 'correct',
                text: ' a dog.',
              },
            ],
            sourceText: 'I has a dog.',
            type: 'sentence_evaluation',
          },
        ],
      },
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      blocks: message.metadata?.blocks,
    });
  });

  it('serializes ephemeral initial greetings as normal message blocks', () => {
    const message = buildMessage({
      content: 'Hola, soy Mr. F. ¿Qué necesitas practicar hoy?',
      metadata: {
        source: 'initial_greeting',
      },
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      blocks: [
        {
          markdown: 'Hola, soy Mr. F. ¿Qué necesitas practicar hoy?',
          type: 'message',
        },
      ],
    });
  });

  it('keeps user messages as plain learner content', () => {
    const messages = toTutorHistory([
      buildMessage({
        content: 'puedes ver mi progreso general?',
        metadata: null,
        role: 'user',
      }),
    ]);

    expect(messages).toEqual([
      {
        content: 'puedes ver mi progreso general?',
        role: 'user',
      },
    ]);
  });

  it('serializes open-ended exercise submissions with source block context', () => {
    const message = buildMessage({
      content: 'I usually drink coffee in the morning.',
      metadata: {
        exerciseSubmission: {
          block: {
            prompt: 'Completa la oración con una opción natural.',
            sentence: 'I usually ___ coffee in the morning.',
            type: 'fill_in_the_blank_input',
          },
          completedSentence: 'I usually drink coffee in the morning.',
          type: 'fill_in_the_blank_input',
          values: ['drink'],
        },
      },
      role: 'user',
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      exerciseSubmission: {
        block: {
          prompt: 'Completa la oración con una opción natural.',
          sentence: 'I usually ___ coffee in the morning.',
          type: 'fill_in_the_blank_input',
        },
        completedSentence: 'I usually drink coffee in the morning.',
        type: 'fill_in_the_blank_input',
        values: ['drink'],
      },
      kind: 'learner_exercise_submission',
      visibleContent: 'I usually drink coffee in the morning.',
    });
  });

  it('serializes open text prompt submissions with source block context', () => {
    const message = buildMessage({
      content: 'I live in Miami.',
      metadata: {
        exerciseSubmission: {
          block: {
            placeholder: 'I live in...',
            prompt: 'Escribe una oración usando in para hablar de un lugar cerrado.',
            rubric: 'Evalúa si el estudiante usa in correctamente.',
            submitLabel: 'Enviar respuesta',
            type: 'open_text_prompt',
          },
          response: 'I live in Miami.',
          type: 'open_text_prompt',
        },
      },
      role: 'user',
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      exerciseSubmission: {
        block: {
          placeholder: 'I live in...',
          prompt: 'Escribe una oración usando in para hablar de un lugar cerrado.',
          rubric: 'Evalúa si el estudiante usa in correctamente.',
          submitLabel: 'Enviar respuesta',
          type: 'open_text_prompt',
        },
        response: 'I live in Miami.',
        type: 'open_text_prompt',
      },
      kind: 'learner_exercise_submission',
      visibleContent: 'I live in Miami.',
    });
  });

  it('serializes translation prompt submissions with source block context', () => {
    const message = buildMessage({
      content: 'I have lived here for five years.',
      metadata: {
        exerciseSubmission: {
          block: {
            sentence: 'He vivido aquí durante cinco años.',
            type: 'translate_to_english_prompt',
          },
          response: 'I have lived here for five years.',
          type: 'translate_to_english_prompt',
        },
      },
      role: 'user',
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      exerciseSubmission: {
        block: {
          sentence: 'He vivido aquí durante cinco años.',
          type: 'translate_to_english_prompt',
        },
        response: 'I have lived here for five years.',
        type: 'translate_to_english_prompt',
      },
      kind: 'learner_exercise_submission',
      visibleContent: 'I have lived here for five years.',
    });
  });

  it('serializes comprehension prompt submissions with source block context', () => {
    const message = buildMessage({
      content: 'Significa que la reunión se pospuso para otro día.',
      metadata: {
        exerciseSubmission: {
          block: {
            sentence: 'The meeting was pushed back to another day.',
            type: 'understand_in_spanish_prompt',
          },
          response: 'Significa que la reunión se pospuso para otro día.',
          type: 'understand_in_spanish_prompt',
        },
      },
      role: 'user',
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      exerciseSubmission: {
        block: {
          sentence: 'The meeting was pushed back to another day.',
          type: 'understand_in_spanish_prompt',
        },
        response: 'Significa que la reunión se pospuso para otro día.',
        type: 'understand_in_spanish_prompt',
      },
      kind: 'learner_exercise_submission',
      visibleContent: 'Significa que la reunión se pospuso para otro día.',
    });
  });

  it('serializes sentence evaluation correction submissions with source text context', () => {
    const message = buildMessage({
      content: 'She is reading a very interesting book in the library.',
      metadata: {
        exerciseSubmission: {
          block: {
            sourceText: 'She is readng a very interesting book in the librery.',
            type: 'sentence_evaluation_correction',
          },
          response: 'She is reading a very interesting book in the library.',
          type: 'sentence_evaluation_correction',
        },
      },
      role: 'user',
    });

    expect(JSON.parse(getTutorHistoryContent(message))).toEqual({
      exerciseSubmission: {
        block: {
          sourceText: 'She is readng a very interesting book in the librery.',
          type: 'sentence_evaluation_correction',
        },
        response: 'She is reading a very interesting book in the library.',
        type: 'sentence_evaluation_correction',
      },
      kind: 'learner_exercise_submission',
      visibleContent: 'She is reading a very interesting book in the library.',
    });
  });

  it('rejects translation prompt submissions whose block type does not match', () => {
    const message = buildMessage({
      content: 'I have lived here for five years.',
      metadata: {
        exerciseSubmission: {
          block: {
            sentence: 'He vivido aquí durante cinco años.',
            type: 'understand_in_spanish_prompt',
          },
          response: 'I have lived here for five years.',
          type: 'translate_to_english_prompt',
        },
      },
      role: 'user',
    });

    expect(getTutorHistoryContent(message)).toBe('I have lived here for five years.');
  });

  it('falls back to plain learner content when exercise submission metadata is incomplete', () => {
    const messages = toTutorHistory([
      buildMessage({
        content: 'I usually drink coffee in the morning.',
        metadata: {
          exerciseSubmission: {
            completedSentence: 'I usually drink coffee in the morning.',
            type: 'fill_in_the_blank_input',
            values: ['drink'],
          },
        },
        role: 'user',
      }),
    ]);

    expect(messages).toEqual([
      {
        content: 'I usually drink coffee in the morning.',
        role: 'user',
      },
    ]);
  });
});
