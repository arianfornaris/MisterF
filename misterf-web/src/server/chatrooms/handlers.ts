import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import {
  addChatRoomMessage,
  createChatRoom,
  createChatRoomConversation,
  findChatRoomById,
  findChatRoomConversationForUser,
  findChatRoomForUser,
  findChatRoomMessage,
  findChatRoomShareLinkById,
  findProfileById,
  findProfileForUser,
  getOrCreateChatRoomShareLink,
  importChatRoomToProfile,
  listChatRoomCharacters,
  listChatRoomConversationsForRoom,
  listChatRoomMessages,
  listChatRoomsForProfile,
  listConversationsForProfile,
  type StoredChatRoom,
  type StoredChatRoomConversation,
  type StoredChatRoomShareLink,
  updateChatRoomForUser,
  updateChatRoomMessageEvaluation,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  advanceChatRoomConversation,
  evaluateChatRoomUserMessage,
} from '../services/chatrooms.js';
import { getOpenRouterApiKeyForUser } from '../services/openRouterUserKeys.js';

const appDocumentTitle = 'Mr. F, tutor de inglés';
const spanishRelativeTimeFormatter = new Intl.RelativeTimeFormat('es', {
  numeric: 'auto',
});

type ChatRoomFormPayload = {
  title: string;
  description: string;
  characters: Array<{
    name: string;
    shortDescription?: string;
    fullDescription: string;
  }>;
};

type ChatRoomMessageEvaluation =
  | null
  | { status: 'ok' }
  | { status: 'warning'; problem: string };

function buildAbsoluteAppUrl(pathname: string): string {
  return new URL(pathname, env.appBaseUrl).toString();
}

function formatRelativeTime(value: string): string {
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

function readField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function wantsJsonResponse(request: Request): boolean {
  return request.accepts(['html', 'json']) === 'json';
}

function ensureVerifiedChatroomsUser(
  request: Request,
  response: Response,
): { activeProfile: NonNullable<Request['activeProfile']>; user: NonNullable<Request['authUser']> } | null {
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

function readChatRoomFormPayload(request: Request): ChatRoomFormPayload {
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

function validateChatRoomFormPayload(input: ChatRoomFormPayload): string | null {
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

function seedChatRoomConversation(
  conversationId: string,
  room: StoredChatRoom,
  userName: string,
): void {
  const characters = listChatRoomCharacters(room.id);
  for (const character of characters) {
    addChatRoomMessage(
      conversationId,
      'system',
      'Sistema',
      `${character.name} se unió al chat...`,
    );
  }

  addChatRoomMessage(conversationId, 'system', 'Sistema', `${userName} se unió al chat...`);
}

async function advanceChatRoomConversationStep(input: {
  conversationId: string;
  room: StoredChatRoom;
  trigger: 'continue' | 'user';
  userId: string;
  userName: string;
}): Promise<{
  appendedMessages: ReturnType<typeof listChatRoomMessages>;
}> {
  const characters = listChatRoomCharacters(input.room.id);
  const messages = listChatRoomMessages(input.conversationId);
  const openRouterApiKey = await getOpenRouterApiKeyForUser(input.userId);

  console.info(
    `[chatrooms] step:start ${JSON.stringify({
      characterCount: characters.length,
      conversationId: input.conversationId,
      hasOpenRouterKey: Boolean(openRouterApiKey),
      messageCount: messages.length,
      roomId: input.room.id,
      trigger: input.trigger,
      userId: input.userId,
    })}`,
  );

  const nextTurn = await advanceChatRoomConversation({
    characters,
    messages,
    openRouterApiKey,
    room: input.room,
    trigger: input.trigger,
    userName: input.userName,
  });

  if (nextTurn.messages.length === 0) {
    console.info(
      `[chatrooms] step:no-turn ${JSON.stringify({
        conversationId: input.conversationId,
        roomId: input.room.id,
        trigger: input.trigger,
        userId: input.userId,
      })}`,
    );
    return {
      appendedMessages: [],
    };
  }

  const appendedMessages: ReturnType<typeof listChatRoomMessages> = [];
  for (const turn of nextTurn.messages) {
    appendedMessages.push(
      addChatRoomMessage(
        input.conversationId,
        'character',
        turn.character.name,
        turn.content,
      ),
    );
  }

  console.info(
    `[chatrooms] step:stored-turn ${JSON.stringify({
      appendedCount: appendedMessages.length,
      conversationId: input.conversationId,
      roomId: input.room.id,
      speakers: appendedMessages.map((message) => message.senderName),
      trigger: input.trigger,
      userId: input.userId,
    })}`,
  );

  return {
    appendedMessages,
  };
}

async function evaluateChatRoomUserMessageStep(input: {
  conversationId: string;
  room: StoredChatRoom;
  userId: string;
  userMessage: string;
  userName: string;
}): Promise<ChatRoomMessageEvaluation> {
  const messages = listChatRoomMessages(input.conversationId);
  const openRouterApiKey = await getOpenRouterApiKeyForUser(input.userId);
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

async function persistChatRoomUserMessageEvaluation(input: {
  conversationId: string;
  evaluation: ChatRoomMessageEvaluation;
  messageId: number;
}): Promise<void> {
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

function buildChatroomsShellContext(request: Request, options: {
  activeProfile: Request['activeProfile'];
  title: string;
  user: Request['authUser'];
}) {
  const user = options.user;
  const activeProfile = options.activeProfile;
  const conversations =
    user && activeProfile
      ? listConversationsForProfile(user.id, activeProfile.id)
      : [];

  return {
    activeProfile,
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

function resolveSelectedChatRoomForRequest(input: {
  request: Request;
  response: Response;
  user: NonNullable<Request['authUser']>;
}): {
  activeProfile: NonNullable<Request['activeProfile']>;
  room: StoredChatRoom;
} | null {
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

function mapChatRoomsForProfile(userId: string, profileId: string) {
  return listChatRoomsForProfile(userId, profileId).map((room) => ({
    ...room,
    characters: listChatRoomCharacters(room.id),
    sourceProfileName: room.sourceProfileId
      ? findProfileById(room.sourceProfileId)?.name || ''
      : '',
  }));
}

export function renderChatRoomsListPage(request: Request, response: Response): void {
  const auth = ensureVerifiedChatroomsUser(request, response);
  if (!auth) {
    return;
  }

  let activeProfile = auth.activeProfile;
  let selectedChatRoom: StoredChatRoom | null = null;
  const roomId = String(request.params.roomId || '').trim();
  if (roomId) {
    const resolved = resolveSelectedChatRoomForRequest({
      request,
      response,
      user: auth.user,
    });
    if (!resolved) {
      return;
    }
    activeProfile = resolved.activeProfile;
    selectedChatRoom = resolved.room;
  }

  const chatRoomShareModeRaw =
    typeof request.query.share === 'string' ? request.query.share : '';
  const chatRoomShareMode =
    chatRoomShareModeRaw === 'profile' || chatRoomShareModeRaw === 'link'
      ? chatRoomShareModeRaw
      : '';

  const selectedChatRoomShareLink = selectedChatRoom
    ? getOrCreateChatRoomShareLink(selectedChatRoom.id)
    : null;
  const chatRoomShareUrl = selectedChatRoomShareLink
    ? buildAbsoluteAppUrl(
        `/chatrooms/shared/${encodeURIComponent(selectedChatRoomShareLink.id)}`,
      )
    : '';
  const chatRoomShareQrDataUrl = chatRoomShareUrl
    ? QRCode.toDataURL(chatRoomShareUrl, { margin: 1, width: 180 })
    : '';

  Promise.resolve(chatRoomShareQrDataUrl).then((resolvedQr) => {
    response.render('chatrooms-list', {
      ...buildChatroomsShellContext(request, {
        activeProfile,
        title: `Salas de chat · ${appDocumentTitle}`,
        user: auth.user,
      }),
      chatRoomShareMode,
      chatRoomShareQrDataUrl: resolvedQr || '',
      chatRoomShareUrl,
      chatRooms: mapChatRoomsForProfile(auth.user.id, activeProfile.id),
      selectedChatRoom,
      selectedChatRoomShareLink,
      shareTargetChatRoomProfiles: (request.availableProfiles ?? []).filter(
        (profile) => profile.id !== (selectedChatRoom?.profileId ?? activeProfile.id),
      ),
    });
  }).catch(() => {
    response.render('chatrooms-list', {
      ...buildChatroomsShellContext(request, {
        activeProfile,
        title: `Salas de chat · ${appDocumentTitle}`,
        user: auth.user,
      }),
      chatRoomShareMode,
      chatRoomShareQrDataUrl: '',
      chatRoomShareUrl,
      chatRooms: mapChatRoomsForProfile(auth.user.id, activeProfile.id),
      selectedChatRoom,
      selectedChatRoomShareLink,
      shareTargetChatRoomProfiles: (request.availableProfiles ?? []).filter(
        (profile) => profile.id !== (selectedChatRoom?.profileId ?? activeProfile.id),
      ),
    });
  });
}

export function renderNewChatRoomPage(request: Request, response: Response): void {
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
    chatRoomPageMode: 'new',
    selectedChatRoom: null,
    selectedChatRoomCharacters: [],
  });
}

export function renderEditChatRoomPage(request: Request, response: Response): void {
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
    chatRoomPageMode: 'edit',
    selectedChatRoom: resolved.room,
    selectedChatRoomCharacters: listChatRoomCharacters(resolved.room.id),
  });
}

export function renderChatRoomHistoryPage(request: Request, response: Response): void {
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
    chatRoomConversations: listChatRoomConversationsForRoom(resolved.room.id, auth.user.id).map(
      (conversation) => ({
        ...conversation,
        relativeUpdatedAt: formatRelativeTime(conversation.updatedAt),
      }),
    ),
    selectedChatRoom: resolved.room,
  });
}

export function renderChatRoomConversationPage(request: Request, response: Response): void {
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
    selectedChatRoom: room,
    selectedChatRoomConversation: conversation,
    selectedChatRoomMessages: listChatRoomMessages(conversation.id),
  });
}

export function renderSharedChatRoomPage(request: Request, response: Response): void {
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

export function handleCreateChatRoom(request: Request, response: Response): void {
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

  response.redirect(`/chatrooms/${encodeURIComponent(room.id)}/history`);
}

export function handleUpdateChatRoom(request: Request, response: Response): void {
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

  response.redirect(`/chatrooms/${encodeURIComponent(roomId)}/history`);
}

export function handleJoinChatRoom(request: Request, response: Response): void {
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

export function handleCreateChatRoomConversation(request: Request, response: Response): void {
  return handleJoinChatRoom(request, response);
}

export function handleShareChatRoomToProfile(request: Request, response: Response): void {
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

export function handleAcceptSharedChatRoomLink(request: Request, response: Response): void {
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

  response.redirect(`/chatrooms/${encodeURIComponent(imported.id)}/history`);
}

export async function handleChatRoomSendMessage(
  request: Request,
  response: Response,
): Promise<void> {
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
    .then((userMessageEvaluation) =>
      persistChatRoomUserMessageEvaluation({
        conversationId: conversation.id,
        evaluation: userMessageEvaluation,
        messageId: userMessage.id,
      }),
    )
    .catch((error) => {
      console.info(
        `[chatrooms] evaluation:background-error ${JSON.stringify({
          conversationId: conversation.id,
          error: error instanceof Error ? error.message : String(error),
          messageId: userMessage.id,
          roomId: room.id,
          userId: auth.user.id,
        })}`,
      );
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

export function handleGetChatRoomMessageEvaluation(
  request: Request,
  response: Response,
): void {
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

export async function handleChatRoomContinue(
  request: Request,
  response: Response,
): Promise<void> {
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
