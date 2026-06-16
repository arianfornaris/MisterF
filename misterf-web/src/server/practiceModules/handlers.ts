import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  addPracticeModuleToCollection,
  archivePracticeModuleCollectionForUser,
  archivePracticeModuleForUser,
  createConversationFromPracticeModule,
  createPracticeModule,
  createPracticeModuleCollection,
  deletePracticeModuleForUser,
  findPracticeModuleById,
  findPracticeModuleCollectionById,
  findPracticeModuleCollectionForUser,
  findPracticeModuleCollectionShareLinkById,
  findPracticeModuleForUser,
  findPracticeModuleShareLinkById,
  findProfileById,
  findProfileForUser,
  getOrCreatePracticeModuleCollectionShareLink,
  getOrCreatePracticeModuleShareLink,
  importPracticeModuleCollectionToProfile,
  importPracticeModuleToProfile,
  listConversationsForPracticeModule,
  listPracticeModuleCollectionsContainingModule,
  listPracticeModuleCollectionsForProfile,
  listPracticeModulesForCollection,
  listPracticeModulesForProfile,
  movePracticeModuleCollectionItem,
  removePracticeModuleFromCollection,
  restorePracticeModuleCollectionForUser,
  restorePracticeModuleForUser,
  setPracticeModuleCollectionFavoriteForUser,
  setPracticeModuleFavoriteForUser,
  updatePracticeModule,
  updatePracticeModuleCollection,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import { generatePracticeModuleDraft } from '../services/resourceDrafts.js';
import {
  appDocumentTitle,
  buildAbsoluteAppUrl,
  buildAppShellContext,
  getHomeAuthMessage,
  normalizeSearchText,
} from '../pages/shell.js';
import {
  practiceModulesLayoutCookieName,
  resolveResourceLayout,
} from '../pages/resourceLayout.js';

type PracticeModulePageKind =
  | 'list'
  | 'new'
  | 'detail'
  | 'edit'
  | 'share'
  | 'collectionShare'
  | 'collectionDetail'
  | 'collectionNew'
  | 'collectionEdit';

type PracticeModuleDraftFormValues = {
  practiceModuleFormValues?: {
    description: string;
    title: string;
    tutorInstructions: string;
  };
  practiceModuleGenerationError?: string;
  practiceModuleGenerationModalAutoOpen?: boolean;
  practiceModuleGenerationPrompt?: string;
};

function redirectUnauthedPracticeModules(response: Response): void {
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

async function buildPracticeModulesPageModel(
  request: Request,
  response: Response,
  pageKind: PracticeModulePageKind,
) {
  const user = request.authUser;
  const availableProfiles = request.availableProfiles ?? [];
  let activeProfile = request.activeProfile;

  if (!user?.emailVerified && pageKind !== 'share' && pageKind !== 'collectionShare') {
    redirectUnauthedPracticeModules(response);
    return null;
  }

  const practiceModuleFilterQueryRaw =
    typeof request.query.q === 'string' ? request.query.q : '';
  const practiceModuleShareModeRaw =
    typeof request.query.share === 'string' ? request.query.share : '';
  const practiceModuleFilterQuery = practiceModuleFilterQueryRaw.trim();
  const normalizedPracticeModuleFilterQuery = normalizeSearchText(practiceModuleFilterQuery);
  const practiceModuleShareMode =
    practiceModuleShareModeRaw === 'profile' || practiceModuleShareModeRaw === 'link'
      ? practiceModuleShareModeRaw
      : '';
  const practiceModuleLayout = resolveResourceLayout(
    request,
    response,
    practiceModulesLayoutCookieName,
  );
  const showArchivedPracticeModules = String(request.query.archived || '').trim() === '1';

  let selectedPracticeModule = null;
  let selectedPracticeModuleCollection = null;
  let selectedSharedPracticeModule = null;
  let selectedPracticeModuleShareLink = null;
  let selectedPracticeModuleSharedFromProfileName = '';
  let selectedSharedPracticeModuleCollection = null;
  let selectedPracticeModuleCollectionShareLink = null;
  let selectedPracticeModuleCollectionSharedFromProfileName = '';
  let practiceModuleConversations: ReturnType<typeof listConversationsForPracticeModule> = [];
  let practiceModuleCollectionModules: ReturnType<typeof listPracticeModulesForCollection> = [];

  const requestedPracticeModuleIdRaw = request.params.practiceModuleId;
  const requestedPracticeModuleId =
    typeof requestedPracticeModuleIdRaw === 'string'
      ? requestedPracticeModuleIdRaw.trim()
      : '';
  const requestedCollectionIdRaw = request.params.collectionId;
  const requestedCollectionId =
    typeof requestedCollectionIdRaw === 'string'
      ? requestedCollectionIdRaw.trim()
      : '';
  const requestedShareIdRaw = request.params.shareId;
  const requestedShareId =
    typeof requestedShareIdRaw === 'string'
      ? requestedShareIdRaw.trim()
      : '';

  if (pageKind === 'detail' || pageKind === 'edit') {
    if (!user) {
      redirectUnauthedPracticeModules(response);
      return null;
    }

    selectedPracticeModule = findPracticeModuleForUser(requestedPracticeModuleId, user.id);
    if (!selectedPracticeModule) {
      response.redirect('/practice-modules');
      return null;
    }

    if (!activeProfile || selectedPracticeModule.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(selectedPracticeModule.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }

    practiceModuleConversations = listConversationsForPracticeModule(
      selectedPracticeModule.id,
      user.id,
      selectedPracticeModule.profileId,
    );
  }

  if (pageKind === 'collectionDetail' || pageKind === 'collectionEdit') {
    if (!user) {
      redirectUnauthedPracticeModules(response);
      return null;
    }

    selectedPracticeModuleCollection = findPracticeModuleCollectionForUser(
      requestedCollectionId,
      user.id,
    );
    if (!selectedPracticeModuleCollection) {
      response.redirect('/practice-modules');
      return null;
    }

    if (!activeProfile || selectedPracticeModuleCollection.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(selectedPracticeModuleCollection.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }

    practiceModuleCollectionModules = listPracticeModulesForCollection(
      selectedPracticeModuleCollection.id,
      user.id,
    );
  }

  if (pageKind === 'share') {
    selectedPracticeModuleShareLink = findPracticeModuleShareLinkById(requestedShareId);
    if (!selectedPracticeModuleShareLink || selectedPracticeModuleShareLink.revokedAt) {
      response.redirect('/practice-modules');
      return null;
    }

    selectedSharedPracticeModule = findPracticeModuleById(
      selectedPracticeModuleShareLink.practiceModuleId,
    );
    if (!selectedSharedPracticeModule) {
      response.redirect('/practice-modules');
      return null;
    }
  }

  if (pageKind === 'collectionShare') {
    selectedPracticeModuleCollectionShareLink = findPracticeModuleCollectionShareLinkById(
      requestedShareId,
    );
    if (!selectedPracticeModuleCollectionShareLink || selectedPracticeModuleCollectionShareLink.revokedAt) {
      response.redirect('/practice-modules');
      return null;
    }

    selectedSharedPracticeModuleCollection = findPracticeModuleCollectionById(
      selectedPracticeModuleCollectionShareLink.collectionId,
    );
    if (!selectedSharedPracticeModuleCollection) {
      response.redirect('/practice-modules');
      return null;
    }

    practiceModuleCollectionModules = listPracticeModulesForCollection(
      selectedSharedPracticeModuleCollection.id,
      selectedSharedPracticeModuleCollection.userId,
    );
  }

  if (selectedPracticeModule) {
    selectedPracticeModuleShareLink = getOrCreatePracticeModuleShareLink(selectedPracticeModule.id);
    if (selectedPracticeModule.sourceProfileId) {
      selectedPracticeModuleSharedFromProfileName =
        findProfileById(selectedPracticeModule.sourceProfileId)?.name || '';
    }
  }

  if (selectedPracticeModuleCollection) {
    selectedPracticeModuleCollectionShareLink = getOrCreatePracticeModuleCollectionShareLink(
      selectedPracticeModuleCollection.id,
    );
    if (selectedPracticeModuleCollection.sourceProfileId) {
      selectedPracticeModuleCollectionSharedFromProfileName =
        findProfileById(selectedPracticeModuleCollection.sourceProfileId)?.name || '';
    }
  }

  if (
    selectedSharedPracticeModuleCollection &&
    selectedSharedPracticeModuleCollection.sourceProfileId
  ) {
    selectedPracticeModuleCollectionSharedFromProfileName =
      findProfileById(selectedSharedPracticeModuleCollection.sourceProfileId)?.name || '';
  }

  if (selectedSharedPracticeModule && selectedSharedPracticeModule.sourceProfileId) {
    selectedPracticeModuleSharedFromProfileName =
      findProfileById(selectedSharedPracticeModule.sourceProfileId)?.name || '';
  }

  const practiceModuleCollections =
    user && activeProfile
      ? listPracticeModuleCollectionsForProfile(user.id, activeProfile.id)
      : [];
  const practiceModules =
    user && activeProfile
      ? listPracticeModulesForProfile(user.id, activeProfile.id)
      : [];

  const allLessons = user
    ? practiceModules.map((practiceModule) => ({
        ...practiceModule,
        conversationCount: listConversationsForPracticeModule(
          practiceModule.id,
          user.id,
          practiceModule.profileId,
        ).length,
        sourceProfileName: practiceModule.sourceProfileId
          ? findProfileById(practiceModule.sourceProfileId)?.name || ''
          : '',
      }))
    : [];

  const visibleLessons = allLessons.filter((practiceModule) => {
    if (practiceModule.archivedAt && !showArchivedPracticeModules) {
      return false;
    }

    if (!normalizedPracticeModuleFilterQuery) {
      return true;
    }

    const haystack = [
      practiceModule.title,
      practiceModule.description,
      practiceModule.tutorInstructions,
    ].join('\n');
    return normalizeSearchText(haystack).includes(normalizedPracticeModuleFilterQuery);
  });

  const allPracticeModuleCollections = practiceModuleCollections.map((collection) => ({
    ...collection,
    moduleCount: listPracticeModulesForCollection(collection.id, user?.id || '').length,
    sourceProfileName: collection.sourceProfileId
      ? findProfileById(collection.sourceProfileId)?.name || ''
      : '',
  }));

  const visiblePracticeModuleCollections = allPracticeModuleCollections.filter((collection) => {
    if (collection.archivedAt && !showArchivedPracticeModules) {
      return false;
    }

    if (!normalizedPracticeModuleFilterQuery) {
      return true;
    }

    const haystack = [collection.title, collection.description].join('\n');
    return normalizeSearchText(haystack).includes(normalizedPracticeModuleFilterQuery);
  });

  const activeVisiblePracticeModuleCollections = visiblePracticeModuleCollections
    .filter((collection) => !collection.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeVisibleLessons = visibleLessons.filter((practiceModule) => !practiceModule.archivedAt);
  const archivedPracticeModules = visibleLessons
    .filter((practiceModule) => Boolean(practiceModule.archivedAt))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const favoritePracticeModuleCollections = activeVisiblePracticeModuleCollections
    .filter((collection) => collection.isFavorite)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const archivedPracticeModuleCollections = visiblePracticeModuleCollections
    .filter((collection) => Boolean(collection.archivedAt))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const hasArchivedPracticeModules =
    allPracticeModuleCollections.some((collection) => Boolean(collection.archivedAt)) ||
    allLessons.some((practiceModule) => Boolean(practiceModule.archivedAt));
  const favoritePracticeModules = activeVisibleLessons
    .filter((practiceModule) => !practiceModule.sharedVia && !practiceModule.collectionId && practiceModule.isFavorite)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const ownLessons = activeVisibleLessons
    .filter((practiceModule) => !practiceModule.sharedVia && !practiceModule.isFavorite && !practiceModule.collectionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sharedLessons = activeVisibleLessons
    .filter((practiceModule) => Boolean(practiceModule.sharedVia) && !practiceModule.collectionId)
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const availablePracticeModulesForCollection =
    user && activeProfile && selectedPracticeModuleCollection
      ? activeVisibleLessons.filter(
          (practiceModule) =>
            practiceModule.profileId === selectedPracticeModuleCollection.profileId &&
            !practiceModule.collectionId,
        )
      : [];
  const containingCollectionsForSelectedPracticeModule =
    user && selectedPracticeModule
      ? listPracticeModuleCollectionsContainingModule(selectedPracticeModule.id, user.id)
      : [];
  const availableCollectionsForSelectedPracticeModule =
    selectedPracticeModule && activeProfile
      ? activeVisiblePracticeModuleCollections.filter(
          (collection) =>
            collection.profileId === selectedPracticeModule.profileId &&
            !containingCollectionsForSelectedPracticeModule.some(
              (existingCollection) => existingCollection.id === collection.id,
            ),
        )
      : [];
  const shareTargetPracticeModuleProfiles = availableProfiles.filter(
    (profile) => profile.id !== (selectedPracticeModule?.profileId ?? activeProfile?.id),
  );
  const shareTargetPracticeModuleCollectionProfiles = availableProfiles.filter(
    (profile) => profile.id !== (selectedPracticeModuleCollection?.profileId ?? activeProfile?.id),
  );

  const practiceModuleShareUrl =
    selectedPracticeModule && selectedPracticeModuleShareLink
      ? buildAbsoluteAppUrl(
          `/practice-modules/shared/${encodeURIComponent(selectedPracticeModuleShareLink.id)}`,
        )
      : '';
  const practiceModuleCollectionShareUrl =
    selectedPracticeModuleCollection && selectedPracticeModuleCollectionShareLink
      ? buildAbsoluteAppUrl(
          `/practice-modules/collections/shared/${encodeURIComponent(
            selectedPracticeModuleCollectionShareLink.id,
          )}`,
        )
      : '';

  const practiceModuleShareQrDataUrl = practiceModuleShareUrl
    ? await QRCode.toDataURL(practiceModuleShareUrl, { margin: 1, width: 180 })
    : '';
  const practiceModuleCollectionShareQrDataUrl = practiceModuleCollectionShareUrl
    ? await QRCode.toDataURL(practiceModuleCollectionShareUrl, { margin: 1, width: 180 })
    : '';

  return {
    activeProfile,
    archivedPracticeModuleCollections,
    archivedPracticeModules,
    authMessage: getHomeAuthMessage(request, user),
    availableCollectionsForSelectedPracticeModule,
    availablePracticeModulesForCollection,
    containingCollectionsForSelectedPracticeModule,
    favoritePracticeModuleCollections,
    favoritePracticeModules,
    hasArchivedPracticeModules,
    ownLessons,
    practiceModuleCollectionModules,
    practiceModuleCollectionShareQrDataUrl,
    practiceModuleCollectionShareUrl,
    practiceModuleCollections: activeVisiblePracticeModuleCollections,
    practiceModuleConversations,
    practiceModulePageMode: pageKind,
    practiceModuleLayout,
    practiceModuleShareMode,
    practiceModuleShareQrDataUrl,
    practiceModuleShareUrl,
    practiceModules: ownLessons,
    selectedPracticeModule,
    selectedPracticeModuleCollection,
    selectedPracticeModuleCollectionShareLink,
    selectedPracticeModuleCollectionSharedFromProfileName,
    selectedPracticeModuleShareLink,
    selectedPracticeModuleSharedFromProfileName,
    selectedSharedPracticeModule,
    selectedSharedPracticeModuleCollection,
    shareTargetPracticeModuleCollectionProfiles,
    shareTargetPracticeModuleProfiles,
    sharedLessons,
    showArchivedPracticeModules,
    title:
      pageKind === 'new'
        ? `Nuevo módulo · ${appDocumentTitle}`
        : pageKind === 'edit'
        ? `Editar módulo · ${appDocumentTitle}`
        : pageKind === 'detail'
        ? `${selectedPracticeModule?.title || 'Módulo'} · ${appDocumentTitle}`
        : pageKind === 'collectionNew'
        ? `Nueva colección · ${appDocumentTitle}`
        : pageKind === 'collectionEdit'
        ? `Editar colección · ${appDocumentTitle}`
        : pageKind === 'collectionDetail'
        ? `${selectedPracticeModuleCollection?.title || 'Colección'} · ${appDocumentTitle}`
        : pageKind === 'share'
        ? `${selectedSharedPracticeModule?.title || 'Módulo compartido'} · ${appDocumentTitle}`
        : pageKind === 'collectionShare'
        ? `${selectedSharedPracticeModuleCollection?.title || 'Colección compartida'} · ${appDocumentTitle}`
        : `Módulos de práctica · ${appDocumentTitle}`,
    user,
  };
}

async function renderPracticeModulesPage(
  request: Request,
  response: Response,
  pageKind: PracticeModulePageKind,
  overrides: PracticeModuleDraftFormValues = {},
): Promise<void> {
  const viewModel = await buildPracticeModulesPageModel(request, response, pageKind);
  if (!viewModel) {
    return;
  }

  response.render('practice-modules', {
    ...buildAppShellContext({
      activeProfile: viewModel.activeProfile,
      authMessage: viewModel.authMessage,
      currentView: 'practiceModules',
      guestInitialGreeting: '',
      request,
      title: viewModel.title,
      user: viewModel.user,
    }),
    archivedPracticeModuleCollections: viewModel.archivedPracticeModuleCollections,
    archivedPracticeModules: viewModel.archivedPracticeModules,
    availableCollectionsForSelectedPracticeModule:
      viewModel.availableCollectionsForSelectedPracticeModule,
    availablePracticeModulesForCollection: viewModel.availablePracticeModulesForCollection,
    containingCollectionsForSelectedPracticeModule:
      viewModel.containingCollectionsForSelectedPracticeModule,
    favoritePracticeModuleCollections: viewModel.favoritePracticeModuleCollections,
    favoritePracticeModules: viewModel.favoritePracticeModules,
    hasArchivedPracticeModules: viewModel.hasArchivedPracticeModules,
    practiceModuleCollectionModules: viewModel.practiceModuleCollectionModules,
    practiceModuleCollectionShareQrDataUrl: viewModel.practiceModuleCollectionShareQrDataUrl,
    practiceModuleCollectionShareUrl: viewModel.practiceModuleCollectionShareUrl,
    practiceModuleCollections: viewModel.practiceModuleCollections,
    practiceModuleConversations: viewModel.practiceModuleConversations,
    practiceModuleFilterQuery:
      typeof request.query.q === 'string' ? request.query.q.trim() : '',
    practiceModulePageMode: viewModel.practiceModulePageMode,
    practiceModuleLayout: viewModel.practiceModuleLayout,
    practiceModuleShareMode: viewModel.practiceModuleShareMode,
    practiceModuleShareQrDataUrl: viewModel.practiceModuleShareQrDataUrl,
    practiceModuleShareUrl: viewModel.practiceModuleShareUrl,
    practiceModules: viewModel.practiceModules,
    selectedPracticeModule: viewModel.selectedPracticeModule,
    selectedPracticeModuleCollection: viewModel.selectedPracticeModuleCollection,
    selectedPracticeModuleCollectionShareLink:
      viewModel.selectedPracticeModuleCollectionShareLink,
    selectedPracticeModuleCollectionSharedFromProfileName:
      viewModel.selectedPracticeModuleCollectionSharedFromProfileName,
    selectedPracticeModuleShareLink: viewModel.selectedPracticeModuleShareLink,
    selectedPracticeModuleSharedFromProfileName:
      viewModel.selectedPracticeModuleSharedFromProfileName,
    selectedSharedPracticeModule: viewModel.selectedSharedPracticeModule,
    selectedSharedPracticeModuleCollection:
      viewModel.selectedSharedPracticeModuleCollection,
    shareTargetPracticeModuleCollectionProfiles:
      viewModel.shareTargetPracticeModuleCollectionProfiles,
    shareTargetPracticeModuleProfiles: viewModel.shareTargetPracticeModuleProfiles,
    sharedLessons: viewModel.sharedLessons,
    showArchivedPracticeModules: viewModel.showArchivedPracticeModules,
    practiceModuleGenerationError: '',
    practiceModuleGenerationModalAutoOpen: false,
    practiceModuleGenerationPrompt: '',
    ...overrides,
  });
}

export function renderPracticeModulesListPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'list');
}

export function renderNewPracticeModulePage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'new');
}

export async function handleGeneratePracticeModuleDraft(
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
    response.redirect('/practice-modules/new');
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
    const draft = await generatePracticeModuleDraft({
      openRouterApiKey,
      prompt,
    });
    const practiceModule = createPracticeModule({
      description: draft.description,
      profileId: activeProfile.id,
      title: draft.title,
      tutorInstructions: draft.tutorInstructions,
      userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
  } catch (error) {
    await renderPracticeModulesPage(request, response, 'list', {
      practiceModuleGenerationError:
        error instanceof Error && error.message
          ? error.message
          : 'No pude generar el módulo automáticamente.',
      practiceModuleGenerationModalAutoOpen: true,
      practiceModuleGenerationPrompt: prompt,
    });
  }
}

export function renderPracticeModuleDetailPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'detail');
}

export function renderEditPracticeModulePage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'edit');
}

export function renderSharedPracticeModulePage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'share');
}

export function renderNewPracticeModuleCollectionPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'collectionNew');
}

export function renderPracticeModuleCollectionDetailPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'collectionDetail');
}

export function renderEditPracticeModuleCollectionPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'collectionEdit');
}

export function renderSharedPracticeModuleCollectionPage(request: Request, response: Response) {
  return renderPracticeModulesPage(request, response, 'collectionShare');
}

export function handleCreatePracticeModule(request: Request, response: Response): void {
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
    response.redirect('/practice-modules/new');
    return;
  }

  const practiceModule = createPracticeModule({
    profileId: activeProfile.id,
    userId: user.id,
    title,
    description,
    tutorInstructions,
  });

  response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}

export function handleCreatePracticeModuleConversation(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleIdRaw = request.params.practiceModuleId;
  const practiceModuleId =
    typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
  if (!practiceModuleId) {
    response.redirect('/practice-modules');
    return;
  }

  const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
  if (!practiceModule) {
    response.redirect('/practice-modules');
    return;
  }

  const conversation = createConversationFromPracticeModule(user.id, practiceModule);

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

export function handleUpdatePracticeModule(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleIdRaw = request.params.practiceModuleId;
  const practiceModuleId =
    typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
  if (!practiceModuleId) {
    response.redirect('/practice-modules');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();
  if (!title || !description || !tutorInstructions) {
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModuleId)}/edit`);
    return;
  }

  const practiceModule = updatePracticeModule({
    practiceModuleId,
    description,
    title,
    tutorInstructions,
    userId: user.id,
  });

  if (!practiceModule) {
    response.redirect('/practice-modules');
    return;
  }

  response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}

export function handleSetPracticeModuleFavorite(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
  if (!practiceModuleId) {
    response.redirect(returnTo);
    return;
  }

  const favoriteValue = String(request.body.favorite || '').trim();
  const isFavorite = favoriteValue === '1' || favoriteValue === 'true';
  setPracticeModuleFavoriteForUser(practiceModuleId, user.id, isFavorite);
  response.redirect(returnTo);
}

export function handleArchivePracticeModule(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
  if (!practiceModuleId) {
    response.redirect(returnTo);
    return;
  }

  archivePracticeModuleForUser(practiceModuleId, user.id);
  response.redirect(returnTo);
}

export function handleRestorePracticeModule(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules?archived=1'));
  if (!practiceModuleId) {
    response.redirect(returnTo);
    return;
  }

  restorePracticeModuleForUser(practiceModuleId, user.id);
  response.redirect(returnTo);
}

export function handleDeletePracticeModule(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleIdRaw = request.params.practiceModuleId;
  const practiceModuleId =
    typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
  if (!practiceModuleId) {
    response.redirect('/practice-modules');
    return;
  }

  deletePracticeModuleForUser(practiceModuleId, user.id);
  response.redirect('/practice-modules');
}

export function handleCreatePracticeModuleCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  if (!title) {
    response.redirect('/practice-modules/collections/new');
    return;
  }

  const collection = createPracticeModuleCollection({
    description,
    profileId: activeProfile.id,
    title,
    userId: user.id,
  });

  response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}

export function handleUpdatePracticeModuleCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  if (!collectionId || !title) {
    response.redirect(collectionId ? `/practice-modules/collections/${encodeURIComponent(collectionId)}/edit` : '/practice-modules');
    return;
  }

  const collection = updatePracticeModuleCollection({
    collectionId,
    description,
    title,
    userId: user.id,
  });
  if (!collection) {
    response.redirect('/practice-modules');
    return;
  }

  response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}

export function handleSetPracticeModuleCollectionFavorite(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
  if (!collectionId) {
    response.redirect(returnTo);
    return;
  }

  const favoriteValue = String(request.body.favorite || '').trim();
  const isFavorite = favoriteValue === '1' || favoriteValue === 'true';
  setPracticeModuleCollectionFavoriteForUser(collectionId, user.id, isFavorite);
  response.redirect(returnTo);
}

export function handleArchivePracticeModuleCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
  if (!collectionId) {
    response.redirect(returnTo);
    return;
  }

  archivePracticeModuleCollectionForUser(collectionId, user.id);
  response.redirect(returnTo);
}

export function handleRestorePracticeModuleCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules?archived=1'));
  if (!collectionId) {
    response.redirect(returnTo);
    return;
  }

  restorePracticeModuleCollectionForUser(collectionId, user.id);
  response.redirect(returnTo);
}

export function handleAddPracticeModuleToCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const practiceModuleIdsRaw = request.body.practiceModuleId;
  const returnTo = normalizeReturnTo(
    String(request.body.returnTo || `/practice-modules/collections/${collectionId}`),
  );
  const practiceModuleIds = Array.isArray(practiceModuleIdsRaw)
    ? practiceModuleIdsRaw.map((value) => String(value || '').trim()).filter(Boolean)
    : [String(practiceModuleIdsRaw || '').trim()].filter(Boolean);
  if (!collectionId || practiceModuleIds.length === 0) {
    response.redirect(returnTo);
    return;
  }

  for (const practiceModuleId of practiceModuleIds) {
    addPracticeModuleToCollection({
      collectionId,
      practiceModuleId,
      userId: user.id,
    });
  }
  response.redirect(returnTo);
}

export function handleRemovePracticeModuleFromCollection(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const returnTo = normalizeReturnTo(
    String(request.body.returnTo || `/practice-modules/collections/${collectionId}`),
  );
  if (!collectionId || !practiceModuleId) {
    response.redirect(returnTo);
    return;
  }

  removePracticeModuleFromCollection({
    collectionId,
    practiceModuleId,
    userId: user.id,
  });
  response.redirect(returnTo);
}

export function handleMovePracticeModuleCollectionItem(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const direction = request.path.endsWith('/move-up') ? 'up' : 'down';
  const returnTo = normalizeReturnTo(
    String(request.body.returnTo || `/practice-modules/collections/${collectionId}`),
  );
  if (!collectionId || !practiceModuleId) {
    response.redirect(returnTo);
    return;
  }

  movePracticeModuleCollectionItem({
    collectionId,
    direction,
    practiceModuleId,
    userId: user.id,
  });
  response.redirect(returnTo);
}

export function handleSharePracticeModuleToProfile(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const practiceModuleId = String(request.params.practiceModuleId || '').trim();
  const targetProfileId = String(request.body.targetProfileId || '').trim();
  if (!practiceModuleId || !targetProfileId) {
    response.redirect('/practice-modules');
    return;
  }

  const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
  if (!practiceModule) {
    response.redirect('/practice-modules');
    return;
  }

  const targetProfile = findProfileForUser(targetProfileId, user.id);
  if (!targetProfile || targetProfile.id === practiceModule.profileId) {
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
    return;
  }

  importPracticeModuleToProfile({
    shareKind: 'profile',
    sourcePracticeModule: practiceModule,
    targetProfileId: targetProfile.id,
    userId: user.id,
  });
  response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}

export function handleSharePracticeModuleCollectionToProfile(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const collectionId = String(request.params.collectionId || '').trim();
  const targetProfileId = String(request.body.targetProfileId || '').trim();
  if (!collectionId || !targetProfileId) {
    response.redirect('/practice-modules');
    return;
  }

  const collection = findPracticeModuleCollectionForUser(collectionId, user.id);
  if (!collection) {
    response.redirect('/practice-modules');
    return;
  }

  const targetProfile = findProfileForUser(targetProfileId, user.id);
  if (!targetProfile || targetProfile.id === collection.profileId) {
    response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
    return;
  }

  importPracticeModuleCollectionToProfile({
    shareKind: 'profile',
    sourceCollection: collection,
    targetProfileId: targetProfile.id,
    userId: user.id,
  });
  response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}

export function handleAcceptSharedPracticeModuleLink(
  request: Request,
  response: Response,
): void {
  const shareId = String(request.params.shareId || '').trim();
  if (!shareId) {
    response.redirect('/practice-modules');
    return;
  }

  const shareLink = findPracticeModuleShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/practice-modules');
    return;
  }

  const sourcePracticeModule = findPracticeModuleById(shareLink.practiceModuleId);
  if (!sourcePracticeModule) {
    response.redirect('/practice-modules');
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const imported = importPracticeModuleToProfile({
    shareKind: 'link',
    sourcePracticeModule,
    targetProfileId: activeProfile.id,
    userId: user.id,
  });
  response.redirect(`/practice-modules/${encodeURIComponent(imported.id)}`);
}

export function handleAcceptSharedPracticeModuleCollectionLink(
  request: Request,
  response: Response,
): void {
  const shareId = String(request.params.shareId || '').trim();
  if (!shareId) {
    response.redirect('/practice-modules');
    return;
  }

  const shareLink = findPracticeModuleCollectionShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/practice-modules');
    return;
  }

  const sourceCollection = findPracticeModuleCollectionById(shareLink.collectionId);
  if (!sourceCollection) {
    response.redirect('/practice-modules');
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const imported = importPracticeModuleCollectionToProfile({
    shareKind: 'link',
    sourceCollection,
    targetProfileId: activeProfile.id,
    userId: user.id,
  });
  response.redirect(`/practice-modules/collections/${encodeURIComponent(imported.id)}`);
}
