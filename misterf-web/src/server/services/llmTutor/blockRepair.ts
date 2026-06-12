import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { renderSystemPrompt } from '../systemPrompts.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import { TutorResponseValidationError } from './errors.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature } from './providers.js';
import { validateTutorResponseBlocks } from './validation.js';
import type { LlmRequestOptions, TutorAgentResponseBlock } from './types.js';

type MessageTaskLeakageKind =
  | 'blank_placeholder'
  | 'translation_prompt'
  | 'unscramble_prompt'
  | 'matching_prompt'
  | 'multiple_choice_prompt'
  | 'inline_correction_markup'
  | 'inline_evaluation_json';

type MessageTaskLeakageIssue = {
  blockIndex: number;
  expectedBlockTypes: string[];
  excerpt: string;
  kind: MessageTaskLeakageKind;
  reason: string;
};

const maxRepairAttempts = 2;

export type TutorBlockRepairResult = {
  blocks: TutorAgentResponseBlock[];
  repaired: boolean;
};

export function detectMessageTaskLeakage(
  blocks: TutorAgentResponseBlock[],
): MessageTaskLeakageIssue[] {
  return blocks.flatMap((block, blockIndex) => {
    if (block.type !== 'message') {
      return [];
    }

    return detectMessageIssues(block.markdown).map((issue) => ({
      ...issue,
      blockIndex,
      excerpt: buildExcerpt(block.markdown),
    }));
  });
}

export async function repairTutorResponseBlocks(input: {
  abortSignal?: AbortSignal;
  blocks: TutorAgentResponseBlock[];
  llm?: LlmRequestOptions;
}): Promise<TutorBlockRepairResult> {
  const initialIssues = detectMessageTaskLeakage(input.blocks);
  if (initialIssues.length === 0) {
    return {
      blocks: input.blocks,
      repaired: false,
    };
  }

  let currentBlocks = input.blocks;
  let currentIssues = initialIssues;
  let lastGeneratedText: string | null = null;

  for (let attempt = 0; attempt < maxRepairAttempts; attempt += 1) {
    const result = await generateText({
      abortSignal: input.abortSignal,
      maxOutputTokens: 1800,
      messages: buildRepairMessages(),
      model: getLanguageModel(input.llm),
      providerOptions: getProviderOptions(),
      system: renderSystemPrompt('tutor/block-repair.md', {
        BLOCK_PROTOCOL: renderTutorBlockProtocol(),
        DETECTED_ISSUES_JSON: JSON.stringify(currentIssues, null, 2),
        ORIGINAL_BLOCKS_JSON: JSON.stringify({ blocks: currentBlocks }, null, 2),
      }),
      temperature: shouldUseTemperature(input.llm) ? 0.1 : undefined,
    });

    lastGeneratedText = result.text;
    const repairedBlocks = validateTutorResponseBlocks(
      parseJsonFromModelText(result.text),
      { generatedText: result.text },
    );
    const remainingIssues = detectMessageTaskLeakage(repairedBlocks);

    console.log('[Mr. F block repair]', JSON.stringify({
      attempt: attempt + 1,
      issueKinds: currentIssues.map((issue) => issue.kind),
      initialIssueCount: initialIssues.length,
      repairedBlockTypes: repairedBlocks.map((block) => block.type),
      remainingIssueCount: remainingIssues.length,
    }, null, 2));

    if (remainingIssues.length === 0) {
      return {
        blocks: repairedBlocks,
        repaired: true,
      };
    }

    currentBlocks = repairedBlocks;
    currentIssues = remainingIssues;
  }

  throw new TutorResponseValidationError({
    generatedText: lastGeneratedText,
    issues: currentIssues.map((issue) => ({
      code: z.ZodIssueCode.custom,
      message: `message block still simulates a typed tutor block: ${issue.reason}`,
      path: ['blocks', issue.blockIndex, 'markdown'],
    })),
  });
}

function detectMessageIssues(
  markdown: string,
): Omit<MessageTaskLeakageIssue, 'blockIndex' | 'excerpt'>[] {
  const issues: Omit<MessageTaskLeakageIssue, 'blockIndex' | 'excerpt'>[] = [];

  if (/_{3,}|\{\{\s*blank\s*\}\}/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['fill_in_the_blank_input', 'fill_in_the_blank_choice', 'quiz'],
      kind: 'blank_placeholder',
      reason: 'A message contains a blank placeholder that should be rendered by a fill-in-the-blank block.',
    });
  }

  if (/\btraduce(?:\s+(?:la\s+)?(?:siguiente\s+)?(?:frase|oraci[oó]n|texto))?\s+al\s+ingl[eé]s\b\s*:?/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['translate_to_english_prompt', 'quiz'],
      kind: 'translation_prompt',
      reason: 'A message contains an explicit Spanish-to-English translation task.',
    });
  }

  if (/\b(?:ordena|reordena)\b[\s\S]{0,180}\b(?:palabras|oraci[oó]n|frase)\b/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['unscramble_sentence', 'quiz'],
      kind: 'unscramble_prompt',
      reason: 'A message asks the learner to reorder words or a sentence.',
    });
  }

  if (/\b(?:une|relaciona|empareja)\b[\s\S]{0,180}\b(?:con|cada|correct[ao]s?|significado|traducci[oó]n|pareja)\b/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['matching_pairs', 'quiz'],
      kind: 'matching_prompt',
      reason: 'A message asks the learner to match related items.',
    });
  }

  if (/\b(?:elige|escoge|selecciona|marca)\b[\s\S]{0,180}\b(?:opci[oó]n correcta|respuesta correcta|la correcta|mejor opci[oó]n)\b/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['multiple_choice', 'quiz'],
      kind: 'multiple_choice_prompt',
      reason: 'A message asks the learner to choose among options.',
    });
  }

  if (containsInlineCorrectionMarkup(markdown)) {
    issues.push({
      expectedBlockTypes: ['sentence_evaluation'],
      kind: 'inline_correction_markup',
      reason: 'A message uses bracketed inline correction markup instead of a sentence_evaluation block.',
    });
  }

  if (containsInlineEvaluationJson(markdown)) {
    issues.push({
      expectedBlockTypes: ['sentence_evaluation'],
      kind: 'inline_evaluation_json',
      reason: 'A message contains JSON that imitates a sentence_evaluation block.',
    });
  }

  return issues;
}

function containsInlineCorrectionMarkup(markdown: string): boolean {
  const bracketedWords = markdown.match(/\[[^\]\n]{2,80}\]/g) ?? [];
  if (bracketedWords.length >= 2) {
    return true;
  }

  return (
    bracketedWords.length === 1 &&
    /\b(?:corrige|correcci[oó]n|correcciones|errores|reescribe|reescribir|int[eé]ntalo)\b/i.test(markdown)
  );
}

function containsInlineEvaluationJson(markdown: string): boolean {
  const hasEvaluationShape =
    /"parts"\s*:\s*\[/i.test(markdown) &&
    /"text"\s*:\s*"[^"]+"/i.test(markdown) &&
    /"status"\s*:\s*"(?:correct|improve|error)"/i.test(markdown);
  if (hasEvaluationShape) {
    return true;
  }

  return (
    /"type"\s*:\s*"sentence_evaluation"/i.test(markdown) ||
    (
      /\b(?:evaluaci[oó]n|revisemos esta parte|pista con la evaluaci[oó]n)\b/i.test(markdown) &&
      /"explanation"\s*:\s*"[^"]+"/i.test(markdown) &&
      /"status"\s*:\s*"(?:correct|improve|error)"/i.test(markdown)
    )
  );
}

function buildExcerpt(markdown: string): string {
  const normalized = markdown.replace(/\s+/g, ' ').trim();
  return normalized.length > 320
    ? `${normalized.slice(0, 317)}...`
    : normalized;
}

function buildRepairMessages(): ModelMessage[] {
  return [
    {
      content: 'Repair the TutorResponse blocks.',
      role: 'user',
    },
  ];
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`JSON parsing failed: ${message}`);
  }
}
