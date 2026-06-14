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
});
