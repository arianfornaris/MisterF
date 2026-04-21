import type { Server, Socket } from 'socket.io';
import { findUserBySessionTokenHash } from '../auth/repository.js';
import {
  getSessionTokenFromCookieHeader,
  hashSessionToken,
} from '../auth/session.js';
import { verifySocketAuthToken } from '../auth/socketAuth.js';
import {
  addMessage,
  completeSentenceChallenge,
  createConversation,
  createSentenceChallenge,
  deleteConversationForUser,
  findActiveSentenceChallenge,
  findConversationForUser,
  getProgressForConversation,
  listVocabularyForConversation,
  listSentenceChallenges,
  listMessages,
  renameConversationForUser,
  updateMessageMetadata,
  upsertProgressForConversation,
  upsertSentenceAttempt,
  upsertVocabularyItems,
  type StoredMessage,
} from '../db/repository.js';
import { pickInitialGreeting } from './initialGreetings.js';
import {
  LlmFinishReasonError,
  MissingLlmApiKeyError,
  runTutorAgentLoop,
  translateTextWithLlm,
  type TranslationMode,
  type TutorMessage,
  type TutorResponseBlock,
  type TutorSentenceEvaluationBlock,
} from '../services/llmTutor.js';

type JoinPayload = {
  conversationId?: string | null;
};

type SendMessagePayload = {
  conversationId?: string | null;
  content?: string;
};

type RenamePayload = {
  conversationId?: string | null;
  title?: string;
};

type DeletePayload = {
  conversationId?: string | null;
};

type TranslatePayload = {
  mode?: string;
  text?: string;
};

type AuthenticatedSocketData = {
  authenticatedUser?: {
    exp: number;
    sub: string;
  };
};

const runningConversations = new Set<string>();
const fallbackChallengeTitle = 'Oración pendiente de identificar';

export function registerChatSocket(io: Server): void {
  io.use((socket, next) => {
    const payload =
      verifySocketAuthToken(socket.handshake.auth.token) ??
      verifySocketSessionCookie(socket);
    if (!payload) {
      next(new Error('authentication_required'));
      return;
    }

    (socket.data as AuthenticatedSocketData).authenticatedUser = payload;
    next();
  });

  io.on('connection', (socket) => {
    let currentConversationId: string | null = null;
    let pendingInitialGreeting = pickInitialGreeting();

    socket.on('conversation:join', async (payload: JoinPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversation = payload.conversationId
        ? findConversationForUser(payload.conversationId, userId)
        : null;

      if (!conversation) {
        pendingInitialGreeting = pickInitialGreeting();
        leaveConversationRoom(socket, currentConversationId);
        currentConversationId = null;
        socket.emit('conversation:ready', {
          conversation: null,
          conversationId: null,
          messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
          practice: [],
          progress: null,
          vocabulary: [],
        });
        return;
      }

      joinConversationRoom(socket, currentConversationId, conversation.id);
      currentConversationId = conversation.id;

      const messages = listMessages(conversation.id);
      if (messages.length === 0) {
        pendingInitialGreeting = pickInitialGreeting();
      }

      socket.emit('conversation:ready', {
        conversation,
        conversationId: conversation.id,
        messages:
          messages.length > 0
            ? messages
            : [createEphemeralInitialMessage(pendingInitialGreeting)],
        practice: listSentenceChallenges(conversation.id),
        progress: getProgressForConversation(conversation.id),
        vocabulary: listVocabularyForConversation(conversation.id),
      });
    });

    socket.on('message:send', async (payload: SendMessagePayload = {}) => {
      const content = payload.content?.trim();
      if (!content) {
        return;
      }

      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      let conversation = payload.conversationId
        ? findConversationForUser(payload.conversationId, userId)
        : null;

      const shouldPersistInitialGreeting =
        !conversation || listMessages(conversation.id).length === 0;
      if (!conversation) {
        conversation = createConversation(userId);
      }

      joinConversationRoom(socket, currentConversationId, conversation.id);
      currentConversationId = conversation.id;

      if (runningConversations.has(conversation.id)) {
        socket.emit('assistant:error', {
          message: 'Espera un momento: Mister F todavia esta respondiendo.',
        });
        return;
      }

      if (shouldPersistInitialGreeting) {
        addMessage(conversation.id, 'model', pendingInitialGreeting, {
          source: 'initial_greeting',
        });
        socket.emit('conversation:promoted', {
          conversation,
          conversationId: conversation.id,
        });
      }

      const userMessage = addMessage(conversation.id, 'user', content);
      io.to(conversation.id).emit('message:created', userMessage);

      await streamAssistantMessage(io, conversation.id, userId, userMessage.id);
    });

    socket.on('conversation:reset', async () => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      pendingInitialGreeting = pickInitialGreeting();
      leaveConversationRoom(socket, currentConversationId);
      currentConversationId = null;
      socket.emit('conversation:ready', {
        conversation: null,
        conversationId: null,
        messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
        practice: [],
        progress: null,
        vocabulary: [],
      });
    });

    socket.on('conversation:rename', (payload: RenamePayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      const title = normalizeConversationTitle(payload.title);
      if (!conversationId || !title) {
        socket.emit('conversation:error', {
          message: 'El titulo de la conversacion no puede estar vacio.',
        });
        return;
      }

      const conversation = renameConversationForUser(
        conversationId,
        userId,
        title,
        { updatedByUser: true },
      );
      if (!conversation) {
        socket.emit('conversation:error', {
          message: 'No pude encontrar esa conversacion.',
        });
        return;
      }

      socket.emit('conversation:renamed', {
        conversation,
        conversationId: conversation.id,
      });
      socket.to(conversation.id).emit('conversation:renamed', {
        conversation,
        conversationId: conversation.id,
      });
    });

    socket.on('conversation:delete', (payload: DeletePayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      if (!conversationId) {
        return;
      }

      const conversation = findConversationForUser(conversationId, userId);
      if (!conversation) {
        socket.emit('conversation:error', {
          message: 'No pude encontrar esa conversacion.',
        });
        return;
      }

      const wasCurrentConversation = currentConversationId === conversation.id;
      const deleted = deleteConversationForUser(conversation.id, userId);
      if (!deleted) {
        socket.emit('conversation:error', {
          message: 'No pude eliminar esa conversacion.',
        });
        return;
      }

      runningConversations.delete(conversation.id);
      io.to(conversation.id).emit('conversation:deleted', {
        conversationId: conversation.id,
        wasActive: true,
      });

      if (!wasCurrentConversation) {
        socket.emit('conversation:deleted', {
          conversationId: conversation.id,
          wasActive: false,
        });
        return;
      }

      pendingInitialGreeting = pickInitialGreeting();
      leaveConversationRoom(socket, currentConversationId);
      currentConversationId = null;
      socket.emit('conversation:ready', {
        conversation: null,
        conversationId: null,
        messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
        practice: [],
        progress: null,
        vocabulary: [],
      });
    });

    socket.on('translator:translate', async (payload: TranslatePayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const text = payload.text?.trim() ?? '';
      const mode = normalizeTranslationMode(payload.mode);
      if (!text) {
        socket.emit('translator:error', {
          message: 'Escribe algo para traducir.',
        });
        return;
      }

      try {
        const translation = await translateTextWithLlm({ mode, text });
        socket.emit('translator:result', {
          mode,
          translation,
        });
      } catch (error) {
        console.error('Translator request failed.', {
          error: serializeError(error),
          mode,
          userId,
        });
        socket.emit('translator:error', {
          message: toUserFacingError(error),
        });
      }
    });
  });
}

function verifySocketSessionCookie(socket: Socket): {
  exp: number;
  sub: string;
} | null {
  const token = getSessionTokenFromCookieHeader(socket.request.headers.cookie);
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const user = findUserBySessionTokenHash(tokenHash);
  if (!user?.emailVerified) {
    return null;
  }

  return {
    exp: Math.floor(Date.now() / 1000) + 60,
    sub: user.id,
  };
}

function getAuthenticatedUserId(socket: Socket): string | null {
  return (
    (socket.data as AuthenticatedSocketData).authenticatedUser?.sub ?? null
  );
}

function emitAuthRequired(socket: Socket): void {
  socket.emit('auth:required', {
    message:
      'Para usar Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
  });
}

function joinConversationRoom(
  socket: Socket,
  previousConversationId: string | null,
  nextConversationId: string,
): void {
  if (previousConversationId && previousConversationId !== nextConversationId) {
    socket.leave(previousConversationId);
  }

  socket.join(nextConversationId);
}

function leaveConversationRoom(
  socket: Socket,
  conversationId: string | null,
): void {
  if (conversationId) {
    socket.leave(conversationId);
  }
}

function createEphemeralInitialMessage(content: string): TutorMessage {
  return {
    content,
    role: 'model',
  };
}

function normalizeConversationTitle(title?: string): string {
  return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}

function normalizeTranslationMode(mode?: string): TranslationMode {
  return mode === 'es-en' || mode === 'en-es' ? mode : 'auto';
}

async function streamAssistantMessage(
  io: Server,
  conversationId: string,
  userId: string,
  lastUserMessageId?: number,
  startConversation = false,
): Promise<void> {
  if (runningConversations.has(conversationId)) {
    return;
  }

  runningConversations.add(conversationId);
  io.to(conversationId).emit('assistant:start');

  try {
    const conversation = findConversationForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    const messages = listMessages(conversationId);
    const currentProgress = getProgressForConversation(conversationId);
    const result = await runTutorAgentLoop(
      toTutorHistory(messages),
      {
        currentProgressMarkdown: currentProgress?.markdown ?? '',
        currentTitle: conversation.title,
        startConversation,
        titleUpdatedByUser: conversation.titleUpdatedByUser,
      },
    );

    const trimmedContent = result.content.trim();
    if (!trimmedContent) {
      throw new Error('The model returned an empty response.');
    }

    const assistantMessage = addMessage(
      conversationId,
      'model',
      trimmedContent,
      { blocks: result.blocks, model: result.model, provider: result.provider },
    );

    applyTutorBlocks({
      blocks: result.blocks,
      conversationId,
      io,
      lastUserMessageId,
      messageHistory: messages,
      userId,
    });

    io.to(conversationId).emit('assistant:done', assistantMessage);
  } catch (error) {
    console.error('Assistant response failed.', {
      conversationId,
      error: serializeError(error),
      lastUserMessageId,
      userId,
    });
    io.to(conversationId).emit('assistant:error', {
      message: toUserFacingError(error),
    });
  } finally {
    runningConversations.delete(conversationId);
  }
}

function toTutorHistory(messages: StoredMessage[]): TutorMessage[] {
  return messages.map((message) => ({
    content: message.content,
    role: message.role,
  }));
}

function applyTutorBlocks(input: {
  blocks: TutorResponseBlock[];
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  messageHistory: StoredMessage[];
  userId: string;
}): void {
  let latestEvaluation: TutorSentenceEvaluationBlock | null = null;

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

      case 'learning_progress':
        handleLearningProgressBlock(input.io, input.conversationId, block.markdown);
        break;

      case 'conversation_title':
        handleConversationTitleBlock({
          conversationId: input.conversationId,
          io: input.io,
          title: block.title,
          userId: input.userId,
        });
        break;

      case 'vocabulary_items':
        handleVocabularyItemsBlock(input.io, input.conversationId, block.items);
        break;

      case 'message':
        break;
    }
  }
}

function handleChallengeStartedBlock(
  io: Server,
  conversationId: string,
  block: Extract<TutorResponseBlock, { type: 'challenge_started' }>,
): void {
  const current = findActiveSentenceChallenge(conversationId);
  if (current) {
    console.log('[Mr. F challenge_started skipped]', {
      conversationId,
      reason: 'active_challenge_exists',
      sourceSentence: block.sourceSentence,
    });
    return;
  }

  createSentenceChallenge({
    conversationId,
    level: block.level,
    sourceSentence: block.sourceSentence,
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

  const message = updateMessageMetadata(
    input.lastUserMessageId,
    input.conversationId,
    { sentenceEvaluation: { parts: input.block.parts } },
  );
  if (!message) {
    return;
  }

  const challenge =
    findActiveSentenceChallenge(input.conversationId) ??
    createSentenceChallenge({
      conversationId: input.conversationId,
      sourceSentence:
        inferLatestSourceSentence(input.messageHistory, input.lastUserMessageId) ??
        fallbackChallengeTitle,
    });
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
    sentenceEvaluation: { parts: input.block.parts },
  });

  emitPracticeUpdated(input.io, input.conversationId);

  if (isCorrect) {
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
  const activeChallenge = findActiveSentenceChallenge(input.conversationId);
  if (!activeChallenge) {
    return;
  }

  const completedChallenge = completeSentenceChallenge(
    activeChallenge.id,
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

function handleLearningProgressBlock(
  io: Server,
  conversationId: string,
  markdown: string,
): void {
  const progress = upsertProgressForConversation(conversationId, markdown);
  io.to(conversationId).emit('progress:updated', {
    conversationId,
    progress,
  });
}

function handleVocabularyItemsBlock(
  io: Server,
  conversationId: string,
  items: Extract<TutorResponseBlock, { type: 'vocabulary_items' }>['items'],
): void {
  const vocabulary = upsertVocabularyItems(conversationId, items);
  io.to(conversationId).emit('vocabulary:updated', {
    conversationId,
    vocabulary,
  });
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

function inferLatestSourceSentence(
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
  if (value.split(/\s+/).filter(Boolean).length < 4) {
    return false;
  }

  const spanishSignals = [
    /[¿¡áéíóúñü]/i,
    /\b(el|la|los|las|un|una|unos|unas|de|del|que|con|para|por|donde|dónde|cuando|cuándo|cuanto|cuánto|me|mi|quiero|gustaria|gustaría|esta|está|son|es)\b/i,
  ];
  const englishSignals =
    /\b(the|would|like|ticket|please|where|nearest|bus|stop|train|to|from|round-trip|return)\b/i;

  return (
    spanishSignals.some((pattern) => pattern.test(value)) &&
    !englishSignals.test(value)
  );
}

function toUserFacingError(error: unknown): string {
  if (error instanceof MissingLlmApiKeyError) {
    return `Falta configurar la API key del proveedor "${error.provider}" en ecosystem.config.cjs.`;
  }

  if (error instanceof LlmFinishReasonError) {
    return error.message;
  }

  if (error instanceof Error) {
    return `No pude hablar con el modelo: ${error.message}`;
  }

  return 'No pude hablar con el modelo por un error inesperado.';
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  return {
    cause: error.cause,
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}
