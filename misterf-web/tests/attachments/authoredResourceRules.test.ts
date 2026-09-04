import { describe, expect, it } from 'vitest';

import { withAuthoredResourceAttachmentRules } from '../../src/server/attachments/modelParts.js';
import type { AttachmentDigest } from '../../src/server/attachments/types.js';

/**
 * A generated resource is opened by a learner who never saw the material it was
 * built from. Descriptions like "practice based on the attached document" are a
 * dangling reference, so the authoring prompts have to forbid provenance.
 */

const digest: AttachmentDigest = {
  contentType: 'application/pdf',
  displayName: 'worksheet.pdf',
  id: 'attachment-1',
  sourceType: 'pdf',
  text: 'Exercise 1. She ___ (go) to school.',
  textIsDescription: true,
  truncated: false,
};

describe('withAuthoredResourceAttachmentRules', () => {
  it('leaves a prompt-only generation byte-identical', () => {
    expect(withAuthoredResourceAttachmentRules('base prompt', [])).toBe(
      'base prompt',
    );
  });

  it('forbids referring to the source when material is attached', () => {
    const system = withAuthoredResourceAttachmentRules('base prompt', [digest]);

    expect(system.startsWith('base prompt')).toBe(true);
    expect(system).toContain('Never refer to the source');
    expect(system).toContain('standalone artifact');
  });

  it('covers every emitted field, not just the description', () => {
    const system = withAuthoredResourceAttachmentRules('base', [digest]);

    for (const field of ['titles', 'descriptions', 'instructions', 'questions']) {
      expect(system).toContain(field);
    }
  });
});
