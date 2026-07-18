import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  danglingSectionQuizDraft,
  duplicateBlockIdsQuizDraft,
  invalidQuizEvaluation,
  markdownFencedDraftText,
  proseWrappedDraftText,
  quizItemKinds,
  smallQuizDraft,
  unknownKindQuizDraft,
  validQuizDraft,
  validQuizEvaluation,
} from './fixtures/quizAuthoringFixtures.js';

const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: generateTextMock,
  };
});

import {
  generatePracticeGuideDraft,
  generatePracticeGuideRevision,
  generateQuizBlockRevision,
  generateQuizBlocksRevision,
  generateQuizDraft,
  generateQuizMetadataRevision,
} from '../../src/server/services/resourceDrafts.js';
import { evaluateQuizResultItemsWithLlm } from '../../src/server/services/llmTutor/index.js';
import {
  parseQuizDraft,
  quizDraftSchema,
  quizDraftToQuizBlock,
} from '../../src/server/services/quizzes.js';
import { quizAuthoringPlaceholders } from '../../src/server/services/llmTutor/languagePack.js';
import {
  loadSystemPrompt,
  renderSystemPrompt,
} from '../../src/server/services/systemPrompts.js';

const testApiKey = 'test-openrouter-key';

function modelResult(text: string, finishReason = 'stop') {
  return {
    finishReason,
    providerMetadata: undefined,
    text,
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
  };
}

function enqueueModelTexts(...texts: string[]): void {
  for (const text of texts) {
    generateTextMock.mockResolvedValueOnce(modelResult(text));
  }
}

type CapturedMessage = { content: string; role: string };

function capturedMessages(callIndex: number): CapturedMessage[] {
  const call = generateTextMock.mock.calls[callIndex] as [
    { messages: CapturedMessage[] },
  ];
  return call[0].messages;
}

beforeEach(() => {
  generateTextMock.mockReset();
});

describe('quiz draft generation contract', () => {
  it('parses a representative valid draft covering every item kind', async () => {
    enqueueModelTexts(JSON.stringify(validQuizDraft));

    const draft = await generateQuizDraft({
      openRouterApiKey: testApiKey,
      prompt: 'Un quiz de rutinas diarias, nivel A2.',
    });

    expect(draft.title).toBe('Daily Routines Quiz');
    expect(draft.blocks.map((block) => block.item.kind)).toEqual([
      ...quizItemKinds,
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it('accepts markdown-fenced output without burning a correction turn', async () => {
    enqueueModelTexts(markdownFencedDraftText);

    const draft = await generateQuizDraft({
      openRouterApiKey: testApiKey,
      prompt: 'Un quiz de rutinas diarias.',
    });

    expect(draft.blocks).toHaveLength(9);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it('recovers from prose-wrapped output through one correction turn', async () => {
    enqueueModelTexts(proseWrappedDraftText, JSON.stringify(validQuizDraft));

    const draft = await generateQuizDraft({
      openRouterApiKey: testApiKey,
      prompt: 'Un quiz de rutinas diarias.',
    });

    expect(draft.title).toBe('Daily Routines Quiz');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it('recovers from an unknown item kind through one correction turn', async () => {
    enqueueModelTexts(
      JSON.stringify(unknownKindQuizDraft),
      JSON.stringify(validQuizDraft),
    );

    const draft = await generateQuizDraft({
      openRouterApiKey: testApiKey,
      prompt: 'Un quiz de rutinas diarias.',
    });

    expect(draft.blocks).toHaveLength(9);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(capturedMessages(1).at(-1)?.content).toContain(
      'Your previous JSON did not match the required schema.',
    );
  });

  it('gives up cleanly after exhausting correction turns on invalid JSON', async () => {
    enqueueModelTexts(
      proseWrappedDraftText,
      proseWrappedDraftText,
      proseWrappedDraftText,
      proseWrappedDraftText,
    );

    await expect(
      generateQuizDraft({
        openRouterApiKey: testApiKey,
        prompt: 'Un quiz de rutinas diarias.',
      }),
    ).rejects.toThrow('La IA devolvió un borrador inválido.');
    expect(generateTextMock).toHaveBeenCalledTimes(4);
  });

  it('gives up cleanly after exhausting correction turns on schema drift', async () => {
    enqueueModelTexts(
      JSON.stringify(unknownKindQuizDraft),
      JSON.stringify(unknownKindQuizDraft),
      JSON.stringify(unknownKindQuizDraft),
      JSON.stringify(unknownKindQuizDraft),
    );

    await expect(
      generateQuizDraft({
        openRouterApiKey: testApiKey,
        prompt: 'Un quiz de rutinas diarias.',
      }),
    ).rejects.toThrow('La IA devolvió un borrador incompleto.');
    expect(generateTextMock).toHaveBeenCalledTimes(4);
  });

  it('rejects duplicate block ids and dangling section references', () => {
    const duplicate = quizDraftSchema.safeParse(duplicateBlockIdsQuizDraft);
    expect(duplicate.success).toBe(false);

    const dangling = quizDraftSchema.safeParse(danglingSectionQuizDraft);
    expect(dangling.success).toBe(false);
  });

  it('strips unsupported estimatedMinutes and rubric fields before validating', () => {
    const withUnsupported = {
      ...validQuizDraft,
      estimatedMinutes: 15,
      rubric: 'Grade generously.',
    };

    const parsed = quizDraftSchema.safeParse(withUnsupported);
    expect(parsed.success).toBe(true);
  });
});

describe('quiz metadata modification contract', () => {
  const currentMetadata = {
    description: 'A quiz about daily routines.',
    evaluationInstructions: 'Grade generously.',
    instructions: 'Answer every question.',
    level: 'A2',
    targetTopic: 'daily routines',
    title: 'Daily Routines Quiz',
  };

  it('parses a metadata-only revision without touching blocks', async () => {
    enqueueModelTexts(
      JSON.stringify({ metadata: { ...currentMetadata, level: 'B1' } }),
    );

    const revision = await generateQuizMetadataRevision({
      currentMetadata,
      openRouterApiKey: testApiKey,
      prompt: 'Súbelo a nivel B1.',
    });

    expect(revision.metadata.level).toBe('B1');
    expect(revision.metadata).not.toHaveProperty('blocks');
    const payload = JSON.parse(capturedMessages(0)[0].content) as Record<string, unknown>;
    expect(payload).toEqual({
      currentMetadata,
      requestedChange: 'Súbelo a nivel B1.',
    });
  });
});

describe('quiz block modification contract', () => {
  const quizContext = {
    instructions: 'Answer every question.',
    level: 'A2',
    siblingKinds: ['quiz_open_text'],
    targetTopic: 'daily routines',
    title: 'Daily Routines Quiz',
  };
  const currentItem = {
    kind: 'quiz_multiple_choice' as const,
    prompt: 'Pick the correct sentence.',
    selectionMode: 'single' as const,
    options: ['She goes to school.', 'She go to school.'],
    correctOptions: ['She goes to school.'],
  };

  it('parses a single revised item that keeps the requested kind', async () => {
    enqueueModelTexts(
      JSON.stringify({
        item: {
          ...currentItem,
          options: ['She goes to school.', 'She go to school.', 'She going to school.'],
        },
      }),
    );

    const revision = await generateQuizBlockRevision({
      currentItem,
      level: 'A2',
      openRouterApiKey: testApiKey,
      prompt: 'Agrega un distractor.',
      quizContext,
      targetKind: 'quiz_multiple_choice',
    });

    expect(revision.item.kind).toBe('quiz_multiple_choice');
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it('rejects and recovers when the item kind does not match the requested kind', async () => {
    enqueueModelTexts(
      JSON.stringify({ item: currentItem }),
      JSON.stringify({
        item: {
          kind: 'quiz_open_text',
          prompt: 'Describe your morning.',
          placeholder: 'Write here…',
        },
      }),
    );

    const revision = await generateQuizBlockRevision({
      currentItem,
      level: 'A2',
      openRouterApiKey: testApiKey,
      prompt: 'Conviértelo en respuesta abierta.',
      quizContext,
      targetKind: 'quiz_open_text',
    });

    expect(revision.item.kind).toBe('quiz_open_text');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it('creates a new item when no current item is provided', async () => {
    enqueueModelTexts(
      JSON.stringify({
        item: {
          kind: 'quiz_open_text',
          prompt: 'Write about your weekend.',
          placeholder: 'Write here…',
        },
      }),
    );

    const revision = await generateQuizBlockRevision({
      level: 'A2',
      openRouterApiKey: testApiKey,
      prompt: 'Una pregunta abierta sobre el fin de semana.',
      quizContext,
      targetKind: 'quiz_open_text',
    });

    expect(revision.item.kind).toBe('quiz_open_text');
    const payload = JSON.parse(capturedMessages(0)[0].content) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('currentItem');
  });
});

describe('quiz blocks modification contract', () => {
  const currentDraft = parseQuizDraft(validQuizDraft);
  const currentMetadata = {
    description: currentDraft.description,
    evaluationInstructions: currentDraft.evaluationInstructions,
    instructions: currentDraft.instructions,
    level: currentDraft.level,
    targetTopic: currentDraft.targetTopic,
    title: currentDraft.title,
  };

  it('parses a blocks-and-sections revision and returns only those parts', async () => {
    enqueueModelTexts(
      JSON.stringify({ blocks: validQuizDraft.blocks, sections: validQuizDraft.sections ?? [] }),
    );

    const revision = await generateQuizBlocksRevision({
      currentDraft,
      currentMetadata,
      openRouterApiKey: testApiKey,
      prompt: 'Reordena los bloques.',
    });

    expect(revision.blocks).toHaveLength(9);
    expect(revision).not.toHaveProperty('title');
    const payload = JSON.parse(capturedMessages(0)[0].content) as Record<string, unknown>;
    expect(payload).toHaveProperty('metadataContext');
    expect(payload).not.toHaveProperty('metadata');
  });

  it('recovers when the proposed blocks violate cross-block constraints', async () => {
    enqueueModelTexts(
      JSON.stringify({
        blocks: duplicateBlockIdsQuizDraft.blocks,
        sections: duplicateBlockIdsQuizDraft.sections ?? [],
      }),
      JSON.stringify({ blocks: validQuizDraft.blocks, sections: validQuizDraft.sections ?? [] }),
    );

    const revision = await generateQuizBlocksRevision({
      currentDraft,
      currentMetadata,
      openRouterApiKey: testApiKey,
      prompt: 'Cambia el primer bloque.',
    });

    expect(revision.blocks).toHaveLength(9);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });
});

describe('practice guide draft generation contract', () => {
  it('uses the model output budget and retries truncation without echoing partial JSON', async () => {
    const validDraft = {
      description: 'Focused practice with everyday color vocabulary.',
      title: 'Everyday Colors',
      tutorInstructions: 'Guide one short color exercise at a time.',
    };
    generateTextMock
      .mockResolvedValueOnce(modelResult('{"title":"truncated', 'length'))
      .mockResolvedValueOnce(modelResult(JSON.stringify(validDraft)));

    const draft = await generatePracticeGuideDraft({
      openRouterApiKey: testApiKey,
      prompt: 'Crea una guía de práctica sobre los colores.',
    });

    expect(draft).toEqual(validDraft);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[0]?.[0]).not.toHaveProperty('maxOutputTokens');
    expect(capturedMessages(1)).not.toContainEqual(
      expect.objectContaining({
        content: '{"title":"truncated',
        role: 'assistant',
      }),
    );
    expect(capturedMessages(1).at(-1)?.content).toContain(
      'exceeded the output budget',
    );
  });

  it('revises the complete current draft without authoring-chat history and repairs invalid output', async () => {
    const currentPracticeGuide = {
      description: 'Practice everyday color vocabulary.',
      title: 'Everyday Colors',
      tutorInstructions: 'Guide one short color exercise at a time.',
    };
    const validRevision = {
      assistantMessage: 'I added the requested spoken practice.',
      guide: {
        ...currentPracticeGuide,
        tutorInstructions: 'Guide one short spoken color exercise at a time.',
      },
    };
    generateTextMock
      .mockResolvedValueOnce(modelResult('{}'))
      .mockResolvedValueOnce(modelResult(JSON.stringify(validRevision)));

    const revision = await generatePracticeGuideRevision({
      currentPracticeGuide,
      openRouterApiKey: testApiKey,
      prompt: 'Add spoken practice to the tutor instructions.',
    });

    expect(revision).toEqual(validRevision);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    const requestPayload = JSON.parse(capturedMessages(0)[0].content) as Record<string, unknown>;
    expect(requestPayload).toEqual({
      currentPracticeGuide,
      requestedChange: 'Add spoken practice to the tutor instructions.',
    });
    expect(requestPayload).not.toHaveProperty('conversationHistory');
    expect(capturedMessages(1).at(-1)?.content).toContain('Correct only the structural');
  });
});

describe('quiz evaluation contract', () => {
  const quiz = quizDraftToQuizBlock(parseQuizDraft(smallQuizDraft));
  const responses = [
    { text: 'I wake up at seven and I have breakfast.' },
    { selectedOptions: ['She go to school.'] },
  ];

  it('parses a representative valid evaluation', async () => {
    enqueueModelTexts(JSON.stringify(validQuizEvaluation));

    const items = await evaluateQuizResultItemsWithLlm({
      llm: { openRouterApiKey: testApiKey },
      quiz,
      responses,
    });

    expect(items).toHaveLength(2);
    expect(items[0].status).toBe('correct');
    expect(items[1].status).toBe('incorrect');
  });

  it('recovers from a schema-invalid evaluation through one correction turn', async () => {
    enqueueModelTexts(
      JSON.stringify(invalidQuizEvaluation),
      JSON.stringify(validQuizEvaluation),
    );

    const items = await evaluateQuizResultItemsWithLlm({
      llm: { openRouterApiKey: testApiKey },
      quiz,
      responses,
    });

    expect(items).toHaveLength(2);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(capturedMessages(1).at(-1)?.content).toContain(
      'did not satisfy the required schema',
    );
  });

  it('throws after exhausting evaluation correction attempts', async () => {
    enqueueModelTexts(
      JSON.stringify(invalidQuizEvaluation),
      JSON.stringify(invalidQuizEvaluation),
      JSON.stringify(invalidQuizEvaluation),
    );

    await expect(
      evaluateQuizResultItemsWithLlm({
        llm: { openRouterApiKey: testApiKey },
        quiz,
        responses,
      }),
    ).rejects.toThrow();
    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });
});

describe('prompt-schema drift guards', () => {
  it('documents every accepted quiz item kind in the Spanish draft prompt', () => {
    const prompt = renderSystemPrompt(
      'resources/quiz-draft.md',
      quizAuthoringPlaceholders('es'),
    );
    for (const kind of quizItemKinds) {
      expect(prompt).toContain(kind);
    }
  });

  it('offers the Spanish translation kinds only to Spanish authoring profiles', () => {
    const authoringPrompts = [
      'resources/quiz-draft.md',
      'resources/quiz-block-revision.md',
      'resources/quiz-blocks-revision.md',
    ];

    for (const promptPath of authoringPrompts) {
      const spanish = renderSystemPrompt(promptPath, {
        CORRECTION_REASON: 'reason',
        ...quizAuthoringPlaceholders('es'),
      });
      expect(spanish).toContain('quiz_translate_to_english');
      expect(spanish).toContain('quiz_understand_in_spanish');

      for (const locale of ['en', 'ht'] as const) {
        const rendered = renderSystemPrompt(promptPath, {
          CORRECTION_REASON: 'reason',
          ...quizAuthoringPlaceholders(locale),
        });
        expect(rendered).not.toContain('quiz_translate_to_english');
        expect(rendered).not.toContain('quiz_understand_in_spanish');
        expect(rendered).not.toContain('Spanish grammar');
        expect(rendered).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }
    }
  });

  it('covers every accepted quiz item kind in the valid draft fixture', () => {
    const draft = parseQuizDraft(validQuizDraft);
    expect(draft.blocks.map((block) => block.item.kind)).toEqual([
      ...quizItemKinds,
    ]);
  });

  it('documents the blank placeholder conventions in the draft prompt', () => {
    const prompt = loadSystemPrompt('resources/quiz-draft.md');
    expect(prompt).toContain('___');
    expect(prompt).toContain('{{blank}}');
  });

  it('documents the response contract in the block and blocks revision prompts', () => {
    expect(loadSystemPrompt('resources/quiz-block-revision.md')).toContain(
      'QuizBlockRevisionResponse',
    );
    const blocksPrompt = loadSystemPrompt('resources/quiz-blocks-revision.md');
    expect(blocksPrompt).toContain('QuizBlocksRevisionResponse');
    expect(blocksPrompt).toContain('sections');
  });

  it('keeps the correction reason placeholder in every correction prompt', () => {
    for (const path of [
      'resources/quiz-draft-correction.md',
      'resources/quiz-block-revision-correction.md',
      'resources/quiz-blocks-revision-correction.md',
      'resources/quiz-metadata-revision-correction.md',
      'tutor/quiz-result-evaluation-correction.md',
    ]) {
      expect(loadSystemPrompt(path)).toContain('{{CORRECTION_REASON}}');
    }
  });
});
