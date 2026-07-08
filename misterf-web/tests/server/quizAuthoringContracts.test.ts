import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blockAdditionQuizRevision,
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
  validQuizRevision,
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
  generateQuizDraft,
  generateQuizRevision,
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

function modelResult(text: string) {
  return {
    finishReason: 'stop',
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

describe('quiz revision contract', () => {
  it('parses a representative whole-draft revision', async () => {
    enqueueModelTexts(JSON.stringify(validQuizRevision));

    const revision = await generateQuizRevision({
      currentDraft: parseQuizDraft(validQuizDraft),
      openRouterApiKey: testApiKey,
      prompt: 'Cambia la pregunta de opción múltiple.',
    });

    expect(revision.assistantMessage).toContain('opción múltiple');
    expect(revision.draft.blocks).toHaveLength(9);
  });

  it('parses a single-block addition (block generation travels as a revision)', async () => {
    enqueueModelTexts(JSON.stringify(blockAdditionQuizRevision));

    const revision = await generateQuizRevision({
      currentDraft: parseQuizDraft(validQuizDraft),
      openRouterApiKey: testApiKey,
      prompt: 'Agrega un ejercicio de ordenar oraciones sobre la noche.',
    });

    expect(revision.draft.blocks).toHaveLength(10);
    expect(revision.draft.blocks.at(-1)?.id).toBe('order-2');
    expect(revision.draft.blocks.at(-1)?.item.kind).toBe(
      'quiz_order_sentences',
    );
  });

  it('recovers when the revision draft violates the schema', async () => {
    enqueueModelTexts(
      JSON.stringify({
        assistantMessage: 'Listo.',
        draft: duplicateBlockIdsQuizDraft,
      }),
      JSON.stringify(validQuizRevision),
    );

    const revision = await generateQuizRevision({
      currentDraft: parseQuizDraft(validQuizDraft),
      openRouterApiKey: testApiKey,
      prompt: 'Cambia la primera pregunta.',
    });

    expect(revision.draft.title).toBe('Daily Routines Quiz');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
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
      'resources/quiz-revision.md',
      'resources/quiz-draft-correction.md',
      'resources/quiz-revision-correction.md',
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

  it('documents the revision envelope keys in the revision prompt', () => {
    const prompt = loadSystemPrompt('resources/quiz-revision.md');
    expect(prompt).toContain('assistantMessage');
    expect(prompt).toContain('draft');
  });

  it('keeps the correction reason placeholder in every correction prompt', () => {
    for (const path of [
      'resources/quiz-draft-correction.md',
      'resources/quiz-revision-correction.md',
      'tutor/quiz-result-evaluation-correction.md',
    ]) {
      expect(loadSystemPrompt(path)).toContain('{{CORRECTION_REASON}}');
    }
  });
});
