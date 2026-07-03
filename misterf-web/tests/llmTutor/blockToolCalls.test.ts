import { describe, expect, it } from 'vitest';
import { extractTutorResponseFromBlockToolCalls } from '../../src/server/services/llmTutor/index.js';

describe('tutor block tool-call extraction', () => {
  it('recovers tutor response blocks when the provider returns block names as tool calls', () => {
    const response = extractTutorResponseFromBlockToolCalls([
      {
        toolCalls: [
          {
            input: {
              reason: 'initial_topic',
              title: 'Práctica de orden de diálogo',
            },
            toolName: 'update_conversation_title',
          },
        ],
      },
      {
        toolCalls: [
          {
            input: {
              markdown: 'Vamos a reconstruir un diálogo breve.',
            },
            toolName: 'message',
          },
          {
            input: {
              prompt: 'Ordena las siguientes frases para formar un diálogo coherente:',
              sentences: [
                'Hi, how are you doing today?',
                "I'm doing great, thanks for asking. How about you?",
                "I'm fine too. Are you ready for the meeting?",
                "Yes, I'm ready. Let's start.",
              ],
            },
            toolName: 'order_sentences',
          },
        ],
      },
    ]);

    expect(response).toEqual({
      blocks: [
        {
          markdown: 'Vamos a reconstruir un diálogo breve.',
          type: 'message',
        },
        {
          prompt: 'Ordena las siguientes frases para formar un diálogo coherente:',
          sentences: [
            'Hi, how are you doing today?',
            "I'm doing great, thanks for asking. How about you?",
            "I'm fine too. Are you ready for the meeting?",
            "Yes, I'm ready. Let's start.",
          ],
          type: 'order_sentences',
        },
      ],
    });
  });

  it('prefers the first step with a real exercise block over later message-only steps', () => {
    const response = extractTutorResponseFromBlockToolCalls([
      {
        toolCalls: [
          {
            input: {
              markdown: 'Primera guía.',
            },
            toolName: 'message',
          },
          {
            input: {
              prompt: 'Ordena.',
              sentences: ['First.', 'Second.'],
            },
            toolName: 'order_sentences',
          },
        ],
      },
      {
        toolCalls: [
          {
            input: {
              markdown: 'Ordena: 1. First. 2. Second.',
            },
            toolName: 'message',
          },
        ],
      },
    ]);

    expect(response).toEqual({
      blocks: [
        {
          markdown: 'Primera guía.',
          type: 'message',
        },
        {
          prompt: 'Ordena.',
          sentences: ['First.', 'Second.'],
          type: 'order_sentences',
        },
      ],
    });
  });
});
