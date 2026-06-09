import type { Server, Socket } from 'socket.io';
import {
  findUserById,
  findUserBySessionTokenHash,
} from '../auth/repository.js';
import {
  getSessionTokenFromCookieHeader,
  hashSessionToken,
} from '../auth/session.js';
import { verifySocketAuthToken } from '../auth/socketAuth.js';
import {
  addMessage,
  ensureUserHasProfile,
  createConversation,
  deleteConversationForUser,
  deleteConversationTutorPlan,
  findConversationForUser,
  findProfileForUser,
  getConversationChatRoomReportSnapshot,
  getConversationPracticeModuleSnapshot,
  getConversationTutorPlan,
  getConversationTutorReportSnapshot,
  findMessageInConversation,
  listMessages,
  renameConversationForUser,
  updateConversationModelTierForUser,
  updateMessageMetadata,
  type StoredMessage,
  type StoredProfile,
} from '../db/repository.js';
import { getActiveProfileIdFromCookieHeader } from '../auth/profiles.js';
import { pickInitialGreeting } from './initialGreetings.js';
import {
  LlmFinishReasonError,
  MissingLlmApiKeyError,
  evaluateQuizResultItemsWithLlm,
  runTutorAgentLoop,
  translateTextWithLlm,
  type TutorFillInTheBlankChoiceBlock,
  type TutorFillInTheBlankInputBlock,
  type LlmRequestOptions,
  type LlmRequestTokenUsage,
  type TutorQuizBlock,
  type TutorQuizResultBlock,
  type TranslationMode,
  type TutorMessage,
  type TutorMatchingPairsBlock,
  type TutorMultipleChoiceBlock,
  type TutorUnscrambleSentenceBlock,
} from '../services/llmTutor.js';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import { applyTutorBlocksRuntime } from '../services/tutorWorkflow/index.js';

type JoinPayload = {
  conversationId?: string | null;
};

type SendMessagePayload = {
  conversationId?: string | null;
  content?: string;
  modelTier?: string;
};

type RenamePayload = {
  conversationId?: string | null;
  title?: string;
};

type DeletePayload = {
  conversationId?: string | null;
};

type TutorPlanClosePayload = {
  conversationId?: string | null;
};

type ModelTierPayload = {
  conversationId?: string | null;
  modelTier?: string;
};

type TranslatePayload = {
  mode?: string;
  text?: string;
};

type PracticeModuleStartPayload = {
  conversationId?: string | null;
  modelTier?: string;
};

type CancelAssistantPayload = {
  conversationId?: string | null;
};

type AssistantToolStatusPayload = {
  label: string;
  toolName: string;
};

type MatchingExerciseCompletedPayload = {
  blockIndex?: number;
  conversationId?: string | null;
  incorrectAttempts?: Array<{
    left?: string;
    right?: string;
  }>;
  messageId?: number;
  modelTier?: string;
  totalAttempts?: number;
};

type FillInTheBlankCompletedPayload = {
  blockIndex?: number;
  completedSentence?: string;
  conversationId?: string | null;
  incorrectSentences?: string[];
  messageId?: number;
  modelTier?: string;
  totalAttempts?: number;
  values?: string[];
};

type MultipleChoiceCompletedPayload = {
  blockIndex?: number;
  conversationId?: string | null;
  incorrectSelections?: string[][];
  messageId?: number;
  modelTier?: string;
  selectedOptions?: string[];
  totalAttempts?: number;
};

type UnscrambleSentenceCompletedPayload = {
  blockIndex?: number;
  completedSentence?: string;
  conversationId?: string | null;
  incorrectSentences?: string[];
  messageId?: number;
  modelTier?: string;
  selectedTokens?: string[];
  totalAttempts?: number;
};

type QuizCompletedPayload = {
  blockIndex?: number;
  conversationId?: string | null;
  messageId?: number;
  modelTier?: string;
  responses?: unknown[];
};

type QuizAbortedPayload = {
  blockIndex?: number;
  conversationId?: string | null;
  messageId?: number;
  modelTier?: string;
  responses?: unknown[];
};

type AuthenticatedSocketData = {
  authenticatedUser?: {
    exp: number;
    sub: string;
  };
};

const runningConversations = new Set<string>();
const runningConversationControllers = new Map<string, AbortController>();

export function registerChatSocket(io: Server): void {
  io.use((socket, next) => {
    const payload =
      verifySocketAuthToken(socket.handshake.auth.token) ??
      verifySocketSessionCookie(socket);
    if (!payload) {
      next(new Error('authentication_required'));
      return;
    }

    const user = findUserById(payload.sub);
    if (!user?.emailVerified) {
      next(new Error('authentication_required'));
      return;
    }

    (socket.data as AuthenticatedSocketData).authenticatedUser = payload;
    next();
  });

  io.on('connection', (socket) => {
    let currentConversationId: string | null = null;
    let pendingInitialGreeting = pickInitialGreeting();
    let currentProfile: StoredProfile | null = null;

    const authenticatedUserId = getAuthenticatedUserId(socket);
    if (authenticatedUserId) {
      currentProfile = resolveSocketProfile(socket, authenticatedUserId);
    }

    socket.on('conversation:join', async (payload: JoinPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }
      currentProfile = resolveSocketProfile(socket, userId);

      let conversation = payload.conversationId
        ? findConversationForUser(payload.conversationId, userId)
        : null;

      if (!conversation) {
        pendingInitialGreeting = pickInitialGreeting();
        leaveConversationRoom(socket, currentConversationId);
        currentConversationId = null;
        socket.emit('conversation:ready', {
          activeAgent: 'tutor',
          assistantPending: false,
          practiceModule: null,
          conversation: null,
          conversationId: null,
          messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
          pendingPracticeModuleStart: false,
          tutorPlan: null,
        });
        return;
      }

      joinConversationRoom(socket, currentConversationId, conversation.id);
      currentConversationId = conversation.id;

      const conversationProfile =
        currentProfile?.id === conversation.profileId
          ? currentProfile
          : findProfileForUser(conversation.profileId, userId);
      if (
        conversationProfile &&
        conversation.modelTier !== conversationProfile.modelTier
      ) {
        conversation =
          updateConversationModelTierForUser(
            conversation.id,
            userId,
            conversationProfile.modelTier,
          ) ?? conversation;
      }

      const messages = listMessages(conversation.id);
      const practiceModuleSnapshot = getConversationPracticeModuleSnapshot(conversation.id);
      const chatRoomReportSnapshot = getConversationChatRoomReportSnapshot(conversation.id);
      const tutorReportSnapshot = getConversationTutorReportSnapshot(conversation.id);
      const tutorPlan = getConversationTutorPlan(conversation.id);
      if (messages.length === 0) {
        pendingInitialGreeting = pickInitialGreeting();
      }

      socket.emit('conversation:ready', {
        activeAgent: conversation.activeAgent,
        assistantPending: runningConversations.has(conversation.id),
        practiceModule: practiceModuleSnapshot
          ? {
              description: practiceModuleSnapshot.description,
              id: practiceModuleSnapshot.practiceModuleId,
              title: practiceModuleSnapshot.title,
            }
          : null,
        conversation,
        conversationId: conversation.id,
        messages:
          (practiceModuleSnapshot || chatRoomReportSnapshot || tutorReportSnapshot) &&
          messages.length === 0
            ? []
            : messages.length > 0
            ? messages
            : [createEphemeralInitialMessage(pendingInitialGreeting)],
        pendingPracticeModuleStart: Boolean(practiceModuleSnapshot && messages.length === 0),
        tutorPlan,
      });

      if (
        (chatRoomReportSnapshot || tutorReportSnapshot) &&
        messages.length === 0 &&
        !practiceModuleSnapshot
      ) {
        void streamAssistantMessage(
          io,
          conversation.id,
          userId,
          undefined,
          true,
          [],
          conversation.modelTier,
        );
      }
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
      currentProfile = resolveSocketProfile(socket, userId);

      let conversation = payload.conversationId
        ? findConversationForUser(payload.conversationId, userId)
        : null;

      const shouldPersistInitialGreeting =
        !conversation ||
        (listMessages(conversation.id).length === 0 &&
          !conversation.practiceModuleId &&
          !conversation.chatRoomConversationReportId);
      if (!conversation) {
        if (!currentProfile) {
          return;
        }

        conversation = createConversation(userId, currentProfile.id, undefined, {
          modelTier: currentProfile.modelTier,
        });
      } else {
        const conversationProfile =
          currentProfile?.id === conversation.profileId
            ? currentProfile
            : findProfileForUser(conversation.profileId, userId);

        if (
          conversationProfile &&
          conversation.modelTier !== conversationProfile.modelTier
        ) {
          conversation =
            updateConversationModelTierForUser(
              conversation.id,
              userId,
              conversationProfile.modelTier,
            ) ?? conversation;
        }
      }

      joinConversationRoom(socket, currentConversationId, conversation.id);
      currentConversationId = conversation.id;

      if (runningConversations.has(conversation.id)) {
        socket.emit('assistant:error', {
          message: 'Espera un momento: Mister F todavia esta respondiendo.',
        });
        return;
      }

      if (conversation.closedAt) {
        socket.emit('conversation:error', {
          message: 'Esta conversación ya fue finalizada. Puedes revisar su resumen o empezar una nueva práctica.',
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
      emitConversationUpdated(io, conversation.id, userId);
      io.to(conversation.id).emit('message:created', userMessage);

      await streamAssistantMessage(
        io,
        conversation.id,
        userId,
        userMessage.id,
        false,
        [],
        conversation.modelTier,
      );
    });

    socket.on('conversation:model_tier', (payload: ModelTierPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }

      const conversationId = payload.conversationId?.trim();
      if (!conversationId) {
        return;
      }

      const conversation = updateConversationModelTierForUser(
        conversationId,
        userId,
        normalizeModelTier(payload.modelTier),
      );
      if (!conversation) {
        return;
      }
    });

    socket.on('assistant:cancel', (payload: CancelAssistantPayload = {}) => {
      const userId = getAuthenticatedUserId(socket);
      if (!userId) {
        emitAuthRequired(socket);
        return;
      }
      currentProfile = resolveSocketProfile(socket, userId);

      const conversationId = payload.conversationId?.trim();
      if (!conversationId) {
        return;
      }

      const conversation = findConversationForUser(conversationId, userId);
      if (!conversation) {
        return;
      }

      runningConversationControllers.get(conversationId)?.abort();
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
        activeAgent: 'tutor',
        assistantPending: false,
        practiceModule: null,
        conversation: null,
        conversationId: null,
        messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
        pendingPracticeModuleStart: false,
        tutorPlan: null,
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
        activeAgent: 'tutor',
        assistantPending: false,
        practiceModule: null,
        conversation: null,
        conversationId: null,
        messages: [createEphemeralInitialMessage(pendingInitialGreeting)],
        pendingPracticeModuleStart: false,
        tutorPlan: null,
      });
    });

    socket.on('tutor_plan:close', (payload: TutorPlanClosePayload = {}) => {
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
          message: 'No pude encontrar esa conversación.',
        });
        return;
      }

      if (conversation.closedAt) {
        socket.emit('conversation:error', {
          message: 'Esta conversación ya fue finalizada.',
        });
        return;
      }

      deleteConversationTutorPlan(conversation.id);
      emitConversationUpdated(io, conversation.id, userId);
      io.to(conversation.id).emit('tutor_plan:updated', {
        conversationId: conversation.id,
        tutorPlan: null,
      });
    });

    socket.on('practice-module:start', async (payload: PracticeModuleStartPayload = {}) => {
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
      if (!conversation?.practiceModuleId) {
        socket.emit('assistant:error', {
          message: 'No pude iniciar este módulo de práctica.',
        });
        return;
      }

      const practiceModuleSnapshot = getConversationPracticeModuleSnapshot(conversation.id);
      if (!practiceModuleSnapshot) {
        socket.emit('assistant:error', {
          message: 'No pude cargar este módulo de práctica.',
        });
        return;
      }

      if (listMessages(conversation.id).length > 0) {
        return;
      }

      await streamAssistantMessage(
        io,
        conversation.id,
        userId,
        undefined,
        false,
        [buildPracticeModuleStartMessage(practiceModuleSnapshot)],
        normalizeModelTier(payload.modelTier),
      );
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
          normalizeModelTier(payload.modelTier),
        );
      },
    );

    socket.on(
      'exercise:fill_in_the_blank_completed',
      async (payload: FillInTheBlankCompletedPayload = {}) => {
        const userId = getAuthenticatedUserId(socket);
        if (!userId) {
          emitAuthRequired(socket);
          return;
        }

        const conversationId = payload.conversationId?.trim();
        const messageId = normalizePositiveInteger(payload.messageId);
        const blockIndex = normalizeNonNegativeInteger(payload.blockIndex);
        const totalAttempts = normalizePositiveInteger(payload.totalAttempts) ?? 0;
        const completedSentence = normalizeExerciseSentence(payload.completedSentence);
        if (!conversationId || !messageId || blockIndex === null || !completedSentence) {
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
        if (!isFillInTheBlankBlock(block)) {
          return;
        }

        const incorrectSentences = normalizeIncorrectSentences(
          payload.incorrectSentences,
          completedSentence,
        );
        const nextResults = {
          ...((message.metadata?.fillInTheBlankResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            completedAt: new Date().toISOString(),
            completedSentence,
            incorrectSentences,
            totalAttempts,
            values: normalizeExerciseValues(payload.values),
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          fillInTheBlankResults: nextResults,
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
              content: buildFillInTheBlankCompletionContext({
                block,
                completedSentence,
                incorrectSentences,
                totalAttempts,
              }),
              role: 'user',
            },
          ],
          normalizeModelTier(payload.modelTier),
        );
      },
    );

    socket.on(
      'exercise:multiple_choice_completed',
      async (payload: MultipleChoiceCompletedPayload = {}) => {
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
        if (!isMultipleChoiceBlock(block)) {
          return;
        }

        const selectedOptions = normalizeStringArray(payload.selectedOptions, 240);
        const incorrectSelections = normalizeIncorrectSelections(
          payload.incorrectSelections,
          block,
        );
        const nextResults = {
          ...((message.metadata?.multipleChoiceResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            completedAt: new Date().toISOString(),
            incorrectSelections,
            selectedOptions,
            totalAttempts,
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          multipleChoiceResults: nextResults,
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
              content: buildMultipleChoiceCompletionContext({
                block,
                incorrectSelections,
                selectedOptions,
                totalAttempts,
              }),
              role: 'user',
            },
          ],
          normalizeModelTier(payload.modelTier),
        );
      },
    );

    socket.on(
      'exercise:unscramble_sentence_completed',
      async (payload: UnscrambleSentenceCompletedPayload = {}) => {
        const userId = getAuthenticatedUserId(socket);
        if (!userId) {
          emitAuthRequired(socket);
          return;
        }

        const conversationId = payload.conversationId?.trim();
        const messageId = normalizePositiveInteger(payload.messageId);
        const blockIndex = normalizeNonNegativeInteger(payload.blockIndex);
        const totalAttempts = normalizePositiveInteger(payload.totalAttempts) ?? 0;
        const completedSentence = normalizeExerciseSentence(payload.completedSentence);
        if (!conversationId || !messageId || blockIndex === null || !completedSentence) {
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
        if (!isUnscrambleSentenceBlock(block)) {
          return;
        }

        const incorrectSentences = normalizeIncorrectSentences(
          payload.incorrectSentences,
          completedSentence,
        );
        const nextResults = {
          ...((message.metadata?.unscrambleSentenceResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            completedAt: new Date().toISOString(),
            completedSentence,
            incorrectSentences,
            selectedTokens: normalizeStringArray(payload.selectedTokens, 120),
            totalAttempts,
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          unscrambleSentenceResults: nextResults,
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
              content: buildUnscrambleSentenceCompletionContext({
                block,
                completedSentence,
                incorrectSentences,
                totalAttempts,
              }),
              role: 'user',
            },
          ],
          normalizeModelTier(payload.modelTier),
        );
      },
    );

    socket.on(
      'exercise:quiz_completed',
      async (payload: QuizCompletedPayload = {}) => {
        const userId = getAuthenticatedUserId(socket);
        if (!userId) {
          emitAuthRequired(socket);
          return;
        }

        const conversationId = payload.conversationId?.trim();
        const messageId = normalizePositiveInteger(payload.messageId);
        const blockIndex = normalizeNonNegativeInteger(payload.blockIndex);
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
        if (!isQuizBlock(block)) {
          return;
        }

        const responses = normalizeQuizResponses(payload.responses, block);
        const nextResults = {
          ...((message.metadata?.quizResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            responses,
            submittedAt: new Date().toISOString(),
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          quizResults: nextResults,
        });
        if (updatedMessage) {
          io.to(conversationId).emit('message:updated', updatedMessage);
        }

        let quizEvaluations: Array<{
          feedback: string;
          inlineReview?: Record<string, unknown>;
          status: 'correct' | 'incorrect' | 'partial';
        }>;
        try {
          const llmOptions = await getLlmRequestOptionsForUser(userId);
          llmOptions.modelTier = normalizeModelTier(payload.modelTier);
          quizEvaluations = await evaluateQuizResultItemsWithLlm({
            llm: llmOptions,
            quiz: block,
            responses,
          });
        } catch (error) {
          console.error('Quiz result evaluation failed.', {
            conversationId,
            error: serializeError(error),
            messageId,
            userId,
          });
          if (emitCreditExhaustedIfNeeded(socket, error)) {
            return;
          }
          socket.emit('assistant:error', {
            message: toUserFacingError(error),
          });
          return;
        }

        const quizResultBlock = buildQuizResultBlock({
          block,
          evaluations: quizEvaluations,
          responses,
        });
        const quizResultMessage = addMessage(
          conversationId,
          'model',
          buildQuizResultMessageContent(quizResultBlock),
          {
            blocks: [quizResultBlock],
            quizSource: {
              blockIndex,
              messageId,
            },
            source: 'quiz_result',
          },
        );
        emitConversationUpdated(io, conversationId, userId);
        io.to(conversationId).emit('message:created', quizResultMessage);

        await streamAssistantMessage(
          io,
          conversationId,
          userId,
          undefined,
          false,
          [
            {
              content: buildQuizCompletionContext({
                block,
                responses,
              }),
              role: 'user',
            },
          ],
          normalizeModelTier(payload.modelTier),
        );
      },
    );

    socket.on(
      'exercise:quiz_aborted',
      (payload: QuizAbortedPayload = {}) => {
        const userId = getAuthenticatedUserId(socket);
        if (!userId) {
          emitAuthRequired(socket);
          return;
        }

        const conversationId = payload.conversationId?.trim();
        const messageId = normalizePositiveInteger(payload.messageId);
        const blockIndex = normalizeNonNegativeInteger(payload.blockIndex);
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

        const message = findMessageInConversation(messageId, conversationId);
        if (!message || message.role !== 'model') {
          return;
        }

        const blocks = Array.isArray(message.metadata?.blocks)
          ? message.metadata.blocks
          : [];
        const block = blocks[blockIndex];
        if (!isQuizBlock(block)) {
          return;
        }

        const responses = normalizeQuizResponses(payload.responses, block);
        const nextResults = {
          ...((message.metadata?.quizResults as Record<string, unknown>) ?? {}),
          [String(blockIndex)]: {
            abortedAt: new Date().toISOString(),
            responses,
          },
        };

        const updatedMessage = updateMessageMetadata(messageId, conversationId, {
          quizResults: nextResults,
        });
        if (updatedMessage) {
          io.to(conversationId).emit('message:updated', updatedMessage);
        }
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

function resolveSocketProfile(socket: Socket, userId: string): StoredProfile {
  const fallbackProfile = ensureUserHasProfile(userId);
  const requestedProfileId = getActiveProfileIdFromCookieHeader(
    socket.request.headers.cookie,
  );

  return requestedProfileId
    ? findProfileForUser(requestedProfileId, userId) ?? fallbackProfile
    : fallbackProfile;
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
    openRouterApiKey: await getCreditCheckedOpenRouterApiKeyForUser(userId),
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
  modelTier: 'advanced' | 'max' | 'regular' = 'regular',
): Promise<void> {
  if (runningConversations.has(conversationId)) {
    return;
  }

  const abortController = new AbortController();
  runningConversations.add(conversationId);
  runningConversationControllers.set(conversationId, abortController);
  io.to(conversationId).emit('assistant:start');

  try {
    const conversation = findConversationForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }
    const practiceModuleSnapshot = getConversationPracticeModuleSnapshot(conversationId);
    const chatRoomReportSnapshot = getConversationChatRoomReportSnapshot(conversationId);
    const tutorReportSnapshot = getConversationTutorReportSnapshot(conversationId);
    const tutorPlan = getConversationTutorPlan(conversationId);

    const messages = listMessages(conversationId);
    const llmOptions = await getLlmRequestOptionsForUser(userId);
    llmOptions.modelTier = modelTier;
    const onTokenUsage = (usage: LlmRequestTokenUsage) => {
      emitLlmRequestTokenUsage(io, conversationId, usage);
    };
    const onToolCall = (toolName: string) => {
      emitAssistantToolStatus(io, conversationId, toolName);
    };
    const history = [...toTutorHistory(messages), ...extraHistory];
    const practiceModuleContext = practiceModuleSnapshot
      ? {
          description: practiceModuleSnapshot.description,
          title: practiceModuleSnapshot.title,
          tutorInstructions: practiceModuleSnapshot.tutorInstructions,
        }
      : null;
    const chatRoomReportContext = chatRoomReportSnapshot
      ? {
          chatRoomConversationId: chatRoomReportSnapshot.chatRoomConversationId,
          reportSummaryDescription: chatRoomReportSnapshot.reportSummaryDescription,
          reportSummaryTitle: chatRoomReportSnapshot.reportSummaryTitle,
          roomDescription: chatRoomReportSnapshot.roomDescription,
          roomTitle: chatRoomReportSnapshot.roomTitle,
          slidesJson: chatRoomReportSnapshot.slidesJson,
        }
      : null;
    const tutorReportContext = tutorReportSnapshot
      ? {
          reportJson: tutorReportSnapshot.reportJson,
          reportSummaryDescription: tutorReportSnapshot.reportSummaryDescription,
          reportSummaryTitle: tutorReportSnapshot.reportSummaryTitle,
          sourceConversationId: tutorReportSnapshot.sourceConversationId,
        }
      : null;

    const result = await runTutorAgentLoop(history, {
      chatRoomReport: chatRoomReportContext,
      practiceModule: practiceModuleContext,
      tutorReport: tutorReportContext,
      abortSignal: abortController.signal,
      currentTitle: conversation.title,
      currentPracticeModuleId: conversation.practiceModuleId,
      llm: llmOptions,
      onTokenUsage,
      onToolCall,
      profileId: conversation.profileId,
      startConversation,
      titleUpdatedByUser: conversation.titleUpdatedByUser,
      tutorPlan,
      userId,
    });

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
    emitConversationUpdated(io, conversationId, userId);
    io.to(conversationId).emit('assistant:done', assistantMessage);

    applyTutorBlocksRuntime({
      blocks: result.blocks,
      conversationId,
      io,
      lastUserMessageId,
      userId,
    });
  } catch (error) {
    if (isAbortError(error, abortController.signal)) {
      io.to(conversationId).emit('assistant:stopped');
      return;
    }

    console.error('Assistant response failed.', {
      conversationId,
      error: serializeError(error),
      lastUserMessageId,
      userId,
    });
    if (emitRoomCreditExhaustedIfNeeded(io, conversationId, error)) {
      return;
    }

    io.to(conversationId).emit('assistant:error', {
      message: toUserFacingError(error),
    });
  } finally {
    runningConversations.delete(conversationId);
    runningConversationControllers.delete(conversationId);
  }
}

function normalizeModelTier(
  value: string | null | undefined,
): 'advanced' | 'max' | 'regular' {
  if (value === 'max') {
    return 'max';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  return 'regular';
}

function emitAssistantToolStatus(
  io: Server,
  conversationId: string,
  toolName: string,
): void {
  const payload: AssistantToolStatusPayload = {
    label: getToolStatusLabel(toolName),
    toolName,
  };
  io.to(conversationId).emit('assistant:tool_status', payload);
}

function getToolStatusLabel(toolName: string): string {
  switch (toolName) {
    case 'list_practice_modules':
      return 'Ejecutando herramienta: buscar módulos de práctica...';
    case 'create_practice_module':
      return 'Ejecutando herramienta: crear módulo de práctica...';
    case 'update_practice_module':
      return 'Ejecutando herramienta: actualizar módulo de práctica...';
    case 'delete_practice_module':
      return 'Ejecutando herramienta: eliminar módulo de práctica...';
    case 'build_practice_module_link':
      return 'Ejecutando herramienta: preparar enlace del módulo de práctica...';
    case 'list_chat_rooms':
      return 'Ejecutando herramienta: buscar salas de chat...';
    case 'create_chat_room':
      return 'Ejecutando herramienta: crear sala de chat...';
    case 'delete_chat_room':
      return 'Ejecutando herramienta: eliminar sala de chat...';
    case 'list_chat_room_conversations':
      return 'Ejecutando herramienta: buscar conversaciones de la sala de chat...';
    case 'get_chat_room_conversation':
      return 'Ejecutando herramienta: leer conversación de la sala de chat...';
    default:
      return `Ejecutando herramienta: ${toolName}...`;
  }
}

function toTutorHistory(messages: StoredMessage[]): TutorMessage[] {
  return messages.map((message) => ({
    content: message.content,
    role: message.role,
  }));
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || /abort(ed)?/i.test(error.message);
}

function buildPracticeModuleStartMessage(practiceModule: {
  description: string;
  title: string;
  tutorInstructions: string;
}): TutorMessage {
  return {
    role: 'user',
    content: [
      'INTERNAL ACTIVITY START.',
      'This practice module has just begun.',
      'Use this as teacher-only context. Do not mention the internal signal.',
      `Practice module title: ${practiceModule.title}`,
      `Practice module description: ${practiceModule.description}`,
      `Practice module tutor instructions: ${practiceModule.tutorInstructions}`,
      'Start the practice module now with the first useful exercise or prompt.',
      'Do not ask unnecessary setup questions if the practice module already provides enough direction.',
    ].join('\n'),
  };
}

function emitConversationUpdated(
  io: Server,
  conversationId: string,
  userId: string,
): void {
  const conversation = findConversationForUser(conversationId, userId);
  if (!conversation) {
    return;
  }

  io.to(conversationId).emit('conversation:updated', {
    conversation,
    conversationId: conversation.id,
  });
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
      Array.isArray((value as Record<string, unknown>).pairs),
  );
}

function isFillInTheBlankBlock(
  value: unknown,
): value is TutorFillInTheBlankInputBlock | TutorFillInTheBlankChoiceBlock {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (
        (value as Record<string, unknown>).type === 'fill_in_the_blank_input' ||
        (value as Record<string, unknown>).type === 'fill_in_the_blank_choice'
      ) &&
      typeof (value as Record<string, unknown>).sentence === 'string' &&
      Array.isArray((value as Record<string, unknown>).blanks),
  );
}

function isMultipleChoiceBlock(value: unknown): value is TutorMultipleChoiceBlock {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === 'multiple_choice' &&
      Array.isArray((value as Record<string, unknown>).options),
  );
}

function isUnscrambleSentenceBlock(
  value: unknown,
): value is TutorUnscrambleSentenceBlock {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === 'unscramble_sentence' &&
      Array.isArray((value as Record<string, unknown>).tokens),
  );
}

function isQuizBlock(value: unknown): value is TutorQuizBlock {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === 'quiz' &&
      Array.isArray((value as Record<string, unknown>).items) &&
      typeof (value as Record<string, unknown>).prompt === 'string',
  );
}

function normalizeQuizResponses(
  values: unknown,
  block: TutorQuizBlock,
): Array<Record<string, unknown>> {
  const items = Array.isArray(block.items) ? block.items : [];
  const responses = Array.isArray(values) ? values : [];

  return items.map((item, index) => {
    const response = responses[index];

    if (item.kind === 'quiz_matching_pairs') {
      return {
        kind: item.kind,
        pairs: normalizeQuizMatchingPairsResponse(response, item),
      };
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      const normalizedValues = normalizeStringArray(
        (response as { values?: unknown })?.values,
        240,
      );
      return {
        completedSentence: fillSentencePlaceholdersForQuiz(
          item.sentence,
          normalizedValues,
          item.kind === 'quiz_fill_in_the_blank_choice' ? '{{blank}}' : '___',
        ),
        kind: item.kind,
        values: normalizedValues,
      };
    }

    if (item.kind === 'quiz_multiple_choice') {
      return {
        kind: item.kind,
        selectedOptions: normalizeStringArray(
          (response as { selectedOptions?: unknown })?.selectedOptions,
          400,
        ).filter((option) => item.options.includes(option)),
      };
    }

    if (item.kind === 'quiz_unscramble_sentence') {
      const selectedTokens = normalizeStringArray(
        (response as { selectedTokens?: unknown })?.selectedTokens,
        120,
      );
      return {
        kind: item.kind,
        selectedTokens: selectedTokens.filter((token) => item.tokens.includes(token)),
        sentence: normalizeExerciseSentence(selectedTokens.join(' ')) ?? '',
      };
    }

    return {
      kind: item.kind,
      text:
        typeof (response as { text?: unknown })?.text === 'string'
          ? (response as { text: string }).text.replace(/\s+/g, ' ').trim().slice(0, 2400)
          : '',
    };
  });
}

function normalizeQuizMatchingPairsResponse(
  response: unknown,
  item: TutorQuizBlock['items'][number] & { kind: 'quiz_matching_pairs' },
): Array<{ left: string; right: string }> {
  const leftItems = new Set(item.leftItems);
  const rightItems = new Set(item.rightItems);
  const unique = new Set<string>();
  const pairs: Array<{ left: string; right: string }> = [];

  for (const pair of Array.isArray((response as { pairs?: unknown })?.pairs)
    ? (response as { pairs: unknown[] }).pairs
    : []) {
    const left =
      typeof (pair as { left?: unknown })?.left === 'string'
        ? (pair as { left: string }).left.replace(/\s+/g, ' ').trim().slice(0, 600)
        : '';
    const right =
      typeof (pair as { right?: unknown })?.right === 'string'
        ? (pair as { right: string }).right.replace(/\s+/g, ' ').trim().slice(0, 600)
        : '';
    if (!left || !right || !leftItems.has(left) || !rightItems.has(right)) {
      continue;
    }

    const key = `${left}::${right}`;
    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    pairs.push({ left, right });
  }

  return pairs;
}

function fillSentencePlaceholdersForQuiz(
  sentence: string,
  values: string[],
  placeholderToken: string,
): string {
  if (typeof sentence !== 'string' || !placeholderToken || !sentence.includes(placeholderToken)) {
    return '';
  }

  let nextSentence = sentence;
  for (const value of values) {
    nextSentence = nextSentence.replace(placeholderToken, value.trim());
  }

  return nextSentence.replace(/\s+/g, ' ').trim();
}

function buildQuizResultBlock(input: {
  block: TutorQuizBlock;
  evaluations: Array<{
    feedback: string;
    inlineReview?: Record<string, unknown>;
    status: 'correct' | 'incorrect' | 'partial';
  }>;
  responses: Array<Record<string, unknown>>;
}): TutorQuizResultBlock {
  return {
    type: 'quiz_result',
    title: input.block.title?.trim() || 'Quiz completado',
    prompt: input.block.prompt.trim(),
    items: input.block.items.map((item, index) => {
      const response = input.responses[index] ?? {};
      const evaluation = input.evaluations[index] ?? {
        feedback: 'Miremos esta respuesta con más detalle en la siguiente práctica.',
        status: 'partial' as const,
      };

      if (item.kind === 'quiz_open_text') {
        return {
          evaluation,
          inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
          kind: item.kind,
          prompt: item.prompt,
          userResponse: {
            text:
              typeof response.text === 'string'
                ? response.text
                : '',
          },
        };
      }

      if (
        item.kind === 'quiz_translate_to_english' ||
        item.kind === 'quiz_understand_in_spanish'
      ) {
        return {
          evaluation,
          inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
          kind: item.kind,
          prompt: item.prompt,
          sentence: item.sentence,
          userResponse: {
            text:
              typeof response.text === 'string'
                ? response.text
                : '',
          },
        };
      }

      if (item.kind === 'quiz_fill_in_the_blank_input') {
        return {
          evaluation,
          inlineReview: normalizeBlankInlineReview(
            evaluation.inlineReview,
            item.blanks.length,
          ),
          kind: item.kind,
          prompt: item.prompt,
          sentence: item.sentence,
          userResponse: {
            completedSentence:
              typeof response.completedSentence === 'string'
                ? response.completedSentence
                : undefined,
            values: Array.isArray(response.values)
              ? response.values.filter((value): value is string => typeof value === 'string')
              : [],
          },
        };
      }

      if (item.kind === 'quiz_fill_in_the_blank_choice') {
        return {
          kind: item.kind,
          evaluation,
          inlineReview: normalizeBlankInlineReview(
            evaluation.inlineReview,
            item.blanks.length,
          ),
          prompt: item.prompt,
          sentence: item.sentence,
          blanks: item.blanks.map((blank) => ({
            choices: blank.choices,
          })),
          userResponse: {
            completedSentence:
              typeof response.completedSentence === 'string'
                ? response.completedSentence
                : undefined,
            values: Array.isArray(response.values)
              ? response.values.filter((value): value is string => typeof value === 'string')
              : [],
          },
        };
      }

      if (item.kind === 'quiz_multiple_choice') {
        return {
          evaluation,
          inlineReview: normalizeMultipleChoiceInlineReview(
            evaluation.inlineReview,
            item.options,
          ),
          kind: item.kind,
          prompt: item.prompt,
          selectionMode: item.selectionMode,
          options: item.options,
          userResponse: {
            selectedOptions: Array.isArray(response.selectedOptions)
              ? response.selectedOptions.filter((value): value is string => typeof value === 'string')
              : [],
          },
        };
      }

      if (item.kind === 'quiz_matching_pairs') {
        return {
          evaluation,
          inlineReview: normalizeMatchingPairsInlineReview(
            evaluation.inlineReview,
            Array.isArray(response.pairs)
              ? response.pairs.filter(
                  (pair): pair is { left: string; right: string } =>
                    Boolean(
                      pair &&
                        typeof pair === 'object' &&
                        typeof pair.left === 'string' &&
                        typeof pair.right === 'string',
                    ),
                )
              : [],
          ),
          kind: item.kind,
          prompt: item.prompt,
          leftItems: item.leftItems,
          rightItems: item.rightItems,
          userResponse: {
            pairs: Array.isArray(response.pairs)
              ? response.pairs.filter(
                  (pair): pair is { left: string; right: string } =>
                    Boolean(
                      pair &&
                        typeof pair === 'object' &&
                        typeof pair.left === 'string' &&
                        typeof pair.right === 'string',
                    ),
                )
              : [],
          },
        };
      }

      return {
        evaluation,
        inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
        kind: 'quiz_unscramble_sentence',
        prompt: item.prompt,
        tokens: item.tokens,
        userResponse: {
          selectedTokens: Array.isArray(response.selectedTokens)
            ? response.selectedTokens.filter((value): value is string => typeof value === 'string')
            : [],
          sentence:
            typeof response.sentence === 'string'
              ? response.sentence
              : undefined,
        },
      };
    }),
  };
}

function buildQuizResultMessageContent(block: TutorQuizResultBlock): string {
  const normalizedTitle = block.title?.replace(/\s+/g, ' ').trim();
  return normalizedTitle
    ? `Resumen del quiz: ${normalizedTitle}`
    : 'Resumen del quiz';
}

function normalizeTextInlineReview(
  value: Record<string, unknown> | undefined,
): { parts: Array<{ explanation?: string; status: 'correct' | 'improve' | 'error'; text: string }> } | undefined {
  const parts = Array.isArray(value?.parts)
    ? value.parts
        .filter(
          (part): part is { explanation?: string; status: 'correct' | 'improve' | 'error'; text: string } =>
            Boolean(
              part &&
                typeof part === 'object' &&
                typeof part.text === 'string' &&
                (part.status === 'correct' || part.status === 'improve' || part.status === 'error'),
            ),
        )
        .map((part) => ({
          text: part.text.replace(/\s+/g, ' ').trim().slice(0, 2400),
          status: part.status,
          explanation:
            typeof part.explanation === 'string'
              ? part.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
        }))
        .filter((part) => part.text)
    : [];

  return parts.length > 0 ? { parts } : undefined;
}

function normalizeBlankInlineReview(
  value: Record<string, unknown> | undefined,
  expectedLength: number,
): { blanks: Array<{ explanation?: string; status: 'correct' | 'improve' | 'error' }> } | undefined {
  const blanks = Array.isArray(value?.blanks)
    ? value.blanks
        .slice(0, expectedLength)
        .filter(
          (blank): blank is { explanation?: string; status: 'correct' | 'improve' | 'error' } =>
            Boolean(
              blank &&
                typeof blank === 'object' &&
                (blank.status === 'correct' || blank.status === 'improve' || blank.status === 'error'),
            ),
        )
        .map((blank) => ({
          status: blank.status,
          explanation:
            typeof blank.explanation === 'string'
              ? blank.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
        }))
    : [];

  return blanks.length > 0 ? { blanks } : undefined;
}

function normalizeMultipleChoiceInlineReview(
  value: Record<string, unknown> | undefined,
  options: string[],
): {
  options: Array<{
    explanation?: string;
    selectedByUser: boolean;
    status: 'correct' | 'neutral' | 'missed' | 'error';
    text: string;
  }>;
} | undefined {
  const reviews = Array.isArray(value?.options)
    ? value.options
        .filter(
          (
            option,
          ): option is {
            explanation?: string;
            selectedByUser: boolean;
            status: 'correct' | 'neutral' | 'missed' | 'error';
            text: string;
          } =>
            Boolean(
              option &&
                typeof option === 'object' &&
                typeof option.text === 'string' &&
                typeof option.selectedByUser === 'boolean' &&
                (
                  option.status === 'correct' ||
                  option.status === 'neutral' ||
                  option.status === 'missed' ||
                  option.status === 'error'
                ),
            ),
        )
        .map((option) => ({
          text: option.text.replace(/\s+/g, ' ').trim().slice(0, 400),
          selectedByUser: option.selectedByUser,
          status: option.status,
          explanation:
            typeof option.explanation === 'string'
              ? option.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
        }))
        .filter((option) => options.includes(option.text))
    : [];

  return reviews.length > 0 ? { options: reviews } : undefined;
}

function normalizeMatchingPairsInlineReview(
  value: Record<string, unknown> | undefined,
  userPairs: Array<{ left: string; right: string }>,
): {
  pairs: Array<{
    explanation?: string;
    left: string;
    right: string;
    status: 'correct' | 'error';
  }>;
} | undefined {
  const reviews = Array.isArray(value?.pairs)
    ? value.pairs
        .filter(
          (
            pair,
          ): pair is {
            explanation?: string;
            left: string;
            right: string;
            status: 'correct' | 'error';
          } =>
            Boolean(
              pair &&
                typeof pair === 'object' &&
                typeof pair.left === 'string' &&
                typeof pair.right === 'string' &&
                (pair.status === 'correct' || pair.status === 'error'),
            ),
        )
        .map((pair) => ({
          left: pair.left.replace(/\s+/g, ' ').trim().slice(0, 600),
          right: pair.right.replace(/\s+/g, ' ').trim().slice(0, 600),
          status: pair.status,
          explanation:
            typeof pair.explanation === 'string'
              ? pair.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
              : undefined,
        }))
        .filter((pair) =>
          userPairs.some(
            (userPair) => userPair.left === pair.left && userPair.right === pair.right,
          ),
        )
    : [];

  return reviews.length > 0 ? { pairs: reviews } : undefined;
}

function normalizeIncorrectAttempts(
  attempts: MatchingExerciseCompletedPayload['incorrectAttempts'],
  block: TutorMatchingPairsBlock,
): Array<{ left: string; right: string }> {
  const validPairs = new Set(
    block.pairs.map((pair) => `${pair.left.trim()}::${pair.right.trim()}`),
  );
  const unique = new Set<string>();
  const normalized: Array<{ left: string; right: string }> = [];

  for (const item of attempts ?? []) {
    const left = item?.left?.replace(/\s+/g, ' ').trim();
    const right = item?.right?.replace(/\s+/g, ' ').trim();
    if (!left || !right) {
      continue;
    }

    if (validPairs.has(`${left}::${right}`)) {
      continue;
    }

    const key = `${left}::${right}`;
    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    normalized.push({ left, right });
  }

  return normalized;
}

function buildMatchingPairsCompletionContext(input: {
  block: TutorMatchingPairsBlock;
  incorrectAttempts: Array<{ left: string; right: string }>;
  totalAttempts: number;
}): string {
  const incorrectPairs =
    input.incorrectAttempts.length > 0
      ? input.incorrectAttempts
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
    ...input.block.pairs.map((pair) => `- ${pair.left} -> ${pair.right}`),
    'Incorrect attempts before success:',
    incorrectPairs,
    'You may briefly reinforce the pairs that were difficult, then continue naturally.',
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeExerciseSentence(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sentence = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:%)\]}])/g, '$1')
    .replace(/([¿¡([{])\s+/g, '$1')
    .trim();
  return sentence ? sentence.slice(0, 1200) : null;
}

function normalizeIncorrectSentences(
  values: unknown,
  completedSentence: string,
): string[] {
  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const value of Array.isArray(values) ? values : []) {
    const sentence = normalizeExerciseSentence(value);
    if (!sentence || sentence === completedSentence || unique.has(sentence)) {
      continue;
    }

    unique.add(sentence);
    normalized.push(sentence);
  }

  return normalized;
}

function normalizeExerciseValues(values: unknown): string[] {
  const normalized: string[] = [];

  for (const value of Array.isArray(values) ? values : []) {
    const nextValue =
      typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, 240)
        : '';
    if (!nextValue) {
      continue;
    }

    normalized.push(nextValue);
  }

  return normalized;
}

function normalizeStringArray(values: unknown, maxLength: number): string[] {
  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const value of Array.isArray(values) ? values : []) {
    const nextValue =
      typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
    if (!nextValue || unique.has(nextValue)) {
      continue;
    }

    unique.add(nextValue);
    normalized.push(nextValue);
  }

  return normalized;
}

function normalizeIncorrectSelections(
  values: unknown,
  block: TutorMultipleChoiceBlock,
): string[][] {
  const validOptions = new Set(block.options.map((option) => option.text.trim()));
  const unique = new Set<string>();
  const normalized: string[][] = [];

  for (const selection of Array.isArray(values) ? values : []) {
    const normalizedSelection = normalizeStringArray(selection, 240).filter((item) =>
      validOptions.has(item),
    );
    if (normalizedSelection.length === 0) {
      continue;
    }

    const key = normalizedSelection.slice().sort().join(' || ');
    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    normalized.push(normalizedSelection);
  }

  return normalized;
}

function buildFillInTheBlankCompletionContext(input: {
  block: TutorFillInTheBlankInputBlock | TutorFillInTheBlankChoiceBlock;
  completedSentence: string;
  incorrectSentences: string[];
  totalAttempts: number;
}): string {
  return [
    'INTERNAL FILL IN THE BLANK EXERCISE COMPLETED.',
    'The learner completed a fill-in-the-blank exercise in the UI.',
    'Use this as teacher-only context. Do not mention the existence of the internal report.',
    input.block.prompt ? `Exercise prompt: ${input.block.prompt}` : '',
    `Sentence with blank: ${input.block.sentence}`,
    `Completed sentence: ${input.completedSentence}`,
    `Total attempts: ${Math.max(0, input.totalAttempts)}`,
    'Incorrect full sentences before success:',
    ...(input.incorrectSentences.length > 0
      ? input.incorrectSentences.map((sentence) => `- ${sentence}`)
      : ['- none']),
    'You may briefly reinforce what was difficult, then continue naturally.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMultipleChoiceCompletionContext(input: {
  block: TutorMultipleChoiceBlock;
  incorrectSelections: string[][];
  selectedOptions: string[];
  totalAttempts: number;
}): string {
  const correctOptions = input.block.options
    .filter((option) => option.isCorrect)
    .map((option) => option.text);

  return [
    'INTERNAL MULTIPLE CHOICE EXERCISE COMPLETED.',
    'The learner completed a multiple_choice exercise in the UI.',
    'Use this as teacher-only context. Do not mention the existence of the internal report.',
    input.block.prompt ? `Exercise prompt: ${input.block.prompt}` : '',
    `Question: ${input.block.question}`,
    `Selected correct options: ${input.selectedOptions.join(' | ')}`,
    `Total attempts: ${Math.max(0, input.totalAttempts)}`,
    'Correct options:',
    ...correctOptions.map((option) => `- ${option}`),
    'Incorrect selections before success:',
    ...(input.incorrectSelections.length > 0
      ? input.incorrectSelections.map((selection) => `- ${selection.join(' | ')}`)
      : ['- none']),
    'You may briefly reinforce what was difficult, then continue naturally.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUnscrambleSentenceCompletionContext(input: {
  block: TutorUnscrambleSentenceBlock;
  completedSentence: string;
  incorrectSentences: string[];
  totalAttempts: number;
}): string {
  return [
    'INTERNAL UNSCRAMBLE SENTENCE EXERCISE COMPLETED.',
    'The learner completed an unscramble_sentence exercise in the UI.',
    'Use this as teacher-only context. Do not mention the existence of the internal report.',
    input.block.prompt ? `Exercise prompt: ${input.block.prompt}` : '',
    `Correct token order: ${input.block.tokens.join(' | ')}`,
    `Completed sentence: ${input.completedSentence}`,
    `Total attempts: ${Math.max(0, input.totalAttempts)}`,
    'Incorrect full sentences before success:',
    ...(input.incorrectSentences.length > 0
      ? input.incorrectSentences.map((sentence) => `- ${sentence}`)
      : ['- none']),
    'You may briefly reinforce what was difficult, then continue naturally.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildQuizCompletionContext(input: {
  block: TutorQuizBlock;
  responses: Array<Record<string, unknown>>;
}): string {
  const lines = [
    'INTERNAL QUIZ COMPLETED.',
    'The learner submitted a completed quiz in the UI.',
    'Use this as teacher-only context. Do not mention the existence of the internal report.',
    input.block.title ? `Quiz title: ${input.block.title}` : '',
    `Quiz prompt: ${input.block.prompt}`,
    input.block.rubric ? `Quiz rubric: ${input.block.rubric}` : '',
    'Evaluate the learner based on the quiz prompt, the item prompts, the hidden answer guidance when present, and the learner responses below.',
    'The quiz is self-contained. Do not assume extra context from the surrounding conversation.',
    'After evaluating it, give concise, useful feedback in natural tutoring language.',
    '',
  ].filter(Boolean);

  input.block.items.forEach((item, index) => {
    const response = input.responses[index] ?? {};
    lines.push(`Item ${index + 1} (${item.kind})`);
    lines.push(`Prompt: ${item.prompt}`);

    if (item.kind === 'quiz_open_text') {
      if (item.placeholder) {
        lines.push(`Placeholder: ${item.placeholder}`);
      }
      if (item.rubric) {
        lines.push(`Item rubric: ${item.rubric}`);
      }
      lines.push(`Learner response: ${String(response.text || '(empty)')}`);
    }

    if (item.kind === 'quiz_translate_to_english' || item.kind === 'quiz_understand_in_spanish') {
      lines.push(`Sentence: ${item.sentence}`);
      if (Array.isArray(item.acceptableAnswers) && item.acceptableAnswers.length > 0) {
        lines.push(`Acceptable answers: ${item.acceptableAnswers.join(' | ')}`);
      }
      if (item.rubric) {
        lines.push(`Item rubric: ${item.rubric}`);
      }
      lines.push(`Learner response: ${String(response.text || '(empty)')}`);
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      lines.push(`Sentence: ${item.sentence}`);
      if (item.kind === 'quiz_fill_in_the_blank_choice') {
        item.blanks.forEach((blank, blankIndex) => {
          if (Array.isArray(blank.acceptableAnswers) && blank.acceptableAnswers.length > 0) {
            lines.push(
              `Blank ${blankIndex + 1} acceptable answers: ${blank.acceptableAnswers.join(' | ')}`,
            );
          }
          if (blank.rubric) {
            lines.push(`Blank ${blankIndex + 1} rubric: ${blank.rubric}`);
          }
          lines.push(`Blank ${blankIndex + 1} choices: ${blank.choices.join(' | ')}`);
        });
      } else {
        item.blanks.forEach((blank, blankIndex) => {
          if (Array.isArray(blank.acceptableAnswers) && blank.acceptableAnswers.length > 0) {
            lines.push(
              `Blank ${blankIndex + 1} acceptable answers: ${blank.acceptableAnswers.join(' | ')}`,
            );
          }
          if (blank.rubric) {
            lines.push(`Blank ${blankIndex + 1} rubric: ${blank.rubric}`);
          }
        });
      }
      lines.push(
        `Learner values: ${Array.isArray(response.values) && response.values.length > 0 ? response.values.join(' | ') : '(empty)'}`,
      );
      lines.push(`Learner completed sentence: ${String(response.completedSentence || '(empty)')}`);
    }

    if (item.kind === 'quiz_multiple_choice') {
      lines.push(`Selection mode: ${item.selectionMode}`);
      lines.push(`Options: ${item.options.join(' | ')}`);
      lines.push(`Correct options: ${item.correctOptions.join(' | ')}`);
      if (item.rubric) {
        lines.push(`Item rubric: ${item.rubric}`);
      }
      lines.push(
        `Learner selection: ${Array.isArray(response.selectedOptions) && response.selectedOptions.length > 0 ? response.selectedOptions.join(' | ') : '(empty)'}`,
      );
    }

    if (item.kind === 'quiz_matching_pairs') {
      lines.push(`Left items: ${item.leftItems.join(' | ')}`);
      lines.push(`Right items: ${item.rightItems.join(' | ')}`);
      lines.push(
        `Correct pairs: ${item.correctPairs.map((pair) => `${pair.left} -> ${pair.right}`).join(' ; ')}`,
      );
      if (item.rubric) {
        lines.push(`Item rubric: ${item.rubric}`);
      }
      lines.push(
        `Learner pairs: ${Array.isArray(response.pairs) && response.pairs.length > 0 ? response.pairs.map((pair) => `${pair.left} -> ${pair.right}`).join(' ; ') : '(empty)'}`,
      );
    }

    if (item.kind === 'quiz_unscramble_sentence') {
      lines.push(`Tokens: ${item.tokens.join(' | ')}`);
      if (Array.isArray(item.acceptableAnswers) && item.acceptableAnswers.length > 0) {
        lines.push(`Acceptable answers: ${item.acceptableAnswers.join(' | ')}`);
      }
      if (item.rubric) {
        lines.push(`Item rubric: ${item.rubric}`);
      }
      lines.push(
        `Learner token order: ${Array.isArray(response.selectedTokens) && response.selectedTokens.length > 0 ? response.selectedTokens.join(' | ') : '(empty)'}`,
      );
      lines.push(`Learner sentence: ${String(response.sentence || '(empty)')}`);
    }

    lines.push('');
  });

  lines.push('Now evaluate the quiz and continue naturally as the tutor.');
  return lines.join('\n');
}

function emitLlmRequestTokenUsage(
  io: Server,
  conversationId: string,
  usage: LlmRequestTokenUsage,
  roomId = conversationId,
): void {
  io.to(roomId).emit('llm:request_tokens', {
    conversationId,
    usage,
  });
}

function toUserFacingError(error: unknown): string {
  if (isCreditExhaustedError(error)) {
    return getCreditExhaustedMessage();
  }

  if (error instanceof MissingLlmApiKeyError) {
    return 'Ahora mismo no puedo responder bien. Hay una configuración del tutor que necesita atención.';
  }

  if (error instanceof LlmFinishReasonError) {
    return 'Mi respuesta se cortó antes de estar lista. Inténtalo otra vez en unos segundos.';
  }

  return 'Se me enredó la respuesta y no quiero confundirte. Inténtalo otra vez en unos segundos.';
}

function emitCreditExhaustedIfNeeded(socket: Socket, error: unknown): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  socket.emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
}

function emitRoomCreditExhaustedIfNeeded(
  io: Server,
  conversationId: string,
  error: unknown,
): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  io.to(conversationId).emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
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
