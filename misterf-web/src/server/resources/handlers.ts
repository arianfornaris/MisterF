import type { Request, Response } from 'express';
import {
  addResourceToFolder,
  archiveResourceForUser,
  createResourceFolder,
  findResourceForUser,
  listResourceFolderItems,
  listResourcesForProfile,
  removeResourceFromFolder,
  restoreResourceForUser,
  type StoredResource,
} from '../db/repository.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  formatRelativeTime,
  getHomeAuthMessage,
} from '../pages/shell.js';
import {
  resolveResourceLayout,
  resourcesLayoutCookieName,
} from '../pages/resourceLayout.js';

type ResourceListItem = StoredResource & {
  actionLabel: string;
  actionMethod: 'get' | 'post';
  actionPath: string;
  descriptionText: string;
  detailPath: string;
  headerClass: string;
  iconClass: string;
  label: string;
  relativeUpdatedAt: string;
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

function buildResourceDetailPath(resource: StoredResource): string {
  if (resource.type === 'assignment') {
    return `/assignments/${encodeURIComponent(resource.id)}`;
  }

  if (resource.type === 'practice_guide') {
    return `/practice-modules/${encodeURIComponent(resource.id)}`;
  }

  return `/resources/folders/${encodeURIComponent(resource.id)}`;
}

function buildResourceAction(resource: StoredResource): {
  actionLabel: string;
  actionMethod: 'get' | 'post';
  actionPath: string;
} {
  if (resource.type === 'assignment') {
    return {
      actionLabel: 'Probar',
      actionMethod: 'post',
      actionPath: `/assignments/${encodeURIComponent(resource.id)}/test-attempts`,
    };
  }

  if (resource.type === 'practice_guide') {
    return {
      actionLabel: 'Comenzar',
      actionMethod: 'post',
      actionPath: `/practice-modules/${encodeURIComponent(resource.id)}/chats`,
    };
  }

  return {
    actionLabel: 'Abrir',
    actionMethod: 'get',
    actionPath: `/resources/folders/${encodeURIComponent(resource.id)}`,
  };
}

function buildResourceListItem(resource: StoredResource): ResourceListItem {
  const meta = {
    assignment: {
      headerClass: 'bg-primary text-white',
      iconClass: 'bi-ui-checks-grid',
      label: 'Tarea',
    },
    practice_guide: {
      headerClass: 'bg-success text-white',
      iconClass: 'bi-journal-text',
      label: 'Guía de Práctica',
    },
    resource_folder: {
      headerClass: 'bg-info-subtle text-info-emphasis',
      iconClass: 'bi-folder',
      label: 'Carpeta',
    },
  }[resource.type];
  const action = buildResourceAction(resource);

  return {
    ...resource,
    ...action,
    descriptionText: resource.description || resource.topic || 'Sin descripción',
    detailPath: buildResourceDetailPath(resource),
    headerClass: meta.headerClass,
    iconClass: meta.iconClass,
    label: meta.label,
    relativeUpdatedAt: formatRelativeTime(resource.updatedAt),
  };
}

function removeFiledResourcesFromRoot(resources: StoredResource[], userId: string): StoredResource[] {
  const folderIds = resources
    .filter((resource) => resource.type === 'resource_folder' && !resource.archivedAt)
    .map((resource) => resource.id);
  const filedResourceIds = new Set(
    folderIds.flatMap((folderId) =>
      listResourceFolderItems(folderId, userId).map((item) => item.resourceId),
    ),
  );

  return resources.filter((resource) =>
    resource.type === 'resource_folder' || !filedResourceIds.has(resource.id),
  );
}

export function renderResourcesListPage(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const folderId = readField(request.params.folderId, 100) || null;
  const selectedFolder = folderId ? findResourceForUser(folderId, auth.user.id) : null;
  if (folderId && selectedFolder?.type !== 'resource_folder') {
    response.redirect('/resources');
    return;
  }

  const resourceLayout = resolveResourceLayout(
    request,
    response,
    resourcesLayoutCookieName,
  );
  const scopedResources = listResourcesForProfile({
    folderId,
    includeArchived: false,
    profileId: auth.activeProfile.id,
    type: null,
    userId: auth.user.id,
  });
  const allResources = selectedFolder
    ? scopedResources
    : removeFiledResourcesFromRoot(scopedResources, auth.user.id);
  const selectedFolderItemCount = selectedFolder
    ? listResourceFolderItems(selectedFolder.id, auth.user.id).length
    : 0;
  const folderOptions = listResourcesForProfile({
    includeArchived: false,
    profileId: auth.activeProfile.id,
    type: 'resource_folder',
    userId: auth.user.id,
  }).filter((folder) => folder.id !== selectedFolder?.id);

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
    folderOptions: folderOptions.map(buildResourceListItem),
    resourceItems: allResources.map(buildResourceListItem),
    resourceLayout,
    selectedFolder: selectedFolder ? buildResourceListItem(selectedFolder) : null,
    selectedFolderItemCount,
  });
}

export function handleCreateResourceFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  const title = readField(request.body.title, 160);
  const description = readField(request.body.description, 800);
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

  response.redirect(`/resources/folders/${encodeURIComponent(folder.id)}`);
}

export function handleArchiveResource(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  archiveResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleRestoreResource(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  restoreResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleMoveResourceToFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  addResourceToFolder({
    folderId: readField(request.body.folderId, 100),
    resourceId: readField(request.params.resourceId, 100),
    userId: auth.user.id,
  });
  response.redirect(normalizeReturnTo(request.body.returnTo));
}

export function handleRemoveResourceFromFolder(request: Request, response: Response): void {
  const auth = ensureVerifiedResourceUser(request, response);
  if (!auth) {
    return;
  }

  removeResourceFromFolder({
    folderId: readField(request.params.folderId, 100),
    resourceId: readField(request.params.resourceId, 100),
    userId: auth.user.id,
  });
  response.redirect(normalizeReturnTo(request.body.returnTo));
}
