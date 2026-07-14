import type { SceneMediaPendingPreview } from './types.js';

// In-memory store for the not-yet-applied layer preview shown in the change
// modal. The preview lifecycle is bounded by the modal (generate -> approve or
// discard), so holding it in process memory keeps the flow simple and avoids a
// schema migration. A restart between generate and apply drops the pending
// entry (the author just regenerates) and may leak its temporary storage
// object, which is acceptable for this bounded, best-effort feature.

export type SceneMediaPreviewOwnerKey = {
  mediaId: string;
  ownerProfileId: string;
  ownerUserId: string;
};

const maxAgeMs = 30 * 60 * 1000;
const store = new Map<string, SceneMediaPendingPreview>();

function keyOf(owner: SceneMediaPreviewOwnerKey): string {
  return `${owner.ownerUserId}:${owner.ownerProfileId}:${owner.mediaId}`;
}

function sweepExpired(): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, preview] of store) {
    if (preview.createdAt < cutoff) {
      store.delete(key);
    }
  }
}

export function getPendingPreview(
  owner: SceneMediaPreviewOwnerKey,
): SceneMediaPendingPreview | undefined {
  sweepExpired();
  return store.get(keyOf(owner));
}

export function setPendingPreview(
  owner: SceneMediaPreviewOwnerKey,
  preview: SceneMediaPendingPreview,
): void {
  store.set(keyOf(owner), preview);
}

export function deletePendingPreview(owner: SceneMediaPreviewOwnerKey): void {
  store.delete(keyOf(owner));
}
