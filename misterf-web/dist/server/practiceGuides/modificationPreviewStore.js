const maxAgeMs = 30 * 60 * 1000;
const store = new Map();
function keyOf(owner) {
    return `${owner.userId}:${owner.profileId}:${owner.practiceGuideId}`;
}
function sweepExpired() {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, preview] of store) {
        if (preview.createdAt < cutoff) {
            store.delete(key);
        }
    }
}
export function getPendingPracticeGuideModification(owner) {
    sweepExpired();
    return store.get(keyOf(owner));
}
export function setPendingPracticeGuideModification(owner, preview) {
    store.set(keyOf(owner), preview);
}
export function deletePendingPracticeGuideModification(owner) {
    store.delete(keyOf(owner));
}
export function listPracticeGuideModificationChanges(before, after) {
    const fields = [
        'title',
        'description',
        'tutorInstructions',
    ];
    return fields.flatMap((field) => (before[field] === after[field]
        ? []
        : [{ after: after[field], before: before[field], field }]));
}
//# sourceMappingURL=modificationPreviewStore.js.map