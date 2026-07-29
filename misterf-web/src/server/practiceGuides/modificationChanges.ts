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
