import type { Server } from 'socket.io';
import {
  completeSentenceChallenge,
  createSentenceChallenge,
  findConversationForUser,
  findCurrentSentenceChallenge,
  listSentenceChallenges,
  renameConversationForUser,
  updateMessageMetadata,
  upsertSentenceAttempt,
  type StoredMessage,
  type StoredSentenceChallenge,
} from '../../db/repository.js';
import type {
  TutorResponseBlock,
  TutorSentenceEvaluationBlock,
} from '../llmTutor.js';

const fallbackChallengeTitle = 'Oración pendiente de identificar';

export function validateTutorBlocksAgainstConversationState(
  blocks: TutorResponseBlock[],
  conversationId: string,
  lastUserMessageId?: number,
): void {
  const current = findCurrentSentenceChallenge(conversationId);
  assertTutorBlocksFitCurrentState(blocks, current, lastUserMessageId);

  const startedBlock = blocks.find(
    (block): block is Extract<TutorResponseBlock, { type: 'challenge_started' }> =>
      block.type === 'challenge_started',
  );
  if (!startedBlock) {
    return;
  }

  if (!current || current.completedAt) {
    return;
  }

  const requestedChallengeText =
    'challengeLabel' in startedBlock
      ? startedBlock.challengeLabel
      : null;

  console.error('[Mr. F tutor blocks rejected before apply]', JSON.stringify({
    conversationId,
    currentChallengeCompletedAt: current.completedAt,
    currentChallengeId: current.id,
    currentChallengeText: current.challengeLabel,
    reason: 'challenge_started_while_current_challenge_not_completed',
    requestedChallengeText,
  }, null, 2));

  throw new Error(
    'The response is inconsistent with the current conversation state: there is already an open challenge, so you must not emit challenge_started yet. Continue the current challenge instead, or wait until the learner explicitly asks for the next challenge after completion.',
  );
}

function assertTutorBlocksFitCurrentState(
  blocks: TutorResponseBlock[],
  currentChallenge: StoredSentenceChallenge | null,
  lastUserMessageId?: number,
): void {
  if (currentChallenge && lastUserMessageId) {
    const evaluationBlocks = blocks.filter(
      (block): block is TutorSentenceEvaluationBlock =>
        block.type === 'sentence_evaluation',
    );

    if (evaluationBlocks.length !== 1) {
      throw new Error(
        'After a learner message inside an open challenge, include exactly one sentence_evaluation before any follow-up tutor guidance.',
      );
    }
  }

  assertDialogueBlocksFitCurrentState(blocks, currentChallenge);
}

export function applyTutorBlocksRuntime(input: {
  blocks: TutorResponseBlock[];
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  messageHistory: StoredMessage[];
  userId: string;
}): void {
  let latestEvaluation: TutorSentenceEvaluationBlock | null = null;

  console.log('[Mr. F apply start]', JSON.stringify({
    conversationId: input.conversationId,
    blockTypes: input.blocks.map((block) => block.type),
    lastUserMessageId: input.lastUserMessageId ?? null,
  }, null, 2));

  for (const block of input.blocks) {
    switch (block.type) {
      case 'challenge_started':
        handleChallengeStartedBlock(input.io, input.conversationId, block);
        break;

      case 'sentence_evaluation':
        latestEvaluation = block;
        handleSentenceEvaluationBlock({
          block,
          conversationId: input.conversationId,
          io: input.io,
          lastUserMessageId: input.lastUserMessageId,
          messageHistory: input.messageHistory,
        });
        break;

      case 'challenge_completed':
        handleChallengeCompletedBlock({
          block,
          conversationId: input.conversationId,
          io: input.io,
          latestEvaluation,
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
      case 'character_message':
        break;
    }
  }

  const current = findCurrentSentenceChallenge(input.conversationId);
  console.log('[Mr. F apply done]', JSON.stringify({
    conversationId: input.conversationId,
    currentChallengeCompletedAt: current?.completedAt ?? null,
    currentChallengeId: current?.id ?? null,
    currentChallengeType: current?.challengeType ?? null,
    currentChallengeText:
      current?.challengeLabel ?? null,
  }, null, 2));
}

function assertDialogueBlocksFitCurrentState(
  blocks: TutorResponseBlock[],
  currentChallenge: StoredSentenceChallenge | null,
): void {
  const startedDialogueBlock = blocks.find(
    (block): block is Extract<TutorResponseBlock, { type: 'challenge_started'; challengeType: 'dialogue_scene' }> =>
      block.type === 'challenge_started' && block.challengeType === 'dialogue_scene',
  );
  if (startedDialogueBlock) {
    const hasTutorMessage = blocks.some((block) => block.type === 'message');
    const hasCharacterMessage = blocks.some((block) => block.type === 'character_message');

    if (!hasTutorMessage || !hasCharacterMessage) {
      throw new Error(
        'When opening a dialogue_scene with challenge_started, include both a tutor message and a character_message in the same response.',
      );
    }
  }

  if (!currentChallenge || currentChallenge.challengeType !== 'dialogue_scene') {
    return;
  }

  const latestEvaluation = [...blocks]
    .reverse()
    .find(
      (block): block is TutorSentenceEvaluationBlock =>
        block.type === 'sentence_evaluation',
    );
  if (!latestEvaluation) {
    return;
  }

  const hasCharacterMessage = blocks.some(
    (block) => block.type === 'character_message',
  );
  const hasChallengeCompleted = blocks.some(
    (block) => block.type === 'challenge_completed',
  );

  if (
    evaluationIsFullyCorrect(latestEvaluation) &&
    !hasChallengeCompleted &&
    !hasCharacterMessage
  ) {
    throw new Error(
      'In a dialogue_scene, when the latest sentence_evaluation is fully correct and the scene is not completed in this response, include exactly one character_message with the next in-scene turn.',
    );
  }
}

function handleChallengeStartedBlock(
  io: Server,
  conversationId: string,
  block: Extract<TutorResponseBlock, { type: 'challenge_started' }>,
): void {
  const current = findCurrentSentenceChallenge(conversationId);
  if (current && !current.completedAt) {
    console.log('[Mr. F challenge_started skipped]', {
      conversationId,
      currentChallengeId: current.id,
      reason: 'current_challenge_not_completed',
      challengeText:
        'challengeLabel' in block
          ? block.challengeLabel
          : null,
    });
    return;
  }

  createSentenceChallenge({
    challengeType: block.challengeType ?? 'produce_en',
    conversationId,
    level: block.level,
    objective: block.objective,
    challengeLabel: 'challengeLabel' in block ? block.challengeLabel : fallbackChallengeTitle,
    topic: block.topic,
  });
  emitPracticeUpdated(io, conversationId);
}

function handleSentenceEvaluationBlock(input: {
  block: TutorSentenceEvaluationBlock;
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  messageHistory: StoredMessage[];
}): void {
  if (!input.lastUserMessageId) {
    return;
  }

  const challenge =
    findCurrentSentenceChallenge(input.conversationId) ??
    createSentenceChallenge({
      conversationId: input.conversationId,
      challengeLabel:
        inferLatestChallengeLabel(input.messageHistory, input.lastUserMessageId) ??
        fallbackChallengeTitle,
    });

  const message = updateMessageMetadata(
    input.lastUserMessageId,
    input.conversationId,
    {
      sentenceEvaluation: {
        challengeType: challenge.challengeType,
        parts: input.block.parts,
        challengeLabel: challenge.challengeLabel,
      },
    },
  );
  if (!message) {
    return;
  }

  const isCorrect = input.block.parts.every((part) => part.status === 'correct');

  upsertSentenceAttempt({
    attemptText: message.content,
    challengeId: challenge.id,
    conversationId: input.conversationId,
    evaluation: { parts: input.block.parts },
    isCorrect,
    userMessageId: message.id,
  });

  input.io.to(input.conversationId).emit('message:evaluation_updated', {
    conversationId: input.conversationId,
    message,
    messageId: message.id,
    sentenceEvaluation: {
      challengeType: challenge.challengeType,
      parts: input.block.parts,
      challengeLabel: challenge.challengeLabel,
    },
  });

  emitPracticeUpdated(input.io, input.conversationId);

  if (isCorrect) {
    if (challenge.completedAt) {
      emitPracticeUpdated(input.io, input.conversationId);
      return;
    }

    if (challenge.challengeType === 'dialogue_scene') {
      return;
    }

    completeAndCelebrateChallenge({
      conversationId: input.conversationId,
      io: input.io,
      score: 1,
      source: 'sentence_evaluation',
    });
  }
}

function handleChallengeCompletedBlock(input: {
  block: Extract<TutorResponseBlock, { type: 'challenge_completed' }>;
  conversationId: string;
  io: Server;
  latestEvaluation: TutorSentenceEvaluationBlock | null;
}): void {
  const canComplete =
    input.latestEvaluation?.parts.every((part) => part.status === 'correct') ??
    false;
  if (!canComplete) {
    console.log('[Mr. F challenge_completed skipped]', {
      conversationId: input.conversationId,
      reason: 'latest_evaluation_not_all_correct',
      score: input.block.score,
    });
    return;
  }

  const currentChallenge = findCurrentSentenceChallenge(input.conversationId);
  completeAndCelebrateChallenge({
    conversationId: input.conversationId,
    io: input.io,
    score: input.block.score,
    source: 'challenge_completed',
  });
}

function completeAndCelebrateChallenge(input: {
  conversationId: string;
  io: Server;
  score: number;
  source: string;
}): void {
  const currentChallenge = findCurrentSentenceChallenge(input.conversationId);
  if (!currentChallenge || currentChallenge.completedAt) {
    return;
  }

  const completedChallenge = completeSentenceChallenge(
    currentChallenge.id,
    input.conversationId,
    input.score,
  );
  emitPracticeUpdated(input.io, input.conversationId);

  const completionPayload = {
    automatic: true,
    challenge: completedChallenge,
    conversationId: input.conversationId,
    score: input.score,
    source: input.source,
  };
  console.log('[Mr. F confetti emit]', completionPayload);
  input.io
    .to(input.conversationId)
    .emit('sentence_challenge:completed', completionPayload);
}

function evaluationIsFullyCorrect(
  evaluation: TutorSentenceEvaluationBlock | null,
): boolean {
  return evaluation?.parts.every((part) => part.status === 'correct') ?? false;
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

function emitPracticeUpdated(io: Server, conversationId: string): void {
  io.to(conversationId).emit('practice:updated', {
    challenges: listSentenceChallenges(conversationId),
    conversationId,
  });
}

function inferLatestChallengeLabel(
  messages: StoredMessage[],
  lastUserMessageId: number,
): string | null {
  const lastUserIndex = messages.findIndex(
    (message) => message.id === lastUserMessageId,
  );
  const searchEndIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length;
  const previousModelMessages = messages
    .slice(0, searchEndIndex)
    .filter((message) => message.role === 'model')
    .reverse();

  for (const message of previousModelMessages) {
    const quotedSentence = extractBestSpanishQuotedSentence(message.content);
    if (quotedSentence) {
      return quotedSentence;
    }
  }

  return null;
}

function extractBestSpanishQuotedSentence(content: string): string | null {
  const quotedSegments = [...content.matchAll(/["“”]([^"“”]{8,240})["“”]/g)]
    .map((match) => normalizeConversationTitle(match[1]).slice(0, 240))
    .filter(Boolean);

  return quotedSegments.find(isLikelySpanishChallengeSentence) ?? null;
}

function isLikelySpanishChallengeSentence(value: string): boolean {
  return /[áéíóúñ¿¡]/i.test(value) || /\b(el|la|los|las|que|para|como)\b/i.test(value);
}

function normalizeConversationTitle(title?: string): string {
  return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}
