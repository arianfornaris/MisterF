const maxAgeMs = 30 * 60 * 1000;
const store = new Map();
function keyOf(owner) {
    return `${owner.ownerUserId}:${owner.ownerProfileId}:${owner.mediaId}`;
}
function sweepExpired() {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, preview] of store) {
        if (preview.createdAt < cutoff) {
            store.delete(key);
        }
    }
}
export function getPendingPreview(owner) {
    sweepExpired();
    return store.get(keyOf(owner));
}
export function setPendingPreview(owner, preview) {
    store.set(keyOf(owner), preview);
}
export function deletePendingPreview(owner) {
    store.delete(keyOf(owner));
}
//# sourceMappingURL=sceneMediaPreviewStore.js.map