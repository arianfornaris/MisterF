/**
 * Where a resource lives. Shared by the resource catalog and the signed-in home
 * so both link to the same place from one definition.
 */
export function buildResourceDetailPath(resource) {
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
/**
 * The owner's view of who practiced a shared resource. Folders have no
 * participation of their own, so they fall back to the folder page.
 */
export function buildResourceParticipationPath(resource) {
    if (resource.type === 'resource_folder') {
        return buildResourceDetailPath(resource);
    }
    return `${buildResourceDetailPath(resource)}/participation`;
}
//# sourceMappingURL=paths.js.map