import type { StoredMessage } from '../../db/repository.js';
import type { TutorMessage, TutorMessageBlock } from './types.js';

export function toTutorHistory(messages: StoredMessage[]): TutorMessage[] {
  return messages.map((message) => ({
    content: getTutorHistoryContent(message),
    role: message.role,
  }));
}

export function getTutorHistoryContent(message: StoredMessage): string {
  if (message.role !== 'model') {
    return message.content;
  }

  const blocks = message.metadata?.blocks;
  if (!Array.isArray(blocks)) {
    if (message.metadata?.source === 'initial_greeting') {
      return JSON.stringify(
        { blocks: [createInitialGreetingBlock(message.content)] },
        null,
        2,
      );
    }

    return message.content;
  }

  return JSON.stringify({ blocks }, null, 2);
}

function createInitialGreetingBlock(content: string): TutorMessageBlock {
  return {
    markdown: content,
    type: 'message',
  };
}
