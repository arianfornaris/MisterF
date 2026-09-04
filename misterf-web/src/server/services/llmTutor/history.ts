import { readAttachmentDigests } from '../../attachments/persistence.js';
import type { StoredMessage } from '../../db/repository.js';
import { formatExerciseSubmissionForTutorHistory } from './exerciseSubmissions.js';
import type { TutorMessage, TutorMessageBlock } from './types.js';

export function toTutorHistory(messages: StoredMessage[]): TutorMessage[] {
  return messages.map((message) => {
    const attachments = readAttachmentDigests(message.metadata?.attachments);

    return {
      // Digests, never bytes: the binary was released after the turn it arrived
      // on, and rehydrating history is exactly where re-sending it would become
      // a per-turn charge for the rest of the conversation.
      ...(attachments.length > 0 ? { attachments } : {}),
      content: getTutorHistoryContent(message),
      role: message.role,
    };
  });
}

export function getTutorHistoryContent(message: StoredMessage): string {
  if (message.role === 'user') {
    return getLearnerHistoryContent(message);
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

function getLearnerHistoryContent(message: StoredMessage): string {
  const exerciseSubmission = formatExerciseSubmissionForTutorHistory(
    message.metadata?.exerciseSubmission,
    message.content,
  );
  return exerciseSubmission ?? message.content;
}

function createInitialGreetingBlock(content: string): TutorMessageBlock {
  return {
    markdown: content,
    type: 'message',
  };
}
