import type { Request, Response } from 'express';
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
  findPracticeGuideShareLinkById,
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

type PracticeGuidePageKind = 'new' | 'detail' | 'edit' | 'share';

type PracticeGuideFormValues = {
  description: string;
  title: string;
  tutorInstructions: string;
};

type PracticeGuideDraftFormValues = {
  practiceGuideGenerationCreditExhausted?: boolean;
  practiceGuideFormValues?: PracticeGuideFormValues;
  practiceGuideGenerationError?: string;
  practiceGuideGenerationModalAutoOpen?: boolean;
  practiceGuideGenerationPrompt?: string;
  practiceGuideRevisionCreditExhausted?: boolean;
  practiceGuideRevisionError?: string;
  practiceGuideRevisionModalAutoOpen?: boolean;
  practiceGuideRevisionPrompt?: string;
  practiceGuideRevisionSuccess?: boolean;
};

const emptyPracticeGuideFormValues: PracticeGuideFormValues = {
  description: '',
  title: '',
  tutorInstructions: '',
};

function getDefaultPracticeGuideFormValues(
  pageKind: PracticeGuidePageKind,
  selectedPracticeGuide: ReturnType<typeof findPracticeGuideForUser>,
): PracticeGuideFormValues {
  if (pageKind !== 'edit' || !selectedPracticeGuide) {
    return emptyPracticeGuideFormValues;
  }

  return {
    description: selectedPracticeGuide.description,
    title: selectedPracticeGuide.title,
    tutorInstructions: selectedPracticeGuide.tutorInstructions,
  };
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

  if (!user?.emailVerified && pageKind !== 'share') {
    redirectUnauthedPracticeGuides(response);
    return null;
  }

  let selectedPracticeGuide: ReturnType<typeof findPracticeGuideForUser> = null;
  let selectedSharedPracticeGuide: ReturnType<typeof findPracticeGuideById> = null;
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
  const requestedShareId =
    typeof request.params.shareId === 'string' ? request.params.shareId.trim() : '';

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

  if (pageKind === 'share') {
    const legacyShareLink = findPracticeGuideShareLinkById(requestedShareId);
    if (!legacyShareLink || legacyShareLink.revokedAt) {
      response.redirect('/resources');
      return null;
    }

    selectedPracticeGuideShareLink = legacyShareLink;
    selectedSharedPracticeGuide = findPracticeGuideById(
      legacyShareLink.practiceGuideId,
    );
    if (!selectedSharedPracticeGuide) {
      response.redirect('/resources');
      return null;
    }
  }

  if (selectedPracticeGuide && canManagePracticeGuide) {
    selectedPracticeGuideShareLink = getOrCreateResourceShareLink(selectedPracticeGuide.id);
    if (selectedPracticeGuide.sourceProfileId) {
      selectedPracticeGuideSharedFromProfileName =
        findProfileById(selectedPracticeGuide.sourceProfileId)?.name || '';
    }
  }

  if (selectedSharedPracticeGuide?.sourceProfileId) {
    selectedPracticeGuideSharedFromProfileName =
      findProfileById(selectedSharedPracticeGuide.sourceProfileId)?.name || '';
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
    selectedSharedPracticeGuide,
    shareTargetPracticeGuideProfiles,
    title:
      pageKind === 'new'
        ? `Nueva guía de práctica · ${appDocumentTitle}`
        : pageKind === 'edit'
        ? `Editar guía de práctica · ${appDocumentTitle}`
        : pageKind === 'detail'
        ? `${selectedPracticeGuide?.title || 'Guía de práctica'} · ${appDocumentTitle}`
        : `${selectedSharedPracticeGuide?.title || 'Guía compartida'} · ${appDocumentTitle}`,
    user,
  };
}

async function renderPracticeGuidesPage(
  request: Request,
  response: Response,
  pageKind: PracticeGuidePageKind,
  overrides: PracticeGuideDraftFormValues = {},
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
    practiceGuideFormValues: getDefaultPracticeGuideFormValues(
      pageKind,
      viewModel.selectedPracticeGuide,
    ),
    practiceGuideGenerationCreditExhausted: false,
    practiceGuideGenerationError: '',
    practiceGuideGenerationModalAutoOpen: false,
    practiceGuideGenerationPrompt: '',
    practiceGuidePageMode: viewModel.practiceGuidePageMode,
    practiceGuideRevisionCreditExhausted: false,
    practiceGuideRevisionError: '',
    practiceGuideRevisionModalAutoOpen: false,
    practiceGuideRevisionPrompt: '',
    practiceGuideRevisionSuccess: String(request.query.aiRevision || '') === 'success',
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
    selectedSharedPracticeGuide: viewModel.selectedSharedPracticeGuide,
    shareTargetPracticeGuideProfiles: viewModel.shareTargetPracticeGuideProfiles,
    ...overrides,
  });
}

export function renderNewPracticeGuidePage(request: Request, response: Response) {
  return renderPracticeGuidesPage(request, response, 'new');
}

export async function handleGeneratePracticeGuideDraft(
  request: Request,
  response: Response,
): Promise<void> {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const prompt = typeof request.body.prompt === 'string' ? request.body.prompt.trim() : '';
  if (!prompt) {
    response.redirect('/practice-guides/new');
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
    const draft = await generatePracticeGuideDraft({
      openRouterApiKey,
      prompt,
    });
    const practiceGuide = createPracticeGuide({
      description: draft.description,
      profileId: activeProfile.id,
      title: draft.title,
      tutorInstructions: draft.tutorInstructions,
      userId: user.id,
    });
    logger.info('practice_guide_created_from_prompt', {
      profileId: activeProfile.id,
      resourceId: practiceGuide.id,
      resourceType: 'practice_guide',
      userId: user.id,
    });
    response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
  } catch (error) {
    const isCreditError = isCreditExhaustedError(error);
    await renderPracticeGuidesPage(request, response, 'new', {
      practiceGuideGenerationCreditExhausted: isCreditError,
      practiceGuideGenerationError:
        isCreditError
          ? getCreditExhaustedMessage()
          : error instanceof Error && error.message
          ? error.message
          : 'No pude generar la guía automáticamente.',
      practiceGuideGenerationModalAutoOpen: true,
      practiceGuideGenerationPrompt: prompt,
    });
  }
}

export function renderPracticeGuideDetailPage(request: Request, response: Response) {
  return renderPracticeGuidesPage(request, response, 'detail');
}

export function renderEditPracticeGuidePage(request: Request, response: Response) {
  return renderPracticeGuidesPage(request, response, 'edit');
}

export function renderSharedPracticeGuidePage(request: Request, response: Response) {
  const shareId = String(request.params.shareId || '').trim();
  const legacyShareLink = findPracticeGuideShareLinkById(shareId);
  if (!legacyShareLink || legacyShareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const resourceShareLink = getOrCreateResourceShareLink(legacyShareLink.practiceGuideId);
  response.redirect(`/resources/shared/${encodeURIComponent(resourceShareLink.id)}`);
}

export function handleCreatePracticeGuide(request: Request, response: Response): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();

  if (!title || !description || !tutorInstructions) {
    response.redirect('/practice-guides/new');
    return;
  }

  const practiceGuide = createPracticeGuide({
    profileId: activeProfile.id,
    userId: user.id,
    title,
    description,
    tutorInstructions,
  });
  logger.info('practice_guide_created', {
    profileId: activeProfile.id,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    userId: user.id,
  });

  response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
}

export async function handleRevisePracticeGuide(
  request: Request,
  response: Response,
): Promise<void> {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceGuideId = String(request.params.practiceGuideId || '').trim();
  const requestedChange = readMultilineField(request.body.prompt, 4000);
  if (!practiceGuideId) {
    response.redirect('/resources');
    return;
  }

  const practiceGuide = findPracticeGuideForUser(practiceGuideId, user.id);
  if (!practiceGuide) {
    response.redirect('/resources');
    return;
  }

  if (requestedChange.length < 3) {
    await renderPracticeGuidesPage(request, response.status(422), 'edit', {
      practiceGuideRevisionError: 'Describe los cambios que quieres aplicar.',
      practiceGuideRevisionModalAutoOpen: true,
      practiceGuideRevisionPrompt: requestedChange,
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
    const revision = await generatePracticeGuideRevision({
      currentPracticeGuide: {
        description: practiceGuide.description,
        title: practiceGuide.title,
        tutorInstructions: practiceGuide.tutorInstructions,
      },
      openRouterApiKey,
      prompt: requestedChange,
    });
    const updatedPracticeGuide = updatePracticeGuide({
      description: revision.description,
      practiceGuideId: practiceGuide.id,
      title: revision.title,
      tutorInstructions: revision.tutorInstructions,
      userId: user.id,
    });

    if (!updatedPracticeGuide) {
      await renderPracticeGuidesPage(request, response.status(422), 'edit', {
        practiceGuideRevisionError: 'No pude guardar los cambios de la guía.',
        practiceGuideRevisionModalAutoOpen: true,
        practiceGuideRevisionPrompt: requestedChange,
      });
      return;
    }
    logger.info('practice_guide_revised', {
      profileId: updatedPracticeGuide.profileId,
      resourceId: updatedPracticeGuide.id,
      resourceType: 'practice_guide',
      userId: user.id,
    });

    response.redirect(
      `/practice-guides/${encodeURIComponent(updatedPracticeGuide.id)}/edit?aiRevision=success`,
    );
  } catch (error) {
    const isCreditError = isCreditExhaustedError(error);
    await renderPracticeGuidesPage(request, response.status(422), 'edit', {
      practiceGuideRevisionCreditExhausted: isCreditError,
      practiceGuideRevisionError: isCreditError
        ? getCreditExhaustedMessage()
        : 'No pude editar la guía con IA ahora mismo.',
      practiceGuideRevisionModalAutoOpen: true,
      practiceGuideRevisionPrompt: requestedChange,
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

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();
  if (!title || !description || !tutorInstructions) {
    response.redirect(`/practice-guides/${encodeURIComponent(practiceGuideId)}/edit`);
    return;
  }

  const practiceGuide = updatePracticeGuide({
    practiceGuideId,
    description,
    title,
    tutorInstructions,
    userId: user.id,
  });

  if (!practiceGuide) {
    response.redirect('/resources');
    return;
  }
  logger.info('practice_guide_updated', {
    profileId: practiceGuide.profileId,
    resourceId: practiceGuide.id,
    resourceType: 'practice_guide',
    userId: user.id,
  });

  response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
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

export function handleAcceptSharedPracticeGuideLink(
  request: Request,
  response: Response,
): void {
  const shareId = String(request.params.shareId || '').trim();
  if (!shareId) {
    response.redirect('/resources');
    return;
  }

  const shareLink = findPracticeGuideShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const sourcePracticeGuide = findPracticeGuideById(shareLink.practiceGuideId);
  if (!sourcePracticeGuide) {
    response.redirect('/resources');
    return;
  }

  const resourceShareLink = getOrCreateResourceShareLink(sourcePracticeGuide.id);
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect(
      `/login?returnTo=${encodeURIComponent(
        `/resources/shared/${resourceShareLink.id}`,
      )}`,
    );
    return;
  }

  grantResourceAccess({
    grantedByUserId: sourcePracticeGuide.userId,
    grantedVia: 'link',
    profileId: activeProfile.id,
    resourceId: sourcePracticeGuide.id,
    shareLinkId: resourceShareLink.id,
    userId: user.id,
  });
  logger.info('resource_share_link_accepted', {
    ownerProfileId: sourcePracticeGuide.profileId,
    ownerUserId: sourcePracticeGuide.userId,
    profileId: activeProfile.id,
    resourceId: sourcePracticeGuide.id,
    resourceType: 'practice_guide',
    shareLinkId: resourceShareLink.id,
    userId: user.id,
  });
  response.redirect(`/practice-guides/${encodeURIComponent(sourcePracticeGuide.id)}`);
}
