import type { PracticeGuideDraft } from '../services/resourceDrafts.js';

export type PracticeGuideModificationField =
  | 'description'
  | 'title'
  | 'tutorInstructions';

export type PracticeGuideModificationChange = {
  after: string;
  before: string;
  field: PracticeGuideModificationField;
};

export type PracticeGuideModificationPreviewOwner = {
  practiceGuideId: string;
  profileId: string;
  userId: string;
};

export type PendingPracticeGuideModification = {
  baseStoredDraft: PracticeGuideDraft;
  baseUpdatedAt: string;
  createdAt: number;
  draft: PracticeGuideDraft;
  previewId: string;
};

const maxAgeMs = 30 * 60 * 1000;
const store = new Map<string, PendingPracticeGuideModification>();

function keyOf(owner: PracticeGuideModificationPreviewOwner): string {
  return `${owner.userId}:${owner.profileId}:${owner.practiceGuideId}`;
}

function sweepExpired(): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, preview] of store) {
    if (preview.createdAt < cutoff) {
      store.delete(key);
    }
  }
}

export function getPendingPracticeGuideModification(
  owner: PracticeGuideModificationPreviewOwner,
): PendingPracticeGuideModification | undefined {
  sweepExpired();
  return store.get(keyOf(owner));
}

export function setPendingPracticeGuideModification(
  owner: PracticeGuideModificationPreviewOwner,
  preview: PendingPracticeGuideModification,
): void {
  store.set(keyOf(owner), preview);
}

export function deletePendingPracticeGuideModification(
  owner: PracticeGuideModificationPreviewOwner,
): void {
  store.delete(keyOf(owner));
}

export function listPracticeGuideModificationChanges(
  before: PracticeGuideDraft,
  after: PracticeGuideDraft,
): PracticeGuideModificationChange[] {
  const fields: PracticeGuideModificationField[] = [
    'title',
    'description',
    'tutorInstructions',
  ];

  return fields.flatMap((field) => (
    before[field] === after[field]
      ? []
      : [{ after: after[field], before: before[field], field }]
  ));
}
