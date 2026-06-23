import { describe, expect, it } from 'vitest';
import {
  appendAssignmentBlock,
  assignmentDraftToQuizBlock,
  buildAssignmentResultBlock,
  moveAssignmentBlock,
  normalizeAssignmentResponses,
  parseAssignmentDraft,
  safeParseAssignmentDraft,
} from '../../src/server/services/assignments.js';
import { quizResultBlockSchema } from '../../src/server/services/llmTutor/schemas.js';

const validDraft = {
  blocks: [
    {
      id: 'open_text',
      item: {
        kind: 'quiz_open_text',
        prompt: 'Write one sentence.',
        rubric: 'Accept a clear sentence.',
      },
    },
    {
      id: 'choice',
      item: {
        correctOptions: ['has lived'],
        kind: 'quiz_multiple_choice',
        options: ['lived', 'has lived'],
        prompt: 'Choose the correct form.',
        selectionMode: 'single',
      },
    },
  ],
  description: 'Short diagnostic.',
  instructions: 'Evaluate clearly.',
  level: 'B1',
  targetTopic: 'Present perfect',
  title: 'Present Perfect Diagnostic',
};

describe('assignment service', () => {
  it('accepts valid assignment drafts and rejects duplicate block ids', () => {
    expect(parseAssignmentDraft(validDraft).blocks).toHaveLength(2);
    expect(assignmentDraftToQuizBlock(parseAssignmentDraft(validDraft)).items).toHaveLength(2);
    expect(Object.hasOwn(parseAssignmentDraft({
      ...validDraft,
      estimatedMinutes: 5,
      rubric: 'Legacy task-level rubric.',
    }), 'estimatedMinutes')).toBe(false);
    expect(Object.hasOwn(parseAssignmentDraft({
      ...validDraft,
      rubric: 'Legacy task-level rubric.',
    }), 'rubric')).toBe(false);
    expect(Object.hasOwn(parseAssignmentDraft(validDraft).blocks[0]?.item ?? {}, 'rubric')).toBe(false);

    expect(safeParseAssignmentDraft({
      ...validDraft,
      blocks: [
        validDraft.blocks[0],
        validDraft.blocks[0],
      ],
    })).toBeNull();
  });

  it('preserves stable ids while moving and appending blocks', () => {
    const draft = parseAssignmentDraft(validDraft);
    const moved = moveAssignmentBlock(draft, 'choice', 'up');
    expect(moved.blocks.map((block) => block.id)).toEqual(['choice', 'open_text']);

    const appended = appendAssignmentBlock(moved, {
      id: 'choice',
      item: {
        kind: 'quiz_open_text',
        prompt: 'Write another sentence.',
      },
    });
    expect(appended.blocks.map((block) => block.id)).toEqual([
      'choice',
      'open_text',
      'choice_2',
    ]);
  });

  it('normalizes submitted form responses for supported quiz item kinds', () => {
    const draft = parseAssignmentDraft({
      ...validDraft,
      blocks: [
        ...validDraft.blocks,
        {
          id: 'blank',
          item: {
            blanks: [{ acceptableAnswers: ['eat'] }],
            kind: 'quiz_fill_in_the_blank_input',
            prompt: 'Fill the blank.',
            sentence: 'I ___ breakfast.',
          },
        },
      ],
    });

    expect(normalizeAssignmentResponses({
      body: {
        response_0_text: ' She has lived here. ',
        response_1_selectedOptions: 'has lived',
        response_2_blank_0: ' eat ',
      },
      draft,
    })).toEqual([
      { text: 'She has lived here.' },
      { selectedOptions: ['has lived'] },
      {
        completedSentence: 'I eat breakfast.',
        values: ['eat'],
      },
    ]);
  });

  it('keeps inline review outside the strict quiz result evaluation object', () => {
    const draft = parseAssignmentDraft(validDraft);
    const result = buildAssignmentResultBlock({
      draft,
      evaluations: [
        {
          feedback: 'La frase comunica bien la idea.',
          inlineReview: {
            parts: [
              {
                text: 'She has lived here.',
                status: 'correct',
              },
            ],
          },
          status: 'correct',
        },
        {
          feedback: 'Elegiste la forma correcta.',
          inlineReview: {
            options: [
              {
                selectedByUser: false,
                status: 'neutral',
                text: 'lived',
              },
              {
                selectedByUser: true,
                status: 'correct',
                text: 'has lived',
              },
            ],
          },
          status: 'correct',
        },
      ],
      responses: [
        { text: 'She has lived here.' },
        { selectedOptions: ['has lived'] },
      ],
    });

    expect(quizResultBlockSchema.parse(result)).toEqual(result);
    expect(result.items[0].evaluation).not.toHaveProperty('inlineReview');
    expect(result.items[0].inlineReview).toBeDefined();
  });
});
