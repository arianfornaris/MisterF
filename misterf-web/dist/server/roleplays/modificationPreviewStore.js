const maxAgeMs = 30 * 60 * 1000;
const store = new Map();
function keyOf(owner) {
    return `${owner.userId}:${owner.profileId}:${owner.roleplayId}`;
}
function sweepExpired() {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, preview] of store) {
        if (preview.createdAt < cutoff) {
            store.delete(key);
        }
    }
}
export function getPendingRoleplayModification(owner) {
    sweepExpired();
    return store.get(keyOf(owner));
}
export function setPendingRoleplayModification(owner, preview) {
    store.set(keyOf(owner), preview);
}
export function deletePendingRoleplayModification(owner) {
    store.delete(keyOf(owner));
}
export function listRoleplayModificationChanges(before, after) {
    const changes = [];
    const add = (field, beforeValue, afterValue) => {
        if (beforeValue !== afterValue) {
            changes.push({ after: afterValue, before: beforeValue, field });
        }
    };
    const beforeLearner = before.characters.find((character) => character.id === 'learner');
    const afterLearner = after.characters.find((character) => character.id === 'learner');
    const beforeAi = before.characters.find((character) => character.id === 'ai');
    const afterAi = after.characters.find((character) => character.id === 'ai');
    add('title', before.title, after.title);
    add('description', before.description, after.description);
    add('level', before.level, after.level);
    add('learner.name', beforeLearner?.name ?? '', afterLearner?.name ?? '');
    add('learner.description', beforeLearner?.description ?? '', afterLearner?.description ?? '');
    add('learner.avatarId', beforeLearner?.avatarId ?? '', afterLearner?.avatarId ?? '');
    add('ai.name', beforeAi?.name ?? '', afterAi?.name ?? '');
    add('ai.description', beforeAi?.description ?? '', afterAi?.description ?? '');
    add('ai.avatarId', beforeAi?.avatarId ?? '', afterAi?.avatarId ?? '');
    return changes;
}
//# sourceMappingURL=modificationPreviewStore.js.map