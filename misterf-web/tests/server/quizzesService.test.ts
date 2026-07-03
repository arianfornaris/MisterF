import { describe, expect, it } from 'vitest';
import {
  buildQuizBlockSectionList,
  buildQuizEvaluationSections,
  quizDraftToQuizBlock,
  quizDraftToStudentQuizBlock,
  buildQuizResultBlock,
  canonicalizeQuizDraftBlockOrder,
  moveQuizBlock,
  normalizeQuizResponses,
  parseQuizDraft,
  safeParseQuizDraft,
} from '../../src/server/services/quizzes.js';
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

describe('quiz service', () => {
  it('accepts valid quiz drafts and rejects duplicate block ids', () => {
    expect(parseQuizDraft(validDraft).blocks).toHaveLength(2);
    expect(quizDraftToQuizBlock(parseQuizDraft(validDraft)).items).toHaveLength(2);
    expect(Object.hasOwn(parseQuizDraft({
      ...validDraft,
      estimatedMinutes: 5,
      rubric: 'Legacy task-level rubric.',
    }), 'estimatedMinutes')).toBe(false);
    expect(Object.hasOwn(parseQuizDraft({
      ...validDraft,
      rubric: 'Legacy task-level rubric.',
    }), 'rubric')).toBe(false);
    expect(Object.hasOwn(parseQuizDraft(validDraft).blocks[0]?.item ?? {}, 'rubric')).toBe(false);

    expect(safeParseQuizDraft({
      ...validDraft,
      blocks: [
        validDraft.blocks[0],
        validDraft.blocks[0],
      ],
    })).toBeNull();
  });

  it('preserves stable ids while moving blocks', () => {
    const draft = parseQuizDraft(validDraft);
    const moved = moveQuizBlock(draft, 'choice', 'up');
    expect(moved.blocks.map((block) => block.id)).toEqual(['choice', 'open_text']);
  });

  it('normalizes submitted form responses for supported quiz item kinds', () => {
    const draft = parseQuizDraft({
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

    expect(normalizeQuizResponses({
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

  it('accepts drafts with more than 24 blocks', () => {
    const draft = parseQuizDraft({
      ...validDraft,
      blocks: Array.from({ length: 30 }, (_value, index) => ({
        id: `open_text_${index + 1}`,
        item: {
          kind: 'quiz_open_text',
          prompt: `Write sentence ${index + 1}.`,
        },
      })),
    });

    expect(draft.blocks).toHaveLength(30);
    expect(quizDraftToQuizBlock(draft).items).toHaveLength(30);
  });

  it('validates section metadata against blocks', () => {
    const sectionedDraft = {
      ...validDraft,
      blocks: [
        { ...validDraft.blocks[0], sectionId: 'section_a' },
        validDraft.blocks[1],
      ],
      sections: [
        { id: 'section_a', instructions: 'Completa las oraciones.', title: 'Parte A' },
      ],
    };

    const parsed = parseQuizDraft(sectionedDraft);
    expect(parsed.sections).toHaveLength(1);
    expect(buildQuizBlockSectionList(parsed).map((section) => section?.id ?? null)).toEqual([
      'section_a',
      null,
    ]);
    expect(buildQuizEvaluationSections(parsed)).toEqual([
      {
        instructions: 'Completa las oraciones.',
        itemIndexes: [0],
        title: 'Parte A',
      },
    ]);

    // Dangling sectionId is rejected so the AI correction loop can fix it.
    expect(safeParseQuizDraft({
      ...sectionedDraft,
      sections: [],
    })).toBeNull();

    // Duplicate section ids are rejected.
    expect(safeParseQuizDraft({
      ...sectionedDraft,
      sections: [
        { id: 'section_a', instructions: 'Una.' },
        { id: 'section_a', instructions: 'Otra.' },
      ],
    })).toBeNull();

    // Drafts saved before sections existed still parse.
    expect(parseQuizDraft(validDraft).sections).toEqual([]);
  });

  it('groups blocks by section order when canonicalizing', () => {
    const draft = parseQuizDraft({
      ...validDraft,
      blocks: [
        { id: 'b_one', item: { kind: 'quiz_open_text', prompt: 'One.' }, sectionId: 'section_b' },
        { id: 'b_two', item: { kind: 'quiz_open_text', prompt: 'Two.' } },
        { id: 'b_three', item: { kind: 'quiz_open_text', prompt: 'Three.' }, sectionId: 'section_a' },
        { id: 'b_four', item: { kind: 'quiz_open_text', prompt: 'Four.' }, sectionId: 'section_b' },
      ],
      sections: [
        { id: 'section_a', instructions: 'Parte A.' },
        { id: 'section_b', instructions: 'Parte B.' },
      ],
    });

    expect(canonicalizeQuizDraftBlockOrder(draft).blocks.map((block) => block.id)).toEqual([
      'b_two',
      'b_three',
      'b_one',
      'b_four',
    ]);
  });

  it('moves blocks across section boundaries by switching membership', () => {
    const withSection = parseQuizDraft({
      ...validDraft,
      blocks: [
        validDraft.blocks[0],
        { ...validDraft.blocks[1], sectionId: 'section_a' },
      ],
      sections: [
        { id: 'section_a', instructions: 'Elige la forma correcta.', title: 'Parte A' },
      ],
    });

    // Moving up across the section boundary leaves the section instead of swapping.
    const movedOut = moveQuizBlock(withSection, 'choice', 'up');
    expect(movedOut.blocks.map((block) => [block.id, block.sectionId ?? null])).toEqual([
      ['open_text', null],
      ['choice', null],
    ]);

    // Moving down across the boundary joins the neighbor's section.
    const movedIn = moveQuizBlock(withSection, 'open_text', 'down');
    expect(movedIn.blocks[0]?.sectionId).toBe('section_a');
  });

  it('attaches section context to the student quiz block', () => {
    const draft = parseQuizDraft({
      ...validDraft,
      blocks: [
        validDraft.blocks[0],
        { ...validDraft.blocks[1], sectionId: 'section_a' },
      ],
      sections: [
        { id: 'section_a', instructions: 'Elige la forma correcta.', title: 'Parte A' },
      ],
    });

    const studentBlock = quizDraftToStudentQuizBlock(draft);
    expect(studentBlock.items[0]?.section).toBeUndefined();
    expect(studentBlock.items[1]?.section).toEqual({
      id: 'section_a',
      instructions: 'Elige la forma correcta.',
      title: 'Parte A',
    });
  });

  it('keeps inline review outside the strict quiz result evaluation object', () => {
    const draft = parseQuizDraft(validDraft);
    const result = buildQuizResultBlock({
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
