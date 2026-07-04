import type { Request, Response } from 'express';
import { translate } from '../i18n/index.js';
import QRCode from 'qrcode';
import {
  archivePracticeGuideForUser,
  createConversationFromPracticeGuide,
  createPracticeGuide,
  deletePracticeGuideForUser,
  findResourceAccessForProfile,
  findResourceShareLinkById,
  findPracticeGuideById,
  findPracticeGuideForUser,
  findProfileById,
  findProfileForUser,
  findResourceFolderForResource,
  getOrCreateResourceShareLink,
  listResourceFolderPathForResource,
  listResourceFoldersForProfile,
  grantResourceAccess,
  listConversationsForPracticeGuide,
  restorePracticeGuideForUser,
  updatePracticeGuide,
  updatePracticeGuideAuthoringMessages,
  type PracticeGuideAuthoringMessage,
  type StoredPracticeGuide,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import {
  generatePracticeGuideDraft,
  generatePracticeGuideRevision,
} from '../services/resourceDrafts.js';
import {
  appDocumentTitle,
  buildAbsoluteAppUrl,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';
import { logger } from '../services/logger.js';

type PracticeGuidePageKind = 'new' | 'detail' | 'edit';

type PracticeGuideAuthoringTab = 'chat' | 'general';

const defaultPracticeGuideAuthoringTab: PracticeGuideAuthoringTab = 'general';
const maxPracticeGuideAuthoringMessages = 40;
const maxPracticeGuideAuthoringMessageLength = 6000;

function readPracticeGuideAuthoringTab(value: unknown): PracticeGuideAuthoringTab {
  const tab = String(value || '').trim();
  return tab === 'chat' ? 'chat' : defaultPracticeGuideAuthoringTab;
}

function buildPracticeGuideAuthoringPath(
  practiceGuideId: string,
  tab: PracticeGuideAuthoringTab,
): string {
  return `/practice-guides/${encodeURIComponent(practiceGuideId)}/edit?tab=${tab}`;
}

function normalizePracticeGuideAuthoringMessageContent(content: string): string {
  return content.trim().slice(0, maxPracticeGuideAuthoringMessageLength);
}

function createPracticeGuideAuthoringMessage(
  role: PracticeGuideAuthoringMessage['role'],
  content: string,
): PracticeGuideAuthoringMessage {
  return {
    content: normalizePracticeGuideAuthoringMessageContent(content),
    createdAt: new Date().toISOString(),
    role,
  };
}

function appendPracticeGuideAuthoringMessages(
  existingMessages: PracticeGuideAuthoringMessage[],
  ...messages: PracticeGuideAuthoringMessage[]
): PracticeGuideAuthoringMessage[] {
  return [...existingMessages, ...messages]
    .flatMap((message): PracticeGuideAuthoringMessage[] => {
      const content = normalizePracticeGuideAuthoringMessageContent(message.content);
      if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
        return [];
      }

      return [{
        content,
        createdAt: message.createdAt || new Date().toISOString(),
        role: message.role,
      }];
    })
    .slice(-maxPracticeGuideAuthoringMessages);
}

function savePracticeGuideAuthoringTurn(input: {
  assistantMessage: string;
  practiceGuide: StoredPracticeGuide;
  userId: string;
  userMessage: string;
}): StoredPracticeGuide | null {
  return updatePracticeGuideAuthoringMessages({
    messages: appendPracticeGuideAuthoringMessages(
      input.practiceGuide.authoringMessages,
      createPracticeGuideAuthoringMessage('user', input.userMessage),
      createPracticeGuideAuthoringMessage('assistant', input.assistantMessage),
    ),
    practiceGuideId: input.practiceGuide.id,
    userId: input.userId,
  });
}

function redirectUnauthedPracticeGuides(response: Response): void {
  response.redirect('/');
}

function normalizeReturnTo(value: string | undefined): string {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return '/';
  }

  return trimmed;
}

function readMultilineField(value: unknown, maxLength: number): string {
  return String(value || '').trim().slice(0, maxLength);
}

async function buildPracticeGuidesPageModel(
  request: Request,
  response: Response,
  pageKind: PracticeGuidePageKind,
) {
  const user = request.authUser;
  const availableProfiles = request.availableProfiles ?? [];
  let activeProfile = request.activeProfile;

  if (!user?.emailVerified) {
    redirectUnauthedPracticeGuides(response);
    return null;
  }

  let selectedPracticeGuide: ReturnType<typeof findPracticeGuideForUser> = null;
  let selectedPracticeGuideShareLink: { id: string; revokedAt: string | null } | null = null;
  let selectedPracticeGuideSharedFromProfileName = '';
  let practiceGuideConversations: ReturnType<typeof listConversationsForPracticeGuide> = [];
  let resourceCurrentFolder: ReturnType<typeof findResourceFolderForResource> = null;
  let resourceFolderPath: ReturnType<typeof listResourceFolderPathForResource> = [];
  let resourceFolderOptions: ReturnType<typeof listResourceFoldersForProfile> = [];
  let canManagePracticeGuide = false;

  const requestedPracticeGuideId =
    typeof request.params.practiceGuideId === 'string'
      ? request.params.practiceGuideId.trim()
      : '';

  if (pageKind === 'edit') {
    if (!user) {
      redirectUnauthedPracticeGuides(response);
      return null;
    }

    selectedPracticeGuide = findPracticeGuideForUser(requestedPracticeGuideId, user.id);
    if (!selectedPracticeGuide) {
      response.redirect('/resources');
      return null;
    }
    canManagePracticeGuide = true;

    if (!activeProfile || selectedPracticeGuide.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(selectedPracticeGuide.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }
  }

  if (pageKind === 'detail') {
    if (!user?.emailVerified || !activeProfile) {
      redirectUnauthedPracticeGuides(response);
      return null;
    }

    const resourceAccess = findResourceAccessForProfile({
      includeArchived: true,
      profileId: activeProfile.id,
      resourceId: requestedPracticeGuideId,
      userId: user.id,
    });

    if (resourceAccess?.type === 'practice_guide') {
      if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
        response.redirect('/resources');
        return null;
      }

      selectedPracticeGuide = findPracticeGuideById(resourceAccess.id);
      canManagePracticeGuide = resourceAccess.accessKind === 'owner';
    }

    if (!selectedPracticeGuide) {
      selectedPracticeGuide = findPracticeGuideForUser(requestedPracticeGuideId, user.id);
      canManagePracticeGuide = Boolean(selectedPracticeGuide);
      if (selectedPracticeGuide && selectedPracticeGuide.profileId !== activeProfile.id) {
        const profile = findProfileForUser(selectedPracticeGuide.profileId, user.id);
        if (profile) {
          activeProfile = profile;
          setActiveProfileCookie(response, profile.id);
        }
      }
    }

    if (!selectedPracticeGuide) {
      response.redirect('/resources');
      return null;
    }
  }

  if (selectedPracticeGuide && user) {
    const conversationProfileId = canManagePracticeGuide
      ? selectedPracticeGuide.profileId
      : activeProfile?.id ?? selectedPracticeGuide.profileId;
    practiceGuideConversations = listConversationsForPracticeGuide(
      selectedPracticeGuide.id,
      user.id,
      conversationProfileId,
    );
    if (canManagePracticeGuide) {
      resourceCurrentFolder = findResourceFolderForResource(
        selectedPracticeGuide.id,
        user.id,
      );
      resourceFolderPath = listResourceFolderPathForResource(
        selectedPracticeGuide.id,
        user.id,
      );
      resourceFolderOptions = listResourceFoldersForProfile({
        includeArchived: false,
        profileId: selectedPracticeGuide.profileId,
        userId: user.id,
      });
    }
  }

  if (selectedPracticeGuide && canManagePracticeGuide) {
    selectedPracticeGuideShareLink = getOrCreateResourceShareLink(selectedPracticeGuide.id);
    if (selectedPracticeGuide.sourceProfileId) {
      selectedPracticeGuideSharedFromProfileName =
        findProfileById(selectedPracticeGuide.sourceProfileId)?.name || '';
    }
  }

  if (selectedPracticeGuide && !canManagePracticeGuide) {
    selectedPracticeGuideSharedFromProfileName =
      findProfileById(selectedPracticeGuide.profileId)?.name || '';
  }

  const shareTargetPracticeGuideProfiles = availableProfiles.filter(
    (profile) => profile.id !== (selectedPracticeGuide?.profileId ?? activeProfile?.id),
  );

  const practiceGuideShareUrl =
    selectedPracticeGuide && selectedPracticeGuideShareLink
      ? buildAbsoluteAppUrl(
          `/resources/shared/${encodeURIComponent(selectedPracticeGuideShareLink.id)}`,
        )
      : '';
  const practiceGuideShareQrDataUrl = practiceGuideShareUrl
    ? await QRCode.toDataURL(practiceGuideShareUrl, { margin: 1, width: 180 })
    : '';

  return {
    activeProfile,
    authMessage: getHomeAuthMessage(request, user),
    canManagePracticeGuide,
    practiceGuideConversations,
    practiceGuidePageMode: pageKind,
    practiceGuideShareQrDataUrl,
    practiceGuideShareUrl,
    resourceCurrentFolder,
    resourceFolderPath,
    resourceFolderOptions,
    selectedPracticeGuide,
    selectedPracticeGuideShareLink,
    selectedPracticeGuideSharedFromProfileName,
    shareTargetPracticeGuideProfiles,
    title:
      pageKind === 'new'
        ? `Nueva guía de práctica · ${appDocumentTitle}`
        : pageKind === 'edit'
        ? `Editar guía de práctica · ${appDocumentTitle}`
        : `${selectedPracticeGuide?.title || 'Guía de práctica'} · ${appDocumentTitle}`,
    user,
  };
}

async function renderPracticeGuidesPage(
  request: Request,
  response: Response,
  pageKind: PracticeGuidePageKind,
): Promise<void> {
  const viewModel = await buildPracticeGuidesPageModel(request, response, pageKind);
  if (!viewModel) {
    return;
  }

  response.render('practice-guides', {
    ...buildAppShellContext({
      activeProfile: viewModel.activeProfile,
      authMessage: viewModel.authMessage,
      currentView: 'resources',
      guestInitialGreeting: '',
      request,
      title: viewModel.title,
      user: viewModel.user,
    }),
    practiceGuideConversations: viewModel.practiceGuideConversations,
    practiceGuidePageMode: viewModel.practiceGuidePageMode,
    canManagePracticeGuide: viewModel.canManagePracticeGuide,
    practiceGuideShareQrDataUrl: viewModel.practiceGuideShareQrDataUrl,
    practiceGuideShareUrl: viewModel.practiceGuideShareUrl,
    resourceCurrentFolder: viewModel.resourceCurrentFolder,
    resourceFolderPath: viewModel.resourceFolderPath,
    resourceFolderOptions: viewModel.resourceFolderOptions,
    selectedPracticeGuide: viewModel.selectedPracticeGuide,
    selectedPracticeGuideShareLink: viewModel.selectedPracticeGuideShareLink,
    selectedPracticeGuideSharedFromProfileName:
      viewModel.selectedPracticeGuideSharedFromProfileName,
    shareTargetPracticeGuideProfiles: viewModel.shareTargetPracticeGuideProfiles,
  });
}

function ensureVerifiedPracticeGuideUser(
  request: Request,
  response: Response,
): { activeProfile: NonNullable<Request['activeProfile']>; user: NonNullable<Request['authUser']> } | null {
  const user = request.authUser;
  const activeProfile = request.activeProfile;

  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return null;
  }

  return { activeProfile, user };
}

function resolveOwnPracticeGuide(
  request: Request,
  response: Response,
): {
  activeProfile: NonNullable<Request['activeProfile']>;
  practiceGuide: StoredPracticeGuide;
  user: NonNullable<Request['authUser']>;
} | null {
  const auth = ensureVerifiedPracticeGuideUser(request, response);
  if (!auth) {
    return null;
  }

  const practiceGuideId = String(request.params.practiceGuideId || '').trim();
  const practiceGuide = findPracticeGuideForUser(practiceGuideId, auth.user.id);
  if (!practiceGuide) {
    response.redirect('/resources');
    return null;
  }

  let activeProfile = auth.activeProfile;
  if (practiceGuide.profileId !== activeProfile.id) {
    const profile = findProfileForUser(practiceGuide.profileId, auth.user.id);
    if (!profile) {
      response.redirect('/resources');
      return null;
    }

    activeProfile = profile;
    setActiveProfileCookie(response, profile.id);
  }

  return { activeProfile, practiceGuide, user: auth.user };
}

function renderPracticeGuideAuthoring(
  request: Request,
  response: Response,
  input: {
    activeProfile: NonNullable<Request['activeProfile']>;
    activeTab?: PracticeGuideAuthoringTab;
    error?: string;
    practiceGuide: StoredPracticeGuide;
    user: NonNullable<Request['authUser']>;
  },
): void {
  response.render('practice-guides-authoring', {
    ...buildAppShellContext({
      activeProfile: input.activeProfile,
      authMessage: getHomeAuthMessage(request, input.user),
      currentView: 'resources',
      guestInitialGreeting: '',
      request,
      title: `${input.practiceGuide.title} - ${appDocumentTitle}`,
      user: input.user,
    }),
    activeTab: input.activeTab ?? defaultPracticeGuideAuthoringTab,
    authoringError: input.error || '',
    practiceGuideAuthoringMessages: input.practiceGuide.authoringMessages,
    selectedPracticeGuide: input.practiceGuide,
  });
}

export function renderNewPracticeGuidePage(request: Request, response: Response): void {
  const auth = ensureVerifiedPracticeGuideUser(request, response);
  if (!auth) {
    return;
  }

  renderPracticeGuideNewView(request, response, {
    activeProfile: auth.activeProfile,
    generationError: '',
    generationPrompt: '',
    user: auth.user,
  });
}

function renderPracticeGuideNewView(
  request: Request,
  response: Response,
  input: {
    activeProfile: NonNullable<Request['activeProfile']>;
    generationCreditExhausted?: boolean;
    generationError: string;
    generationPrompt: string;
    user: NonNullable<Request['authUser']>;
  },
): void {
  response.render('practice-guides-new', {
    ...buildAppShellContext({
      activeProfile: input.activeProfile,
      authMessage: getHomeAuthMessage(request, input.user),
      currentView: 'resources',
      guestInitialGreeting: '',
      request,
      title: `Nueva guía de práctica - ${appDocumentTitle}`,
      user: input.user,
    }),
    generationCreditExhausted: Boolean(input.generationCreditExhausted),
    generationError: input.generationError,
    generationPrompt: input.generationPrompt,
  });
}

export async function handleGeneratePracticeGuideDraft(
  request: Request,
  response: Response,
): Promise<void> {
  const auth = ensureVerifiedPracticeGuideUser(request, response);
  if (!auth) {
    return;
  }

  const prompt = readMultilineField(request.body.prompt, 6000);
  if (prompt.length < 10) {
    renderPracticeGuideNewView(request, response.status(422), {
      activeProfile: auth.activeProfile,
      generationError: translate(request.locale, 'msg.describeGuideBetter'),
      generationPrompt: prompt,
      user: auth.user,
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const draft = await generatePracticeGuideDraft({
      instructionLanguage: auth.activeProfile?.instructionLanguage,
      openRouterApiKey,
      prompt,
    });
    const practiceGuide = createPracticeGuide({
      description: draft.description,
      profileId: auth.activeProfile.id,
      title: draft.title,
      tutorInstructions: draft.tutorInstructions,
      userId: auth.user.id,
    });
    updatePracticeGuideAuthoringMessages({
      messages: appendPracticeGuideAuthoringMessages(
        [],
        createPracticeGuideAuthoringMessage('user', prompt),
        createPracticeGuideAuthoringMessage(
          'assistant',
          `Listo. Creé una primera versión de "${draft.title}".`,
        ),
      ),
      practiceGuideId: practiceGuide.id,
      userId: auth.user.id,
    });
    logger.info('practice_guide_created_from_prompt', {
      profileId: auth.activeProfile.id,
      resourceId: practiceGuide.id,
      resourceType: 'practice_guide',
      userId: auth.user.id,
    });
    response.redirect(
      buildPracticeGuideAuthoringPath(practiceGuide.id, defaultPracticeGuideAuthoringTab),
    );
  } catch (error) {
    const isCreditError = isCreditExhaustedError(error);
    logger.error('practice_guide_generation_failed', {
      error,
      userId: auth.user.id,
    });
    renderPracticeGuideNewView(request, response.status(422), {
      activeProfile: auth.activeProfile,
      generationCreditExhausted: isCreditError,
      generationError: isCreditError
        ? getCreditExhaustedMessage(request.locale)
        : translate(request.locale, 'msg.generateGuideError'),
      generationPrompt: prompt,
      user: auth.user,
    });
  }
}

export function renderPracticeGuideDetailPage(request: Request, response: Response) {
  return renderPracticeGuidesPage(request, response, 'detail');
}

export function renderEditPracticeGuidePage(request: Request, response: Response): void {
  const resolved = resolveOwnPracticeGuide(request, response);
  if (!resolved) {
    return;
  }

  renderPracticeGuideAuthoring(request, response, {
    ...resolved,
    activeTab: readPracticeGuideAuthoringTab(request.query.tab),
  });
}

function wantsJsonResponse(request: Request): boolean {
  return Boolean(request.get('accept')?.includes('application/json'));
}

export async function handleRevisePracticeGuide(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveOwnPracticeGuide(request, response);
  if (!resolved) {
    return;
  }

  const userMessage = readMultilineField(request.body.message, 4000);
  if (userMessage.length < 3) {
    if (wantsJsonResponse(request)) {
      response.status(422).json({ error: translate(request.locale, 'msg.writeChange') });
      return;
    }

    renderPracticeGuideAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'chat',
      error: translate(request.locale, 'msg.writeChange'),
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
    const revision = await generatePracticeGuideRevision({
      instructionLanguage: resolved.activeProfile?.instructionLanguage,
      conversationHistory: resolved.practiceGuide.authoringMessages.map((message) => ({
        content: message.content,
        createdAt: message.createdAt,
        role: message.role,
      })),
      currentPracticeGuide: {
        description: resolved.practiceGuide.description,
        title: resolved.practiceGuide.title,
        tutorInstructions: resolved.practiceGuide.tutorInstructions,
      },
      openRouterApiKey,
      prompt: userMessage,
    });
    const updatedPracticeGuide = updatePracticeGuide({
      description: revision.guide.description,
      practiceGuideId: resolved.practiceGuide.id,
      title: revision.guide.title,
      tutorInstructions: revision.guide.tutorInstructions,
      userId: resolved.user.id,
    });
    if (!updatedPracticeGuide) {
      throw new Error('Could not save the revised practice guide.');
    }

    savePracticeGuideAuthoringTurn({
      assistantMessage: revision.assistantMessage,
      practiceGuide: updatedPracticeGuide,
      userId: resolved.user.id,
      userMessage,
    });
    logger.info('practice_guide_revised', {
      profileId: updatedPracticeGuide.profileId,
      resourceId: updatedPracticeGuide.id,
      resourceType: 'practice_guide',
      userId: resolved.user.id,
    });

    if (wantsJsonResponse(request)) {
      response.json({ assistantMessage: revision.assistantMessage });
      return;
    }

    response.redirect(buildPracticeGuideAuthoringPath(resolved.practiceGuide.id, 'chat'));
  } catch (error) {
    const isCreditError = isCreditExhaustedError(error);
    const failureMessage = isCreditError
      ? getCreditExhaustedMessage(request.locale)
      : translate(request.locale, 'msg.applyChangeError');
    const practiceGuideWithFailureMessage = savePracticeGuideAuthoringTurn({
      assistantMessage: failureMessage,
      practiceGuide: resolved.practiceGuide,
      userId: resolved.user.id,
      userMessage,
    });
    logger.error('practice_guide_revision_failed', {
      error,
      resourceId: resolved.practiceGuide.id,
      resourceType: 'practice_guide',
      userId: resolved.user.id,
    });

    if (wantsJsonResponse(request)) {
      response.status(422).json({
        creditExhausted: isCreditError,
        error: failureMessage,
      });
      return;
    }

    renderPracticeGuideAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'chat',
      error: failureMessage,
      practiceGuide: practiceGuideWithFailureMessage ?? resolved.practiceGuide,
    });
  }
}

export function handleCreatePracticeGuideConversation(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId =
    typeof request.params.practiceGuideId === 'string'
      ? request.params.practiceGuideId.trim()
      : '';
  if (!practiceGuideId) {
    response.redirect('/resources');
    return;
  }

  const resourceAccess = findResourceAccessForProfile({
    profileId: activeProfile.id,
    resourceId: practiceGuideId,
    userId: user.id,
  });
  const practiceGuide = resourceAccess?.type === 'practice_guide'
    ? findPracticeGuideById(resourceAccess.id)
    : findPracticeGuideForUser(practiceGuideId, user.id);
  if (!practiceGuide) {
    response.redirect('/resources');
    return;
  }

  const conversation = createConversationFromPracticeGuide(
    user.id,
    practiceGuide,
    resourceAccess?.accessKind === 'shared' ? activeProfile.id : practiceGuide.profileId,
  );
  logger.info('practice_guide_conversation_created', {
    accessKind: resourceAccess?.accessKind ?? 'owner',
    conversationId: conversation.id,
    profileId: conversation.profileId,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    userId: user.id,
  });

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

/**
 * Starts a shared practice guide. An anonymous visitor is sent to sign up / log
 * in and returned here to launch. Once authenticated, grant access and open the
 * tutor conversation.
 */
export function handleStartSharedPracticeGuide(
  request: Request,
  response: Response,
): void {
  const shareId = String(request.params.shareId || '').trim();
  const sharePath = `/resources/shared/${encodeURIComponent(shareId)}`;
  const shareLink = findResourceShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const practiceGuide = findPracticeGuideById(shareLink.resourceId);
  if (!practiceGuide || practiceGuide.archivedAt) {
    response.redirect(sharePath);
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    const startPath = `/practice-guides/shared/${encodeURIComponent(shareId)}/start`;
    response.redirect(`/signup?returnTo=${encodeURIComponent(startPath)}`);
    return;
  }

  grantResourceAccess({
    grantedByUserId: practiceGuide.userId,
    grantedVia: 'link',
    profileId: activeProfile.id,
    resourceId: practiceGuide.id,
    shareLinkId: shareLink.id,
    userId: user.id,
  });

  const conversation = createConversationFromPracticeGuide(
    user.id,
    practiceGuide,
    activeProfile.id,
  );
  logger.info('practice_guide_conversation_created', {
    accessKind: 'shared',
    conversationId: conversation.id,
    profileId: conversation.profileId,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    userId: user.id,
  });

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

export function handleUpdatePracticeGuide(request: Request, response: Response): void {
  const resolved = resolveOwnPracticeGuide(request, response);
  if (!resolved) {
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();
  if (!title || !description || !tutorInstructions) {
    renderPracticeGuideAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'general',
      error: 'Completa el título, la descripción y las instrucciones al tutor.',
    });
    return;
  }

  const practiceGuide = updatePracticeGuide({
    practiceGuideId: resolved.practiceGuide.id,
    description,
    title,
    tutorInstructions,
    userId: resolved.user.id,
  });

  if (!practiceGuide) {
    response.redirect('/resources');
    return;
  }
  logger.info('practice_guide_updated', {
    profileId: practiceGuide.profileId,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    userId: resolved.user.id,
  });

  response.redirect(buildPracticeGuideAuthoringPath(practiceGuide.id, 'general'));
}

export function handleArchivePracticeGuide(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId = String(request.params.practiceGuideId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
  if (!practiceGuideId) {
    response.redirect(returnTo);
    return;
  }

  const practiceGuide = archivePracticeGuideForUser(practiceGuideId, user.id);
  if (practiceGuide) {
    logger.info('resource_archived', {
      profileId: practiceGuide.profileId,
      resourceId: practiceGuide.id,
      resourceType: 'practice_guide',
      userId: user.id,
    });
  }
  response.redirect(returnTo);
}

export function handleRestorePracticeGuide(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId = String(request.params.practiceGuideId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
  if (!practiceGuideId) {
    response.redirect(returnTo);
    return;
  }

  const practiceGuide = restorePracticeGuideForUser(practiceGuideId, user.id);
  if (practiceGuide) {
    logger.info('resource_restored', {
      profileId: practiceGuide.profileId,
      resourceId: practiceGuide.id,
      resourceType: 'practice_guide',
      userId: user.id,
    });
  }
  response.redirect(returnTo);
}

export function handleDeletePracticeGuide(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId =
    typeof request.params.practiceGuideId === 'string'
      ? request.params.practiceGuideId.trim()
      : '';
  if (!practiceGuideId) {
    response.redirect('/resources');
    return;
  }

  deletePracticeGuideForUser(practiceGuideId, user.id);
  response.redirect('/resources');
}

export function handleSharePracticeGuideToProfile(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId = String(request.params.practiceGuideId || '').trim();
  const targetProfileId = String(request.body.targetProfileId || '').trim();
  if (!practiceGuideId || !targetProfileId) {
    response.redirect('/resources');
    return;
  }

  const practiceGuide = findPracticeGuideForUser(practiceGuideId, user.id);
  if (!practiceGuide) {
    response.redirect('/resources');
    return;
  }

  const targetProfile = findProfileForUser(targetProfileId, user.id);
  if (!targetProfile || targetProfile.id === practiceGuide.profileId) {
    response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
    return;
  }

  grantResourceAccess({
    grantedByUserId: user.id,
    grantedVia: 'profile',
    profileId: targetProfile.id,
    resourceId: practiceGuide.id,
    userId: user.id,
  });
  logger.info('resource_shared_with_profile', {
    profileId: practiceGuide.profileId,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    targetProfileId: targetProfile.id,
    userId: user.id,
  });
  response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
}
