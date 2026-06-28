import { addResourceToFolder, archiveResourceForUser, createResourceFolder, findResourceForUser, findResourceFolderForResource, listResourceFolderItems, listResourceFolderPath, listResourceFoldersForProfile, listResourcesForProfile, removeResourceFromFolder, restoreResourceForUser, updateResourceFolder, } from '../db/repository.js';
import { appDocumentTitle, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, normalizeSearchText, } from '../pages/shell.js';
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
        resourceType === 'resource_folder') {
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
        return `/practice-modules/${encodeURIComponent(resource.id)}`;
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
            actionPath: `/practice-modules/${encodeURIComponent(resource.id)}/chats`,
        };
    }
    return {
        actionLabel: 'Abrir',
        actionMethod: 'get',
        actionPath: `/resources/folders/${encodeURIComponent(resource.id)}`,
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
    };
}
function buildResourceFolderListItem(folder) {
    return {
        ...buildResourceListItem(folder),
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
export function renderResourcesListPage(request, response) {
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
    const folderOptions = listResourceFoldersForProfile({
        includeArchived: false,
        profileId: auth.activeProfile.id,
        userId: auth.user.id,
    });
    const selectedFolderPath = selectedFolder
        ? listResourceFolderPath(selectedFolder.id, auth.user.id)
        : [];
    const selectedFolderParent = selectedFolder
        ? findResourceFolderForResource(selectedFolder.id, auth.user.id)
        : null;
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
        selectedFolderParent: selectedFolderParent ? buildResourceListItem(selectedFolderParent) : null,
        selectedFolder: selectedFolder ? buildResourceListItem(selectedFolder) : null,
    });
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
    response.redirect(returnTo);
}
export function handleArchiveResource(request, response) {
    const auth = ensureVerifiedResourceUser(request, response);
    if (!auth) {
        return;
    }
    archiveResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
    response.redirect(normalizeReturnTo(request.body.returnTo));
}
export function handleRestoreResource(request, response) {
    const auth = ensureVerifiedResourceUser(request, response);
    if (!auth) {
        return;
    }
    restoreResourceForUser(readField(request.params.resourceId, 100), auth.user.id);
    response.redirect(normalizeReturnTo(request.body.returnTo));
}
export function handleMoveResourceToFolder(request, response) {
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
export function handleRemoveResourceFromFolder(request, response) {
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
//# sourceMappingURL=handlers.js.map