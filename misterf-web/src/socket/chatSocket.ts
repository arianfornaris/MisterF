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
  findConversationForUser,
  findCurrentSentenceChallenge,
  getLearningSourceUpdatedAt,
  getProgressForConversation,
  getVocabularyUpdatedAt,
  listVocabularyForConversation,
  listSentenceChallenges,
  listMessages,
  renameConversationForUser,
  updateSentenceChallengeMetadata,
  updateMessageMetadata,
  upsertProgressForConversation,
  upsertSentenceAttempt,
  upsertVocabularyItems,
  type ChallengeMetadata,
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
          assertTutorBlocksFitConversationState(blocks, conversationId);
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
    (challenge) => challenge.attempts.length > 0 || challenge.sourceSentence,
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
      `Challenge sentence: ${challenge.sourceSentence}`,
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
  const dialogue = challenge.metadata?.dialogue;
  const slice = getChallengeMessageSlice(messages, challenge);
  const lines = [
    `Dialogue Scene ${index}:`,
    `Compression level: light`,
    `Scenario: ${dialogue?.scenario || challenge.sourceSentence}`,
    `Learner role: ${dialogue?.learnerRole || 'not specified'}`,
    `Character: ${dialogue?.characterName || 'Character'} (${dialogue?.characterRole || 'not specified'})`,
    `Objective: ${challenge.objective || 'not specified'}`,
    `Goals: ${(dialogue?.goals || []).join(' | ') || 'not specified'}`,
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
  const dialogue = challenge.metadata?.dialogue;
  const lines = [
    `Dialogue Scene ${index}:`,
    `Compression level: aggressive`,
    `Scenario: ${dialogue?.scenario || challenge.sourceSentence}`,
    `Learner role: ${dialogue?.learnerRole || 'not specified'}`,
    `Character: ${dialogue?.characterName || 'Character'} (${dialogue?.characterRole || 'not specified'})`,
    `Objective: ${challenge.objective || 'not specified'}`,
    `Goals completed: ${(dialogue?.completedGoals || []).join(' | ') || 'none'}`,
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
    (challenge) => challenge.sourceSentence || challenge.attempts.length > 0,
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
      `${index + 1}. Sentence: ${challenge.sourceSentence}`,
      `Type: ${challenge.challengeType}`,
      `Topic: ${challenge.topic || 'not specified'}`,
      `Level: ${challenge.level || 'not specified'}`,
      `Objective: ${challenge.objective || 'not specified'}`,
    ];

    if (challenge.challengeType === 'dialogue_scene') {
      const dialogue = challenge.metadata?.dialogue;
      lines.push(`Scenario: ${dialogue?.scenario || challenge.sourceSentence}`);
      lines.push(`Learner role: ${dialogue?.learnerRole || 'not specified'}`);
      lines.push(
        `Character: ${dialogue?.characterName || 'Character'} (${dialogue?.characterRole || 'not specified'})`,
      );
      lines.push(`Goals: ${(dialogue?.goals || []).join(' | ') || 'not specified'}`);
      lines.push(
        `Completed goals: ${(dialogue?.completedGoals || []).join(' | ') || 'none'}`,
      );
    }

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
      getChallengeStartedPrimaryText(message) === challenge.sourceSentence
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
      | { challengeType?: string; sourceSentence: string; type: string }
      | {
          challengeType: 'dialogue_scene';
          dialogue: { scenario: string };
          type: string;
        } =>
      Boolean(
        block &&
          typeof block === 'object' &&
          (block as { type?: unknown }).type === 'challenge_started',
      ),
  );

  if (!startedBlock) {
    return null;
  }

  if (
    startedBlock.challengeType === 'dialogue_scene' &&
    'dialogue' in startedBlock &&
    typeof startedBlock.dialogue?.scenario === 'string'
  ) {
    return startedBlock.dialogue.scenario;
  }

  return 'sourceSentence' in startedBlock ? startedBlock.sourceSentence : null;
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

      case 'dialogue_progress':
        handleDialogueProgressBlock({
          block,
          conversationId: input.conversationId,
          io: input.io,
          latestEvaluation,
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
}

function assertTutorBlocksFitConversationState(
  blocks: TutorResponseBlock[],
  conversationId: string,
): void {
  const current = findCurrentSentenceChallenge(conversationId);
  assertDialogueBlocksFitCurrentState(blocks, current);

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
    startedBlock.challengeType === 'dialogue_scene' && 'dialogue' in startedBlock
      ? startedBlock.dialogue.scenario
      : 'sourceSentence' in startedBlock
        ? startedBlock.sourceSentence
        : null;

  console.error('[Mr. F tutor blocks rejected before apply]', JSON.stringify({
    conversationId,
    currentChallengeCompletedAt: current.completedAt,
    currentChallengeId: current.id,
    currentChallengeText: current.sourceSentence,
    reason: 'challenge_started_while_current_challenge_not_completed',
    requestedChallengeText,
  }, null, 2));

  throw new Error(
    'The response is inconsistent with the current conversation state: there is already an open challenge, so you must not emit challenge_started yet. Continue the current challenge instead, or wait until the learner explicitly asks for the next challenge after completion.',
  );
}

function assertDialogueBlocksFitCurrentState(
  blocks: TutorResponseBlock[],
  currentChallenge: StoredSentenceChallenge | null,
): void {
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
        block.challengeType === 'dialogue_scene' && 'dialogue' in block
          ? block.dialogue.scenario
          : 'sourceSentence' in block
            ? block.sourceSentence
            : null,
    });
    return;
  }

  createSentenceChallenge({
    challengeType: block.challengeType ?? 'produce_en',
    conversationId,
    level: block.level,
    metadata: block.challengeType === 'dialogue_scene' && 'dialogue' in block
      ? {
          dialogue: {
            ...block.dialogue,
            completedGoals: [],
          },
        }
      : null,
    objective: block.objective,
    sourceSentence:
      block.challengeType === 'dialogue_scene' && 'dialogue' in block
        ? block.dialogue.scenario
        : 'sourceSentence' in block
          ? block.sourceSentence
          : fallbackChallengeTitle,
    topic: block.topic,
  });
  emitPracticeUpdated(io, conversationId);
}

function handleDialogueProgressBlock(input: {
  block: Extract<TutorResponseBlock, { type: 'dialogue_progress' }>;
  conversationId: string;
  io: Server;
  latestEvaluation: TutorSentenceEvaluationBlock | null;
}): void {
  const current = findCurrentSentenceChallenge(input.conversationId);
  if (!current || current.challengeType !== 'dialogue_scene') {
    return;
  }

  const dialogue = current.metadata?.dialogue;
  if (!dialogue) {
    return;
  }

  const completedGoals = mergeCompletedDialogueGoals(
    dialogue.goals,
    dialogue.completedGoals,
    input.block.completedGoals,
  );
  const nextMetadata: ChallengeMetadata = {
    dialogue: {
      ...dialogue,
      completedGoals,
    },
  };
  const updatedChallenge = updateSentenceChallengeMetadata(
    current.id,
    input.conversationId,
    nextMetadata,
  );
  emitPracticeUpdated(input.io, input.conversationId);

  if (
    updatedChallenge &&
    !updatedChallenge.completedAt &&
    dialogueGoalsCompleted(updatedChallenge) &&
    evaluationIsFullyCorrect(input.latestEvaluation)
  ) {
    completeAndCelebrateChallenge({
      conversationId: input.conversationId,
      io: input.io,
      score: 1,
      source: 'dialogue_progress',
    });
  }
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
      sourceSentence:
        inferLatestSourceSentence(input.messageHistory, input.lastUserMessageId) ??
        fallbackChallengeTitle,
    });

  const message = updateMessageMetadata(
    input.lastUserMessageId,
    input.conversationId,
    {
      sentenceEvaluation: {
        challengeType: challenge.challengeType,
        parts: input.block.parts,
        sourceSentence: challenge.sourceSentence,
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
      sourceSentence: challenge.sourceSentence,
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
  if (
    currentChallenge?.challengeType === 'dialogue_scene' &&
    !dialogueGoalsCompleted(currentChallenge)
  ) {
    console.log('[Mr. F challenge_completed skipped]', {
      conversationId: input.conversationId,
      reason: 'dialogue_goals_not_completed',
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

function dialogueGoalsCompleted(challenge: StoredSentenceChallenge): boolean {
  if (challenge.challengeType !== 'dialogue_scene') {
    return true;
  }

  const goals = challenge.metadata?.dialogue?.goals ?? [];
  const completedGoals = challenge.metadata?.dialogue?.completedGoals ?? [];
  return goals.length > 0 && completedGoals.length >= goals.length;
}

function mergeCompletedDialogueGoals(
  canonicalGoals: string[],
  existingCompletedGoals: string[],
  incomingCompletedGoals: string[],
): string[] {
  const merged = new Map<string, string>();

  for (const goal of canonicalGoals) {
    if (goal.trim()) {
      merged.set(normalizeGoalText(goal), goal);
    }
  }

  const completed = new Set<string>();
  for (const goal of [...existingCompletedGoals, ...incomingCompletedGoals]) {
    const matchedGoal = findMatchingDialogueGoal(goal, canonicalGoals);
    if (matchedGoal) {
      completed.add(matchedGoal);
    }
  }

  return canonicalGoals.filter((goal) => completed.has(goal));
}

function findMatchingDialogueGoal(
  candidate: string,
  canonicalGoals: string[],
): string | null {
  const normalizedCandidate = normalizeGoalText(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  for (const goal of canonicalGoals) {
    const normalizedGoal = normalizeGoalText(goal);
    if (
      normalizedGoal === normalizedCandidate ||
      normalizedGoal.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedGoal)
    ) {
      return goal;
    }
  }

  return null;
}

function normalizeGoalText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
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
