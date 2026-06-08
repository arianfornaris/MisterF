import type { Server } from 'socket.io';
import {
  findConversationForUser,
  renameConversationForUser,
  updateMessageMetadata,
} from '../../db/repository.js';
import type {
  TutorResponseBlock,
  TutorSentenceEvaluationBlock,
} from '../llmTutor.js';

export function applyTutorBlocksRuntime(input: {
  blocks: TutorResponseBlock[];
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  userId: string;
}): void {
  for (const block of input.blocks) {
    switch (block.type) {
      case 'sentence_evaluation':
        handleSentenceEvaluationBlock({
          block,
          conversationId: input.conversationId,
          io: input.io,
          lastUserMessageId: input.lastUserMessageId,
        });
        break;

      case 'conversation_title':
        handleConversationTitleBlock({
          conversationId: input.conversationId,
          io: input.io,
          title: block.title,
          userId: input.userId,
        });
        break;

      case 'message':
      case 'practice_module_link':
      case 'dialogue_character_message':
      case 'dialogue_transcript':
      case 'matching_pairs':
      case 'quiz':
      case 'quiz_result':
      case 'translate_to_english_prompt':
      case 'understand_in_spanish_prompt':
      case 'fill_in_the_blank_input':
      case 'fill_in_the_blank_choice':
      case 'multiple_choice':
      case 'unscramble_sentence':
        break;
    }
  }
}

function handleSentenceEvaluationBlock(input: {
  block: TutorSentenceEvaluationBlock;
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
}): void {
  if (!input.lastUserMessageId) {
    return;
  }

  const hasIssues = input.block.parts.some(
    (part) => part.status === 'improve' || part.status === 'error',
  );
  if (!hasIssues) {
    return;
  }

  const sentenceEvaluation = {
    parts: input.block.parts,
    sourceText: partsToSourceText(input.block.parts),
  };

  const message = updateMessageMetadata(
    input.lastUserMessageId,
    input.conversationId,
    {
      sentenceEvaluation,
    },
  );
  if (!message) {
    return;
  }

  input.io.to(input.conversationId).emit('message:evaluation_updated', {
    conversationId: input.conversationId,
    message,
    messageId: message.id,
    sentenceEvaluation,
  });
}

function partsToSourceText(parts: TutorSentenceEvaluationBlock['parts']): string {
  return parts
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([.,!?;:%)\]}])/g, '$1')
    .replace(/([¿¡([{])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function handleConversationTitleBlock(input: {
  conversationId: string;
  io: Server;
  title: string;
  userId: string;
}): void {
  const conversation = findConversationForUser(input.conversationId, input.userId);
  if (!conversation || conversation.titleUpdatedByUser) {
    return;
  }

  const title = normalizeConversationTitle(input.title);
  if (!title || title.toLowerCase() === 'nueva conversación') {
    return;
  }

  const renamedConversation = renameConversationForUser(
    input.conversationId,
    input.userId,
    title,
  );
  if (!renamedConversation) {
    return;
  }

  input.io.to(input.conversationId).emit('conversation:renamed', {
    conversation: renamedConversation,
    conversationId: input.conversationId,
  });
}

function normalizeConversationTitle(title?: string): string {
  return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}
