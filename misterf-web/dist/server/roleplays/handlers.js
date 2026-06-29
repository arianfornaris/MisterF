import QRCode from 'qrcode';
import { appendRoleplayAttemptTurns, createConversationFromRoleplayAttempt, createPracticeModule, createRoleplay, createRoleplayAttempt, findProfileById, findProfileForUser, findResourceAccessForProfile, findResourceFolderForResource, findRoleplayAttemptById, findRoleplayById, findRoleplayForUser, getOrCreateResourceShareLink, grantResourceAccess, listResourceFolderPathForResource, listResourceFoldersForProfile, listRoleplayAttemptsForUser, markRoleplayAttemptFailed, saveRoleplayAttemptResult, submitRoleplayAttempt, updateRoleplay, updateRoleplayAuthoringMessages, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { appDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, } from '../pages/shell.js';
import { appendRoleplayAuthoringMessages, buildRoleplayAuthoringMessage, countLearnerTurns, createRoleplayDraftFromManualInput, evaluateRoleplayAttempt, generateOpeningRoleplayTurn, generateNextRoleplayTurn, getAiCharacter, getLearnerCharacter, hasReachedRoleplayTurnLimit, roleplayEvaluationResultSchema, safeParseRoleplayDraft, storedRoleplayToDraft, } from '../services/roleplays.js';
import { generatePracticeModuleDraft, generateRoleplayDraft, generateRoleplayRevision, } from '../services/resourceDrafts.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { recordRoleplayAttemptProgress } from '../services/learnerProgress.js';
import { logger } from '../services/logger.js';
const defaultRoleplayAuthoringTab = 'general';
function ensureVerifiedRoleplayUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return { activeProfile, user };
}
function buildRoleplaysShellContext(request, options) {
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
function wantsJsonResponse(request) {
    return request.get('accept')?.includes('application/json')
        || request.get('x-requested-with') === 'fetch';
}
function readMaxLearnerTurns(value) {
    const rawValue = readField(value, 20);
    if (!rawValue) {
        return null;
    }
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed)
        ? Math.min(20, Math.max(1, parsed))
        : null;
}
function readRoleplayShareMode(value) {
    const mode = readField(value, 20);
    return mode === 'link' || mode === 'profile' ? mode : '';
}
function readReturnTo(value, fallback) {
    const returnTo = readField(value, 1200);
    return returnTo.startsWith('/') ? returnTo : fallback;
}
function readRoleplayAuthoringTab(value) {
    const tab = readField(value, 20);
    return tab === 'chat' || tab === 'general'
        ? tab
        : defaultRoleplayAuthoringTab;
}
function buildRoleplayAuthoringPath(roleplayId, tab) {
    return `/roleplays/${encodeURIComponent(roleplayId)}/edit?tab=${tab}`;
}
function buildRoleplayResultPath(attemptId, params = {}) {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    const path = `/roleplay-attempts/${encodeURIComponent(attemptId)}/result`;
    return query ? `${path}?${query}` : path;
}
function readRoleplayResultActionError(value) {
    const code = readField(value, 40);
    if (code === 'credit') {
        return {
            resultActionError: getCreditExhaustedMessage(),
            resultActionErrorIsCredit: true,
        };
    }
    if (code === 'practice-guide') {
        return {
            resultActionError: 'No pude crear la guía de práctica ahora mismo. Inténtalo otra vez.',
            resultActionErrorIsCredit: false,
        };
    }
    return {
        resultActionError: '',
        resultActionErrorIsCredit: false,
    };
}
function buildRoleplayPracticeGuidePrompt(input) {
    const payload = {
        evaluation: input.result,
        roleplay: {
            characters: input.draft.characters,
            description: input.draft.description,
            level: input.draft.level,
            pedagogicalFocus: input.draft.pedagogicalFocus,
            scenario: input.draft.scenario,
            title: input.draft.title,
        },
        turns: input.attempt.turns,
    };
    return [
        'Create a reusable Mister F practice guide from this completed Roleplay evaluation.',
        'Mister F is an English-learning product. The guide must help the learner practice English, not Spanish.',
        'Use Spanish for the guide title, description, and tutor instructions, but make the target language and learner production English.',
        'Focus on the learner\'s English errors, unclear phrasing, vocabulary gaps, register choices, and recurring language patterns from the roleplay.',
        'Do not turn the guide into a morality, etiquette, politeness, or personality lesson. Mention tone only when it is directly useful as an English register or phrasing point.',
        'Tell Mr. F to guide one exercise item at a time. If a checkpoint is useful, describe it explicitly as a quiz or checkpoint.',
        'Do not include internal JSON, implementation details, or product flow notes in the generated guide.',
        '',
        'Completed Roleplay data:',
        JSON.stringify(payload, null, 2),
    ].join('\n');
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
function summarizeRoleplayDraftCreation(draft) {
    return `Listo. Creé una primera versión de "${draft.title}" con ${draft.characters.length} personajes.`;
}
function updateRoleplayWithDraft(roleplay, userId, draft, authoringMessages) {
    return updateRoleplay({
        authoringMessages,
        characters: draft.characters,
        description: draft.description,
        level: draft.level,
        maxLearnerTurns: draft.maxLearnerTurns,
        pedagogicalFocus: draft.pedagogicalFocus,
        roleplayId: roleplay.id,
        scenario: draft.scenario,
        title: draft.title,
        userId,
    });
}
function resolveOwnRoleplay(request, response) {
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!auth) {
        return null;
    }
    const roleplayId = readField(request.params.roleplayId, 120);
    const roleplay = findRoleplayForUser(roleplayId, auth.user.id);
    if (!roleplay) {
        response.redirect('/resources');
        return null;
    }
    let activeProfile = auth.activeProfile;
    if (roleplay.profileId !== activeProfile.id) {
        const profile = findProfileForUser(roleplay.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/resources');
            return null;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    return { activeProfile, roleplay, user: auth.user };
}
function resolveAccessibleRoleplay(request, response) {
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!auth) {
        return null;
    }
    const roleplayId = readField(request.params.roleplayId, 120);
    const resourceAccess = findResourceAccessForProfile({
        includeArchived: true,
        profileId: auth.activeProfile.id,
        resourceId: roleplayId,
        userId: auth.user.id,
    });
    if (resourceAccess?.type === 'roleplay') {
        if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
            response.redirect('/resources');
            return null;
        }
        const roleplay = findRoleplayById(resourceAccess.id);
        if (!roleplay) {
            response.redirect('/resources');
            return null;
        }
        return {
            activeProfile: auth.activeProfile,
            canManageRoleplay: resourceAccess.accessKind === 'owner',
            roleplay,
            user: auth.user,
        };
    }
    const ownedRoleplay = findRoleplayForUser(roleplayId, auth.user.id);
    if (!ownedRoleplay) {
        response.redirect('/resources');
        return null;
    }
    let activeProfile = auth.activeProfile;
    if (ownedRoleplay.profileId !== activeProfile.id) {
        const profile = findProfileForUser(ownedRoleplay.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/resources');
            return null;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    return {
        activeProfile,
        canManageRoleplay: true,
        roleplay: ownedRoleplay,
        user: auth.user,
    };
}
function resolveAccessibleAttempt(request, response) {
    const attemptId = readField(request.params.attemptId, 120);
    const attempt = findRoleplayAttemptById(attemptId);
    const user = request.authUser;
    if (!attempt || !user?.emailVerified || attempt.userId !== user.id) {
        response.redirect('/login');
        return null;
    }
    return attempt;
}
function readRoleplayCharacterFromBody(body, id, fallback) {
    const fieldPrefix = id === 'learner' ? 'learnerCharacter' : 'aiCharacter';
    return {
        description: readMultilineField(body[`${fieldPrefix}Description`], 1200)
            || fallback.description,
        id,
        name: readField(body[`${fieldPrefix}Name`], 120) || fallback.name,
    };
}
function readCharactersFromBody(body, previousDraft) {
    return [
        readRoleplayCharacterFromBody(body, 'learner', getLearnerCharacter(previousDraft)),
        readRoleplayCharacterFromBody(body, 'ai', getAiCharacter(previousDraft)),
    ];
}
function buildAttemptListItems(attempts) {
    return attempts.map((attempt) => ({
        ...attempt,
        ...getRoleplayAttemptStatusView(attempt.status),
        learnerTurnCount: countLearnerTurns(attempt.turns),
        relativeUpdatedAt: formatRelativeTime(attempt.updatedAt),
    }));
}
function getRoleplayAttemptStatusView(status) {
    switch (status) {
        case 'draft':
            return { statusBadgeClass: 'text-bg-light border', statusLabel: 'Sin iniciar' };
        case 'in_progress':
            return { statusBadgeClass: 'text-bg-info', statusLabel: 'En progreso' };
        case 'evaluating':
            return { statusBadgeClass: 'text-bg-primary', statusLabel: 'Evaluando' };
        case 'evaluated':
            return { statusBadgeClass: 'text-bg-success', statusLabel: 'Evaluado' };
        case 'failed':
            return { statusBadgeClass: 'text-bg-danger', statusLabel: 'Error al evaluar' };
    }
}
function renderRoleplayEdit(request, response, input) {
    const draft = safeParseRoleplayDraft(storedRoleplayToDraft(input.roleplay));
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    response.render('roleplays-edit', {
        ...buildRoleplaysShellContext(request, {
            activeProfile: input.activeProfile,
            title: `${draft.title} - ${appDocumentTitle}`,
            user: input.user,
        }),
        activeTab: input.activeTab ?? defaultRoleplayAuthoringTab,
        authoringError: input.error || '',
        aiCharacter: getAiCharacter(draft),
        draft,
        learnerCharacter: getLearnerCharacter(draft),
        roleplayAuthoringMessages: input.roleplay.authoringMessages,
        selectedRoleplay: input.roleplay,
    });
}
export function renderRoleplayNewPage(request, response) {
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!auth) {
        return;
    }
    response.render('roleplays-new', {
        ...buildRoleplaysShellContext(request, {
            activeProfile: auth.activeProfile,
            title: `Nuevo Roleplay - ${appDocumentTitle}`,
            user: auth.user,
        }),
        generationError: '',
        generationPrompt: '',
    });
}
export async function handleGenerateRoleplay(request, response) {
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!auth) {
        return;
    }
    const prompt = readMultilineField(request.body.prompt, 6000);
    if (prompt.length < 10) {
        response.status(422).render('roleplays-new', {
            ...buildRoleplaysShellContext(request, {
                activeProfile: auth.activeProfile,
                title: `Nuevo Roleplay - ${appDocumentTitle}`,
                user: auth.user,
            }),
            generationError: 'Describe un poco mejor el Roleplay.',
            generationPrompt: prompt,
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const draft = await generateRoleplayDraft({
            openRouterApiKey,
            prompt,
        });
        const roleplay = createRoleplay({
            authoringMessages: appendRoleplayAuthoringMessages([], buildRoleplayAuthoringMessage('user', prompt), buildRoleplayAuthoringMessage('assistant', summarizeRoleplayDraftCreation(draft), draft)),
            ...draft,
            profileId: auth.activeProfile.id,
            userId: auth.user.id,
        });
        logger.info('roleplay_created_from_prompt', {
            profileId: auth.activeProfile.id,
            resourceId: roleplay.id,
            resourceType: 'roleplay',
            roleplayId: roleplay.id,
            userId: auth.user.id,
        });
        response.redirect(buildRoleplayAuthoringPath(roleplay.id, defaultRoleplayAuthoringTab));
    }
    catch (error) {
        logger.error('roleplay_generation_failed', {
            error,
            userId: auth.user.id,
        });
        response.status(422).render('roleplays-new', {
            ...buildRoleplaysShellContext(request, {
                activeProfile: auth.activeProfile,
                title: `Nuevo Roleplay - ${appDocumentTitle}`,
                user: auth.user,
            }),
            generationError: isCreditExhaustedError(error)
                ? getCreditExhaustedMessage()
                : 'No pude generar el Roleplay ahora mismo. Inténtalo otra vez.',
            generationPrompt: prompt,
        });
    }
}
export function renderRoleplayEditPage(request, response) {
    const resolved = resolveOwnRoleplay(request, response);
    if (!resolved) {
        return;
    }
    renderRoleplayEdit(request, response, {
        ...resolved,
        activeTab: readRoleplayAuthoringTab(request.query.tab),
    });
}
export function handleUpdateRoleplay(request, response) {
    const resolved = resolveOwnRoleplay(request, response);
    if (!resolved) {
        return;
    }
    const draft = storedRoleplayToDraft(resolved.roleplay);
    const updatedDraft = createRoleplayDraftFromManualInput({
        characters: readCharactersFromBody(request.body, draft),
        description: readMultilineField(request.body.description, 1500),
        level: readField(request.body.level, 120),
        maxLearnerTurns: readMaxLearnerTurns(request.body.maxLearnerTurns),
        pedagogicalFocus: readMultilineField(request.body.pedagogicalFocus, 5000),
        previousDraft: draft,
        scenario: readMultilineField(request.body.scenario, 2200),
        title: readField(request.body.title, 220) || draft.title,
    });
    const updatedRoleplay = updateRoleplayWithDraft(resolved.roleplay, resolved.user.id, updatedDraft);
    if (!updatedRoleplay) {
        renderRoleplayEdit(request, response.status(422), {
            ...resolved,
            activeTab: 'general',
            error: 'No pude guardar el Roleplay.',
        });
        return;
    }
    response.redirect(buildRoleplayAuthoringPath(resolved.roleplay.id, 'general'));
}
export async function handleReviseRoleplay(request, response) {
    const resolved = resolveOwnRoleplay(request, response);
    if (!resolved) {
        return;
    }
    const draft = storedRoleplayToDraft(resolved.roleplay);
    const userMessage = readMultilineField(request.body.message, 4000);
    if (userMessage.length < 3) {
        renderRoleplayEdit(request, response.status(422), {
            ...resolved,
            activeTab: 'chat',
            error: 'Escribe los cambios que deseas aplicar.',
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const revision = await generateRoleplayRevision({
            conversationHistory: resolved.roleplay.authoringMessages.map((message) => ({
                content: message.content,
                createdAt: message.createdAt,
                draftSnapshot: message.draftSnapshot,
                role: message.role,
            })),
            currentDraft: draft,
            openRouterApiKey,
            prompt: userMessage,
        });
        const nextAuthoringMessages = appendRoleplayAuthoringMessages(resolved.roleplay.authoringMessages, buildRoleplayAuthoringMessage('user', userMessage), buildRoleplayAuthoringMessage('assistant', revision.assistantMessage, revision.draft));
        const updatedRoleplay = updateRoleplayWithDraft(resolved.roleplay, resolved.user.id, revision.draft, nextAuthoringMessages);
        if (!updatedRoleplay) {
            renderRoleplayEdit(request, response.status(422), {
                ...resolved,
                activeTab: 'chat',
                error: 'No pude aplicar ese cambio ahora mismo.',
            });
            return;
        }
        logger.info('roleplay_revised', {
            resourceId: resolved.roleplay.id,
            resourceType: 'roleplay',
            roleplayId: resolved.roleplay.id,
            userId: resolved.user.id,
        });
        response.redirect(buildRoleplayAuthoringPath(resolved.roleplay.id, 'chat'));
    }
    catch (error) {
        const failureMessage = isCreditExhaustedError(error)
            ? getCreditExhaustedMessage()
            : 'No pude aplicar ese cambio ahora mismo.';
        updateRoleplayAuthoringMessages({
            messages: appendRoleplayAuthoringMessages(resolved.roleplay.authoringMessages, buildRoleplayAuthoringMessage('user', userMessage), buildRoleplayAuthoringMessage('assistant', failureMessage)),
            roleplayId: resolved.roleplay.id,
            userId: resolved.user.id,
        });
        logger.error('roleplay_revision_failed', {
            error,
            resourceId: resolved.roleplay.id,
            resourceType: 'roleplay',
            roleplayId: resolved.roleplay.id,
            userId: resolved.user.id,
        });
        renderRoleplayEdit(request, response.status(422), {
            ...resolved,
            activeTab: 'chat',
            roleplay: findRoleplayForUser(resolved.roleplay.id, resolved.user.id) ?? resolved.roleplay,
            error: failureMessage,
        });
    }
}
export async function renderRoleplayShowPage(request, response) {
    const resolved = resolveAccessibleRoleplay(request, response);
    if (!resolved) {
        return;
    }
    const draft = storedRoleplayToDraft(resolved.roleplay);
    const shareLink = resolved.canManageRoleplay
        ? getOrCreateResourceShareLink(resolved.roleplay.id)
        : null;
    const shareUrl = shareLink
        ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(shareLink.id)}`)
        : '';
    const roleplayShareQrDataUrl = shareLink
        ? await QRCode.toDataURL(shareUrl, { margin: 1, width: 180 })
        : '';
    const roleplayShareMode = readRoleplayShareMode(request.query.share);
    const selectedRoleplaySharedFromProfileName = !resolved.canManageRoleplay
        ? findProfileById(resolved.roleplay.profileId)?.name || ''
        : resolved.roleplay.sourceProfileId
            ? findProfileById(resolved.roleplay.sourceProfileId)?.name || ''
            : '';
    const shareTargetRoleplayProfiles = (request.availableProfiles ?? []).filter((profile) => profile.id !== resolved.roleplay.profileId);
    const resourceCurrentFolder = resolved.canManageRoleplay
        ? findResourceFolderForResource(resolved.roleplay.id, resolved.user.id)
        : null;
    const resourceFolderPath = resolved.canManageRoleplay
        ? listResourceFolderPathForResource(resolved.roleplay.id, resolved.user.id)
        : [];
    const resourceFolderOptions = resolved.canManageRoleplay
        ? listResourceFoldersForProfile({
            includeArchived: false,
            profileId: resolved.roleplay.profileId,
            userId: resolved.user.id,
        })
        : [];
    const attempts = listRoleplayAttemptsForUser({
        profileId: resolved.activeProfile.id,
        roleplayId: resolved.roleplay.id,
        userId: resolved.user.id,
    });
    response.render('roleplays-show', {
        ...buildRoleplaysShellContext(request, {
            activeProfile: resolved.activeProfile,
            title: `${resolved.roleplay.title} - ${appDocumentTitle}`,
            user: resolved.user,
        }),
        aiCharacter: getAiCharacter(draft),
        canManageRoleplay: resolved.canManageRoleplay,
        draft,
        learnerCharacter: getLearnerCharacter(draft),
        resourceCurrentFolder,
        resourceFolderOptions,
        resourceFolderPath,
        roleplayAttempts: buildAttemptListItems(attempts),
        roleplayStartError: readRoleplayStartError(request.query.startError),
        roleplayShareMode,
        roleplayShareQrDataUrl,
        selectedRoleplay: resolved.roleplay,
        selectedRoleplaySharedFromProfileName,
        shareLink,
        shareTargetRoleplayProfiles,
        shareUrl,
    });
}
function readRoleplayStartError(value) {
    const errorCode = readField(value, 40);
    if (errorCode === 'credit') {
        return getCreditExhaustedMessage();
    }
    if (errorCode === 'opening') {
        return 'No pude iniciar el Roleplay ahora mismo. Inténtalo otra vez.';
    }
    return '';
}
export function handleShareRoleplayToProfile(request, response) {
    const resolved = resolveOwnRoleplay(request, response);
    if (!resolved) {
        return;
    }
    const targetProfileId = readField(request.body.targetProfileId, 120);
    const targetProfile = findProfileForUser(targetProfileId, resolved.user.id);
    if (!targetProfile || targetProfile.id === resolved.roleplay.profileId) {
        response.redirect(`/roleplays/${encodeURIComponent(resolved.roleplay.id)}`);
        return;
    }
    grantResourceAccess({
        grantedByUserId: resolved.user.id,
        grantedVia: 'profile',
        profileId: targetProfile.id,
        resourceId: resolved.roleplay.id,
        userId: resolved.user.id,
    });
    response.redirect(`/roleplays/${encodeURIComponent(resolved.roleplay.id)}`);
}
export async function handleStartRoleplayAttempt(request, response) {
    const resolved = resolveAccessibleRoleplay(request, response);
    if (!resolved) {
        return;
    }
    const draft = storedRoleplayToDraft(resolved.roleplay);
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const openingTurn = await generateOpeningRoleplayTurn({
            draft,
            llm: {
                modelTier: resolved.activeProfile.modelTier ?? 'regular',
                openRouterApiKey,
                userId: resolved.user.id,
            },
        });
        const attempt = createRoleplayAttempt({
            profileId: resolved.activeProfile.id,
            roleplayId: resolved.roleplay.id,
            snapshot: draft,
            turns: [openingTurn],
            userId: resolved.user.id,
        });
        logger.info('roleplay_attempt_started', {
            attemptId: attempt.id,
            profileId: attempt.profileId,
            resourceId: resolved.roleplay.id,
            resourceType: 'roleplay',
            roleplayId: resolved.roleplay.id,
            userId: resolved.user.id,
        });
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
    }
    catch (error) {
        logger.error('roleplay_attempt_start_failed', {
            error,
            profileId: resolved.activeProfile.id,
            resourceId: resolved.roleplay.id,
            resourceType: 'roleplay',
            roleplayId: resolved.roleplay.id,
            userId: resolved.user.id,
        });
        const startError = isCreditExhaustedError(error) ? 'credit' : 'opening';
        response.redirect(`/roleplays/${encodeURIComponent(resolved.roleplay.id)}?startError=${startError}`);
    }
}
function renderRoleplayAttempt(request, response, input) {
    const draft = safeParseRoleplayDraft(input.attempt.snapshot);
    if (!draft) {
        response.redirect('/resources');
        return;
    }
    response.render('roleplays-attempt', {
        ...buildRoleplaysShellContext(request, {
            activeProfile: request.activeProfile ?? null,
            title: `${draft.title} - ${appDocumentTitle}`,
            user: request.authUser ?? null,
        }),
        aiCharacter: getAiCharacter(draft),
        attempt: input.attempt,
        attemptError: input.error || '',
        draft,
        hasReachedTurnLimit: hasReachedRoleplayTurnLimit({
            draft,
            turns: input.attempt.turns,
        }),
        learnerCharacter: getLearnerCharacter(draft),
        learnerTurnCount: countLearnerTurns(input.attempt.turns),
    });
}
export function renderRoleplayAttemptPage(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    if (attempt.status === 'evaluated') {
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}/result`);
        return;
    }
    renderRoleplayAttempt(request, response, { attempt });
}
export async function handleSubmitRoleplayTurn(request, response) {
    const wantsJson = wantsJsonResponse(request);
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const draft = safeParseRoleplayDraft(attempt.snapshot);
    const learnerText = readMultilineField(request.body.text, 4000);
    if (!draft || !learnerText || attempt.status !== 'in_progress') {
        if (wantsJson) {
            response.status(422).json({
                error: 'Escribe tu respuesta antes de continuar.',
                ok: false,
            });
            return;
        }
        renderRoleplayAttempt(request, response.status(422), {
            attempt,
            error: 'Escribe tu respuesta antes de continuar.',
        });
        return;
    }
    const learnerCharacter = getLearnerCharacter(draft);
    const learnerTurn = {
        characterId: learnerCharacter.id,
        createdAt: new Date().toISOString(),
        speaker: 'learner',
        text: learnerText,
    };
    const attemptWithLearnerTurn = appendRoleplayAttemptTurns({
        attemptId: attempt.id,
        turns: [learnerTurn],
    });
    if (!attemptWithLearnerTurn) {
        if (wantsJson) {
            response.status(422).json({
                error: 'No pude guardar tu respuesta.',
                ok: false,
            });
            return;
        }
        renderRoleplayAttempt(request, response.status(422), {
            attempt,
            error: 'No pude guardar tu respuesta.',
        });
        return;
    }
    if (hasReachedRoleplayTurnLimit({ draft, turns: attemptWithLearnerTurn.turns })) {
        if (wantsJson) {
            response.json({
                aiTurn: null,
                hasReachedTurnLimit: true,
                learnerTurn,
                learnerTurnCount: countLearnerTurns(attemptWithLearnerTurn.turns),
                ok: true,
            });
            return;
        }
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(attempt.userId ?? '');
        const aiTurn = await generateNextRoleplayTurn({
            attempt: attemptWithLearnerTurn,
            draft,
            llm: {
                modelTier: request.activeProfile?.modelTier ?? 'regular',
                openRouterApiKey,
                userId: attempt.userId ?? undefined,
            },
        });
        const attemptWithAiTurn = appendRoleplayAttemptTurns({
            attemptId: attempt.id,
            turns: [aiTurn],
        });
        if (wantsJson) {
            response.json({
                aiTurn,
                hasReachedTurnLimit: hasReachedRoleplayTurnLimit({
                    draft,
                    turns: attemptWithAiTurn?.turns ?? [...attemptWithLearnerTurn.turns, aiTurn],
                }),
                learnerTurn,
                learnerTurnCount: countLearnerTurns(attemptWithAiTurn?.turns ?? [...attemptWithLearnerTurn.turns, aiTurn]),
                ok: true,
            });
            return;
        }
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
    }
    catch (error) {
        logger.error('roleplay_turn_generation_failed', {
            attemptId: attempt.id,
            error,
            resourceId: attempt.roleplayId,
            resourceType: 'roleplay',
            roleplayId: attempt.roleplayId,
            userId: attempt.userId,
        });
        if (wantsJson) {
            response.status(isCreditExhaustedError(error) ? 402 : 502).json({
                creditExhausted: isCreditExhaustedError(error),
                error: isCreditExhaustedError(error)
                    ? getCreditExhaustedMessage()
                    : 'No pude generar la siguiente respuesta ahora mismo.',
                learnerTurn,
                learnerTurnCount: countLearnerTurns(attemptWithLearnerTurn.turns),
                ok: false,
            });
            return;
        }
        renderRoleplayAttempt(request, response.status(422), {
            attempt: findRoleplayAttemptById(attempt.id) ?? attemptWithLearnerTurn,
            error: isCreditExhaustedError(error)
                ? getCreditExhaustedMessage()
                : 'No pude generar la siguiente respuesta ahora mismo.',
        });
    }
}
export async function handleFinishRoleplayAttempt(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const draft = safeParseRoleplayDraft(attempt.snapshot);
    if (!draft || countLearnerTurns(attempt.turns) < 1) {
        renderRoleplayAttempt(request, response.status(422), {
            attempt,
            error: 'Escribe al menos una intervención antes de finalizar.',
        });
        return;
    }
    const evaluatingAttempt = submitRoleplayAttempt(attempt.id);
    if (!evaluatingAttempt) {
        renderRoleplayAttempt(request, response.status(422), {
            attempt,
            error: 'No pude finalizar el Roleplay. Inténtalo otra vez.',
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(attempt.userId ?? '');
        const result = await evaluateRoleplayAttempt({
            attempt: evaluatingAttempt,
            draft,
            llm: {
                modelTier: request.activeProfile?.modelTier ?? 'regular',
                openRouterApiKey,
                userId: attempt.userId ?? undefined,
            },
        });
        const evaluatedAttempt = saveRoleplayAttemptResult({
            attemptId: evaluatingAttempt.id,
            result,
        });
        if (evaluatedAttempt) {
            recordRoleplayAttemptProgress(evaluatedAttempt);
        }
        logger.info('roleplay_attempt_evaluated', {
            attemptId: attempt.id,
            learnerTurnCount: countLearnerTurns(attempt.turns),
            resourceId: attempt.roleplayId,
            resourceType: 'roleplay',
            roleplayId: attempt.roleplayId,
            userId: attempt.userId,
        });
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}/result`);
    }
    catch (error) {
        logger.error('roleplay_attempt_evaluation_failed', {
            attemptId: attempt.id,
            error,
            resourceId: attempt.roleplayId,
            resourceType: 'roleplay',
            roleplayId: attempt.roleplayId,
            userId: attempt.userId,
        });
        const failedAttempt = markRoleplayAttemptFailed(attempt.id) ?? attempt;
        renderRoleplayAttempt(request, response.status(422), {
            attempt: failedAttempt,
            error: isCreditExhaustedError(error)
                ? getCreditExhaustedMessage()
                : 'No pude evaluar el Roleplay ahora mismo. Puedes volver a intentarlo en unos minutos.',
        });
    }
}
export function renderRoleplayResultPage(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    if (!attempt) {
        return;
    }
    const draft = safeParseRoleplayDraft(attempt.snapshot);
    const result = attempt.result ? roleplayEvaluationResultSchema.safeParse(attempt.result) : null;
    if (!draft || !result?.success) {
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    const actionError = readRoleplayResultActionError(request.query.guideError);
    response.render('roleplays-result', {
        ...buildRoleplaysShellContext(request, {
            activeProfile: request.activeProfile ?? null,
            title: `${result.data.summaryTitle} - ${appDocumentTitle}`,
            user: request.authUser ?? null,
        }),
        attempt,
        draft,
        result: result.data,
        ...actionError,
        resultJson: serializeViewJson(result.data),
    });
}
export function handleCreateRoleplayFollowUpConversation(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!attempt || !auth) {
        return;
    }
    if (!attempt.result || attempt.status !== 'evaluated' || !attempt.profileId) {
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    const conversation = createConversationFromRoleplayAttempt({
        attempt,
        profileId: attempt.profileId,
        userId: auth.user.id,
    });
    logger.info('roleplay_follow_up_conversation_created', {
        attemptId: attempt.id,
        conversationId: conversation.id,
        profileId: attempt.profileId,
        resourceId: attempt.roleplayId,
        resourceType: 'roleplay',
        roleplayId: attempt.roleplayId,
        userId: auth.user.id,
    });
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
export async function handleCreateRoleplayPracticeGuide(request, response) {
    const attempt = resolveAccessibleAttempt(request, response);
    const auth = ensureVerifiedRoleplayUser(request, response);
    if (!attempt || !auth) {
        return;
    }
    const draft = safeParseRoleplayDraft(attempt.snapshot);
    const result = attempt.result ? roleplayEvaluationResultSchema.safeParse(attempt.result) : null;
    if (!draft || !result?.success || attempt.status !== 'evaluated' || !attempt.profileId) {
        response.redirect(`/roleplay-attempts/${encodeURIComponent(attempt.id)}`);
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const generatedModule = await generatePracticeModuleDraft({
            openRouterApiKey,
            prompt: buildRoleplayPracticeGuidePrompt({
                attempt,
                draft,
                result: result.data,
            }),
        });
        const practiceModule = createPracticeModule({
            description: generatedModule.description,
            profileId: attempt.profileId,
            title: generatedModule.title,
            tutorInstructions: generatedModule.tutorInstructions,
            userId: auth.user.id,
        });
        logger.info('roleplay_practice_guide_created', {
            attemptId: attempt.id,
            practiceModuleId: practiceModule.id,
            profileId: attempt.profileId,
            resourceId: attempt.roleplayId,
            resourceType: 'roleplay',
            roleplayId: attempt.roleplayId,
            userId: auth.user.id,
        });
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
    }
    catch (error) {
        logger.error('roleplay_practice_guide_creation_failed', {
            attemptId: attempt.id,
            error,
            resourceId: attempt.roleplayId,
            resourceType: 'roleplay',
            roleplayId: attempt.roleplayId,
            userId: auth.user.id,
        });
        response.redirect(buildRoleplayResultPath(attempt.id, {
            guideError: isCreditExhaustedError(error) ? 'credit' : 'practice-guide',
        }));
    }
}
//# sourceMappingURL=handlers.js.map