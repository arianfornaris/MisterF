import { findUserById, findUserBySessionTokenHash, } from '../auth/repository.js';
import { getSessionTokenFromCookieHeader, hashSessionToken, } from '../auth/session.js';
import { verifySocketAuthToken } from '../auth/socketAuth.js';
import { addMessage, ensureUserHasProfile, createConversation, deleteConversationForUser, deleteConversationTutorPlan, findConversationForUser, findProfileForUser, getConversationChatRoomReportSnapshot, getConversationPracticeModuleSnapshot, getConversationTutorPlan, getConversationTutorReportSnapshot, findMessageInConversation, listMessages, renameConversationForUser, updateConversationModelTierForUser, updateMessageMetadata, } from '../db/repository.js';
import { getActiveProfileIdFromCookieHeader } from '../auth/profiles.js';
import { pickInitialGreeting } from './initialGreetings.js';
import { toTutorHistory } from '../services/llmTutor/history.js';
import { renderSystemPrompt } from '../services/systemPrompts.js';
import { LlmFinishReasonError, MissingLlmApiKeyError, evaluateQuizResultItemsWithLlm, runTutorAgentLoop, translateTextWithLlm, } from '../services/llmTutor.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { applyTutorBlocksRuntime } from '../services/tutorWorkflow/index.js';
const runningConversations = new Set();
const runningConversationControllers = new Map();
export function registerChatSocket(io) {
    io.use((socket, next) => {
        const payload = verifySocketAuthToken(socket.handshake.auth.token) ??
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
        socket.data.authenticatedUser = payload;
        next();
    });
    io.on('connection', (socket) => {
        let currentConversationId = null;
        let pendingInitialGreeting = pickInitialGreeting();
        let currentProfile = null;
        const authenticatedUserId = getAuthenticatedUserId(socket);
        if (authenticatedUserId) {
            currentProfile = resolveSocketProfile(socket, authenticatedUserId);
        }
        socket.on('conversation:join', async (payload = {}) => {
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
            const conversationProfile = currentProfile?.id === conversation.profileId
                ? currentProfile
                : findProfileForUser(conversation.profileId, userId);
            if (conversationProfile &&
                conversation.modelTier !== conversationProfile.modelTier) {
                conversation =
                    updateConversationModelTierForUser(conversation.id, userId, conversationProfile.modelTier) ?? conversation;
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
                messages: (practiceModuleSnapshot || chatRoomReportSnapshot || tutorReportSnapshot) &&
                    messages.length === 0
                    ? []
                    : messages.length > 0
                        ? messages
                        : [createEphemeralInitialMessage(pendingInitialGreeting)],
                pendingPracticeModuleStart: Boolean(practiceModuleSnapshot && messages.length === 0),
                tutorPlan,
            });
            if ((chatRoomReportSnapshot || tutorReportSnapshot) &&
                messages.length === 0 &&
                !practiceModuleSnapshot) {
                void streamAssistantMessage(io, conversation.id, userId, undefined, buildReportConversationStartMessages({
                    chatRoomReportSnapshot,
                    tutorReportSnapshot,
                }), conversation.modelTier);
            }
        });
        socket.on('message:send', async (payload = {}) => {
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
            const shouldPersistInitialGreeting = !conversation ||
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
            }
            else {
                const conversationProfile = currentProfile?.id === conversation.profileId
                    ? currentProfile
                    : findProfileForUser(conversation.profileId, userId);
                if (conversationProfile &&
                    conversation.modelTier !== conversationProfile.modelTier) {
                    conversation =
                        updateConversationModelTierForUser(conversation.id, userId, conversationProfile.modelTier) ?? conversation;
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
                addMessage(conversation.id, 'model', pendingInitialGreeting, createInitialGreetingMetadata(pendingInitialGreeting));
                socket.emit('conversation:promoted', {
                    conversation,
                    conversationId: conversation.id,
                });
            }
            const userMessage = addMessage(conversation.id, 'user', content);
            emitConversationUpdated(io, conversation.id, userId);
            io.to(conversation.id).emit('message:created', userMessage);
            await streamAssistantMessage(io, conversation.id, userId, userMessage.id, [], conversation.modelTier);
        });
        socket.on('conversation:model_tier', (payload = {}) => {
            const userId = getAuthenticatedUserId(socket);
            if (!userId) {
                emitAuthRequired(socket);
                return;
            }
            const conversationId = payload.conversationId?.trim();
            if (!conversationId) {
                return;
            }
            const conversation = updateConversationModelTierForUser(conversationId, userId, normalizeModelTier(payload.modelTier));
            if (!conversation) {
                return;
            }
        });
        socket.on('assistant:cancel', (payload = {}) => {
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
        socket.on('conversation:rename', (payload = {}) => {
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
            const conversation = renameConversationForUser(conversationId, userId, title, { updatedByUser: true });
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
        socket.on('conversation:delete', (payload = {}) => {
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
        socket.on('tutor_plan:close', (payload = {}) => {
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
        socket.on('practice-module:start', async (payload = {}) => {
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
            await streamAssistantMessage(io, conversation.id, userId, undefined, [buildPracticeModuleStartMessage(practiceModuleSnapshot)], normalizeModelTier(payload.modelTier));
        });
        socket.on('translator:translate', async (payload = {}) => {
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
            }
            catch (error) {
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
        socket.on('exercise:matching_completed', async (payload = {}) => {
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
            const incorrectAttempts = normalizeIncorrectAttempts(payload.incorrectAttempts, block);
            const nextResults = {
                ...(message.metadata?.matchingExerciseResults ?? {}),
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
            await streamAssistantMessage(io, conversationId, userId, undefined, [
                {
                    content: buildMatchingPairsCompletionContext({
                        block,
                        incorrectAttempts,
                        totalAttempts,
                    }),
                    role: 'user',
                },
            ], normalizeModelTier(payload.modelTier));
        });
        socket.on('exercise:fill_in_the_blank_completed', async (payload = {}) => {
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
            const incorrectSentences = normalizeIncorrectSentences(payload.incorrectSentences, completedSentence);
            const nextResults = {
                ...(message.metadata?.fillInTheBlankResults ?? {}),
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
            await streamAssistantMessage(io, conversationId, userId, undefined, [
                {
                    content: buildFillInTheBlankCompletionContext({
                        block,
                        completedSentence,
                        incorrectSentences,
                        totalAttempts,
                    }),
                    role: 'user',
                },
            ], normalizeModelTier(payload.modelTier));
        });
        socket.on('exercise:multiple_choice_completed', async (payload = {}) => {
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
            const incorrectSelections = normalizeIncorrectSelections(payload.incorrectSelections, block);
            const nextResults = {
                ...(message.metadata?.multipleChoiceResults ?? {}),
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
            await streamAssistantMessage(io, conversationId, userId, undefined, [
                {
                    content: buildMultipleChoiceCompletionContext({
                        block,
                        incorrectSelections,
                        selectedOptions,
                        totalAttempts,
                    }),
                    role: 'user',
                },
            ], normalizeModelTier(payload.modelTier));
        });
        socket.on('exercise:unscramble_sentence_completed', async (payload = {}) => {
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
            const incorrectSentences = normalizeIncorrectSentences(payload.incorrectSentences, completedSentence);
            const nextResults = {
                ...(message.metadata?.unscrambleSentenceResults ?? {}),
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
            await streamAssistantMessage(io, conversationId, userId, undefined, [
                {
                    content: buildUnscrambleSentenceCompletionContext({
                        block,
                        completedSentence,
                        incorrectSentences,
                        totalAttempts,
                    }),
                    role: 'user',
                },
            ], normalizeModelTier(payload.modelTier));
        });
        socket.on('exercise:quiz_completed', async (payload = {}) => {
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
                ...(message.metadata?.quizResults ?? {}),
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
            let quizEvaluations;
            try {
                const llmOptions = await getLlmRequestOptionsForUser(userId);
                llmOptions.modelTier = normalizeModelTier(payload.modelTier);
                quizEvaluations = await evaluateQuizResultItemsWithLlm({
                    llm: llmOptions,
                    quiz: block,
                    responses,
                });
            }
            catch (error) {
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
            const quizResultMessage = addMessage(conversationId, 'model', buildQuizResultMessageContent(quizResultBlock), {
                blocks: [quizResultBlock],
                quizSource: {
                    blockIndex,
                    messageId,
                },
                source: 'quiz_result',
            });
            emitConversationUpdated(io, conversationId, userId);
            io.to(conversationId).emit('message:created', quizResultMessage);
            await streamAssistantMessage(io, conversationId, userId, undefined, [
                {
                    content: buildQuizCompletionContext({
                        block,
                        responses,
                    }),
                    role: 'user',
                },
            ], normalizeModelTier(payload.modelTier));
        });
        socket.on('exercise:quiz_aborted', (payload = {}) => {
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
                ...(message.metadata?.quizResults ?? {}),
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
        });
    });
}
function verifySocketSessionCookie(socket) {
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
function resolveSocketProfile(socket, userId) {
    const fallbackProfile = ensureUserHasProfile(userId);
    const requestedProfileId = getActiveProfileIdFromCookieHeader(socket.request.headers.cookie);
    return requestedProfileId
        ? findProfileForUser(requestedProfileId, userId) ?? fallbackProfile
        : fallbackProfile;
}
function getAuthenticatedUserId(socket) {
    return (socket.data.authenticatedUser?.sub ?? null);
}
function emitAuthRequired(socket) {
    socket.emit('auth:required', {
        message: 'Para usar Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
    });
}
function joinConversationRoom(socket, previousConversationId, nextConversationId) {
    if (previousConversationId && previousConversationId !== nextConversationId) {
        socket.leave(previousConversationId);
    }
    socket.join(nextConversationId);
}
function leaveConversationRoom(socket, conversationId) {
    if (conversationId) {
        socket.leave(conversationId);
    }
}
function createEphemeralInitialMessage(content) {
    return {
        content,
        metadata: createInitialGreetingMetadata(content),
        role: 'model',
    };
}
function createInitialGreetingMetadata(content) {
    return {
        blocks: [createInitialGreetingBlock(content)],
        source: 'initial_greeting',
    };
}
function createInitialGreetingBlock(content) {
    return {
        markdown: content,
        type: 'message',
    };
}
function normalizeConversationTitle(title) {
    return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}
function normalizeTranslationMode(mode) {
    return mode === 'es-en' || mode === 'en-es' ? mode : 'auto';
}
async function getLlmRequestOptionsForUser(userId) {
    return {
        openRouterApiKey: await getCreditCheckedOpenRouterApiKeyForUser(userId),
        userId,
    };
}
async function streamAssistantMessage(io, conversationId, userId, lastUserMessageId, extraHistory = [], modelTier = 'regular') {
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
        const learnerProfile = findProfileForUser(conversation.profileId, userId);
        const practiceModuleSnapshot = getConversationPracticeModuleSnapshot(conversationId);
        const chatRoomReportSnapshot = getConversationChatRoomReportSnapshot(conversationId);
        const tutorReportSnapshot = getConversationTutorReportSnapshot(conversationId);
        const tutorPlan = getConversationTutorPlan(conversationId);
        const messages = listMessages(conversationId);
        const llmOptions = await getLlmRequestOptionsForUser(userId);
        llmOptions.modelTier = modelTier;
        const onTokenUsage = (usage) => {
            emitLlmRequestTokenUsage(io, conversationId, usage);
        };
        const onToolCall = (toolName) => {
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
            learnerProfile: learnerProfile
                ? {
                    description: learnerProfile.description,
                    learningContext: learnerProfile.learningContext,
                    name: learnerProfile.name,
                }
                : null,
            practiceModule: practiceModuleContext,
            tutorReport: tutorReportContext,
            abortSignal: abortController.signal,
            currentTitle: conversation.title,
            currentPracticeModuleId: conversation.practiceModuleId,
            llm: llmOptions,
            onTokenUsage,
            onToolCall,
            profileId: conversation.profileId,
            titleUpdatedByUser: conversation.titleUpdatedByUser,
            tutorPlan,
            userId,
        });
        const trimmedContent = result.content.trim();
        if (!trimmedContent) {
            throw new Error('The model returned an empty response.');
        }
        const assistantMessage = addMessage(conversationId, 'model', trimmedContent, { blocks: result.blocks, model: result.model, provider: result.provider });
        emitConversationUpdated(io, conversationId, userId);
        io.to(conversationId).emit('assistant:done', assistantMessage);
        applyTutorBlocksRuntime({
            blocks: result.blocks,
            conversationId,
            io,
            userId,
        });
    }
    catch (error) {
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
    }
    finally {
        runningConversations.delete(conversationId);
        runningConversationControllers.delete(conversationId);
    }
}
function normalizeModelTier(value) {
    if (value === 'max') {
        return 'max';
    }
    if (value === 'advanced') {
        return 'advanced';
    }
    return 'regular';
}
function emitAssistantToolStatus(io, conversationId, toolName) {
    const payload = {
        label: getToolStatusLabel(toolName),
        toolName,
    };
    io.to(conversationId).emit('assistant:tool_status', payload);
}
function getToolStatusLabel(toolName) {
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
function isAbortError(error, signal) {
    if (signal?.aborted) {
        return true;
    }
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === 'AbortError' || /abort(ed)?/i.test(error.message);
}
function buildPracticeModuleStartMessage(practiceModule) {
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
function buildReportConversationStartMessages(input) {
    const messages = [];
    if (input.chatRoomReportSnapshot) {
        messages.push({
            role: 'user',
            content: renderSystemPrompt('tutor/chatroom-report-start.md', {}),
        });
    }
    if (input.tutorReportSnapshot) {
        messages.push({
            role: 'user',
            content: renderSystemPrompt('tutor/tutor-report-start.md', {}),
        });
    }
    return messages;
}
function emitConversationUpdated(io, conversationId, userId) {
    const conversation = findConversationForUser(conversationId, userId);
    if (!conversation) {
        return;
    }
    io.to(conversationId).emit('conversation:updated', {
        conversation,
        conversationId: conversation.id,
    });
}
function normalizePositiveInteger(value) {
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}
function normalizeNonNegativeInteger(value) {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}
function isMatchingPairsBlock(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        value.type === 'matching_pairs' &&
        Array.isArray(value.pairs));
}
function isFillInTheBlankBlock(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        (value.type === 'fill_in_the_blank_input' ||
            value.type === 'fill_in_the_blank_choice') &&
        typeof value.sentence === 'string' &&
        Array.isArray(value.blanks));
}
function isMultipleChoiceBlock(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        value.type === 'multiple_choice' &&
        Array.isArray(value.options));
}
function isUnscrambleSentenceBlock(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        value.type === 'unscramble_sentence' &&
        Array.isArray(value.tokens));
}
function isQuizBlock(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        value.type === 'quiz' &&
        Array.isArray(value.items) &&
        typeof value.prompt === 'string');
}
function normalizeQuizResponses(values, block) {
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
        if (item.kind === 'quiz_fill_in_the_blank_input' ||
            item.kind === 'quiz_fill_in_the_blank_choice') {
            const normalizedValues = normalizeStringArray(response?.values, 240);
            return {
                completedSentence: fillSentencePlaceholdersForQuiz(item.sentence, normalizedValues, item.kind === 'quiz_fill_in_the_blank_choice' ? '{{blank}}' : '___'),
                kind: item.kind,
                values: normalizedValues,
            };
        }
        if (item.kind === 'quiz_multiple_choice') {
            return {
                kind: item.kind,
                selectedOptions: normalizeStringArray(response?.selectedOptions, 400).filter((option) => item.options.includes(option)),
            };
        }
        if (item.kind === 'quiz_unscramble_sentence') {
            const selectedTokens = normalizeStringArray(response?.selectedTokens, 120);
            return {
                kind: item.kind,
                selectedTokens: selectedTokens.filter((token) => item.tokens.includes(token)),
                sentence: normalizeExerciseSentence(selectedTokens.join(' ')) ?? '',
            };
        }
        return {
            kind: item.kind,
            text: typeof response?.text === 'string'
                ? response.text.replace(/\s+/g, ' ').trim().slice(0, 2400)
                : '',
        };
    });
}
function normalizeQuizMatchingPairsResponse(response, item) {
    const leftItems = new Set(item.leftItems);
    const rightItems = new Set(item.rightItems);
    const unique = new Set();
    const pairs = [];
    for (const pair of Array.isArray(response?.pairs)
        ? response.pairs
        : []) {
        const left = typeof pair?.left === 'string'
            ? pair.left.replace(/\s+/g, ' ').trim().slice(0, 600)
            : '';
        const right = typeof pair?.right === 'string'
            ? pair.right.replace(/\s+/g, ' ').trim().slice(0, 600)
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
function fillSentencePlaceholdersForQuiz(sentence, values, placeholderToken) {
    if (typeof sentence !== 'string' || !placeholderToken || !sentence.includes(placeholderToken)) {
        return '';
    }
    let nextSentence = sentence;
    for (const value of values) {
        nextSentence = nextSentence.replace(placeholderToken, value.trim());
    }
    return nextSentence.replace(/\s+/g, ' ').trim();
}
function buildQuizResultBlock(input) {
    return {
        type: 'quiz_result',
        title: input.block.title?.trim() || 'Quiz completado',
        prompt: input.block.prompt.trim(),
        items: input.block.items.map((item, index) => {
            const response = input.responses[index] ?? {};
            const evaluation = input.evaluations[index] ?? {
                feedback: 'Miremos esta respuesta con más detalle en la siguiente práctica.',
                status: 'partial',
            };
            if (item.kind === 'quiz_open_text') {
                return {
                    evaluation,
                    inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
                    kind: item.kind,
                    prompt: item.prompt,
                    userResponse: {
                        text: typeof response.text === 'string'
                            ? response.text
                            : '',
                    },
                };
            }
            if (item.kind === 'quiz_translate_to_english' ||
                item.kind === 'quiz_understand_in_spanish') {
                return {
                    evaluation,
                    inlineReview: normalizeTextInlineReview(evaluation.inlineReview),
                    kind: item.kind,
                    prompt: item.prompt,
                    sentence: item.sentence,
                    userResponse: {
                        text: typeof response.text === 'string'
                            ? response.text
                            : '',
                    },
                };
            }
            if (item.kind === 'quiz_fill_in_the_blank_input') {
                return {
                    evaluation,
                    inlineReview: normalizeBlankInlineReview(evaluation.inlineReview, item.blanks.length),
                    kind: item.kind,
                    prompt: item.prompt,
                    sentence: item.sentence,
                    userResponse: {
                        completedSentence: typeof response.completedSentence === 'string'
                            ? response.completedSentence
                            : undefined,
                        values: Array.isArray(response.values)
                            ? response.values.filter((value) => typeof value === 'string')
                            : [],
                    },
                };
            }
            if (item.kind === 'quiz_fill_in_the_blank_choice') {
                return {
                    kind: item.kind,
                    evaluation,
                    inlineReview: normalizeBlankInlineReview(evaluation.inlineReview, item.blanks.length),
                    prompt: item.prompt,
                    sentence: item.sentence,
                    blanks: item.blanks.map((blank) => ({
                        choices: blank.choices,
                    })),
                    userResponse: {
                        completedSentence: typeof response.completedSentence === 'string'
                            ? response.completedSentence
                            : undefined,
                        values: Array.isArray(response.values)
                            ? response.values.filter((value) => typeof value === 'string')
                            : [],
                    },
                };
            }
            if (item.kind === 'quiz_multiple_choice') {
                return {
                    evaluation,
                    inlineReview: normalizeMultipleChoiceInlineReview(evaluation.inlineReview, item.options),
                    kind: item.kind,
                    prompt: item.prompt,
                    selectionMode: item.selectionMode,
                    options: item.options,
                    userResponse: {
                        selectedOptions: Array.isArray(response.selectedOptions)
                            ? response.selectedOptions.filter((value) => typeof value === 'string')
                            : [],
                    },
                };
            }
            if (item.kind === 'quiz_matching_pairs') {
                return {
                    evaluation,
                    inlineReview: normalizeMatchingPairsInlineReview(evaluation.inlineReview, Array.isArray(response.pairs)
                        ? response.pairs.filter((pair) => Boolean(pair &&
                            typeof pair === 'object' &&
                            typeof pair.left === 'string' &&
                            typeof pair.right === 'string'))
                        : []),
                    kind: item.kind,
                    prompt: item.prompt,
                    leftItems: item.leftItems,
                    rightItems: item.rightItems,
                    userResponse: {
                        pairs: Array.isArray(response.pairs)
                            ? response.pairs.filter((pair) => Boolean(pair &&
                                typeof pair === 'object' &&
                                typeof pair.left === 'string' &&
                                typeof pair.right === 'string'))
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
                        ? response.selectedTokens.filter((value) => typeof value === 'string')
                        : [],
                    sentence: typeof response.sentence === 'string'
                        ? response.sentence
                        : undefined,
                },
            };
        }),
    };
}
function buildQuizResultMessageContent(block) {
    const normalizedTitle = block.title?.replace(/\s+/g, ' ').trim();
    return normalizedTitle
        ? `Resumen del quiz: ${normalizedTitle}`
        : 'Resumen del quiz';
}
function normalizeTextInlineReview(value) {
    const parts = Array.isArray(value?.parts)
        ? value.parts
            .filter((part) => Boolean(part &&
            typeof part === 'object' &&
            typeof part.text === 'string' &&
            (part.status === 'correct' || part.status === 'improve' || part.status === 'error')))
            .map((part) => ({
            text: part.text.replace(/\s+/g, ' ').trim().slice(0, 2400),
            status: part.status,
            explanation: typeof part.explanation === 'string'
                ? part.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
        }))
            .filter((part) => part.text)
        : [];
    return parts.length > 0 ? { parts } : undefined;
}
function normalizeBlankInlineReview(value, expectedLength) {
    const blanks = Array.isArray(value?.blanks)
        ? value.blanks
            .slice(0, expectedLength)
            .filter((blank) => Boolean(blank &&
            typeof blank === 'object' &&
            (blank.status === 'correct' || blank.status === 'improve' || blank.status === 'error')))
            .map((blank) => ({
            status: blank.status,
            explanation: typeof blank.explanation === 'string'
                ? blank.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
        }))
        : [];
    return blanks.length > 0 ? { blanks } : undefined;
}
function normalizeMultipleChoiceInlineReview(value, options) {
    const reviews = Array.isArray(value?.options)
        ? value.options
            .filter((option) => Boolean(option &&
            typeof option === 'object' &&
            typeof option.text === 'string' &&
            typeof option.selectedByUser === 'boolean' &&
            (option.status === 'correct' ||
                option.status === 'neutral' ||
                option.status === 'missed' ||
                option.status === 'error')))
            .map((option) => ({
            text: option.text.replace(/\s+/g, ' ').trim().slice(0, 400),
            selectedByUser: option.selectedByUser,
            status: option.status,
            explanation: typeof option.explanation === 'string'
                ? option.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
        }))
            .filter((option) => options.includes(option.text))
        : [];
    return reviews.length > 0 ? { options: reviews } : undefined;
}
function normalizeMatchingPairsInlineReview(value, userPairs) {
    const reviews = Array.isArray(value?.pairs)
        ? value.pairs
            .filter((pair) => Boolean(pair &&
            typeof pair === 'object' &&
            typeof pair.left === 'string' &&
            typeof pair.right === 'string' &&
            (pair.status === 'correct' || pair.status === 'error')))
            .map((pair) => ({
            left: pair.left.replace(/\s+/g, ' ').trim().slice(0, 600),
            right: pair.right.replace(/\s+/g, ' ').trim().slice(0, 600),
            status: pair.status,
            explanation: typeof pair.explanation === 'string'
                ? pair.explanation.replace(/\s+/g, ' ').trim().slice(0, 800)
                : undefined,
        }))
            .filter((pair) => userPairs.some((userPair) => userPair.left === pair.left && userPair.right === pair.right))
        : [];
    return reviews.length > 0 ? { pairs: reviews } : undefined;
}
function normalizeIncorrectAttempts(attempts, block) {
    const validPairs = new Set(block.pairs.map((pair) => `${pair.left.trim()}::${pair.right.trim()}`));
    const unique = new Set();
    const normalized = [];
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
function buildMatchingPairsCompletionContext(input) {
    const incorrectPairs = input.incorrectAttempts.length > 0
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
function normalizeExerciseSentence(value) {
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
function normalizeIncorrectSentences(values, completedSentence) {
    const unique = new Set();
    const normalized = [];
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
function normalizeExerciseValues(values) {
    const normalized = [];
    for (const value of Array.isArray(values) ? values : []) {
        const nextValue = typeof value === 'string'
            ? value.replace(/\s+/g, ' ').trim().slice(0, 240)
            : '';
        if (!nextValue) {
            continue;
        }
        normalized.push(nextValue);
    }
    return normalized;
}
function normalizeStringArray(values, maxLength) {
    const unique = new Set();
    const normalized = [];
    for (const value of Array.isArray(values) ? values : []) {
        const nextValue = typeof value === 'string'
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
function normalizeIncorrectSelections(values, block) {
    const validOptions = new Set(block.options.map((option) => option.text.trim()));
    const unique = new Set();
    const normalized = [];
    for (const selection of Array.isArray(values) ? values : []) {
        const normalizedSelection = normalizeStringArray(selection, 240).filter((item) => validOptions.has(item));
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
function buildFillInTheBlankCompletionContext(input) {
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
function buildMultipleChoiceCompletionContext(input) {
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
function buildUnscrambleSentenceCompletionContext(input) {
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
function buildQuizCompletionContext(input) {
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
        if (item.kind === 'quiz_fill_in_the_blank_input' ||
            item.kind === 'quiz_fill_in_the_blank_choice') {
            lines.push(`Sentence: ${item.sentence}`);
            if (item.kind === 'quiz_fill_in_the_blank_choice') {
                item.blanks.forEach((blank, blankIndex) => {
                    if (Array.isArray(blank.acceptableAnswers) && blank.acceptableAnswers.length > 0) {
                        lines.push(`Blank ${blankIndex + 1} acceptable answers: ${blank.acceptableAnswers.join(' | ')}`);
                    }
                    if (blank.rubric) {
                        lines.push(`Blank ${blankIndex + 1} rubric: ${blank.rubric}`);
                    }
                    lines.push(`Blank ${blankIndex + 1} choices: ${blank.choices.join(' | ')}`);
                });
            }
            else {
                item.blanks.forEach((blank, blankIndex) => {
                    if (Array.isArray(blank.acceptableAnswers) && blank.acceptableAnswers.length > 0) {
                        lines.push(`Blank ${blankIndex + 1} acceptable answers: ${blank.acceptableAnswers.join(' | ')}`);
                    }
                    if (blank.rubric) {
                        lines.push(`Blank ${blankIndex + 1} rubric: ${blank.rubric}`);
                    }
                });
            }
            lines.push(`Learner values: ${Array.isArray(response.values) && response.values.length > 0 ? response.values.join(' | ') : '(empty)'}`);
            lines.push(`Learner completed sentence: ${String(response.completedSentence || '(empty)')}`);
        }
        if (item.kind === 'quiz_multiple_choice') {
            lines.push(`Selection mode: ${item.selectionMode}`);
            lines.push(`Options: ${item.options.join(' | ')}`);
            lines.push(`Correct options: ${item.correctOptions.join(' | ')}`);
            if (item.rubric) {
                lines.push(`Item rubric: ${item.rubric}`);
            }
            lines.push(`Learner selection: ${Array.isArray(response.selectedOptions) && response.selectedOptions.length > 0 ? response.selectedOptions.join(' | ') : '(empty)'}`);
        }
        if (item.kind === 'quiz_matching_pairs') {
            lines.push(`Left items: ${item.leftItems.join(' | ')}`);
            lines.push(`Right items: ${item.rightItems.join(' | ')}`);
            lines.push(`Correct pairs: ${item.correctPairs.map((pair) => `${pair.left} -> ${pair.right}`).join(' ; ')}`);
            if (item.rubric) {
                lines.push(`Item rubric: ${item.rubric}`);
            }
            lines.push(`Learner pairs: ${Array.isArray(response.pairs) && response.pairs.length > 0 ? response.pairs.map((pair) => `${pair.left} -> ${pair.right}`).join(' ; ') : '(empty)'}`);
        }
        if (item.kind === 'quiz_unscramble_sentence') {
            lines.push(`Tokens: ${item.tokens.join(' | ')}`);
            if (Array.isArray(item.acceptableAnswers) && item.acceptableAnswers.length > 0) {
                lines.push(`Acceptable answers: ${item.acceptableAnswers.join(' | ')}`);
            }
            if (item.rubric) {
                lines.push(`Item rubric: ${item.rubric}`);
            }
            lines.push(`Learner token order: ${Array.isArray(response.selectedTokens) && response.selectedTokens.length > 0 ? response.selectedTokens.join(' | ') : '(empty)'}`);
            lines.push(`Learner sentence: ${String(response.sentence || '(empty)')}`);
        }
        lines.push('');
    });
    lines.push('Now evaluate the quiz and continue naturally as the tutor.');
    return lines.join('\n');
}
function emitLlmRequestTokenUsage(io, conversationId, usage, roomId = conversationId) {
    io.to(roomId).emit('llm:request_tokens', {
        conversationId,
        usage,
    });
}
function toUserFacingError(error) {
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
function emitCreditExhaustedIfNeeded(socket, error) {
    if (!isCreditExhaustedError(error)) {
        return false;
    }
    socket.emit('llm:credit_exhausted', {
        message: getCreditExhaustedMessage(),
    });
    return true;
}
function emitRoomCreditExhaustedIfNeeded(io, conversationId, error) {
    if (!isCreditExhaustedError(error)) {
        return false;
    }
    io.to(conversationId).emit('llm:credit_exhausted', {
        message: getCreditExhaustedMessage(),
    });
    return true;
}
function serializeError(error) {
    if (error instanceof Error) {
        return {
            cause: serializeError(error.cause),
            message: error.message,
            name: error.name,
            stack: error.stack,
        };
    }
    if (error && typeof error === 'object') {
        const record = error;
        return {
            message: typeof record.message === 'string' ? record.message : undefined,
            name: typeof record.name === 'string' ? record.name : undefined,
            text: typeof record.text === 'string' ? record.text.slice(0, 6000) : undefined,
        };
    }
    return error;
}
//# sourceMappingURL=chatSocket.js.map