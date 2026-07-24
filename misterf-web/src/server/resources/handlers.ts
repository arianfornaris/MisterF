import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  addResourceToFolder,
  archiveResourceForUser,
  countCollectedQuizAttemptsByQuiz,
  createResourceFolder,
  findResourceAccessForProfile,
  findResourceById,
  findResourceForUser,
  findResourceFolderForResource,
  findResourceShareLinkById,
  findProfileForUser,
  getOrCreateResourceShareLink,
  grantResourceAccess,
  listAccessibleResourceFolderPath,
  listResourceFolderItems,
  listResourceFoldersForProfile,
  listResourcesForProfile,
  listSharedResourcesForProfile,
  removeResourceFromFolder,
  restoreResourceForUser,
  setResourceShareLinkCollectResults,
  updateResourceFolder,
  type StoredResource,
  type StoredAccessibleResource,
  type StoredResourceFolderMoveOption,
} from '../db/repository.js';
import {
  appDocumentTitle,
  buildAbsoluteAppUrl,
  buildAppShellContext,
  formatRelativeTime,
  getHomeAuthMessage,
  normalizeSearchText,
} from '../pages/shell.js';
import { logger } from '../services/logger.js';

type ResourceFilterType = StoredResource['type'] | 'all';
type ResourceSortOption = 'title_asc' | 'type' | 'updated_desc';

type ResourceListItem = StoredAccessibleResource & {
  actionLabel: string;
  actionMethod: 'get' | 'post';
  actionPath: string;
  badgeClass: string;
  detailPath: string;
  headerClass: string;
  iconClass: string;
  label: string;
  relativeUpdatedAt: string;
  canManage: boolean;
};

type ResourceFolderListItem = ResourceListItem & {
  parentFolderId: string | null;
};

function ensureVerifiedResourceUser(
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

function readField(value: unknown, maxLength = 800): string {
  if (Array.isArray(value)) {
    return readField(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeReturnTo(value: unknown): string {
  const returnTo = readField(value, 2000);
  return returnTo.startsWith('/') ? returnTo : '/resources';
}

function readResourceTypeFilter(value: unknown): ResourceFilterType {
  const resourceType = readField(value, 40);
  if (
    resourceType === 'quiz' ||
    resourceType === 'practice_guide' ||
    resourceType === 'resource_folder' ||
    resourceType === 'roleplay'
  ) {
    return resourceType;
  }

  return 'all';
}

function readResourceSort(value: unknown): ResourceSortOption {
  const sort = readField(value, 40);
  if (sort === 'title_asc' || sort === 'type') {
    return sort;
  }

  return 'updated_desc';
}

function buildResourceDetailPath(resource: StoredResource): string {
  if (resource.type === 'quiz') {
    return `/quizzes/${encodeURIComponent(resource.id)}`;
  }

  if (resource.type === 'practice_guide') {
    return `/practice-guides/${encodeURIComponent(resource.id)}`;
  }

  if (resource.type === 'roleplay') {
    return `/roleplays/${encodeURIComponent(resource.id)}`;
  }

  return `/resources/folders/${encodeURIComponent(resource.id)}`;
}

function buildResourceAction(resource: StoredResource): {
  actionLabel: string;
  actionMethod: 'get' | 'post';
  actionPath: string;
} {
  if (resource.type === 'quiz') {
    return {
      actionLabel: 'Probar',
      actionMethod: 'post',
      actionPath: `/quizzes/${encodeURIComponent(resource.id)}/test-attempts`,
    };
  }

  if (resource.type === 'practice_guide') {
    return {
      actionLabel: 'Comenzar',
      actionMethod: 'post',
      actionPath: `/practice-guides/${encodeURIComponent(resource.id)}/chats`,
    };
  }

  if (resource.type === 'roleplay') {
    return {
      actionLabel: 'Comenzar',
      actionMethod: 'post',
      actionPath: `/roleplays/${encodeURIComponent(resource.id)}/attempts`,
    };
  }

  return {
    actionLabel: 'Abrir',
    actionMethod: 'get',
    actionPath: `/resources/folders/${encodeURIComponent(resource.id)}`,
  };
}

function toAccessibleOwnerResource(resource: StoredResource): StoredAccessibleResource {
  return {
    ...resource,
    accessCreatedAt: null,
    accessKind: 'owner',
    grantId: null,
    grantedVia: null,
    shareLinkId: null,
  };
}

function buildResourceListItem(resource: StoredAccessibleResource): ResourceListItem {
  const meta = {
    quiz: {
      badgeClass: 'text-bg-primary',
      headerClass: 'bg-primary text-white',
      iconClass: 'bi-ui-checks-grid',
      label: 'Quiz',
    },
    practice_guide: {
      badgeClass: 'text-bg-success',
      headerClass: 'bg-success text-white',
      iconClass: 'bi-journal-text',
      label: 'Guía de Práctica',
    },
    resource_folder: {
      badgeClass: 'text-bg-info',
      headerClass: 'bg-info-subtle text-info-emphasis',
      iconClass: 'bi-folder',
      label: 'Carpeta',
    },
    roleplay: {
      badgeClass: 'text-bg-warning',
      headerClass: 'bg-warning-subtle text-warning-emphasis',
      iconClass: 'bi-person-video3',
      label: 'Roleplay',
    },
  }[resource.type];
  const action = buildResourceAction(resource);

  return {
    ...resource,
    ...action,
    badgeClass: meta.badgeClass,
    detailPath: buildResourceDetailPath(resource),
    headerClass: meta.headerClass,
    iconClass: meta.iconClass,
    label: meta.label,
    relativeUpdatedAt: formatRelativeTime(resource.updatedAt),
    canManage: resource.accessKind === 'owner',
  };
}

function buildResourceFolderListItem(
  folder: StoredResourceFolderMoveOption,
): ResourceFolderListItem {
  return {
    ...buildResourceListItem(toAccessibleOwnerResource(folder)),
    parentFolderId: folder.parentFolderId,
  };
}

function removeFiledResourcesFromRoot(
  resources: StoredAccessibleResource[],
  folders: StoredResourceFolderMoveOption[],
  userId: string,
): StoredAccessibleResource[] {
  const filedResourceIds = new Set(
    folders.flatMap((folder) =>
      listResourceFolderItems(folder.id, userId).map((item) => item.resourceId),
    ),
  );

  return resources.filter((resource) => !filedResourceIds.has(resource.id));
}

const resourceTypeSortRank: Record<StoredResource['type'], number> = {
  resource_folder: 0,
  quiz: 1,
  practice_guide: 2,
  roleplay: 3,
};

function compareResourceTitles(left: StoredResource, right: StoredResource): number {
  return left.title.localeCompare(right.title, 'es', { sensitivity: 'base' });
}

function compareResourceDates(left: StoredResource, right: StoredResource): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt)
  );
}

function compareResourceTypes(left: StoredResource, right: StoredResource): number {
  return resourceTypeSortRank[left.type] - resourceTypeSortRank[right.type];
}

function filterAndSortResources(
  resources: StoredAccessibleResource[],
  filters: {
    query: string;
    sort: ResourceSortOption;
    type: ResourceFilterType;
  },
): StoredAccessibleResource[] {
  const normalizedQuery = normalizeSearchText(filters.query);
  const filteredResources = resources.filter((resource) => {
    if (filters.type !== 'all' && resource.type !== filters.type) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeSearchText(
      [
        resource.title,
        resource.description,
        resource.topic,
        resource.level,
      ].filter(Boolean).join(' '),
    ).includes(normalizedQuery);
  });

  return filteredResources.sort((left, right) => {
    const folderComparison = compareResourceTypes(left, right);
    if (
      (left.type === 'resource_folder' || right.type === 'resource_folder') &&
      left.type !== right.type
    ) {
      return folderComparison;
    }

    if (filters.sort === 'title_asc') {
      return compareResourceTitles(left, right) || compareResourceDates(left, right);
    }

    if (filters.sort === 'type') {
      return folderComparison || compareResourceTitles(left, right);
    }

    return compareResourceDates(left, right) || compareResourceTitles(left, right);
  });
}

function readResourceShareMode(value: unknown): 'link' | 'profile' | '' {
  const shareMode = readField(value, 20);
  return shareMode === 'link' || shareMode === 'profile' ? shareMode : '';
}

function buildResourceLogDetails(input: {
  profileId?: string | null;
  resource: Pick<StoredResource, 'id' | 'profileId' | 'type' | 'userId'>;
  userId: string;
}): Record<string, unknown> {
  return {
    ownerProfileId: input.resource.profileId,
    ownerUserId: input.resource.userId,
    profileId: input.profileId ?? null,
    resourceId: input.resource.id,
    resourceType: input.resource.type,
    userId: input.userId,
  };
}

export async function renderResourcesListPage(
  request: Request,
  response: Response,
): Promise<void> {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const folderId = readField(request.params.folderId, 100) || null;
  const selectedFolder = folderId
    ? findResourceAccessForProfile({
        includeArchived: false,
        profileId: auth.activeProfile.id,
        resourceId: folderId,
        userId: auth.user.id,
      })
    : null;
  if (folderId && selectedFolder?.type !== 'resource_folder') {
    response.redirect('/resources');
    return;
  }
  const selectedFolderCanManage = selectedFolder?.accessKind === 'owner';
  const folderOptions = listResourceFoldersForProfile({
    includeArchived: false,
    profileId: auth.activeProfile.id,
    userId: auth.user.id,
  });
  const selectedFolderPath = selectedFolder
    ? listAccessibleResourceFolderPath({
        includeArchived: false,
        folderId: selectedFolder.id,
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
      })
    : [];
  const selectedFolderParent = selectedFolderCanManage
    ? findResourceFolderForResource(selectedFolder.id, auth.user.id)
    : null;
  const selectedFolderShareLink = selectedFolderCanManage
    ? getOrCreateResourceShareLink(selectedFolder.id)
    : null;
  const selectedFolderShareUrl = selectedFolderShareLink
    ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(selectedFolderShareLink.id)}`)
    : '';
  const selectedFolderShareQrDataUrl = selectedFolderShareUrl
    ? await QRCode.toDataURL(selectedFolderShareUrl, { margin: 1, width: 180 })
    : '';
  const shareTargetResourceProfiles = selectedFolderCanManage && selectedFolder
    ? (request.availableProfiles ?? []).filter(
        (profile) => profile.id !== selectedFolder.profileId,
      )
    : [];

  const scopedResources = listResourcesForProfile({
    folderId,
    includeArchived: false,
    profileId: auth.activeProfile.id,
    type: null,
    userId: auth.user.id,
  });
  const allResources = selectedFolder
    ? scopedResources
    : removeFiledResourcesFromRoot(scopedResources, folderOptions, auth.user.id);
  const filters = {
    query: readField(request.query.q, 160),
    sort: readResourceSort(request.query.sort),
    type: readResourceTypeFilter(request.query.type),
  };
  const resourceItems = filterAndSortResources(allResources, filters);

  response.render('resources-list', {
    ...buildAppShellContext({
      activeProfile: auth.activeProfile,
      authMessage: getHomeAuthMessage(request, auth.user),
      currentView: 'resources',
      guestInitialGreeting: '',
      request,
      title: selectedFolder
        ? `${selectedFolder.title} - ${appDocumentTitle}`
        : `Recursos - ${appDocumentTitle}`,
      user: auth.user,
    }),
    folderBreadcrumbItems: selectedFolderPath.map(buildResourceListItem),
    folderOptions: folderOptions.map(buildResourceFolderListItem),
    resourceFilters: {
      ...filters,
      hasActiveFilters:
        Boolean(filters.query) ||
        filters.type !== 'all' ||
        filters.sort !== 'updated_desc',
    },
    resourceItems: resourceItems.map(buildResourceListItem),
    selectedFolderCanManage,
    selectedFolderParent: selectedFolderParent
      ? buildResourceListItem(toAccessibleOwnerResource(selectedFolderParent))
      : null,
    selectedFolder: selectedFolder ? buildResourceListItem(selectedFolder) : null,
    selectedFolderShareMode: readResourceShareMode(request.query.share),
    selectedFolderShareQrDataUrl,
    selectedFolderShareUrl,
    shareTargetResourceProfiles,
  });
}

type SharedByMeItem = ResourceListItem & {
  /** People the resource is shared with (active access grants). */
  sharedWithCount: number;
  hasActiveLink: boolean;
  isQuiz: boolean;
  /** Quiz-only: distinct participants who finished, and total submissions. */
  completed: number;
  submissions: number;
  /** Quiz-only: link to the participation ("who practiced") page. */
  participationPath: string | null;
};

/**
 * The guide's "Shared by me" entry point (roadmap V3 §1.6): every resource the
 * active profile has shared, with quiz participation counts and a lightweight
 * shared-with signal for guides and roleplays.
 */
export function renderSharedByMePage(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const sharedResources = listSharedResourcesForProfile({
    profileId: auth.activeProfile.id,
    userId: auth.user.id,
  });

  const quizIds = sharedResources
    .filter((resource) => resource.type === 'quiz')
    .map((resource) => resource.id);
  const quizCounts = countCollectedQuizAttemptsByQuiz({
    authorProfileId: auth.activeProfile.id,
    quizIds,
  });

  const sharedItems: SharedByMeItem[] = sharedResources.map((resource) => {
    const isQuiz = resource.type === 'quiz';
    const counts = isQuiz ? quizCounts.get(resource.id) : undefined;
    return {
      ...buildResourceListItem(resource),
      sharedWithCount: resource.activeGrantCount,
      hasActiveLink: resource.hasActiveLink,
      isQuiz,
      completed: counts?.completed ?? 0,
      submissions: counts?.submissions ?? 0,
      participationPath: isQuiz
        ? `/quizzes/${encodeURIComponent(resource.id)}/participation`
        : null,
    };
  });

  response.render('resources-shared-by-me', {
    ...buildAppShellContext({
      activeProfile: auth.activeProfile,
      authMessage: getHomeAuthMessage(request, auth.user),
      currentView: 'sharedByMe',
      guestInitialGreeting: '',
      request,
      title: `Compartidos - ${appDocumentTitle}`,
      user: auth.user,
    }),
    sharedItems,
  });
}

export function renderSharedResourcePage(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const shareLink = findResourceShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const resource = findResourceById(shareLink.resourceId);
  if (!resource || resource.archivedAt) {
    response.redirect('/resources');
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (user?.emailVerified && activeProfile) {
    const existingAccess = findResourceAccessForProfile({
      profileId: activeProfile.id,
      resourceId: resource.id,
      userId: user.id,
    });
    if (existingAccess) {
      response.redirect(buildResourceDetailPath(existingAccess));
      return;
    }
  }

  const quizTakeAction =
    resource.type === 'quiz'
      ? `/quizzes/shared/${encodeURIComponent(shareLink.id)}/take`
      : '';
  const startAction =
    resource.type === 'roleplay'
      ? `/roleplays/shared/${encodeURIComponent(shareLink.id)}/start`
      : resource.type === 'practice_guide'
      ? `/practice-guides/shared/${encodeURIComponent(shareLink.id)}/start`
      : '';

  response.render('resources-shared', {
    ...buildAppShellContext({
      activeProfile: activeProfile ?? null,
      authMessage: getHomeAuthMessage(request, user ?? null),
      currentView: 'resources',
      guestInitialGreeting: '',
      request,
      title: `${resource.title} - ${appDocumentTitle}`,
      user: user ?? null,
    }),
    quizTakeAction,
    startAction,
    returnTo: `/resources/shared/${encodeURIComponent(shareLink.id)}`,
    shareLink,
    sharedResource: buildResourceListItem(toAccessibleOwnerResource(resource)),
  });
}

export function handleAcceptSharedResourceLink(
  request: Request,
  response: Response,
): void {
  const shareId = readField(request.params.shareId, 120);
  const shareLink = findResourceShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const resource = findResourceById(shareLink.resourceId);
  if (!resource || resource.archivedAt) {
    response.redirect('/resources');
    return;
  }

  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  grantResourceAccess({
    grantedByUserId: resource.userId,
    grantedVia: 'link',
    profileId: auth.activeProfile.id,
    resourceId: resource.id,
    shareLinkId: shareLink.id,
    userId: auth.user.id,
  });
  logger.info('resource_share_link_accepted', {
    ...buildResourceLogDetails({
      profileId: auth.activeProfile.id,
      resource,
      userId: auth.user.id,
    }),
    shareLinkId: shareLink.id,
  });

  response.redirect(buildResourceDetailPath(resource));
}

/**
 * Owner toggle for the share results-feedback flag: whether attempts started
 * through the resource's share link return their results to the owner. The
 * flag is snapshotted per attempt at start, so flipping it never changes the
 * visibility of attempts that already began.
 */
export function handleUpdateResourceShareCollectResults(
  request: Request,
  response: Response,
): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const returnTo = normalizeReturnTo(request.body.returnTo);
  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  if (!resource || resource.archivedAt) {
    response.redirect(returnTo);
    return;
  }

  const collectResults = readField(request.body.collectResults, 10) === 'on';
  getOrCreateResourceShareLink(resource.id);
  setResourceShareLinkCollectResults({
    collectResults,
    resourceId: resource.id,
  });
  logger.info('resource_share_collect_results_updated', {
    ...buildResourceLogDetails({
      profileId: resource.profileId,
      resource,
      userId: auth.user.id,
    }),
    collectResults,
  });

  response.redirect(returnTo);
}

export function handleShareResourceToProfile(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const returnTo = normalizeReturnTo(request.body.returnTo);
  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  const targetProfile = findProfileForUser(readField(request.body.targetProfileId, 120), auth.user.id);

  if (!resource || resource.archivedAt || !targetProfile || targetProfile.id === resource.profileId) {
    response.redirect(returnTo);
    return;
  }

  grantResourceAccess({
    grantedByUserId: auth.user.id,
    grantedVia: 'profile',
    profileId: targetProfile.id,
    resourceId: resource.id,
    userId: auth.user.id,
  });
  logger.info('resource_shared_with_profile', {
    ...buildResourceLogDetails({
      profileId: resource.profileId,
      resource,
      userId: auth.user.id,
    }),
    targetProfileId: targetProfile.id,
  });

  response.redirect(returnTo);
}

export function handleCreateResourceFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const title = readField(request.body.title, 160);
  const description = readField(request.body.description, 800);
  const parentFolderId = readField(request.body.parentFolderId, 100);
  if (!title) {
    response.redirect(normalizeReturnTo(request.body.returnTo));
    return;
  }

  const folder = createResourceFolder({
    description,
    profileId: auth.activeProfile.id,
    title,
    userId: auth.user.id,
  });
  logger.info('resource_folder_created', {
    ...buildResourceLogDetails({
      profileId: auth.activeProfile.id,
      resource: folder,
      userId: auth.user.id,
    }),
    parentFolderId: parentFolderId || null,
  });
  if (parentFolderId) {
    addResourceToFolder({
      folderId: parentFolderId,
      resourceId: folder.id,
      userId: auth.user.id,
    });
  }

  response.redirect(`/resources/folders/${encodeURIComponent(folder.id)}`);
}

export function handleUpdateResourceFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const folderId = readField(request.params.folderId, 100);
  const title = readField(request.body.title, 160);
  const description = readField(request.body.description, 800);
  const returnTo = normalizeReturnTo(request.body.returnTo);

  if (!folderId || !title) {
    response.redirect(returnTo);
    return;
  }

  updateResourceFolder({
    description,
    folderId,
    title,
    userId: auth.user.id,
  });
  const updatedFolder = findResourceForUser(folderId, auth.user.id);
  if (updatedFolder) {
    logger.info('resource_folder_updated', {
      ...buildResourceLogDetails({
        profileId: updatedFolder.profileId,
        resource: updatedFolder,
        userId: auth.user.id,
      }),
    });
  }

  response.redirect(returnTo);
}

export function handleArchiveResource(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  if (resource) {
    archiveResourceForUser(resource.id, auth.user.id);
    logger.info('resource_archived', {
      ...buildResourceLogDetails({
        profileId: resource.profileId,
        resource,
        userId: auth.user.id,
      }),
    });
  }
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleRestoreResource(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  if (resource) {
    restoreResourceForUser(resource.id, auth.user.id);
    logger.info('resource_restored', {
      ...buildResourceLogDetails({
        profileId: resource.profileId,
        resource,
        userId: auth.user.id,
      }),
    });
  }
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleMoveResourceToFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const folderId = readField(request.body.folderId, 100);
  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  if (resource && addResourceToFolder({
    folderId,
    resourceId: resource.id,
    userId: auth.user.id,
  })) {
    logger.info('resource_moved_to_folder', {
      ...buildResourceLogDetails({
        profileId: resource.profileId,
        resource,
        userId: auth.user.id,
      }),
      folderId,
    });
  }
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleRemoveResourceFromFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const folderId = readField(request.params.folderId, 100);
  const resource = findResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  if (resource && removeResourceFromFolder({
    folderId,
    resourceId: resource.id,
    userId: auth.user.id,
  })) {
    logger.info('resource_removed_from_folder', {
      ...buildResourceLogDetails({
        profileId: resource.profileId,
        resource,
        userId: auth.user.id,
      }),
      folderId,
    });
  }
  response.redirect(normalizeReturnTo(request.body.returnTo));
}
