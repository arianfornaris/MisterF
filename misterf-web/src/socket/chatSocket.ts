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
  findMessageInConversation,
  listMessages,
  renameConversationForUser,
  updateMessageMetadata,
  type StoredMessage,
} from '../db/repository.js';
import { pickInitialGreeting } from './initialGreetings.js';
import {
  LlmFinishReasonError,
  MissingLlmApiKeyError,
  runTutorAgentLoop,
  translateTextWithLlm,
  type LlmRequestOptions,
  type LlmRequestTokenUsage,
  type TranslationMode,
  type TutorMessage,
  type TutorMatchingPairsBlock,
} from '../services/llmTutor.js';
import { getOpenRouterApiKeyForUser } from '../services/openRouterUserKeys.js';
import { applyTutorBlocksRuntime } from '../services/tutorWorkflow/index.js';

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

type MatchingExerciseCompletedPayload = {
  blockIndex?: number;
  conversationId?: string | null;
  incorrectAttempts?: Array<{
    leftId?: string;
    rightId?: string;
  }>;
  messageId?: number;
  totalAttempts?: number;
};

type AuthenticatedSocketData = {
  authenticatedUser?: {
    exp: number;
    sub: string;
  };
};

const runningConversations = new Set<string>();

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

    socket.on(
      'exercise:matching_completed',
      async (payload: MatchingExerciseCompletedPayload = {}) => {
        const userId = getAuthenticatedUserId(socket);
        if (!userId) {
          emitAuthRequired(socket);
          return;
        }

        const conversationId = payload.conversationId?.trim();
        const messageId = normalizePositiveInteger(payload.messageId);
        const blockIndex = normalizeNonNegativeInteger(payload.blockIndex);
        const totalAttempts = normalizePositiveInteger(payload.totalAttempts) ?? 0;
        if (!conversationId || !messageId || blockIndex === null) {
          return;
        }

        const conversation = findConversationForUser(conversationId, userId);
        if (!conversation) {
          socket.emit('conversation:error', {
            message: 'No pude encontrar esa conversacion.',
          });
          return;
        }

        if (runningConversations.has(conversationId)) {
          socket.emit('assistant:error', {
            message: 'Espera un momento: Mister F todavia esta respondiendo.',
          });
          return;
        }

        const message = findMessageInConversation(messageId, conversationId);
        if (!message || message.role !== 'model') {
          return;
        }

        const blocks = Array.isArray(message.metadata?.blocks)
          ? message.metadata.blocks
          : [];
        const block = blocks[blockIndex];
        if (!isMatchingPairsBlock(block)) {
          return;
        }

        const incorrectAttempts = normalizeIncorrectAttempts(
          payload.incorrectAttempts,
          block,
        );
        const nextResults = {
          ...((message.metadata?.matchingExerciseResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            completedAt: new Date().toISOString(),
            incorrectAttempts,
            totalAttempts,
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          matchingExerciseResults: nextResults,
        });
        if (updatedMessage) {
          io.to(conversationId).emit('message:updated', updatedMessage);
        }

        await streamAssistantMessage(
          io,
          conversationId,
          userId,
          undefined,
          false,
          [
            {
              content: buildMatchingPairsCompletionContext({
                block,
                incorrectAttempts,
                totalAttempts,
              }),
              role: 'user',
            },
          ],
        );
      },
    );
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
  extraHistory: TutorMessage[] = [],
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
    const result = await runTutorAgentLoop(
      [...toTutorHistory(messages), ...extraHistory],
      {
        currentTitle: conversation.title,
        llm: await getLlmRequestOptionsForUser(userId),
        onTokenUsage: (usage) => {
          emitLlmRequestTokenUsage(io, conversationId, usage);
        },
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

    applyTutorBlocksRuntime({
      blocks: result.blocks,
      conversationId,
      io,
      lastUserMessageId,
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

function normalizePositiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function isMatchingPairsBlock(value: unknown): value is TutorMatchingPairsBlock {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === 'matching_pairs' &&
      Array.isArray((value as Record<string, unknown>).leftItems) &&
      Array.isArray((value as Record<string, unknown>).rightItems) &&
      Array.isArray((value as Record<string, unknown>).correctPairs),
  );
}

function normalizeIncorrectAttempts(
  attempts: MatchingExerciseCompletedPayload['incorrectAttempts'],
  block: TutorMatchingPairsBlock,
): Array<{ leftId: string; rightId: string }> {
  const validLeftIds = new Set(block.leftItems.map((item) => item.id));
  const validRightIds = new Set(block.rightItems.map((item) => item.id));
  const unique = new Set<string>();
  const normalized: Array<{ leftId: string; rightId: string }> = [];

  for (const item of attempts ?? []) {
    const leftId = item?.leftId?.trim();
    const rightId = item?.rightId?.trim();
    if (!leftId || !rightId) {
      continue;
    }

    if (!validLeftIds.has(leftId) || !validRightIds.has(rightId)) {
      continue;
    }

    const key = `${leftId}::${rightId}`;
    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    normalized.push({ leftId, rightId });
  }

  return normalized;
}

function buildMatchingPairsCompletionContext(input: {
  block: TutorMatchingPairsBlock;
  incorrectAttempts: Array<{ leftId: string; rightId: string }>;
  totalAttempts: number;
}): string {
  const leftLookup = new Map(
    input.block.leftItems.map((item) => [item.id, item.text]),
  );
  const rightLookup = new Map(
    input.block.rightItems.map((item) => [item.id, item.text]),
  );

  const correctPairs = input.block.correctPairs.map((pair) => ({
    left: leftLookup.get(pair.leftId) ?? pair.leftId,
    right: rightLookup.get(pair.rightId) ?? pair.rightId,
  }));

  const incorrectPairs =
    input.incorrectAttempts.length > 0
      ? input.incorrectAttempts
          .map((pair) => ({
            left: leftLookup.get(pair.leftId) ?? pair.leftId,
            right: rightLookup.get(pair.rightId) ?? pair.rightId,
          }))
          .map((pair) => `- ${pair.left} -> ${pair.right}`)
          .join('\n')
      : '- none';

  return [
    'INTERNAL MATCHING EXERCISE COMPLETED.',
    'The learner completed a matching_pairs exercise in the UI.',
    'Use this as teacher-only context. Do not mention the existence of the internal report.',
    input.block.prompt ? `Exercise prompt: ${input.block.prompt}` : '',
    `Total attempts: ${Math.max(0, input.totalAttempts)}`,
    'Correct pairs:',
    ...correctPairs.map((pair) => `- ${pair.left} -> ${pair.right}`),
    'Incorrect attempts before success:',
    incorrectPairs,
    'You may briefly reinforce the pairs that were difficult, then continue naturally.',
  ]
    .filter(Boolean)
    .join('\n');
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
    (text.includes('balance') && text.includes('credit')) ||
    (text.includes('402') && text.includes('credit'))
  );
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      cause: serializeError(error.cause),
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      text: typeof record.text === 'string' ? record.text.slice(0, 6000) : undefined,
    };
  }

  return error;
}
