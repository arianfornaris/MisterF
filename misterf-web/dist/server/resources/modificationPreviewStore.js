/**
 * Shared bounded store for AI "modify with approval" previews across resource
 * authoring flows (quiz metadata, and later quiz blocks, roleplays, and
 * practice guides).
 *
 * A preview holds a complete proposed change server-side, keyed to the owner
 * plus the operation and an optional target (for example a specific block id).
 * The browser only ever receives an opaque preview id and the list of changed
 * fields; it never posts back a replacement draft. Apply verifies the base
 * snapshot still matches the stored resource so a concurrent edit cannot be
 * silently overwritten.
 *
 * The store is in-memory and best-effort: entries expire, and a process
 * restart drops pending previews (the author simply regenerates).
 */
const maxAgeMs = 30 * 60 * 1000;
const store = new Map();
function keyOf(owner) {
    return [
        owner.operation,
        owner.userId,
        owner.profileId,
        owner.resourceId,
        owner.target ?? '',
    ].join(':');
}
function sweepExpired() {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, preview] of store) {
        if (preview.createdAt < cutoff) {
            store.delete(key);
        }
    }
}
export function getPendingModification(owner) {
    sweepExpired();
    return store.get(keyOf(owner));
}
export function setPendingModification(owner, preview) {
    store.set(keyOf(owner), preview);
}
export function deletePendingModification(owner) {
    store.delete(keyOf(owner));
}
/**
 * Builds the before/after change list for a flat record of string fields,
 * emitting an entry only where the value actually changed. `fields` fixes the
 * order shown to the author.
 */
export function listStringFieldChanges(before, after, fields) {
    return fields.flatMap((field) => before[field] === after[field]
        ? []
        : [{ after: after[field], before: before[field], field }]);
}
//# sourceMappingURL=modificationPreviewStore.js.map