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

export type ModificationChange = {
  after: string;
  before: string;
  field: string;
};

export type ModificationPreviewOwner = {
  /** Operation name, e.g. 'quiz-metadata'. Namespaces the key. */
  operation: string;
  profileId: string;
  resourceId: string;
  /** Optional sub-target within the resource, e.g. a block id. */
  target?: string;
  userId: string;
};

export type PendingModification<TProposed, TBaseSnapshot> = {
  /** Snapshot of the stored resource when the preview was generated. */
  baseSnapshot: TBaseSnapshot;
  /** Stored resource updatedAt when the preview was generated. */
  baseUpdatedAt: string;
  createdAt: number;
  previewId: string;
  /** The proposed change to apply on approval. */
  proposed: TProposed;
};

const maxAgeMs = 30 * 60 * 1000;
const store = new Map<string, PendingModification<unknown, unknown>>();

function keyOf(owner: ModificationPreviewOwner): string {
  return [
    owner.operation,
    owner.userId,
    owner.profileId,
    owner.resourceId,
    owner.target ?? '',
  ].join(':');
}

function sweepExpired(): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, preview] of store) {
    if (preview.createdAt < cutoff) {
      store.delete(key);
    }
  }
}

export function getPendingModification<TProposed, TBaseSnapshot>(
  owner: ModificationPreviewOwner,
): PendingModification<TProposed, TBaseSnapshot> | undefined {
  sweepExpired();
  return store.get(keyOf(owner)) as
    | PendingModification<TProposed, TBaseSnapshot>
    | undefined;
}

export function setPendingModification<TProposed, TBaseSnapshot>(
  owner: ModificationPreviewOwner,
  preview: PendingModification<TProposed, TBaseSnapshot>,
): void {
  store.set(keyOf(owner), preview as PendingModification<unknown, unknown>);
}

export function deletePendingModification(owner: ModificationPreviewOwner): void {
  store.delete(keyOf(owner));
}

/**
 * Builds the before/after change list for a flat record of string fields,
 * emitting an entry only where the value actually changed. `fields` fixes the
 * order shown to the author.
 */
export function listStringFieldChanges<TRecord extends Record<string, string>>(
  before: TRecord,
  after: TRecord,
  fields: Array<keyof TRecord & string>,
): ModificationChange[] {
  return fields.flatMap((field) =>
    before[field] === after[field]
      ? []
      : [{ after: after[field], before: before[field], field }],
  );
}
