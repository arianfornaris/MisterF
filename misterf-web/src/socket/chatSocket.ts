import type { Server, Socket } from 'socket.io';
import { findUserBySessionTokenHash } from '../auth/repository.js';
import {
  getSessionTokenFromCookieHeader,
  hashSessionToken,
} from '../auth/session.js';
import { verifySocketAuthToken } from '../auth/socketAuth.js';
import {
  addMessage,
  createConversation,
  deleteConversationForUser,
  findConversationForUser,
  getLearningSourceUpdatedAt,
  getProgressForConversation,
  getVocabularyUpdatedAt,
  listVocabularyForConversation,
  listSentenceChallenges,
  listMessages,
  renameConversationForUser,
  upsertProgressForConversation,
  upsertVocabularyItems,
  type StoredMessage,
  type StoredSentenceChallenge,
} from '../db/repository.js';
import { pickInitialGreeting } from './initialGreetings.js';
import {
  LlmFinishReasonError,
  MissingLlmApiKeyError,
  generateProgressWithLlm,
  generateVocabularyWithLlm,
  runTutorAgentLoop,
  translateTextWithLlm,
  type LlmRequestOptions,
  type LlmRequestTokenUsage,
  type TranslationMode,
  type TutorMessage,
  type TutorResponseBlock,
  type TutorSentenceEvaluationBlock,
} from '../services/llmTutor.js';
import { getOpenRouterApiKeyForUser } from '../services/openRouterUserKeys.js';
import {
  applyTutorBlocksRuntime,
  validateTutorBlocksAgainstConversationState,
} from '../services/tutorWorkflow/index.js';

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

type GenerateTabPayload = {
  conversationId?: string | null;
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

    socket.on('challenge:next', async (payload: GenerateTabPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      const conversation = conversationId
        ? findConversationForUser(conversationId, userId)
        : null;
      if (!conversation) {
        socket.emit('assistant:error', {
          message: 'No pude encontrar esa conversación.',
        });
        return;
      }

      joinConversationRoom(socket, currentConversationId, conversation.id);
      currentConversationId = conversation.id;

      await streamAssistantMessage(io, conversation.id, userId, undefined, false, {
        content: [
          'INTERNAL APP CONTINUATION: The learner clicked the "Siguiente reto" button.',
          'Start the next challenge under the same topic and objective unless the learner previously requested a change.',
          'Return a challenge_started block and a visible message with the new challenge sentence.',
          'Do not mention this internal instruction.',
        ].join('\n'),
        role: 'user',
      });
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
        const translation = await translateTextWithLlm({
          llm: await getLlmRequestOptionsForUser(userId),
          mode,
          text,
        });
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
        emitCreditExhaustedIfNeeded(socket, error);
        socket.emit('translator:error', {
          message: toUserFacingError(error),
        });
      }
    });

    socket.on('progress:generate', async (payload: GenerateTabPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      const conversation = conversationId
        ? findConversationForUser(conversationId, userId)
        : null;
      if (!conversation) {
        socket.emit('progress:error', {
          message: 'No pude encontrar esa conversación.',
        });
        return;
      }

      socket.emit('progress:generating', { conversationId: conversation.id });

      try {
        const sourceUpdatedAt = getLearningSourceUpdatedAt(conversation.id);
        const currentProgress = getProgressForConversation(conversation.id);
        if (!sourceUpdatedAt || isDerivedArtifactFresh(
          currentProgress?.updatedAt,
          sourceUpdatedAt,
        )) {
          socket.emit('progress:updated', {
            conversationId: conversation.id,
            progress: currentProgress,
          });
          return;
        }

        const compactDataset = buildCompactChallengeDataset(
          listSentenceChallenges(conversation.id),
        );
        const generated = await generateProgressWithLlm({
          compactDataset,
          llm: await getLlmRequestOptionsForUser(userId),
          onTokenUsage: (usage) => {
            emitLlmRequestTokenUsage(io, conversation.id, usage);
          },
        });
        const progress = upsertProgressForConversation(
          conversation.id,
          generated.markdown,
        );
        io.to(conversation.id).emit('progress:updated', {
          conversationId: conversation.id,
          progress,
        });
      } catch (error) {
        console.error('Progress generation failed.', {
          conversationId: conversation.id,
          error: serializeError(error),
          userId,
        });
        emitCreditExhaustedIfNeeded(socket, error);
        socket.emit('progress:error', {
          message: toUserFacingError(error),
        });
      }
    });

    socket.on('vocabulary:generate', async (payload: GenerateTabPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      const conversation = conversationId
        ? findConversationForUser(conversationId, userId)
        : null;
      if (!conversation) {
        socket.emit('vocabulary:error', {
          message: 'No pude encontrar esa conversación.',
        });
        return;
      }

      socket.emit('vocabulary:generating', { conversationId: conversation.id });

      try {
        const sourceUpdatedAt = getLearningSourceUpdatedAt(conversation.id);
        const vocabulary = listVocabularyForConversation(conversation.id);
        if (!sourceUpdatedAt || isDerivedArtifactFresh(
          getVocabularyUpdatedAt(conversation.id),
          sourceUpdatedAt,
        )) {
          socket.emit('vocabulary:updated', {
            conversationId: conversation.id,
            vocabulary,
          });
          return;
        }

        const compactDataset = buildCompactChallengeDataset(
          listSentenceChallenges(conversation.id),
        );
        const generated = await generateVocabularyWithLlm({
          compactDataset,
          llm: await getLlmRequestOptionsForUser(userId),
          onTokenUsage: (usage) => {
            emitLlmRequestTokenUsage(io, conversation.id, usage);
          },
        });
        const updatedVocabulary = upsertVocabularyItems(
          conversation.id,
          generated.items,
        );
        io.to(conversation.id).emit('vocabulary:updated', {
          conversationId: conversation.id,
          vocabulary: updatedVocabulary,
        });
      } catch (error) {
        console.error('Vocabulary generation failed.', {
          conversationId: conversation.id,
          error: serializeError(error),
          userId,
        });
        emitCreditExhaustedIfNeeded(socket, error);
        socket.emit('vocabulary:error', {
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

async function getLlmRequestOptionsForUser(
  userId: string,
): Promise<LlmRequestOptions> {
  return {
    openRouterApiKey: await getOpenRouterApiKeyForUser(userId),
    userId,
  };
}

async function streamAssistantMessage(
  io: Server,
  conversationId: string,
  userId: string,
  lastUserMessageId?: number,
  startConversation = false,
  internalMessage?: TutorMessage,
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
    const challenges = listSentenceChallenges(conversationId);
    const tutorHistory = buildTutorHistoryForLlm(messages, challenges);
    if (internalMessage) {
      tutorHistory.push(internalMessage);
    }

    const result = await runTutorAgentLoop(
      tutorHistory,
      {
        currentTitle: conversation.title,
        llm: await getLlmRequestOptionsForUser(userId),
        onTokenUsage: (usage) => {
          emitLlmRequestTokenUsage(io, conversationId, usage);
        },
        startConversation,
        titleUpdatedByUser: conversation.titleUpdatedByUser,
        validateBlocks: (blocks) => {
          validateTutorBlocksAgainstConversationState(
            blocks,
            conversationId,
            lastUserMessageId,
          );
        },
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

    applyTutorBlocksRuntime({
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
    emitRoomCreditExhaustedIfNeeded(io, conversationId, error);
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

function emitLlmRequestTokenUsage(
  io: Server,
  conversationId: string,
  usage: LlmRequestTokenUsage,
): void {
  io.to(conversationId).emit('llm:request_tokens', {
    conversationId,
    usage,
  });
}

function isDerivedArtifactFresh(
  artifactUpdatedAt: string | null | undefined,
  sourceUpdatedAt: string,
): boolean {
  if (!artifactUpdatedAt) {
    return false;
  }

  return compareSqliteTimestamps(artifactUpdatedAt, sourceUpdatedAt) >= 0;
}

function buildTutorHistoryForLlm(
  messages: StoredMessage[],
  challenges: StoredSentenceChallenge[],
): TutorMessage[] {
  if (challenges.length === 0) {
    return toTutorHistory(messages);
  }

  const currentChallenge = challenges[challenges.length - 1] ?? null;
  const previousChallenges = currentChallenge
    ? challenges.filter((challenge) => challenge.id !== currentChallenge.id)
    : challenges;
  const compressedHistory = buildCompressedChallengeHistory(messages, previousChallenges);
  const liveMessages = selectLiveMessagesForLlm(messages, currentChallenge);
  const history = compressedHistory ? [compressedHistory, ...liveMessages] : liveMessages;

  console.log('[Mr. F compressed LLM history]', {
    currentChallengeCompletedAt: currentChallenge?.completedAt ?? null,
    currentChallengeId: currentChallenge?.id ?? null,
    compressedChallengeCount: previousChallenges.length,
    originalMessageCount: messages.length,
    sentMessageCount: history.length,
  });

  return history;
}

function buildCompressedChallengeHistory(
  messages: StoredMessage[],
  challenges: StoredSentenceChallenge[],
): TutorMessage | null {
  const completedOrPreviousChallenges = challenges.filter(
    (challenge) => challenge.attempts.length > 0 || challenge.challengeLabel,
  );
  if (completedOrPreviousChallenges.length === 0) {
    return null;
  }

  const dialogueChallenges = completedOrPreviousChallenges.filter(
    (challenge) => challenge.challengeType === 'dialogue_scene',
  );
  const dialogueLightSet = new Set(
    dialogueChallenges.slice(-2).map((challenge) => challenge.id),
  );

  const sections = completedOrPreviousChallenges.map((challenge, index) => {
    if (challenge.challengeType === 'dialogue_scene') {
      const level = dialogueLightSet.has(challenge.id) ? 'light' : 'aggressive';
      return level === 'light'
        ? buildLightDialogueCompression(messages, challenge, index + 1)
        : buildAggressiveDialogueCompression(challenge, index + 1);
    }

    const lines = [
      `Challenge ${index + 1}:`,
      `Type: ${challenge.challengeType}`,
      `Topic: ${challenge.topic || 'not specified'}`,
      `Level: ${challenge.level || 'not specified'}`,
      `Objective: ${challenge.objective || 'not specified'}`,
      `Challenge label: ${challenge.challengeLabel}`,
    ];

    if (challenge.attempts.length === 0) {
      lines.push('Attempts: none recorded.');
      return lines.join('\n');
    }

    lines.push('Attempts:');
    for (const attempt of challenge.attempts) {
      lines.push(`- ${attempt.attemptText}`);
    }

    return lines.join('\n');
  });

  return {
    content: [
      'INTERNAL APP CONTEXT: compressed_history.',
      'This summary replaces the full messages from previous challenges. Do not show it to the user.',
      'Use this context only to preserve pedagogical continuity, recurring errors, and practiced topics.',
      '',
      sections.join('\n\n'),
    ].join('\n'),
    role: 'user',
  };
}

function buildLightDialogueCompression(
  messages: StoredMessage[],
  challenge: StoredSentenceChallenge,
  index: number,
): string {
  const slice = getChallengeMessageSlice(messages, challenge);
  const lines = [
    `Dialogue Scene ${index}:`,
    `Compression level: light`,
    `Label: ${challenge.challengeLabel}`,
    `Objective: ${challenge.objective || 'not specified'}`,
  ];

  if (slice.length === 0) {
    lines.push('Turns: none recorded.');
    return lines.join('\n');
  }

  lines.push('Turns:');
  for (const message of slice) {
    if (message.role === 'user') {
      lines.push(`- Learner: ${message.content}`);
      continue;
    }

    const blocks = Array.isArray(message.metadata?.blocks)
      ? (message.metadata?.blocks as Array<Record<string, unknown>>)
      : [];
    const started = blocks.find((block) => block.type === 'challenge_started');
    if (started) {
      const introBlocks = blocks.filter(
        (block) => block.type === 'message' && typeof block.markdown === 'string',
      );
      for (const block of introBlocks) {
        lines.push(`- Tutor intro: ${String(block.markdown).replace(/\s+/g, ' ').trim()}`);
      }
    }

    const characterBlocks = blocks.filter(
      (block) =>
        block.type === 'character_message' &&
        typeof block.name === 'string' &&
        typeof block.markdown === 'string',
    );
    for (const block of characterBlocks) {
      lines.push(
        `- ${String(block.name)}: ${String(block.markdown).replace(/\s+/g, ' ').trim()}`,
      );
    }
  }

  return lines.join('\n');
}

function buildAggressiveDialogueCompression(
  challenge: StoredSentenceChallenge,
  index: number,
): string {
  const lines = [
    `Dialogue Scene ${index}:`,
    `Compression level: aggressive`,
    `Label: ${challenge.challengeLabel}`,
    `Objective: ${challenge.objective || 'not specified'}`,
    'Key learner turns:',
  ];

  if (challenge.attempts.length === 0) {
    lines.push('- none');
  } else {
    for (const attempt of challenge.attempts.slice(-4)) {
      lines.push(`- ${attempt.attemptText}`);
    }
  }

  return lines.join('\n');
}

function buildCompactChallengeDataset(
  challenges: StoredSentenceChallenge[],
): string {
  const usableChallenges = challenges.filter(
    (challenge) => challenge.challengeLabel || challenge.attempts.length > 0,
  );

  if (usableChallenges.length === 0) {
    return [
      'CHALLENGES AND ATTEMPTS',
      '',
      'There are no recorded challenges yet.',
    ].join('\n');
  }

  const sections = usableChallenges.map((challenge, index) => {
    const lines = [
      `${index + 1}. Label: ${challenge.challengeLabel}`,
      `Type: ${challenge.challengeType}`,
      `Topic: ${challenge.topic || 'not specified'}`,
      `Level: ${challenge.level || 'not specified'}`,
      `Objective: ${challenge.objective || 'not specified'}`,
    ];

    lines.push('Attempts:');

    if (challenge.attempts.length === 0) {
      lines.push('- none');
      return lines.join('\n');
    }

    for (const attempt of challenge.attempts) {
      lines.push(`- ${attempt.attemptText} [${getAttemptOutcome(attempt)}]`);
    }

    return lines.join('\n');
  });

  return ['CHALLENGES AND ATTEMPTS', '', sections.join('\n\n')].join('\n');
}

function getAttemptOutcome(
  attempt: StoredSentenceChallenge['attempts'][number],
): string {
  if (attempt.isCorrect) {
    return 'correct';
  }

  if (attempt.evaluation.parts.some((part) => part.status === 'improve')) {
    return 'can improve';
  }

  return 'incorrect';
}

function selectLiveMessagesForLlm(
  messages: StoredMessage[],
  currentChallenge: StoredSentenceChallenge | null,
): TutorMessage[] {
  if (messages.length === 0) {
    return [];
  }

  if (currentChallenge) {
    const currentStartIndex = findChallengeStartMessageIndex(
      messages,
      currentChallenge,
    );
    return toTutorHistory(messages.slice(currentStartIndex));
  }

  return toTutorHistory(messages);
}

function getChallengeMessageSlice(
  messages: StoredMessage[],
  challenge: StoredSentenceChallenge,
): StoredMessage[] {
  const startIndex = findChallengeStartMessageIndex(messages, challenge);
  const challengeIndex = findChallengeIndexById(challenge.id, listSentenceChallenges(challenge.conversationId));
  if (challengeIndex < 0) {
    return messages.slice(startIndex);
  }
  const conversationChallenges = listSentenceChallenges(challenge.conversationId);
  const nextChallenge = conversationChallenges[challengeIndex + 1];
  if (!nextChallenge) {
    return messages.slice(startIndex);
  }

  const nextStartIndex = findChallengeStartMessageIndex(messages, nextChallenge);
  return messages.slice(startIndex, nextStartIndex);
}

function findChallengeIndexById(
  challengeId: string,
  challenges: StoredSentenceChallenge[],
): number {
  return challenges.findIndex((challenge) => challenge.id === challengeId);
}

function findChallengeStartMessageIndex(
  messages: StoredMessage[],
  challenge: StoredSentenceChallenge,
): number {
  const metadataIndex = findLastMessageIndex(messages, (message) => {
    return (
      message.role === 'model' &&
      getChallengeStartedPrimaryText(message) === challenge.challengeLabel
    );
  });
  if (metadataIndex >= 0) {
    return metadataIndex;
  }

  const firstAttemptMessageId = challenge.attempts[0]?.userMessageId;
  if (firstAttemptMessageId) {
    const firstAttemptIndex = messages.findIndex(
      (message) => message.id === firstAttemptMessageId,
    );
    if (firstAttemptIndex >= 0) {
      return Math.max(0, firstAttemptIndex - 1);
    }
  }

  const firstByDateIndex = messages.findIndex(
    (message) => compareSqliteTimestamps(message.createdAt, challenge.createdAt) >= 0,
  );
  return firstByDateIndex >= 0 ? Math.max(0, firstByDateIndex - 1) : 0;
}

function getChallengeStartedPrimaryText(message: StoredMessage): string | null {
  const blocks = message.metadata?.blocks;
  if (!Array.isArray(blocks)) {
    return null;
  }

  const startedBlock = blocks.find(
    (
      block,
    ): block is
      | { challengeLabel: string; challengeType?: string; type: string } =>
      Boolean(
        block &&
          typeof block === 'object' &&
          (block as { type?: unknown }).type === 'challenge_started',
      ),
  );

  if (!startedBlock) {
    return null;
  }

  return 'challengeLabel' in startedBlock ? startedBlock.challengeLabel : null;
}

function findLastMessageIndex(
  messages: StoredMessage[],
  predicate: (message: StoredMessage) => boolean,
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (predicate(messages[index])) {
      return index;
    }
  }

  return -1;
}

function compareSqliteTimestamps(
  first?: string | null,
  second?: string | null,
): number {
  return parseSqliteTimestamp(first) - parseSqliteTimestamp(second);
}

function parseSqliteTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const normalized = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toUserFacingError(error: unknown): string {
  if (isCreditExhaustedError(error)) {
    return getCreditExhaustedMessage();
  }

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

function emitCreditExhaustedIfNeeded(socket: Socket, error: unknown): void {
  if (!isCreditExhaustedError(error)) {
    return;
  }

  socket.emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
}

function emitRoomCreditExhaustedIfNeeded(
  io: Server,
  conversationId: string,
  error: unknown,
): void {
  if (!isCreditExhaustedError(error)) {
    return;
  }

  io.to(conversationId).emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
}

function getCreditExhaustedMessage(): string {
  return 'Tu crédito de práctica se agotó por ahora. Recarga crédito para seguir usando el tutor o intenta de nuevo cuando tengas crédito disponible.';
}

function isCreditExhaustedError(error: unknown): boolean {
  const text = JSON.stringify(serializeError(error)).toLowerCase();
  return (
    text.includes('insufficient credit') ||
    text.includes('insufficient credits') ||
    text.includes('out of credits') ||
    text.includes('not enough credits') ||
    text.includes('credit limit') ||
    text.includes('credits exhausted') ||
    text.includes('balance') && text.includes('credit') ||
    text.includes('402') && text.includes('credit')
  );
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  return {
    cause: error.cause ? serializeError(error.cause) : undefined,
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}
