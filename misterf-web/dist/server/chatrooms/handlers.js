import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { addChatRoomMessage, archiveChatRoomForUser, createConversationFromChatRoomReport, createPracticeModule, createChatRoom, createChatRoomConversation, findChatRoomById, findChatRoomConversationForUser, findChatRoomConversationReport, findChatRoomForUser, findChatRoomMessage, findChatRoomShareLinkById, findPracticeModuleForUser, findProfileById, findProfileForUser, getOrCreateChatRoomShareLink, importChatRoomToProfile, listChatRoomCharacters, listChatRoomConversationsForRoom, listChatRoomMessages, listChatRoomsForProfile, listConversationsForProfile, restoreChatRoomForUser, saveChatRoomConversationReport, setChatRoomConversationReportPracticeModule, updateChatRoomForUser, updateChatRoomMessageEvaluation, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { advanceChatRoomConversation, evaluateChatRoomUserMessage, generateChatRoomConversationReport, generatePracticeModuleFromChatRoomConversationReport, } from '../services/chatrooms.js';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import { generateChatRoomDraft as generateChatRoomDraftFromPrompt } from '../services/resourceDrafts.js';
import { chatroomsLayoutCookieName, resolveResourceLayout, } from '../pages/resourceLayout.js';
const appDocumentTitle = 'Mr. F, tutor de inglés';
const spanishRelativeTimeFormatter = new Intl.RelativeTimeFormat('es', {
    numeric: 'auto',
});
function buildAbsoluteAppUrl(pathname) {
    return new URL(pathname, env.appBaseUrl).toString();
}
function formatRelativeTime(value) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return value;
    }
    const diffMs = timestamp - Date.now();
    const diffSeconds = Math.round(diffMs / 1000);
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 60) {
        return spanishRelativeTimeFormatter.format(diffSeconds, 'second');
    }
    const diffMinutes = Math.round(diffSeconds / 60);
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 60) {
        return spanishRelativeTimeFormatter.format(diffMinutes, 'minute');
    }
    const diffHours = Math.round(diffMinutes / 60);
    const absHours = Math.abs(diffHours);
    if (absHours < 24) {
        return spanishRelativeTimeFormatter.format(diffHours, 'hour');
    }
    const diffDays = Math.round(diffHours / 24);
    const absDays = Math.abs(diffDays);
    if (absDays < 7) {
        return spanishRelativeTimeFormatter.format(diffDays, 'day');
    }
    const diffWeeks = Math.round(diffDays / 7);
    const absWeeks = Math.abs(diffWeeks);
    if (absWeeks < 5) {
        return spanishRelativeTimeFormatter.format(diffWeeks, 'week');
    }
    const diffMonths = Math.round(diffDays / 30);
    const absMonths = Math.abs(diffMonths);
    if (absMonths < 12) {
        return spanishRelativeTimeFormatter.format(diffMonths, 'month');
    }
    const diffYears = Math.round(diffDays / 365);
    return spanishRelativeTimeFormatter.format(diffYears, 'year');
}
function readField(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function readReturnTo(value, fallback) {
    const returnTo = typeof value === 'string' ? value.trim() : '';
    if (!returnTo.startsWith('/')) {
        return fallback;
    }
    return returnTo;
}
function readPositiveIndex(value, fallback = 0) {
    const raw = typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(raw) || raw < 0) {
        return fallback;
    }
    return raw;
}
function wantsJsonResponse(request) {
    return request.accepts(['html', 'json']) === 'json';
}
function serializeChatRoomConversationReportSlide(input) {
    const slide = input.report.slides[input.index] || null;
    return {
        index: input.index,
        slide,
        slideCount: input.report.slides.length,
        summary: {
            description: input.report.summaryDescription,
            title: input.report.summaryTitle,
        },
    };
}
function ensureVerifiedChatroomsUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return {
        activeProfile,
        user,
    };
}
function readChatRoomFormPayload(request) {
    const characters = [1, 2, 3]
        .map((index) => ({
        fullDescription: readField(request.body[`characterFullDescription${index}`]),
        name: readField(request.body[`characterName${index}`]),
        shortDescription: readField(request.body[`characterShortDescription${index}`]),
    }))
        .filter((character) => character.name || character.fullDescription);
    return {
        characters,
        description: readField(request.body.description),
        title: readField(request.body.title),
    };
}
function validateChatRoomFormPayload(input) {
    if (input.title.length < 2) {
        return 'Escribe un nombre para la sala.';
    }
    if (input.description.length < 10) {
        return 'Describe un poco mejor la sala.';
    }
    if (input.characters.length < 1) {
        return 'Agrega al menos un personaje.';
    }
    if (input.characters.length > 3) {
        return 'Solo se permiten hasta tres personajes.';
    }
    for (const character of input.characters) {
        if (!character.name) {
            return 'Cada personaje necesita un nombre.';
        }
        if (character.fullDescription.length < 10) {
            return 'Cada personaje necesita una descripción completa.';
        }
    }
    return null;
}
function buildChatRoomFormViewModel(input) {
    const payload = input.payload ?? null;
    const room = input.room ?? null;
    const roomCharacters = input.roomCharacters ?? [];
    return {
        chatRoomGenerationError: input.generationError || '',
        chatRoomGenerationModalAutoOpen: false,
        chatRoomGenerationPrompt: input.generationPrompt || '',
        chatRoomPageMode: input.pageMode,
        chatRoomFormValues: {
            description: payload?.description ?? room?.description ?? '',
            title: payload?.title ?? room?.title ?? '',
        },
        selectedChatRoom: room,
        selectedChatRoomCharacters: payload?.characters.length
            ? payload.characters
            : roomCharacters.map((character) => ({
                fullDescription: character.fullDescription,
                name: character.name,
                shortDescription: character.shortDescription || '',
            })),
    };
}
function seedChatRoomConversation(conversationId, room, userName) {
    const characters = listChatRoomCharacters(room.id);
    for (const character of characters) {
        addChatRoomMessage(conversationId, 'system', 'Sistema', `${character.name} se unió al chat...`);
    }
    addChatRoomMessage(conversationId, 'system', 'Sistema', `${userName} se unió al chat...`);
}
async function advanceChatRoomConversationStep(input) {
    const characters = listChatRoomCharacters(input.room.id);
    const messages = listChatRoomMessages(input.conversationId);
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(input.userId);
    console.info(`[chatrooms] step:start ${JSON.stringify({
        characterCount: characters.length,
        conversationId: input.conversationId,
        hasOpenRouterKey: Boolean(openRouterApiKey),
        messageCount: messages.length,
        roomId: input.room.id,
        trigger: input.trigger,
        userId: input.userId,
    })}`);
    const nextTurn = await advanceChatRoomConversation({
        characters,
        messages,
        openRouterApiKey,
        room: input.room,
        trigger: input.trigger,
        userName: input.userName,
    });
    if (nextTurn.messages.length === 0) {
        console.info(`[chatrooms] step:no-turn ${JSON.stringify({
            conversationId: input.conversationId,
            roomId: input.room.id,
            trigger: input.trigger,
            userId: input.userId,
        })}`);
        return {
            appendedMessages: [],
        };
    }
    const appendedMessages = [];
    for (const turn of nextTurn.messages) {
        appendedMessages.push(addChatRoomMessage(input.conversationId, 'character', turn.character.name, turn.content));
    }
    console.info(`[chatrooms] step:stored-turn ${JSON.stringify({
        appendedCount: appendedMessages.length,
        conversationId: input.conversationId,
        roomId: input.room.id,
        speakers: appendedMessages.map((message) => message.senderName),
        trigger: input.trigger,
        userId: input.userId,
    })}`);
    return {
        appendedMessages,
    };
}
async function evaluateChatRoomUserMessageStep(input) {
    const messages = listChatRoomMessages(input.conversationId);
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(input.userId);
    return evaluateChatRoomUserMessage({
        historyText: messages
            .filter((message) => message.senderType !== 'system')
            .slice(-18)
            .map((message) => {
            const visibleName = message.senderType === 'user' ? 'You' : message.senderName;
            return `${visibleName}: ${message.content}`;
        })
            .join('\n'),
        openRouterApiKey,
        room: input.room,
        userMessage: input.userMessage,
        userName: input.userName,
    });
}
async function persistChatRoomUserMessageEvaluation(input) {
    if (!input.evaluation) {
        return;
    }
    updateChatRoomMessageEvaluation({
        conversationId: input.conversationId,
        messageId: input.messageId,
        problem: input.evaluation.status === 'warning' ? input.evaluation.problem : null,
        status: input.evaluation.status,
    });
}
function buildChatroomsShellContext(request, options) {
    const user = options.user;
    const activeProfile = options.activeProfile;
    const conversations = user && activeProfile
        ? listConversationsForProfile(user.id, activeProfile.id)
        : [];
    return {
        activeProfile,
        activeProfileModelTier: activeProfile?.modelTier ?? 'regular',
        authMessage: '',
        chatMode: 'tutor',
        conversations,
        csrfToken: request.res?.locals.csrfToken ?? '',
        currentPath: request.originalUrl || request.path,
        currentView: 'chatrooms',
        guestInitialGreeting: '',
        hasSession: Boolean(user),
        initialConversationId: '',
        isAuthenticated: Boolean(user?.emailVerified),
        profiles: request.availableProfiles ?? [],
        socketAuthToken: '',
        title: options.title,
        user,
    };
}
function resolveSelectedChatRoomForRequest(input) {
    const roomId = String(input.request.params.roomId || '').trim();
    const room = findChatRoomForUser(roomId, input.user.id);
    if (!room) {
        input.response.redirect('/chatrooms');
        return null;
    }
    let activeProfile = input.request.activeProfile;
    if (!activeProfile || room.profileId !== activeProfile.id) {
        activeProfile = findProfileForUser(room.profileId, input.user.id);
        if (!activeProfile) {
            input.response.redirect('/chatrooms');
            return null;
        }
        setActiveProfileCookie(input.response, activeProfile.id);
    }
    return {
        activeProfile,
        room,
    };
}
function mapChatRoomsForProfile(userId, profileId) {
    return listChatRoomsForProfile(userId, profileId).map((room) => ({
        ...room,
        characters: listChatRoomCharacters(room.id),
        sourceProfileName: room.sourceProfileId
            ? findProfileById(room.sourceProfileId)?.name || ''
            : '',
    }));
}
function renderChatRoomPageWithShareState(input) {
    const chatRoomShareModeRaw = typeof input.request.query.share === 'string' ? input.request.query.share : '';
    const chatRoomShareMode = chatRoomShareModeRaw === 'profile' || chatRoomShareModeRaw === 'link'
        ? chatRoomShareModeRaw
        : '';
    const selectedChatRoomShareLink = getOrCreateChatRoomShareLink(input.selectedChatRoom.id);
    const chatRoomShareUrl = buildAbsoluteAppUrl(`/chatrooms/shared/${encodeURIComponent(selectedChatRoomShareLink.id)}`);
    const shareTargetChatRoomProfiles = (input.request.availableProfiles ?? []).filter((profile) => profile.id !== input.selectedChatRoom.profileId);
    Promise.resolve(QRCode.toDataURL(chatRoomShareUrl, { margin: 1, width: 180 })).then((chatRoomShareQrDataUrl) => {
        input.response.render(input.view, {
            ...buildChatroomsShellContext(input.request, {
                activeProfile: input.activeProfile,
                title: input.title,
                user: input.user,
            }),
            ...(input.viewModel ?? {}),
            chatRoomShareMode,
            chatRoomShareQrDataUrl: chatRoomShareQrDataUrl || '',
            chatRoomShareUrl,
            selectedChatRoom: input.selectedChatRoom,
            selectedChatRoomShareLink,
            shareTargetChatRoomProfiles,
        });
    }).catch(() => {
        input.response.render(input.view, {
            ...buildChatroomsShellContext(input.request, {
                activeProfile: input.activeProfile,
                title: input.title,
                user: input.user,
            }),
            ...(input.viewModel ?? {}),
            chatRoomShareMode,
            chatRoomShareQrDataUrl: '',
            chatRoomShareUrl,
            selectedChatRoom: input.selectedChatRoom,
            selectedChatRoomShareLink,
            shareTargetChatRoomProfiles,
        });
    });
}
export function renderChatRoomsListPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const showArchivedChatRooms = String(request.query.archived || '').trim() === '1';
    const chatRoomLayout = resolveResourceLayout(request, response, chatroomsLayoutCookieName);
    const selectedRoomId = typeof request.query.room === 'string' ? request.query.room.trim() : '';
    const selectedChatRoom = selectedRoomId
        ? findChatRoomForUser(selectedRoomId, auth.user.id)
        : null;
    const chatRoomShareModeRaw = typeof request.query.share === 'string' ? request.query.share : '';
    const chatRoomShareMode = selectedChatRoom &&
        (chatRoomShareModeRaw === 'profile' || chatRoomShareModeRaw === 'link')
        ? chatRoomShareModeRaw
        : '';
    const selectedChatRoomShareLink = selectedChatRoom
        ? getOrCreateChatRoomShareLink(selectedChatRoom.id)
        : null;
    const chatRoomShareUrl = selectedChatRoomShareLink
        ? buildAbsoluteAppUrl(`/chatrooms/shared/${encodeURIComponent(selectedChatRoomShareLink.id)}`)
        : '';
    const shareTargetChatRoomProfiles = selectedChatRoom
        ? (request.availableProfiles ?? []).filter((profile) => profile.id !== selectedChatRoom.profileId)
        : [];
    const allChatRooms = mapChatRoomsForProfile(auth.user.id, auth.activeProfile.id);
    const chatRooms = allChatRooms.filter((room) => {
        if (room.archivedAt && !showArchivedChatRooms) {
            return false;
        }
        return true;
    });
    const hasArchivedChatRooms = allChatRooms.some((room) => Boolean(room.archivedAt));
    Promise.resolve(chatRoomShareUrl
        ? QRCode.toDataURL(chatRoomShareUrl, { margin: 1, width: 180 })
        : '').then((chatRoomShareQrDataUrl) => {
        response.render('chatrooms-list', {
            ...buildChatroomsShellContext(request, {
                activeProfile: auth.activeProfile,
                title: `Salas de chat · ${appDocumentTitle}`,
                user: auth.user,
            }),
            chatRoomShareMode,
            chatRoomGenerationError: '',
            chatRoomGenerationModalAutoOpen: false,
            chatRoomGenerationPrompt: '',
            chatRoomShareQrDataUrl: chatRoomShareQrDataUrl || '',
            chatRoomShareUrl,
            chatRooms,
            chatRoomLayout,
            hasArchivedChatRooms,
            showArchivedChatRooms,
            selectedChatRoom,
            selectedChatRoomShareLink,
            shareTargetChatRoomProfiles,
        });
    }).catch(() => {
        response.render('chatrooms-list', {
            ...buildChatroomsShellContext(request, {
                activeProfile: auth.activeProfile,
                title: `Salas de chat · ${appDocumentTitle}`,
                user: auth.user,
            }),
            chatRoomShareMode,
            chatRoomGenerationError: '',
            chatRoomGenerationModalAutoOpen: false,
            chatRoomGenerationPrompt: '',
            chatRoomShareQrDataUrl: '',
            chatRoomShareUrl,
            chatRooms,
            chatRoomLayout,
            hasArchivedChatRooms,
            showArchivedChatRooms,
            selectedChatRoom,
            selectedChatRoomShareLink,
            shareTargetChatRoomProfiles,
        });
    });
}
export function renderChatRoomShowPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const resolved = resolveSelectedChatRoomForRequest({
        request,
        response,
        user: auth.user,
    });
    if (!resolved) {
        return;
    }
    renderChatRoomPageWithShareState({
        activeProfile: resolved.activeProfile,
        request,
        response,
        selectedChatRoom: resolved.room,
        title: `${resolved.room.title} · ${appDocumentTitle}`,
        user: auth.user,
        view: 'chatrooms-show',
        viewModel: {
            selectedChatRoomCharacters: listChatRoomCharacters(resolved.room.id),
            selectedChatRoomSourceProfileName: resolved.room.sourceProfileId
                ? findProfileById(resolved.room.sourceProfileId)?.name || ''
                : '',
        },
    });
}
export function renderNewChatRoomPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    response.render('chatrooms-form', {
        ...buildChatroomsShellContext(request, {
            activeProfile: auth.activeProfile,
            title: `Nueva sala · ${appDocumentTitle}`,
            user: auth.user,
        }),
        ...buildChatRoomFormViewModel({
            pageMode: 'new',
            payload: {
                characters: [],
                description: '',
                title: '',
            },
        }),
    });
}
export function renderEditChatRoomPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const resolved = resolveSelectedChatRoomForRequest({
        request,
        response,
        user: auth.user,
    });
    if (!resolved) {
        return;
    }
    response.render('chatrooms-form', {
        ...buildChatroomsShellContext(request, {
            activeProfile: resolved.activeProfile,
            title: `Editar sala · ${appDocumentTitle}`,
            user: auth.user,
        }),
        ...buildChatRoomFormViewModel({
            pageMode: 'edit',
            room: resolved.room,
            roomCharacters: listChatRoomCharacters(resolved.room.id),
        }),
    });
}
export async function handleGenerateChatRoomDraft(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const prompt = readField(request.body.prompt);
    if (!prompt) {
        response.redirect('/chatrooms/new');
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const draft = await generateChatRoomDraftFromPrompt({
            openRouterApiKey,
            prompt,
        });
        const room = createChatRoom({
            characters: draft.characters.map((character) => ({
                fullDescription: character.fullDescription,
                name: character.name,
                shortDescription: character.shortDescription || '',
            })),
            description: draft.description,
            profileId: auth.activeProfile.id,
            title: draft.title,
            userId: auth.user.id,
        });
        response.redirect(`/chatrooms/${encodeURIComponent(room.id)}`);
    }
    catch (error) {
        const showArchivedChatRooms = String(request.query.archived || '').trim() === '1';
        const chatRooms = mapChatRoomsForProfile(auth.user.id, auth.activeProfile.id).filter((room) => {
            if (room.archivedAt && !showArchivedChatRooms) {
                return false;
            }
            return true;
        });
        response.render('chatrooms-list', {
            ...buildChatroomsShellContext(request, {
                activeProfile: auth.activeProfile,
                title: `Salas de chat · ${appDocumentTitle}`,
                user: auth.user,
            }),
            chatRoomGenerationError: error instanceof Error && error.message
                ? error.message
                : 'No pude generar la sala automáticamente.',
            chatRoomGenerationModalAutoOpen: true,
            chatRoomGenerationPrompt: prompt,
            chatRoomShareMode: '',
            chatRoomShareQrDataUrl: '',
            chatRoomShareUrl: '',
            chatRooms,
            selectedChatRoom: null,
            selectedChatRoomShareLink: null,
            shareTargetChatRoomProfiles: [],
            showArchivedChatRooms,
        });
    }
}
export function renderChatRoomHistoryPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const resolved = resolveSelectedChatRoomForRequest({
        request,
        response,
        user: auth.user,
    });
    if (!resolved) {
        return;
    }
    response.render('chatrooms-history', {
        ...buildChatroomsShellContext(request, {
            activeProfile: resolved.activeProfile,
            title: `Historial de sala · ${appDocumentTitle}`,
            user: auth.user,
        }),
        chatRoomConversations: listChatRoomConversationsForRoom(resolved.room.id, auth.user.id).map((conversation) => ({
            ...conversation,
            relativeReportCreatedAt: conversation.reportCreatedAt
                ? formatRelativeTime(conversation.reportCreatedAt)
                : '',
            relativeUpdatedAt: formatRelativeTime(conversation.updatedAt),
        })),
        selectedChatRoom: resolved.room,
    });
}
export function renderChatRoomConversationPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    let activeProfile = auth.activeProfile;
    if (room.profileId !== activeProfile.id) {
        const profile = findProfileForUser(room.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/chatrooms');
            return;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    response.render('chatrooms-conversation', {
        ...buildChatroomsShellContext(request, {
            activeProfile,
            title: `${room.title} · ${appDocumentTitle}`,
            user: auth.user,
        }),
        selectedChatRoomConversationReport: conversation.reportId
            ? findChatRoomConversationReport(conversation.id, auth.user.id)
            : null,
        selectedChatRoom: room,
        selectedChatRoomConversation: conversation,
        selectedChatRoomMessages: listChatRoomMessages(conversation.id),
    });
}
export function renderChatRoomConversationReportPage(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const report = findChatRoomConversationReport(conversation.id, auth.user.id);
    if (!report) {
        response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
        return;
    }
    let activeProfile = auth.activeProfile;
    if (room.profileId !== activeProfile.id) {
        const profile = findProfileForUser(room.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/chatrooms');
            return;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    const selectedSlideIndex = Math.min(Math.max(readPositiveIndex(request.query.slide, 0), 0), Math.max(report.slides.length - 1, 0));
    if (wantsJsonResponse(request)) {
        response.json({
            ok: true,
            report: serializeChatRoomConversationReportSlide({
                index: selectedSlideIndex,
                report,
            }),
        });
        return;
    }
    response.render('chatrooms-report', {
        ...buildChatroomsShellContext(request, {
            activeProfile,
            title: `Análisis · ${room.title} · ${appDocumentTitle}`,
            user: auth.user,
        }),
        selectedChatRoom: room,
        selectedChatRoomConversation: conversation,
        selectedChatRoomConversationReport: report,
        selectedChatRoomReportSlide: report.slides[selectedSlideIndex] || null,
        selectedChatRoomReportSlideIndex: selectedSlideIndex,
    });
}
export function renderSharedChatRoomPage(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/chatrooms');
        return;
    }
    const shareLink = findChatRoomShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/chatrooms');
        return;
    }
    const selectedSharedChatRoom = findChatRoomById(shareLink.roomId);
    if (!selectedSharedChatRoom) {
        response.redirect('/chatrooms');
        return;
    }
    const activeProfile = request.authUser?.emailVerified ? request.activeProfile : null;
    response.render('chatrooms-share', {
        ...buildChatroomsShellContext(request, {
            activeProfile,
            title: `${selectedSharedChatRoom.title} · ${appDocumentTitle}`,
            user: request.authUser?.emailVerified ? request.authUser : null,
        }),
        selectedChatRoomShareLink: shareLink,
        selectedChatRoomSharedFromProfileName: selectedSharedChatRoom.sourceProfileId
            ? findProfileById(selectedSharedChatRoom.sourceProfileId)?.name || ''
            : '',
        selectedChatRoomCharacters: listChatRoomCharacters(selectedSharedChatRoom.id),
        selectedSharedChatRoom,
    });
}
export function handleCreateChatRoom(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const payload = readChatRoomFormPayload(request);
    if (validateChatRoomFormPayload(payload)) {
        response.redirect('/chatrooms/new');
        return;
    }
    const room = createChatRoom({
        characters: payload.characters,
        description: payload.description,
        profileId: auth.activeProfile.id,
        title: payload.title,
        userId: auth.user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(room.id)}`);
}
export function handleUpdateChatRoom(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const existingRoom = findChatRoomForUser(roomId, auth.user.id);
    if (!existingRoom) {
        response.redirect('/chatrooms');
        return;
    }
    const payload = readChatRoomFormPayload(request);
    if (validateChatRoomFormPayload(payload)) {
        response.redirect(`/chatrooms/${encodeURIComponent(roomId)}/edit`);
        return;
    }
    updateChatRoomForUser({
        characters: payload.characters,
        description: payload.description,
        roomId,
        title: payload.title,
        userId: auth.user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(roomId)}`);
}
export function handleJoinChatRoom(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const room = findChatRoomForUser(roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const conversation = createChatRoomConversation(auth.user.id, room);
    seedChatRoomConversation(conversation.id, room, auth.user.fullName);
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export function handleCreateChatRoomConversation(request, response) {
    return handleJoinChatRoom(request, response);
}
export function handleShareChatRoomToProfile(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!roomId || !targetProfileId) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, auth.user.id);
    if (!targetProfile || targetProfile.id === room.profileId) {
        response.redirect(`/chatrooms/${encodeURIComponent(room.id)}?share=profile`);
        return;
    }
    importChatRoomToProfile({
        shareKind: 'profile',
        sourceRoom: room,
        targetProfileId: targetProfile.id,
        userId: auth.user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(room.id)}?share=profile`);
}
export function handleArchiveChatRoom(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const fallbackPath = `/chatrooms/${encodeURIComponent(roomId)}`;
    const returnTo = readReturnTo(request.body.returnTo, fallbackPath);
    const room = archiveChatRoomForUser(roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    response.redirect(returnTo);
}
export function handleRestoreChatRoom(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const fallbackPath = `/chatrooms/${encodeURIComponent(roomId)}`;
    const returnTo = readReturnTo(request.body.returnTo, fallbackPath);
    const room = restoreChatRoomForUser(roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    response.redirect(returnTo);
}
export function handleAcceptSharedChatRoomLink(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/chatrooms');
        return;
    }
    const shareLink = findChatRoomShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/chatrooms');
        return;
    }
    const sourceRoom = findChatRoomById(shareLink.roomId);
    if (!sourceRoom) {
        response.redirect('/chatrooms');
        return;
    }
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const imported = importChatRoomToProfile({
        shareKind: 'link',
        sourceRoom,
        targetProfileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(imported.id)}`);
}
export async function handleChatRoomSendMessage(request, response) {
    const wantsJson = wantsJsonResponse(request);
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        if (wantsJson) {
            response.status(401).json({ ok: false, redirect: '/login' });
        }
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, auth.user.id);
    if (!room) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    if (conversation.reportId) {
        const redirect = `/chatroom-conversations/${encodeURIComponent(conversation.id)}/report`;
        if (wantsJson) {
            response.status(409).json({ ok: false, redirect, error: 'Esta conversación ya fue evaluada.' });
            return;
        }
        response.redirect(redirect);
        return;
    }
    const content = readField(request.body.content);
    if (!content) {
        if (wantsJson) {
            response.status(400).json({ ok: false, error: 'Escribe un mensaje.' });
            return;
        }
        response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
        return;
    }
    const userMessage = addChatRoomMessage(conversation.id, 'user', auth.user.fullName, content);
    const stepResult = await advanceChatRoomConversationStep({
        conversationId: conversation.id,
        room,
        trigger: 'user',
        userId: auth.user.id,
        userName: auth.user.fullName,
    });
    void evaluateChatRoomUserMessageStep({
        conversationId: conversation.id,
        room,
        userId: auth.user.id,
        userMessage: content,
        userName: auth.user.fullName,
    })
        .then((userMessageEvaluation) => persistChatRoomUserMessageEvaluation({
        conversationId: conversation.id,
        evaluation: userMessageEvaluation,
        messageId: userMessage.id,
    }))
        .catch((error) => {
        console.info(`[chatrooms] evaluation:background-error ${JSON.stringify({
            conversationId: conversation.id,
            error: error instanceof Error ? error.message : String(error),
            messageId: userMessage.id,
            roomId: room.id,
            userId: auth.user.id,
        })}`);
    });
    if (wantsJson) {
        response.json({
            appendedMessages: stepResult.appendedMessages,
            ok: true,
            userMessage,
        });
        return;
    }
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export async function handleEvaluateChatRoomConversation(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const existingReport = findChatRoomConversationReport(conversation.id, auth.user.id);
    if (existingReport) {
        response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}/report`);
        return;
    }
    const messages = listChatRoomMessages(conversation.id);
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const report = await generateChatRoomConversationReport({
        messages,
        openRouterApiKey,
        room,
        userName: auth.user.fullName,
    });
    saveChatRoomConversationReport({
        conversationId: conversation.id,
        profileId: conversation.profileId,
        roomId: room.id,
        slides: report.slides,
        summaryDescription: report.summaryDescription,
        summaryTitle: report.summaryTitle,
        userId: auth.user.id,
    });
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}/report`);
}
export async function handleCreatePracticeModuleFromChatRoomConversationReport(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const report = findChatRoomConversationReport(conversation.id, auth.user.id);
    if (!report) {
        response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
        return;
    }
    if (report.practiceModuleId) {
        const existingPracticeModule = findPracticeModuleForUser(report.practiceModuleId, auth.user.id);
        if (existingPracticeModule) {
            response.redirect(`/practice-modules/${encodeURIComponent(existingPracticeModule.id)}`);
            return;
        }
    }
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const generatedModule = await generatePracticeModuleFromChatRoomConversationReport({
        openRouterApiKey,
        report,
        room,
    });
    const practiceModule = createPracticeModule({
        description: generatedModule.description,
        profileId: conversation.profileId,
        title: generatedModule.title,
        tutorInstructions: generatedModule.tutorInstructions,
        userId: auth.user.id,
    });
    setChatRoomConversationReportPracticeModule({
        conversationId: conversation.id,
        practiceModuleId: practiceModule.id,
        userId: auth.user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handlePracticeChatRoomConversationReportWithTutor(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const chatRoomConversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!chatRoomConversation) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(chatRoomConversation.roomId, auth.user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const report = findChatRoomConversationReport(chatRoomConversation.id, auth.user.id);
    if (!report) {
        response.redirect(`/chatroom-conversations/${encodeURIComponent(chatRoomConversation.id)}/report`);
        return;
    }
    const tutorConversation = createConversationFromChatRoomReport({
        profileId: chatRoomConversation.profileId,
        report,
        room,
        userId: auth.user.id,
    });
    response.redirect(`/c/${encodeURIComponent(tutorConversation.id)}`);
}
export function handleGetChatRoomMessageEvaluation(request, response) {
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        response.status(401).json({ ok: false, redirect: '/login' });
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const messageId = Number(request.params.messageId);
    if (!conversationId || !Number.isInteger(messageId) || messageId <= 0) {
        response.status(400).json({ ok: false, error: 'Invalid message id.' });
        return;
    }
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        response.status(404).json({ ok: false, redirect: '/chatrooms' });
        return;
    }
    const message = findChatRoomMessage(conversation.id, messageId);
    if (!message || message.senderType !== 'user') {
        response.status(404).json({ ok: false, error: 'Message not found.' });
        return;
    }
    response.json({
        message,
        ok: true,
        pending: !message.evaluationStatus,
    });
}
export async function handleChatRoomContinue(request, response) {
    const wantsJson = wantsJsonResponse(request);
    const auth = ensureVerifiedChatroomsUser(request, response);
    if (!auth) {
        if (wantsJson) {
            response.status(401).json({ ok: false, redirect: '/login' });
        }
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, auth.user.id);
    if (!conversation) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    if (wantsJson) {
        response.json({
            ok: true,
            messages: listChatRoomMessages(conversation.id),
        });
        return;
    }
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
//# sourceMappingURL=handlers.js.map