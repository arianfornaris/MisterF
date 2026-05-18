import type { Request, Response } from 'express';
import { findConversationForUser, findProfileForUser } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
  resolveGuestInitialGreeting,
} from '../pages/shell.js';

export function renderChatPage(request: Request, response: Response): void {
  const user = request.authUser;
  let activeProfile = request.activeProfile;
  let initialConversationId = '';

  const requestedConversationIdRaw = request.params.conversationId;
  const requestedConversationId =
    typeof requestedConversationIdRaw === 'string'
      ? requestedConversationIdRaw.trim()
      : '';

  if (requestedConversationId) {
    if (!user) {
      response.redirect('/');
      return;
    }

    const conversation = findConversationForUser(requestedConversationId, user.id);
    if (!conversation) {
      response.redirect('/');
      return;
    }

    if (!activeProfile || conversation.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(conversation.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }

    initialConversationId = conversation.id;
  }

  response.render('chat', {
    ...buildAppShellContext({
      activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'chat',
      guestInitialGreeting: resolveGuestInitialGreeting(request, user),
      initialConversationId,
      request,
      title: appDocumentTitle,
      user,
    }),
  });
}
