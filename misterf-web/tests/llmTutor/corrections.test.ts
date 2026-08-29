import { describe, expect, it } from 'vitest';
import { buildStructuredCorrectionReason } from '../../src/server/services/llmTutor/corrections.js';
import { TutorResponseValidationError } from '../../src/server/services/llmTutor/errors.js';

describe('structured correction reason', () => {
  it('names the offending paths so a schema failure is correctable', () => {
    const reason = buildStructuredCorrectionReason(
      new TutorResponseValidationError({
        issues: [
          {
            code: 'custom',
            message: 'step id must start with a lowercase letter.',
            path: ['blocks', 2, 'steps', 0, 'id'],
          },
        ],
      }),
    );

    expect(reason).toContain('does not satisfy the TutorResponse contract');
    expect(reason).toContain('path=blocks.2.steps.0.id');
    expect(reason).toContain('step id must start with a lowercase letter.');
  });

  it('keeps the generic wording for a failure that is not a schema violation', () => {
    const reason = buildStructuredCorrectionReason(new Error('Unexpected token }'));

    expect(reason).toBe(
      'Your previous response was not valid JSON or could not be converted into a TutorResponse object.',
    );
  });
});
