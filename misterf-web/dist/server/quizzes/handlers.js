import { languages, translate } from '../i18n/index.js';
import QRCode from 'qrcode';
import { addResourceToFolder, archiveQuizForUser, attachQuizAttemptToUser, createQuiz, createQuizAttempt, createConversationFromQuizAttempt, findQuizAttemptById, findQuizById, findQuizForUser, findProfileById, findProfileForUser, findResourceAccessForProfile, findResourceAccessGrant, findResourceFolderForResource, findResourceShareLinkById, getOrCreateResourceShareLink, listResourceFolderPathForResource, listResourceFoldersForProfile, grantResourceAccess, getQuizResponseSummary, listCollectedQuizAttemptsForOwner, listQuizAttemptsForUser, upsertQuizResponseSummary, markQuizAttemptEvaluating, markQuizAttemptFailed, restoreQuizForUser, saveQuizAttemptResult, submitQuizAttempt, updateQuiz, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { findUserById } from '../auth/repository.js';
import { buildDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, } from '../pages/shell.js';
import { applyQuizMetadataToDraft, buildQuizBlockSectionList, quizDraftToStudentQuizBlock, buildQuizEvaluationSummary, buildQuizResponsesSummary, buildQuizResultTitle, computeQuizResponsesFingerprint, canonicalizeQuizDraftBlockOrder, createQuizDraftFromManualInput, applyQuizBlocksAndSectionsToDraft, diffQuizBlocks, duplicateQuizBlock, evaluateQuizAttempt, findQuizBlock, insertQuizBlock, moveQuizBlock, normalizeQuizResponses, quizBlocksDiffHasChanges, quizDraftToMetadata, removeQuizBlock, safeParseQuizDraft, safeParseQuizMetadata, setQuizBlockItem, storedQuizToDraft, } from '../services/quizzes.js';
import { claimRequestAttachments } from '../attachments/requestAttachments.js';
import { generateQuizDraft, generateQuizRevision, generateQuizBlockRevision, generateQuizResponsesSummary, } from '../services/resourceDrafts.js';
import { deletePendingModification, getPendingModification, listStringFieldChanges, setPendingModification, } from '../resources/modificationPreviewStore.js';
import { resolveOriginFolderContext } from '../resources/originFolder.js';
import { randomUUID } from 'node:crypto';
import { buildResourceFromContextPrompt, createResourceFromContextDraft, normalizeContextResourceType, } from '../services/resourceFromContext.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { createFixedWindowRateLimiter } from '../services/fixedWindowRateLimiter.js';
import { recordQuizAttemptProgress } from '../services/learnerProgress.js';
import { seededShuffle } from '../services/displayOrder.js';
import { logger } from '../services/logger.js';
import { quizResultBlockSchema } from '../services/llmTutor/schemas.js';
function getQuizBlockKinds(locale) {
    // The Spanish-based translation kinds are offered only to languages that
    // use them, mirroring the authoring prompts and the tutor quiz protocol.
    const includeTranslationKinds = languages[locale].tutor.includesSpanishTranslationBlocks;
    return [
        ['quiz_open_text', 'quizzes.kindOpenText', 'msg.kindOpenTextDesc'],
        ['quiz_translate_to_english', 'quizzes.kindTranslate', 'msg.kindTranslateDesc'],
        ['quiz_understand_in_spanish', 'quizzes.kindUnderstand', 'msg.kindUnderstandDesc'],
        ['quiz_fill_in_the_blank_input', 'quizzes.kindFillInput', 'msg.kindFillInputDesc'],
        ['quiz_fill_in_the_blank_choice', 'quizzes.kindFillChoice', 'msg.kindFillChoiceDesc'],
        ['quiz_multiple_choice', 'quizzes.kindMultipleChoice', 'msg.kindMultipleChoiceDesc'],
        ['quiz_matching_pairs', 'quizzes.kindMatching', 'msg.kindMatchingDesc'],
        ['quiz_unscramble_sentence', 'quizzes.kindUnscramble', 'msg.kindUnscrambleDesc'],
        ['quiz_order_sentences', 'quizzes.kindOrder', 'msg.kindOrderDesc'],
    ]
        .filter(([value]) => includeTranslationKinds ||
        (value !== 'quiz_translate_to_english' &&
            value !== 'quiz_understand_in_spanish'))
        .map(([value, labelKey, descKey]) => ({
        description: translate(locale, descKey),
        label: translate(locale, labelKey),
        value,
    }));
}
const defaultQuizAuthoringTab = 'general';
const maxQuizAuthoringMessages = 40;
const maxQuizAuthoringMessageLength = 6000;
function normalizeOutlineText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function formatFallbackBlockKindLabel(kind) {
    return kind.replace(/^quiz_/, '').replaceAll('_', ' ');
}
function formatCountLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}
function normalizeQuizAuthoringMessageContent(content) {
    return content.trim().slice(0, maxQuizAuthoringMessageLength);
}
function createQuizAuthoringMessage(role, content, draftSnapshot) {
    const message = {
        content: normalizeQuizAuthoringMessageContent(content),
        createdAt: new Date().toISOString(),
        role,
    };
    if (draftSnapshot) {
        message.draftSnapshot = draftSnapshot;
    }
    return message;
}
function appendQuizAuthoringMessages(existingMessages, ...messages) {
    return [...existingMessages, ...messages]
        .flatMap((message) => {
        const content = normalizeQuizAuthoringMessageContent(message.content);
        if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
            return [];
        }
        return [{
                content,
                createdAt: message.createdAt || new Date().toISOString(),
                draftSnapshot: message.draftSnapshot,
                role: message.role,
            }];
    })
        .slice(-maxQuizAuthoringMessages);
}
function summarizeQuizDraftCreation(draft, locale) {
    const blocks = formatCountLabel(draft.blocks.length, translate(locale, 'msg.blockSg'), translate(locale, 'msg.blockPl'));
    return translate(locale, 'msg.draftCreatedQuiz', { blocks, title: draft.title });
}
function buildQuizBlockOutlineItems(draft, locale) {
    const sectionList = buildQuizBlockSectionList(draft);
    const blockKinds = getQuizBlockKinds(locale);
    return draft.blocks.map((block, index) => {
        const item = block.item;
        const kind = blockKinds.find((candidate) => candidate.value === item.kind);
        const metaItems = [];
        const section = sectionList[index];
        const previousSection = index > 0 ? sectionList[index - 1] : null;
        let sentence = '';
        if (item.kind === 'quiz_translate_to_english' ||
            item.kind === 'quiz_understand_in_spanish' ||
            item.kind === 'quiz_fill_in_the_blank_input' ||
            item.kind === 'quiz_fill_in_the_blank_choice') {
            sentence = normalizeOutlineText(item.sentence);
        }
        if (item.kind === 'quiz_fill_in_the_blank_input' ||
            item.kind === 'quiz_fill_in_the_blank_choice') {
            metaItems.push(formatCountLabel(item.blanks.length, translate(locale, 'msg.blankSg'), translate(locale, 'msg.blankPl')));
        }
        if (item.kind === 'quiz_multiple_choice') {
            metaItems.push(formatCountLabel(item.options.length, translate(locale, 'msg.optionSg'), translate(locale, 'msg.optionPl')));
        }
        if (item.kind === 'quiz_matching_pairs') {
            metaItems.push(formatCountLabel(item.leftItems.length, translate(locale, 'msg.pairSg'), translate(locale, 'msg.pairPl')));
        }
        if (item.kind === 'quiz_unscramble_sentence') {
            metaItems.push(formatCountLabel(item.tokens.length, translate(locale, 'msg.wordSg'), translate(locale, 'msg.wordPl')));
        }
        if (item.kind === 'quiz_order_sentences') {
            metaItems.push(formatCountLabel(item.sentences.length, translate(locale, 'msg.sentenceSg'), translate(locale, 'msg.sentencePl')));
        }
        return {
            blockNumber: index + 1,
            kindLabel: kind?.label ?? formatFallbackBlockKindLabel(item.kind),
            metaItems,
            prompt: item.prompt,
            section: section
                ? {
                    instructions: section.instructions,
                    isFirstBlock: !previousSection || previousSection.id !== section.id,
                    number: draft.sections.findIndex((candidate) => candidate.id === section.id) + 1,
                    title: section.title || '',
                }
                : null,
            sentence,
        };
    });
}
function wantsJsonResponse(request) {
    return Boolean(request.get('accept')?.includes('application/json'));
}
function ensureVerifiedQuizUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return { activeProfile, user };
}
function buildQuizzesShellContext(request, options) {
    return buildAppShellContext({
        activeProfile: options.activeProfile ?? null,
        authMessage: getHomeAuthMessage(request, options.user ?? null),
        currentView: 'resources',
        guestInitialGreeting: '',
        request,
        title: options.title,
        user: options.user ?? null,
    });
}
function renderQuizzesView(response, view, model) {
    response.render(view, model);
}
function serializeViewJson(value) {
    return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (character) => {
        switch (character) {
            case '<':
                return '\\u003c';
            case '>':
                return '\\u003e';
            case '&':
                return '\\u0026';
            case '\u2028':
                return '\\u2028';
            case '\u2029':
                return '\\u2029';
            default:
                return character;
        }
    });
}
function readField(value, maxLength = 8000) {
    if (Array.isArray(value)) {
        return readField(value[0], maxLength);
    }
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
function readMultilineField(value, maxLength = 8000) {
    if (Array.isArray(value)) {
        return readMultilineField(value[0], maxLength);
    }
    return typeof value === 'string'
        ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
        : '';
}
function readRawField(value) {
    if (Array.isArray(value)) {
        return readRawField(value[0]);
    }
    return typeof value === 'string' ? value : '';
}
function readReturnTo(value, fallback) {
    const returnTo = readField(value, 1200);
    return returnTo.startsWith('/') ? returnTo : fallback;
}
function readQuizShareMode(value) {
    const mode = readField(value, 20);
    return mode === 'link' || mode === 'profile' ? mode : '';
}
function readQuizAuthoringTab(value) {
    const tab = readField(value, 20);
    if (tab === 'blocks' || tab === 'general') {
        return tab;
    }
    if (tab === 'design' || tab === 'preview' || tab === 'chat') {
        return 'general';
    }
    return defaultQuizAuthoringTab;
}
function buildQuizBlockAnchorId(blockId) {
    return `quiz-block-${blockId}`;
}
function buildQuizAuthoringPath(quizId, tab, anchorId) {
    const path = `/quizzes/${encodeURIComponent(quizId)}/edit?tab=${tab}`;
    return anchorId ? `${path}#${encodeURIComponent(anchorId)}` : path;
}
function appendGuestToken(pathname, attempt) {
    if (!attempt.guestToken) {
        return pathname;
    }
    const separator = pathname.includes('?') ? '&' : '?';
    return `${pathname}${separator}guestToken=${encodeURIComponent(attempt.guestToken)}`;
}
function buildQuizResultPath(attempt, params = {}) {
    const searchParams = new URLSearchParams(params);
    if (attempt.guestToken) {
        searchParams.set('guestToken', attempt.guestToken);
    }
    const query = searchParams.toString();
    const path = `/quiz-attempts/${encodeURIComponent(attempt.id)}/result`;
    return query ? `${path}?${query}` : path;
}
function readQuizResultActionError(value, locale) {
    const code = readField(value, 40);
    if (code === 'credit') {
        return {
            resultActionError: getCreditExhaustedMessage(locale),
            resultActionErrorIsCredit: true,
        };
    }
    if (code === 'practice-guide') {
        return {
            resultActionError: translate(locale, 'msg.createResourceError'),
            resultActionErrorIsCredit: false,
        };
    }
    return {
        resultActionError: '',
        resultActionErrorIsCredit: false,
    };
}
function buildQuizResultContext(input) {
    const summary = buildQuizEvaluationSummary(input.result);
    const payload = {
        quiz: {
            blocks: input.draft.blocks,
            description: input.draft.description,
            instructions: input.draft.instructions,
            level: input.draft.level,
            targetTopic: input.draft.targetTopic,
            title: input.draft.title,
        },
        evaluation: input.result,
        learnerResponses: input.attempt.responses,
        summary,
    };
    return JSON.stringify(payload, null, 2);
}
function quizToDraftOrRedirect(quiz, response) {
    const draft = safeParseQuizDraft(quiz.quiz);
    if (!draft) {
        response.redirect('/resources');
        return null;
    }
    return draft;
}
function updateQuizWithDraft(quiz, userId, draft, authoringMessages) {
    return updateQuiz({
        quizId: quiz.id,
        authoringMessages,
        description: draft.description,
        instructions: draft.instructions,
        level: draft.level,
        quiz: draft,
        targetTopic: draft.targetTopic,
        title: draft.title,
        userId,
    });
}
function buildQuizAttemptListItems(attempts, locale) {
    return attempts.map((attempt) => ({
        ...attempt,
        ...getQuizAttemptStatusView(attempt.status, locale),
        relativeUpdatedAt: formatRelativeTime(attempt.updatedAt),
    }));
}
function buildCollectedQuizAttemptListItems(attempts, locale) {
    return attempts.map((attempt) => {
        const parsedResult = attempt.status === 'evaluated' && attempt.result
            ? quizResultBlockSchema.safeParse(attempt.result)
            : null;
        const summary = parsedResult?.success
            ? buildQuizEvaluationSummary(parsedResult.data)
            : null;
        return {
            ...attempt,
            ...getQuizAttemptStatusView(attempt.status, locale),
            relativeUpdatedAt: formatRelativeTime(attempt.updatedAt),
            resultSummaryLabel: summary
                ? `${summary.correctCount}/${summary.totalCount}`
                : '',
            participantLabel: attempt.participantProfileName
                || attempt.participantName
                || attempt.participantEmail
                || translate(locale, 'quizzes.resultsAnonymousParticipant'),
        };
    });
}
function getQuizAttemptStatusView(status, locale) {
    switch (status) {
        case 'draft':
            return {
                statusBadgeClass: 'text-bg-light border',
                statusLabel: translate(locale, 'msg.statusDraft'),
            };
        case 'submitted':
            return {
                statusBadgeClass: 'text-bg-info',
                statusLabel: translate(locale, 'msg.statusSubmitted'),
            };
        case 'evaluating':
            return {
                statusBadgeClass: 'text-bg-primary',
                statusLabel: translate(locale, 'msg.statusEvaluating'),
            };
        case 'evaluated':
            return {
                statusBadgeClass: 'text-bg-success',
                statusLabel: translate(locale, 'msg.statusEvaluatedFem'),
            };
        case 'failed':
            return {
                statusBadgeClass: 'text-bg-danger',
                statusLabel: translate(locale, 'msg.evaluateError'),
            };
    }
}
function renderQuizAuthoring(request, response, input) {
    const draft = safeParseQuizDraft(input.quiz.quiz);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    renderQuizzesView(response, 'quizzes-authoring', {
        ...buildQuizzesShellContext(request, {
            activeProfile: input.activeProfile,
            title: buildDocumentTitle(request.locale, draft.title),
            user: input.user,
        }),
        activeTab: input.activeTab ?? defaultQuizAuthoringTab,
        blockSections: buildQuizBlockSectionList(draft),
        quizBlockKinds: getQuizBlockKinds(request.locale),
        authoringError: input.error || '',
        draft,
        selectedQuiz: input.quiz,
    });
}
function resolveOwnQuiz(request, response) {
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return null;
    }
    const quizId = readField(request.params.quizId, 120);
    const quiz = findQuizForUser(quizId, auth.user.id);
    if (!quiz) {
        response.redirect('/resources');
        return null;
    }
    let activeProfile = auth.activeProfile;
    if (quiz.profileId !== activeProfile.id) {
        const profile = findProfileForUser(quiz.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/resources');
            return null;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    return { activeProfile, quiz, user: auth.user };
}
function resolveAccessibleQuiz(request, response) {
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return null;
    }
    const quizId = readField(request.params.quizId, 120);
    const resourceAccess = findResourceAccessForProfile({
        includeArchived: true,
        profileId: auth.activeProfile.id,
        resourceId: quizId,
        userId: auth.user.id,
    });
    if (resourceAccess?.type === 'quiz') {
        if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
            response.redirect('/resources');
            return null;
        }
        const quiz = findQuizById(resourceAccess.id);
        if (!quiz) {
            response.redirect('/resources');
            return null;
        }
        return {
            activeProfile: auth.activeProfile,
            quiz,
            canManageQuiz: resourceAccess.accessKind === 'owner',
            user: auth.user,
        };
    }
    const ownedQuiz = findQuizForUser(quizId, auth.user.id);
    if (!ownedQuiz) {
        response.redirect('/resources');
        return null;
    }
    let activeProfile = auth.activeProfile;
    if (ownedQuiz.profileId !== activeProfile.id) {
        const profile = findProfileForUser(ownedQuiz.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/resources');
            return null;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    return {
        activeProfile,
        quiz: ownedQuiz,
        canManageQuiz: true,
        user: auth.user,
    };
}
function resolveAccessibleAttempt(request, response) {
    const attemptId = readField(request.params.attemptId, 120);
    const attempt = findQuizAttemptById(attemptId);
    if (!attempt) {
        response.redirect('/resources');
        return null;
    }
    const user = request.authUser;
    if (attempt.userId && user?.id === attempt.userId) {
        return attempt;
    }
    const guestToken = readField(request.query.guestToken, 200) || readField(request.body?.guestToken, 200);
    if (!attempt.userId && attempt.guestToken && guestToken === attempt.guestToken) {
        return attempt;
    }
    response.redirect('/login');
    return null;
}
function renderQuizAttempt(request, response, input) {
    const draft = safeParseQuizDraft(input.attempt.snapshot);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    renderQuizzesView(response, 'quizzes-attempt', {
        ...buildQuizzesShellContext(request, {
            activeProfile: request.activeProfile ?? null,
            title: buildDocumentTitle(request.locale, draft.title),
            user: request.authUser ?? null,
        }),
        attempt: input.attempt,
        attemptError: input.error || '',
        attemptErrorIsCredit: Boolean(input.errorIsCredit),
        blockSections: buildQuizBlockSectionList(draft),
        // The no-JS fallback renders matching, ordering, and unscramble exercises
        // straight from the draft, whose stored order is the answer key. Seeded by
        // the attempt so a reload does not reshuffle a half-answered exercise.
        displaySeed: input.attempt.id,
        shuffleForDisplay: seededShuffle,
        quizQuizJson: serializeViewJson(quizDraftToStudentQuizBlock(draft)),
        draft,
        guestToken: input.attempt.guestToken || '',
    });
}
function renderQuizResult(request, response, attempt, options = {}) {
    const draft = safeParseQuizDraft(attempt.snapshot);
    const result = attempt.result ? quizResultBlockSchema.safeParse(attempt.result) : null;
    if (!draft || !result?.success) {
        if (options.ownerView) {
            response.redirect(`/quizzes/${encodeURIComponent(attempt.quizId)}`);
            return;
        }
        response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}`, attempt));
        return;
    }
    const summary = buildQuizEvaluationSummary(result.data);
    const actionError = readQuizResultActionError(request.query.guideError, request.locale);
    renderQuizzesView(response, 'quizzes-result', {
        ...buildQuizzesShellContext(request, {
            activeProfile: request.activeProfile ?? null,
            title: buildDocumentTitle(request.locale, draft.title),
            user: request.authUser ?? null,
        }),
        attempt,
        draft,
        // The guest token grants attempt access; the owner's read-only view must
        // never embed it in links or forms.
        guestToken: options.ownerView ? '' : attempt.guestToken || '',
        resultOwnerView: Boolean(options.ownerView),
        resultOwnerViewParticipantLabel: options.ownerViewParticipantLabel || '',
        resultBlockJson: serializeViewJson(result.data),
        resultBlock: result.data,
        resultTitle: buildQuizResultTitle(result.data, request.locale),
        ...actionError,
        summary,
    });
}
export function renderQuizNewPage(request, response) {
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    renderQuizzesView(response, 'quizzes-new', {
        ...buildQuizzesShellContext(request, {
            activeProfile: auth.activeProfile,
            title: buildDocumentTitle(request.locale, translate(request.locale, 'quizzes.newTitle')),
            user: auth.user,
        }),
        ...resolveOriginFolderContext(request.query.folder, auth.user.id),
        generationError: '',
        generationPrompt: '',
    });
}
export async function handleGenerateQuiz(request, response) {
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    const originFolder = resolveOriginFolderContext(request.body.folderId, auth.user.id);
    const prompt = readMultilineField(request.body.prompt, 6000);
    if (prompt.length < 10) {
        renderQuizzesView(response.status(422), 'quizzes-new', {
            ...buildQuizzesShellContext(request, {
                activeProfile: auth.activeProfile,
                title: buildDocumentTitle(request.locale, translate(request.locale, 'quizzes.newTitle')),
                user: auth.user,
            }),
            ...originFolder,
            generationError: translate(request.locale, 'msg.describeQuizBetter'),
            generationPrompt: prompt,
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const draft = canonicalizeQuizDraftBlockOrder(await generateQuizDraft({
            attachments: claimRequestAttachments(request, auth.user.id),
            instructionLanguage: auth.activeProfile?.instructionLanguage,
            modelTier: auth.activeProfile?.modelTier,
            openRouterApiKey,
            prompt,
        }));
        const quiz = createQuiz({
            authoringMessages: appendQuizAuthoringMessages([], createQuizAuthoringMessage('user', prompt), createQuizAuthoringMessage('assistant', summarizeQuizDraftCreation(draft, request.locale), draft)),
            description: draft.description,
            instructions: draft.instructions,
            level: draft.level,
            profileId: auth.activeProfile.id,
            quiz: draft,
            targetTopic: draft.targetTopic,
            title: draft.title,
            userId: auth.user.id,
        });
        if (originFolder.originFolderId) {
            addResourceToFolder({
                folderId: originFolder.originFolderId,
                resourceId: quiz.id,
                userId: auth.user.id,
            });
        }
        logger.info('quiz_created_from_prompt', {
            quizId: quiz.id,
            blockCount: draft.blocks.length,
            profileId: auth.activeProfile.id,
            resourceId: quiz.id,
            resourceType: 'quiz',
            userId: auth.user.id,
        });
        response.redirect(buildQuizAuthoringPath(quiz.id, defaultQuizAuthoringTab));
    }
    catch (error) {
        logger.error('quiz_generation_failed', {
            error,
            userId: auth.user.id,
        });
        const generationError = isCreditExhaustedError(error)
            ? getCreditExhaustedMessage(request.locale)
            : translate(request.locale, 'msg.generateQuizError');
        renderQuizzesView(response.status(422), 'quizzes-new', {
            ...buildQuizzesShellContext(request, {
                activeProfile: auth.activeProfile,
                title: buildDocumentTitle(request.locale, translate(request.locale, 'quizzes.newTitle')),
                user: auth.user,
            }),
            ...originFolder,
            generationError,
            generationPrompt: prompt,
        });
    }
}
export function handleUpdateQuizMetadata(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = safeParseQuizDraft(resolved.quiz.quiz);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    const updatedDraft = createQuizDraftFromManualInput({
        description: readMultilineField(request.body.description, 1500),
        evaluationInstructions: readMultilineField(request.body.evaluationInstructions, 3000),
        instructions: readMultilineField(request.body.instructions, 3000),
        level: readField(request.body.level, 120),
        previousDraft: draft,
        targetTopic: readField(request.body.targetTopic, 220),
        title: readField(request.body.title, 220) || draft.title,
    });
    const updatedQuiz = updateQuizWithDraft(resolved.quiz, resolved.user.id, updatedDraft);
    if (!updatedQuiz) {
        renderQuizAuthoring(request, response.status(422), {
            ...resolved,
            activeTab: 'general',
            error: translate(request.locale, 'msg.saveQuizDetailsError'),
        });
        return;
    }
    response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'general'));
}
const quizMetadataModificationFields = [
    'title',
    'description',
    'targetTopic',
    'level',
    'instructions',
    'evaluationInstructions',
];
function quizBlockModificationOwner(resolved, blockId) {
    return {
        operation: 'quiz-block',
        profileId: resolved.activeProfile.id,
        resourceId: resolved.quiz.id,
        target: blockId,
        userId: resolved.user.id,
    };
}
function buildQuizBlockRevisionContext(draft, blockId) {
    const block = findQuizBlock(draft, blockId);
    const section = block?.sectionId
        ? draft.sections.find((candidate) => candidate.id === block.sectionId)
        : undefined;
    return {
        instructions: draft.instructions,
        level: draft.level,
        sectionInstructions: section?.instructions,
        siblingKinds: draft.blocks
            .filter((candidate) => candidate.id !== blockId)
            .map((candidate) => candidate.item.kind),
        targetTopic: draft.targetTopic,
        title: draft.title,
    };
}
function isSupportedQuizBlockKind(kind, locale) {
    return getQuizBlockKinds(locale).some((candidate) => candidate.value === kind);
}
export async function handlePreviewQuizBlockModification(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = safeParseQuizDraft(resolved.quiz.quiz);
    const blockId = readField(request.params.blockId, 120);
    const block = draft ? findQuizBlock(draft, blockId) : undefined;
    const requestedChange = readMultilineField(request.body.requestedChange, 2000);
    const requestedKindInput = readField(request.body.kind, 120);
    const level = readField(request.body.level, 120);
    if (!draft || !block || requestedChange.length < 3) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
        return;
    }
    const targetKind = isSupportedQuizBlockKind(requestedKindInput, request.locale)
        ? requestedKindInput
        : block.item.kind;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const revision = await generateQuizBlockRevision({
            currentItem: block.item,
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            level: level || draft.level,
            modelTier: resolved.activeProfile?.modelTier,
            openRouterApiKey,
            prompt: requestedChange,
            quizContext: buildQuizBlockRevisionContext(draft, blockId),
            targetKind,
        });
        const previewId = randomUUID();
        setPendingModification(quizBlockModificationOwner(resolved, blockId), {
            baseSnapshot: storedQuizToDraft(resolved.quiz),
            baseUpdatedAt: resolved.quiz.updatedAt,
            createdAt: Date.now(),
            previewId,
            proposed: revision.item,
        });
        logger.info('quiz_block_modification_preview_generated', {
            blockId,
            fromKind: block.item.kind,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            toKind: revision.item.kind,
            userId: resolved.user.id,
        });
        response.json({ changes: revision.item, previewId });
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        logger.error('quiz_block_modification_preview_failed', {
            blockId,
            error,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            userId: resolved.user.id,
        });
        response.status(422).json({
            creditExhausted: isCreditError,
            error: isCreditError
                ? getCreditExhaustedMessage(request.locale)
                : translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
    }
}
export function handleApplyQuizBlockModification(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const blockId = readField(request.params.blockId, 120);
    const owner = quizBlockModificationOwner(resolved, blockId);
    const pending = getPendingModification(owner);
    const previewId = readField(request.body.previewId, 100);
    const currentDraft = storedQuizToDraft(resolved.quiz);
    if (!pending
        || !previewId
        || pending.previewId !== previewId
        || pending.baseUpdatedAt !== resolved.quiz.updatedAt
        || JSON.stringify(pending.baseSnapshot) !== JSON.stringify(currentDraft)
        || !findQuizBlock(currentDraft, blockId)) {
        response.status(409).json({
            error: translate(request.locale, 'msg.quizBlockModificationExpired'),
        });
        return;
    }
    const updatedDraft = setQuizBlockItem(currentDraft, blockId, pending.proposed);
    const updatedQuiz = updateQuizWithDraft(resolved.quiz, resolved.user.id, updatedDraft);
    if (!updatedQuiz) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
        return;
    }
    deletePendingModification(owner);
    logger.info('quiz_block_modification_applied', {
        blockId,
        quizId: resolved.quiz.id,
        resourceId: resolved.quiz.id,
        resourceType: 'quiz',
        userId: resolved.user.id,
    });
    response.json({
        ok: true,
        redirect: buildQuizAuthoringPath(resolved.quiz.id, 'blocks', buildQuizBlockAnchorId(blockId)),
    });
}
export function handleDiscardQuizBlockModification(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const blockId = readField(request.params.blockId, 120);
    const owner = quizBlockModificationOwner(resolved, blockId);
    const pending = getPendingModification(owner);
    const previewId = readField(request.body.previewId, 100);
    if (pending && previewId && pending.previewId === previewId) {
        deletePendingModification(owner);
    }
    response.json({ ok: true });
}
function quizAddBlockModificationOwner(resolved) {
    return {
        operation: 'quiz-add-block',
        profileId: resolved.activeProfile.id,
        resourceId: resolved.quiz.id,
        userId: resolved.user.id,
    };
}
function readQuizBlockPosition(value) {
    return readField(value, 20) === 'start' ? 'start' : 'end';
}
export async function handlePreviewQuizAddBlock(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = safeParseQuizDraft(resolved.quiz.quiz);
    const requestedChange = readMultilineField(request.body.requestedChange, 2000);
    const requestedKindInput = readField(request.body.kind, 120);
    const level = readField(request.body.level, 120);
    const sectionIdInput = readField(request.body.sectionId, 120);
    const position = readQuizBlockPosition(request.body.position);
    if (!draft || requestedChange.length < 3) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
        return;
    }
    const targetKind = isSupportedQuizBlockKind(requestedKindInput, request.locale)
        ? requestedKindInput
        : getQuizBlockKinds(request.locale)[0].value;
    const sectionId = draft.sections.some((section) => section.id === sectionIdInput)
        ? sectionIdInput
        : undefined;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const creation = await generateQuizBlockRevision({
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            level: level || draft.level,
            modelTier: resolved.activeProfile?.modelTier,
            openRouterApiKey,
            prompt: requestedChange,
            quizContext: {
                instructions: draft.instructions,
                level: draft.level,
                sectionInstructions: sectionId
                    ? draft.sections.find((section) => section.id === sectionId)?.instructions
                    : undefined,
                siblingKinds: draft.blocks.map((block) => block.item.kind),
                targetTopic: draft.targetTopic,
                title: draft.title,
            },
            targetKind,
        });
        const previewId = randomUUID();
        setPendingModification(quizAddBlockModificationOwner(resolved), {
            baseSnapshot: storedQuizToDraft(resolved.quiz),
            baseUpdatedAt: resolved.quiz.updatedAt,
            createdAt: Date.now(),
            previewId,
            proposed: { item: creation.item, position, sectionId },
        });
        logger.info('quiz_add_block_preview_generated', {
            kind: creation.item.kind,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            userId: resolved.user.id,
        });
        response.json({ changes: creation.item, previewId });
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        logger.error('quiz_add_block_preview_failed', {
            error,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            userId: resolved.user.id,
        });
        response.status(422).json({
            creditExhausted: isCreditError,
            error: isCreditError
                ? getCreditExhaustedMessage(request.locale)
                : translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
    }
}
export function handleApplyQuizAddBlock(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const owner = quizAddBlockModificationOwner(resolved);
    const pending = getPendingModification(owner);
    const previewId = readField(request.body.previewId, 100);
    const currentDraft = storedQuizToDraft(resolved.quiz);
    if (!pending
        || !previewId
        || pending.previewId !== previewId
        || pending.baseUpdatedAt !== resolved.quiz.updatedAt
        || JSON.stringify(pending.baseSnapshot) !== JSON.stringify(currentDraft)) {
        response.status(409).json({
            error: translate(request.locale, 'msg.quizBlockModificationExpired'),
        });
        return;
    }
    const inserted = insertQuizBlock(currentDraft, pending.proposed.item, {
        position: pending.proposed.position,
        sectionId: pending.proposed.sectionId,
    });
    const updatedQuiz = updateQuizWithDraft(resolved.quiz, resolved.user.id, inserted.draft);
    if (!updatedQuiz) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizBlockModificationFailed'),
        });
        return;
    }
    deletePendingModification(owner);
    logger.info('quiz_add_block_applied', {
        blockId: inserted.blockId,
        quizId: resolved.quiz.id,
        resourceId: resolved.quiz.id,
        resourceType: 'quiz',
        userId: resolved.user.id,
    });
    response.json({
        ok: true,
        redirect: buildQuizAuthoringPath(resolved.quiz.id, 'blocks', buildQuizBlockAnchorId(inserted.blockId)),
    });
}
export function handleDiscardQuizAddBlock(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const owner = quizAddBlockModificationOwner(resolved);
    const pending = getPendingModification(owner);
    const previewId = readField(request.body.previewId, 100);
    if (pending && previewId && pending.previewId === previewId) {
        deletePendingModification(owner);
    }
    response.json({ ok: true });
}
/**
 * Unified `Modify with AI` for a quiz.
 *
 * Replaces the separate metadata-only and blocks-only operations with one
 * request carrying an explicit scope. The scope is the author's choice, made in
 * the modal and sent as two flags, never inferred from what they typed: letting
 * the model decide how much of the resource it may rewrite is the opposite of
 * what proposal-and-approval is for.
 *
 * The proposal is always stored as a complete draft so applying it is uniform,
 * whichever parts were in scope.
 */
function quizRevisionOwner(resolved) {
    return {
        operation: 'quiz-revision',
        profileId: resolved.activeProfile.id,
        resourceId: resolved.quiz.id,
        userId: resolved.user.id,
    };
}
function readQuizRevisionScope(body) {
    return {
        blocks: body?.scopeBlocks === 'on' || body?.scopeBlocks === 'true',
        general: body?.scopeGeneral === 'on' || body?.scopeGeneral === 'true',
    };
}
export async function handlePreviewQuizRevision(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const currentDraft = safeParseQuizDraft(resolved.quiz.quiz);
    const requestedChange = readMultilineField(request.body.requestedChange, 2000);
    const scope = readQuizRevisionScope(request.body);
    // The general tab may hold unsaved edits; the author expects the proposal to
    // build on what they can see, not on what was last written to the database.
    const rawCurrentMetadata = readRawField(request.body.currentMetadata);
    let currentMetadata = null;
    if (rawCurrentMetadata) {
        try {
            currentMetadata = safeParseQuizMetadata(JSON.parse(rawCurrentMetadata));
        }
        catch {
            currentMetadata = null;
        }
    }
    if (!currentMetadata && currentDraft) {
        currentMetadata = quizDraftToMetadata(currentDraft);
    }
    if (!currentDraft
        || !currentMetadata
        || requestedChange.length < 3
        || (!scope.general && !scope.blocks)) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizRevisionFailed'),
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const revision = await generateQuizRevision({
            attachments: claimRequestAttachments(request, resolved.user.id),
            currentDraft,
            currentMetadata,
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            modelTier: resolved.activeProfile?.modelTier,
            openRouterApiKey,
            prompt: requestedChange,
            scope,
        });
        const baseDraft = storedQuizToDraft(resolved.quiz);
        let proposedDraft = applyQuizMetadataToDraft(baseDraft, revision.metadata ?? currentMetadata);
        if (revision.blocks) {
            proposedDraft = applyQuizBlocksAndSectionsToDraft(proposedDraft, revision.blocks, revision.sections ?? proposedDraft.sections);
        }
        const metadataChanges = scope.general
            ? listStringFieldChanges(currentMetadata, revision.metadata ?? currentMetadata, quizMetadataModificationFields)
            : [];
        const blockDiff = scope.blocks
            ? diffQuizBlocks(currentDraft, proposedDraft)
            : null;
        if (metadataChanges.length === 0
            && (!blockDiff || !quizBlocksDiffHasChanges(blockDiff))) {
            response.status(422).json({
                error: translate(request.locale, 'msg.quizRevisionNoChanges'),
            });
            return;
        }
        const previewId = randomUUID();
        setPendingModification(quizRevisionOwner(resolved), {
            baseSnapshot: baseDraft,
            baseUpdatedAt: resolved.quiz.updatedAt,
            createdAt: Date.now(),
            previewId,
            proposed: proposedDraft,
        });
        logger.info('quiz_revision_preview_generated', {
            blockSummary: blockDiff?.summary,
            changedFields: metadataChanges.map((change) => change.field),
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            scope,
            userId: resolved.user.id,
        });
        // The shared modal controller hands `changes` straight to renderChanges,
        // so both halves of the proposal travel under that one key.
        response.json({
            changes: { blockChanges: blockDiff, metadataChanges },
            previewId,
        });
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        logger.error('quiz_revision_preview_failed', {
            error,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            userId: resolved.user.id,
        });
        response.status(422).json({
            creditExhausted: isCreditError,
            error: isCreditError
                ? getCreditExhaustedMessage(request.locale)
                : translate(request.locale, 'msg.quizRevisionFailed'),
        });
    }
}
export function handleApplyQuizRevision(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const owner = quizRevisionOwner(resolved);
    const pending = getPendingModification(owner);
    const previewId = readField(request.body.previewId, 100);
    const currentDraft = storedQuizToDraft(resolved.quiz);
    if (!pending
        || !previewId
        || pending.previewId !== previewId
        || pending.baseUpdatedAt !== resolved.quiz.updatedAt
        || JSON.stringify(pending.baseSnapshot) !== JSON.stringify(currentDraft)) {
        response.status(409).json({
            error: translate(request.locale, 'msg.quizRevisionExpired'),
        });
        return;
    }
    const updatedQuiz = updateQuizWithDraft(resolved.quiz, resolved.user.id, pending.proposed);
    if (!updatedQuiz) {
        response.status(422).json({
            error: translate(request.locale, 'msg.quizRevisionFailed'),
        });
        return;
    }
    deletePendingModification(owner);
    logger.info('quiz_revision_applied', {
        quizId: resolved.quiz.id,
        resourceId: resolved.quiz.id,
        resourceType: 'quiz',
        userId: resolved.user.id,
    });
    response.json({ ok: true });
}
export function handleDiscardQuizRevision(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    deletePendingModification(quizRevisionOwner(resolved));
    response.json({ ok: true });
}
export function handleDeleteQuizBlock(request, response) {
    updateDraftBlocks(request, response, (draft, blockId) => removeQuizBlock(draft, blockId));
}
export function handleDuplicateQuizBlock(request, response) {
    updateDraftBlocks(request, response, (draft, blockId) => duplicateQuizBlock(draft, blockId));
}
export function handleMoveQuizBlock(request, response) {
    const direction = request.path.endsWith('/move-down') ? 'down' : 'up';
    updateDraftBlocks(request, response, (draft, blockId) => moveQuizBlock(draft, blockId, direction), { focusMovedBlock: true });
}
function updateDraftBlocks(request, response, updater, options = {}) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = safeParseQuizDraft(resolved.quiz.quiz);
    const blockId = readField(request.params.blockId, 120);
    if (!draft || !blockId) {
        response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'blocks'));
        return;
    }
    const updatedDraft = updater(draft, blockId);
    const updatedQuiz = updateQuizWithDraft(resolved.quiz, resolved.user.id, updatedDraft);
    if (!updatedQuiz) {
        renderQuizAuthoring(request, response.status(422), {
            ...resolved,
            activeTab: 'blocks',
            error: translate(request.locale, 'msg.updateBlocksError'),
        });
        return;
    }
    logger.info('quiz_blocks_updated', {
        quizId: resolved.quiz.id,
        blockCount: updatedDraft.blocks.length,
        blockId,
        resourceId: resolved.quiz.id,
        resourceType: 'quiz',
        userId: resolved.user.id,
    });
    response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'blocks', options.focusMovedBlock ? buildQuizBlockAnchorId(blockId) : undefined));
}
export function renderQuizEditPage(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = quizToDraftOrRedirect(resolved.quiz, response);
    if (!draft) {
        return;
    }
    const activeTab = readQuizAuthoringTab(request.query.tab);
    renderQuizAuthoring(request, response, {
        activeProfile: resolved.activeProfile,
        activeTab,
        quiz: resolved.quiz,
        user: resolved.user,
    });
}
export async function renderQuizShowPage(request, response) {
    const resolved = resolveAccessibleQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = quizToDraftOrRedirect(resolved.quiz, response);
    if (!draft) {
        return;
    }
    const shareLink = resolved.canManageQuiz
        ? getOrCreateResourceShareLink(resolved.quiz.id)
        : null;
    const shareUrl = shareLink
        ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(shareLink.id)}`)
        : '';
    const quizShareQrDataUrl = shareLink
        ? await QRCode.toDataURL(shareUrl, {
            margin: 1,
            width: 180,
        })
        : '';
    const quizShareMode = readQuizShareMode(request.query.share);
    const selectedQuizSharedFromProfileName = !resolved.canManageQuiz
        ? findProfileById(resolved.quiz.profileId)?.name || ''
        : resolved.quiz.sourceProfileId
            ? findProfileById(resolved.quiz.sourceProfileId)?.name || ''
            : '';
    const shareTargetQuizProfiles = (request.availableProfiles ?? []).filter((profile) => profile.id !== resolved.quiz.profileId);
    const resourceCurrentFolder = resolved.canManageQuiz
        ? findResourceFolderForResource(resolved.quiz.id, resolved.user.id)
        : null;
    const resourceFolderPath = resolved.canManageQuiz
        ? listResourceFolderPathForResource(resolved.quiz.id, resolved.user.id)
        : [];
    const resourceFolderOptions = resolved.canManageQuiz
        ? listResourceFoldersForProfile({
            includeArchived: false,
            profileId: resolved.quiz.profileId,
            userId: resolved.user.id,
        })
        : [];
    const attempts = listQuizAttemptsForUser({
        quizId: resolved.quiz.id,
        profileId: resolved.canManageQuiz
            ? resolved.quiz.profileId
            : resolved.activeProfile.id,
        userId: resolved.user.id,
    });
    const collectedAttempts = resolved.canManageQuiz
        ? listCollectedQuizAttemptsForOwner({
            authorProfileId: resolved.quiz.profileId,
            quizId: resolved.quiz.id,
        })
        : [];
    renderQuizzesView(response, 'quizzes-show', {
        ...buildQuizzesShellContext(request, {
            activeProfile: resolved.activeProfile,
            title: buildDocumentTitle(request.locale, resolved.quiz.title),
            user: resolved.user,
        }),
        quizAttempts: buildQuizAttemptListItems(attempts, request.locale),
        quizParticipationCounts: buildQuizParticipationCounts(collectedAttempts),
        quizBlockOutlineItems: buildQuizBlockOutlineItems(draft, request.locale),
        canManageQuiz: resolved.canManageQuiz,
        quizShareMode,
        quizShareQrDataUrl,
        draft,
        resourceCurrentFolder,
        resourceFolderPath,
        resourceFolderOptions,
        selectedQuiz: resolved.quiz,
        selectedQuizSharedFromProfileName,
        shareLink,
        shareTargetQuizProfiles,
        shareUrl,
    });
}
/**
 * Headline counts for the quiz page's Participantes teaser: how many distinct
 * participants finished (an evaluated attempt) and how many responses came in
 * overall. A participant with several attempts counts once as completed but
 * contributes each submission.
 */
function buildQuizParticipationCounts(attempts) {
    const completedParticipants = new Set();
    for (const attempt of attempts) {
        if (attempt.status !== 'evaluated') {
            continue;
        }
        // Guests have no profile, so each guest attempt is its own participant.
        completedParticipants.add(attempt.profileId ?? `attempt:${attempt.id}`);
    }
    return {
        completed: completedParticipants.size,
        submissions: attempts.length,
    };
}
/**
 * Dedicated participation page: the live responses summary, the stored AI
 * summary with its staleness state, and the per-participant list. Split out of
 * the quiz page so the quiz page stays about the quiz itself.
 */
export async function renderQuizParticipationPage(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = quizToDraftOrRedirect(resolved.quiz, response);
    if (!draft) {
        return;
    }
    const collectedAttempts = listCollectedQuizAttemptsForOwner({
        authorProfileId: resolved.quiz.profileId,
        quizId: resolved.quiz.id,
    });
    const responsesSummary = buildQuizResponsesSummary({
        attempts: collectedAttempts,
        draft,
    });
    const storedAiSummary = getQuizResponseSummary(resolved.quiz.id);
    const aiSummary = storedAiSummary
        ? {
            generatedAtRelative: formatRelativeTime(storedAiSummary.generatedAt),
            stale: storedAiSummary.inputFingerprint
                !== computeQuizResponsesFingerprint(collectedAttempts),
            text: storedAiSummary.summaryText,
        }
        : null;
    renderQuizzesView(response, 'quizzes-participation', {
        ...buildQuizzesShellContext(request, {
            activeProfile: resolved.activeProfile,
            title: buildDocumentTitle(request.locale, resolved.quiz.title),
            user: resolved.user,
        }),
        canManageQuiz: true,
        quizAiSummary: aiSummary,
        quizCollectedAttempts: buildCollectedQuizAttemptListItems(collectedAttempts, request.locale),
        quizResponsesSummary: responsesSummary,
        quizResponsesSummaryError: readQuizResponsesSummaryError(request.query.summaryError, request.locale),
        resourceFolderPath: listResourceFolderPathForResource(resolved.quiz.id, resolved.user.id),
        selectedQuiz: resolved.quiz,
    });
}
function readQuizResponsesSummaryError(value, locale) {
    const code = readField(value, 20);
    if (code === 'credit') {
        return {
            isCredit: true,
            message: getCreditExhaustedMessage(locale),
        };
    }
    if (code === 'empty') {
        return {
            isCredit: false,
            message: translate(locale, 'quizzes.summaryErrorEmpty'),
        };
    }
    if (code === 'generic') {
        return {
            isCredit: false,
            message: translate(locale, 'quizzes.summaryErrorGeneric'),
        };
    }
    return null;
}
/**
 * Generates (or regenerates) the AI summary of a quiz's collected responses on
 * the owner's own credit-gated key, and persists it with a fingerprint of the
 * inputs so the view can flag it stale when new responses arrive. The
 * deterministic aggregation is always live; only this narrative is stored,
 * because it costs an inference.
 */
export async function handleGenerateQuizResponsesSummary(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = quizToDraftOrRedirect(resolved.quiz, response);
    if (!draft) {
        return;
    }
    // The summary lives on the participation page, so every outcome returns
    // there rather than to the quiz page.
    const quizPath = `/quizzes/${encodeURIComponent(resolved.quiz.id)}/participation`;
    const collectedAttempts = listCollectedQuizAttemptsForOwner({
        authorProfileId: resolved.quiz.profileId,
        quizId: resolved.quiz.id,
    });
    const summary = buildQuizResponsesSummary({ attempts: collectedAttempts, draft });
    if (summary.evaluatedCount === 0) {
        response.redirect(`${quizPath}?summaryError=empty`);
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const result = await generateQuizResponsesSummary({
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            modelTier: resolved.activeProfile?.modelTier,
            openRouterApiKey,
            request: {
                evaluatedCount: summary.evaluatedCount,
                questions: summary.questions.map((question) => ({
                    correct: question.correct,
                    incorrect: question.incorrect,
                    partial: question.partial,
                    prompt: question.prompt,
                })),
                respondedCount: summary.respondedCount,
                targetTopic: draft.targetTopic ?? '',
                title: draft.title,
            },
        });
        upsertQuizResponseSummary({
            inputFingerprint: computeQuizResponsesFingerprint(collectedAttempts),
            quizId: resolved.quiz.id,
            summaryText: result.summary,
        });
        logger.info('quiz_responses_summary_generated', {
            evaluatedCount: summary.evaluatedCount,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            respondedCount: summary.respondedCount,
            userId: resolved.user.id,
        });
        response.redirect(quizPath);
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect(`${quizPath}?summaryError=credit`);
            return;
        }
        logger.error('quiz_responses_summary_failed', {
            error,
            quizId: resolved.quiz.id,
            resourceId: resolved.quiz.id,
            resourceType: 'quiz',
            userId: resolved.user.id,
        });
        response.redirect(`${quizPath}?summaryError=generic`);
    }
}
export function handleShareQuizToProfile(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const targetProfileId = readField(request.body.targetProfileId, 120);
    const targetProfile = findProfileForUser(targetProfileId, resolved.user.id);
    if (!targetProfile || targetProfile.id === resolved.quiz.profileId) {
        response.redirect(`/quizzes/${encodeURIComponent(resolved.quiz.id)}`);
        return;
    }
    grantResourceAccess({
        collectResults: readField(request.body.collectResults, 10) === 'on',
        grantedByUserId: resolved.user.id,
        grantedVia: 'profile',
        profileId: targetProfile.id,
        resourceId: resolved.quiz.id,
        userId: resolved.user.id,
    });
    response.redirect(`/quizzes/${encodeURIComponent(resolved.quiz.id)}`);
}
export function handleArchiveQuiz(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const returnTo = readReturnTo(request.body.returnTo, '/resources');
    archiveQuizForUser(resolved.quiz.id, resolved.user.id);
    response.redirect(returnTo);
}
export function handleRestoreQuiz(request, response) {
    const resolved = resolveOwnQuiz(request, response);
    if (!resolved) {
        return;
    }
    const returnTo = readReturnTo(request.body.returnTo, `/quizzes/${encodeURIComponent(resolved.quiz.id)}`);
    restoreQuizForUser(resolved.quiz.id, resolved.user.id);
    response.redirect(returnTo);
}
// Generous enough for a whole classroom behind one school NAT IP, while still
// bounding scripted guest-attempt flooding. Evaluation is already gated behind
// an account, so the only anonymous cost is attempt rows.
const guestQuizAttemptLimiter = createFixedWindowRateLimiter({
    maxActions: 60,
    windowMs: 60 * 60 * 1000,
});
/**
 * Starts an attempt for a shared quiz. Anonymous visitors get a rate-limited
 * guest attempt whose evaluation is gated behind signup. Authenticated
 * visitors get a normal owned attempt with resource access.
 */
export function handleStartSharedQuizAttempt(request, response) {
    const shareId = readField(request.params.shareId, 120);
    const sharePath = `/resources/shared/${encodeURIComponent(shareId)}`;
    const shareLink = findResourceShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/resources');
        return;
    }
    const quiz = findQuizById(shareLink.resourceId);
    if (!quiz || quiz.archivedAt) {
        response.redirect(sharePath);
        return;
    }
    const draft = safeParseQuizDraft(quiz.quiz);
    if (!draft) {
        response.redirect(sharePath);
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (user?.emailVerified && activeProfile) {
        grantResourceAccess({
            collectResults: shareLink.collectResults,
            grantedByUserId: quiz.userId,
            grantedVia: 'link',
            profileId: activeProfile.id,
            resourceId: quiz.id,
            shareLinkId: shareLink.id,
            userId: user.id,
        });
        const attempt = createQuizAttempt({
            quizId: quiz.id,
            collectResults: shareLink.collectResults,
            profileId: activeProfile.id,
            snapshot: draft,
            userId: user.id,
        });
        logger.info('quiz_attempt_started', {
            quizId: quiz.id,
            attemptId: attempt.id,
            collectResults: attempt.collectResults,
            isGuest: false,
            profileId: attempt.profileId,
            resourceId: quiz.id,
            resourceType: 'quiz',
            userId: attempt.userId,
        });
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    const rateLimitKey = `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    const rateLimit = guestQuizAttemptLimiter.allow(rateLimitKey);
    if (!rateLimit.allowed) {
        if (rateLimit.shouldLogLimit) {
            logger.warn('quiz_public_attempt_rate_limited', {
                key: rateLimitKey.slice(0, 80),
                quizId: quiz.id,
                resourceId: quiz.id,
                resourceType: 'quiz',
            });
        }
        response.redirect(sharePath);
        return;
    }
    const attempt = createQuizAttempt({
        quizId: quiz.id,
        collectResults: shareLink.collectResults,
        snapshot: draft,
    });
    logger.info('quiz_public_attempt_started', {
        quizId: quiz.id,
        attemptId: attempt.id,
        collectResults: attempt.collectResults,
        isGuest: true,
        resourceId: quiz.id,
        resourceType: 'quiz',
        userId: null,
    });
    response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}`, attempt));
}
export function handleStartQuizTestAttempt(request, response) {
    const resolved = resolveAccessibleQuiz(request, response);
    if (!resolved) {
        return;
    }
    const draft = quizToDraftOrRedirect(resolved.quiz, response);
    if (!draft) {
        return;
    }
    // The quiz author's own runs are private tests and never collect. Any other
    // profile reaches this through a profile share, so the attempt snapshots the
    // grant's results-feedback flag — the same primitive as the shared link.
    const isAuthorProfile = resolved.activeProfile.id === resolved.quiz.profileId;
    const collectResults = isAuthorProfile
        ? false
        : findResourceAccessGrant({
            profileId: resolved.activeProfile.id,
            resourceId: resolved.quiz.id,
            userId: resolved.user.id,
        })?.collectResults ?? false;
    const attempt = createQuizAttempt({
        quizId: resolved.quiz.id,
        collectResults,
        profileId: resolved.activeProfile.id,
        snapshot: draft,
        userId: resolved.user.id,
    });
    logger.info('quiz_attempt_started', {
        quizId: resolved.quiz.id,
        attemptId: attempt.id,
        collectResults: attempt.collectResults,
        isGuest: false,
        profileId: attempt.profileId,
        resourceId: resolved.quiz.id,
        resourceType: 'quiz',
        userId: attempt.userId,
    });
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
}
export function renderQuizAttemptPage(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    if (attempt.status === 'evaluated') {
        response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
        return;
    }
    renderQuizAttempt(request, response, { attempt });
}
export async function handleSubmitQuizAttempt(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const draft = safeParseQuizDraft(attempt.snapshot);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    const responses = normalizeQuizResponses({
        body: request.body,
        draft,
    });
    const submittedAttempt = submitQuizAttempt({
        attemptId: attempt.id,
        responses,
    });
    logger.info('quiz_attempt_submitted', {
        quizId: attempt.quizId,
        attemptId: attempt.id,
        isGuest: !attempt.userId,
        responseCount: responses.length,
        resourceId: attempt.quizId,
        resourceType: 'quiz',
        userId: attempt.userId,
    });
    if (!submittedAttempt) {
        renderQuizAttempt(request, response.status(422), {
            attempt,
            error: translate(request.locale, 'msg.submitQuizError'),
        });
        return;
    }
    // Anonymous student: the answers are saved, but evaluation needs an account.
    // Send them to sign up / log in; on return the evaluating page claims the
    // attempt and evaluates it with the new account's own credit-gated key,
    // showing progress while the inference runs.
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        const evaluatingPath = appendGuestToken(`/quiz-attempts/${encodeURIComponent(submittedAttempt.id)}/evaluating`, submittedAttempt);
        response.redirect(`/signup?returnTo=${encodeURIComponent(evaluatingPath)}`);
        return;
    }
    try {
        const evaluated = await evaluateSubmittedQuizAttemptForUser({
            attempt: submittedAttempt,
            profileId: activeProfile.id,
            userId: user.id,
        });
        response.redirect(`/quiz-attempts/${encodeURIComponent(evaluated.id)}/result`);
    }
    catch (error) {
        renderQuizEvaluationError(request, response, submittedAttempt, error);
    }
}
/**
 * Interstitial shown while a submitted attempt is evaluated. Rendering this
 * page is instant; the evaluation inference runs in the POST it triggers, so
 * the student always sees progress instead of a hanging navigation. This is
 * the landing spot for a guest who just created an account to see their
 * result.
 */
export function renderQuizEvaluatingPage(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    if (attempt.status === 'evaluated') {
        response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
        return;
    }
    const evaluatingPath = appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/evaluating`, attempt);
    const user = request.authUser;
    if (!user?.emailVerified || !request.activeProfile) {
        response.redirect(`/signup?returnTo=${encodeURIComponent(evaluatingPath)}`);
        return;
    }
    const draft = safeParseQuizDraft(attempt.snapshot);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    renderQuizzesView(response, 'quizzes-evaluating', {
        ...buildQuizzesShellContext(request, {
            activeProfile: request.activeProfile,
            title: buildDocumentTitle(request.locale, draft.title),
            user,
        }),
        attempt,
        draft,
        guestToken: attempt.guestToken || '',
    });
}
/**
 * Evaluates a submitted attempt on the student's own credit-gated key,
 * claiming it first when it started as a guest attempt.
 */
export async function handleEvaluateQuizAttempt(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    if (attempt.status === 'evaluated') {
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
        return;
    }
    try {
        const evaluated = await evaluateSubmittedQuizAttemptForUser({
            attempt,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
        response.redirect(`/quiz-attempts/${encodeURIComponent(evaluated.id)}/result`);
    }
    catch (error) {
        renderQuizEvaluationError(request, response, attempt, error);
    }
}
async function evaluateSubmittedQuizAttemptForUser(input) {
    let attempt = input.attempt;
    // Claim a guest attempt so the evaluation and progress belong to the user.
    if (!attempt.userId && attempt.claimToken) {
        const claimed = attachQuizAttemptToUser({
            attemptId: attempt.id,
            claimToken: attempt.claimToken,
            profileId: input.profileId,
            userId: input.userId,
        });
        if (claimed) {
            attempt = claimed;
        }
    }
    const evaluatingAttempt = markQuizAttemptEvaluating(attempt.id);
    if (!evaluatingAttempt) {
        throw new Error('Could not mark quiz attempt as evaluating.');
    }
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(input.userId);
    const result = await evaluateQuizAttempt({
        attempt: evaluatingAttempt,
        instructionLanguage: findProfileForUser(input.profileId, input.userId)
            ?.instructionLanguage,
        llm: { openRouterApiKey },
    });
    const evaluated = saveQuizAttemptResult({ attemptId: evaluatingAttempt.id, result });
    if (!evaluated) {
        throw new Error('Could not save quiz attempt result.');
    }
    recordQuizAttemptProgress(evaluated);
    logger.info('quiz_attempt_evaluated', {
        quizId: evaluated.quizId,
        attemptId: evaluated.id,
        resourceId: evaluated.quizId,
        resourceType: 'quiz',
        summary: buildQuizEvaluationSummary(result),
        userId: evaluated.userId,
    });
    return evaluated;
}
function renderQuizEvaluationError(request, response, attempt, error) {
    const isCredit = isCreditExhaustedError(error);
    logger.error('quiz_attempt_evaluation_failed', {
        quizId: attempt.quizId,
        attemptId: attempt.id,
        error,
        isCredit,
        resourceId: attempt.quizId,
        resourceType: 'quiz',
        userId: attempt.userId,
    });
    const failedAttempt = markQuizAttemptFailed(attempt.id) ?? attempt;
    renderQuizAttempt(request, response.status(422), {
        attempt: failedAttempt,
        error: isCredit
            ? getCreditExhaustedMessage(request.locale)
            : translate(request.locale, 'msg.evaluateQuizError'),
        errorIsCredit: isCredit,
    });
}
export async function renderQuizResultPage(request, response) {
    // Quiz-owner read-only view of a collected student attempt. Checked before
    // the normal resolver so the owner path can never claim, evaluate, or act on
    // the student's attempt — evaluated attempts render, anything else goes back
    // to the quiz page.
    const requestedAttempt = findQuizAttemptById(readField(request.params.attemptId, 120));
    const viewer = request.authUser;
    if (requestedAttempt
        && requestedAttempt.collectResults
        && viewer?.emailVerified
        && requestedAttempt.userId !== viewer.id) {
        const attemptQuiz = findQuizForUser(requestedAttempt.quizId, viewer.id);
        if (attemptQuiz) {
            if (requestedAttempt.status !== 'evaluated') {
                response.redirect(`/quizzes/${encodeURIComponent(attemptQuiz.id)}`);
                return;
            }
            const participantUser = requestedAttempt.userId
                ? findUserById(requestedAttempt.userId)
                : null;
            logger.info('quiz_owner_result_viewed', {
                attemptId: requestedAttempt.id,
                quizId: attemptQuiz.id,
                resourceId: attemptQuiz.id,
                resourceType: 'quiz',
                userId: viewer.id,
            });
            renderQuizResult(request, response, requestedAttempt, {
                ownerView: true,
                ownerViewParticipantLabel: participantUser?.fullName
                    || participantUser?.email
                    || translate(request.locale, 'quizzes.resultsAnonymousParticipant'),
            });
            return;
        }
    }
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    // A student who filled a quiz as a guest and just signed in / signed up lands
    // here with the attempt only submitted. Evaluation needs an inference, so it
    // runs behind the evaluating page (a POST with visible progress) instead of
    // blocking this render with a blank page.
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (user?.emailVerified && activeProfile && attempt.status === 'submitted') {
        response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/evaluating`, attempt));
        return;
    }
    renderQuizResult(request, response, attempt);
}
export function handleClaimQuizAttempt(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    if (attempt.userId === auth.user.id) {
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
        return;
    }
    if (!attempt.claimToken) {
        response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
        return;
    }
    const claimedAttempt = attachQuizAttemptToUser({
        attemptId: attempt.id,
        claimToken: attempt.claimToken,
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    if (claimedAttempt) {
        recordQuizAttemptProgress(claimedAttempt);
    }
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
}
export function handleCreateQuizFollowUpConversation(request, response) {
    let attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    if (!attempt.userId && attempt.claimToken) {
        attempt = attachQuizAttemptToUser({
            attemptId: attempt.id,
            claimToken: attempt.claimToken,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
        if (attempt) {
            recordQuizAttemptProgress(attempt);
        }
    }
    if (!attempt || attempt.userId !== auth.user.id || !attempt.profileId) {
        response.redirect('/login');
        return;
    }
    if (!attempt.result) {
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    const conversation = createConversationFromQuizAttempt({
        attempt,
        profileId: attempt.profileId,
        userId: auth.user.id,
    });
    logger.info('quiz_follow_up_conversation_created', {
        quizId: attempt.quizId,
        attemptId: attempt.id,
        conversationId: conversation.id,
        profileId: attempt.profileId,
        resourceId: attempt.quizId,
        resourceType: 'quiz',
        userId: auth.user.id,
    });
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
export async function handleCreateQuizResource(request, response) {
    let attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const auth = ensureVerifiedQuizUser(request, response);
    if (!auth) {
        return;
    }
    if (!attempt.userId && attempt.claimToken) {
        attempt = attachQuizAttemptToUser({
            attemptId: attempt.id,
            claimToken: attempt.claimToken,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
        if (attempt) {
            recordQuizAttemptProgress(attempt);
        }
    }
    if (!attempt || attempt.userId !== auth.user.id || !attempt.profileId) {
        response.redirect('/login');
        return;
    }
    const draft = safeParseQuizDraft(attempt.snapshot);
    const result = attempt.result ? quizResultBlockSchema.safeParse(attempt.result) : null;
    if (!draft || !result?.success || attempt.status !== 'evaluated') {
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    const type = normalizeContextResourceType(request.body.type);
    if (!type) {
        response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
        return;
    }
    const instruction = readMultilineField(request.body.prompt, 2000);
    const prompt = buildResourceFromContextPrompt({
        context: buildQuizResultContext({ attempt, draft, result: result.data }),
        contextLabel: 'Completed quiz result',
        instruction,
        type,
    });
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const created = await createResourceFromContextDraft({
            openRouterApiKey,
            profileId: attempt.profileId,
            prompt,
            type,
            userId: auth.user.id,
        });
        logger.info('quiz_resource_created', {
            quizId: attempt.quizId,
            attemptId: attempt.id,
            profileId: attempt.profileId,
            resourceType: type,
            sourceResourceId: attempt.quizId,
            userId: auth.user.id,
        });
        response.redirect(created.detailPath);
    }
    catch (error) {
        logger.error('quiz_resource_creation_failed', {
            quizId: attempt.quizId,
            attemptId: attempt.id,
            error,
            resourceType: type,
            sourceResourceId: attempt.quizId,
            userId: auth.user.id,
        });
        response.redirect(buildQuizResultPath(attempt, {
            guideError: isCreditExhaustedError(error) ? 'credit' : 'practice-guide',
        }));
    }
}
//# sourceMappingURL=handlers.js.map