import QRCode from 'qrcode';
import { addResourceToFolder, archiveResourceForUser, createResourceFolder, findResourceAccessForProfile, findResourceById, findResourceForUser, findResourceFolderForResource, findResourceShareLinkById, findProfileForUser, getOrCreateResourceShareLink, grantResourceAccess, listAccessibleResourceFolderPath, listResourceFolderItems, listResourceFoldersForProfile, listResourcesForProfile, removeResourceFromFolder, restoreResourceForUser, updateResourceFolder, } from '../db/repository.js';
import { appDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, normalizeSearchText, } from '../pages/shell.js';
import { logger } from '../services/logger.js';
function ensureVerifiedResourceUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return { activeProfile, user };
}
function readField(value, maxLength = 800) {
    if (Array.isArray(value)) {
        return readField(value[0], maxLength);
    }
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}
function normalizeReturnTo(value) {
    const returnTo = readField(value, 2000);
    return returnTo.startsWith('/') ? returnTo : '/resources';
}
function readResourceTypeFilter(value) {
    const resourceType = readField(value, 40);
    if (resourceType === 'assignment' ||
        resourceType === 'practice_guide' ||
        resourceType === 'resource_folder' ||
        resourceType === 'roleplay') {
        return resourceType;
    }
    return 'all';
}
function readResourceSort(value) {
    const sort = readField(value, 40);
    if (sort === 'title_asc' || sort === 'type') {
        return sort;
    }
    return 'updated_desc';
}
function buildResourceDetailPath(resource) {
    if (resource.type === 'assignment') {
        return `/assignments/${encodeURIComponent(resource.id)}`;
    }
    if (resource.type === 'practice_guide') {
        return `/practice-guides/${encodeURIComponent(resource.id)}`;
    }
    if (resource.type === 'roleplay') {
        return `/roleplays/${encodeURIComponent(resource.id)}`;
    }
    return `/resources/folders/${encodeURIComponent(resource.id)}`;
}
function buildResourceAction(resource) {
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
function toAccessibleOwnerResource(resource) {
    return {
        ...resource,
        accessCreatedAt: null,
        accessKind: 'owner',
        grantId: null,
        grantedVia: null,
        shareLinkId: null,
    };
}
function buildResourceListItem(resource) {
    const meta = {
        assignment: {
            badgeClass: 'text-bg-primary',
            headerClass: 'bg-primary text-white',
            iconClass: 'bi-ui-checks-grid',
            label: 'Tarea',
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
function buildResourceFolderListItem(folder) {
    return {
        ...buildResourceListItem(toAccessibleOwnerResource(folder)),
        parentFolderId: folder.parentFolderId,
    };
}
function removeFiledResourcesFromRoot(resources, folders, userId) {
    const filedResourceIds = new Set(folders.flatMap((folder) => listResourceFolderItems(folder.id, userId).map((item) => item.resourceId)));
    return resources.filter((resource) => !filedResourceIds.has(resource.id));
}
const resourceTypeSortRank = {
    resource_folder: 0,
    assignment: 1,
    practice_guide: 2,
    roleplay: 3,
};
function compareResourceTitles(left, right) {
    return left.title.localeCompare(right.title, 'es', { sensitivity: 'base' });
}
function compareResourceDates(left, right) {
    return (right.updatedAt.localeCompare(left.updatedAt) ||
        right.createdAt.localeCompare(left.createdAt));
}
function compareResourceTypes(left, right) {
    return resourceTypeSortRank[left.type] - resourceTypeSortRank[right.type];
}
function filterAndSortResources(resources, filters) {
    const normalizedQuery = normalizeSearchText(filters.query);
    const filteredResources = resources.filter((resource) => {
        if (filters.type !== 'all' && resource.type !== filters.type) {
            return false;
        }
        if (!normalizedQuery) {
            return true;
        }
        return normalizeSearchText([
            resource.title,
            resource.description,
            resource.topic,
            resource.level,
        ].filter(Boolean).join(' ')).includes(normalizedQuery);
    });
    return filteredResources.sort((left, right) => {
        const folderComparison = compareResourceTypes(left, right);
        if ((left.type === 'resource_folder' || right.type === 'resource_folder') &&
            left.type !== right.type) {
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
function readResourceShareMode(value) {
    const shareMode = readField(value, 20);
    return shareMode === 'link' || shareMode === 'profile' ? shareMode : '';
}
function buildResourceLogDetails(input) {
    return {
        ownerProfileId: input.resource.profileId,
        ownerUserId: input.resource.userId,
        profileId: input.profileId ?? null,
        resourceId: input.resource.id,
        resourceType: input.resource.type,
        userId: input.userId,
    };
}
export async function renderResourcesListPage(request, response) {
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
        ? (request.availableProfiles ?? []).filter((profile) => profile.id !== selectedFolder.profileId)
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
            hasActiveFilters: Boolean(filters.query) ||
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
export function renderSharedResourcePage(request, response) {
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
        returnTo: `/resources/shared/${encodeURIComponent(shareLink.id)}`,
        shareLink,
        sharedResource: buildResourceListItem(toAccessibleOwnerResource(resource)),
    });
}
export function handleAcceptSharedResourceLink(request, response) {
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
export function handleShareResourceToProfile(request, response) {
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
export function handleCreateResourceFolder(request, response) {
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
export function handleUpdateResourceFolder(request, response) {
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
export function handleArchiveResource(request, response) {
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
export function handleRestoreResource(request, response) {
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
export function handleMoveResourceToFolder(request, response) {
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
export function handleRemoveResourceFromFolder(request, response) {
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
//# sourceMappingURL=handlers.js.map