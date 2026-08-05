import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { renderSystemPrompt } from '../systemPrompts.js';
import { logger } from '../logger.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import {
  defaultInstructionLanguage,
  type InstructionLanguage,
} from './languagePack.js';
import { languages, type LeakagePatterns } from '../../i18n/index.js';
import { TutorResponseValidationError } from './errors.js';
import { parseJsonFromModelText } from './modelJson.js';
import { logLlmCost } from './logging.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature } from './providers.js';
import { validateTutorResponseBlocks } from './validation.js';
import type { LlmRequestOptions, TutorAgentResponseBlock } from './types.js';

type MessageTaskLeakageKind =
  | 'blank_placeholder'
  | 'translation_prompt'
  | 'open_text_prompt'
  | 'unscramble_prompt'
  | 'order_sentences_prompt'
  | 'matching_prompt'
  | 'multiple_choice_prompt'
  | 'inline_correction_markup'
  | 'inline_evaluation_json'
  | 'multi_exercise_batch';

type MessageTaskLeakageIssue = {
  blockIndex: number;
  expectedBlockTypes: string[];
  excerpt: string;
  kind: MessageTaskLeakageKind;
  reason: string;
};

const maxRepairAttempts = 2;

/**
 * Top-level blocks that ask the learner to interact/answer. Normal guided
 * practice emits at most one of these per tutor response; several items that
 * should be answered together belong in a single `quiz` block.
 */
const interactiveExerciseBlockTypes = new Set<TutorAgentResponseBlock['type']>([
  'dialogue_character_message',
  'fill_in_the_blank_choice',
  'fill_in_the_blank_input',
  'matching_pairs',
  'multiple_choice',
  'open_text_prompt',
  'order_sentences',
  'quiz',
  'translate_to_english_prompt',
  'understand_in_spanish_prompt',
  'unscramble_sentence',
]);

export type TutorBlockRepairResult = {
  blocks: TutorAgentResponseBlock[];
  repaired: boolean;
};

export function detectMessageTaskLeakage(
  blocks: TutorAgentResponseBlock[],
  instructionLanguage: InstructionLanguage = defaultInstructionLanguage,
): MessageTaskLeakageIssue[] {
  const patterns = languages[instructionLanguage].leakagePatterns;
  return blocks.flatMap((block, blockIndex) => {
    if (block.type !== 'message') {
      return [];
    }

    return detectMessageIssues(block.markdown, patterns).map((issue) => ({
      ...issue,
      blockIndex,
      excerpt: buildExcerpt(block.markdown),
    }));
  });
}

export function detectMultiExerciseBatch(
  blocks: TutorAgentResponseBlock[],
): MessageTaskLeakageIssue[] {
  const exerciseIndexes = blocks.flatMap((block, blockIndex) => (
    interactiveExerciseBlockTypes.has(block.type) ? [blockIndex] : []
  ));
  if (exerciseIndexes.length <= 1) {
    return [];
  }

  return exerciseIndexes.slice(1).map((blockIndex) => ({
    blockIndex,
    expectedBlockTypes: ['quiz'],
    excerpt: buildExcerpt(JSON.stringify(blocks[blockIndex])),
    kind: 'multi_exercise_batch',
    reason:
      `The response contains ${exerciseIndexes.length} top-level exercise blocks; ` +
      'a tutor response should present at most one interactive exercise at a time. ' +
      'Consolidate the items into a single quiz block, or keep only the primary exercise.',
  }));
}

function detectTutorBlockIssues(
  blocks: TutorAgentResponseBlock[],
  instructionLanguage: InstructionLanguage,
): MessageTaskLeakageIssue[] {
  return [
    ...detectMessageTaskLeakage(blocks, instructionLanguage),
    ...detectMultiExerciseBatch(blocks),
  ];
}

export async function repairTutorResponseBlocks(input: {
  abortSignal?: AbortSignal;
  blocks: TutorAgentResponseBlock[];
  instructionLanguage?: InstructionLanguage;
  llm?: LlmRequestOptions;
}): Promise<TutorBlockRepairResult> {
  const language = input.instructionLanguage ?? defaultInstructionLanguage;
  const initialIssues = detectTutorBlockIssues(input.blocks, language);
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
      messages: buildRepairMessages(),
      model: getLanguageModel(input.llm),
      providerOptions: getProviderOptions({ llm: input.llm }),
      system: renderSystemPrompt('tutor/block-repair.md', {
        BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, language),
        DETECTED_ISSUES_JSON: JSON.stringify(currentIssues, null, 2),
        ORIGINAL_BLOCKS_JSON: JSON.stringify({ blocks: currentBlocks }, null, 2),
      }),
      temperature: shouldUseTemperature(input.llm) ? 0.1 : undefined,
    });

    logLlmCost({
      context: { actorLabel: 'Block repair', llm: input.llm, operation: 'tutor_block_repair' },
      finishReason: result.finishReason,
      providerMetadata: result.providerMetadata,
      usage: result.usage,
    });

    lastGeneratedText = result.text;
    const repairedBlocks = validateTutorResponseBlocks(
      parseJsonFromModelText(result.text),
      {
        generatedText: result.text,
        llm: input.llm,
        operation: 'tutor_block_repair',
      },
    );
    const remainingIssues = detectTutorBlockIssues(repairedBlocks, language);

    logger.info('llm_block_repair_attempt', {
      attempt: attempt + 1,
      issueKinds: currentIssues.map((issue) => issue.kind),
      initialIssueCount: initialIssues.length,
      repairedBlockTypes: repairedBlocks.map((block) => block.type),
      remainingIssueCount: remainingIssues.length,
      userId: input.llm?.userId ?? null,
    });

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
    issues: currentIssues.map((issue) => (
      issue.kind === 'multi_exercise_batch'
        ? {
            code: z.ZodIssueCode.custom,
            message: `response still batches multiple exercises: ${issue.reason}`,
            path: ['blocks', issue.blockIndex],
          }
        : {
            code: z.ZodIssueCode.custom,
            message: `message block still simulates a typed tutor block: ${issue.reason}`,
            path: ['blocks', issue.blockIndex, 'markdown'],
          }
    )),
  });
}

function detectMessageIssues(
  markdown: string,
  patterns: LeakagePatterns,
): Omit<MessageTaskLeakageIssue, 'blockIndex' | 'excerpt'>[] {
  const issues: Omit<MessageTaskLeakageIssue, 'blockIndex' | 'excerpt'>[] = [];

  if (/_{3,}|\{\{\s*blank\s*\}\}/i.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['fill_in_the_blank_input', 'fill_in_the_blank_choice', 'quiz'],
      kind: 'blank_placeholder',
      reason: 'A message contains a blank placeholder that should be rendered by a fill-in-the-blank block.',
    });
  }

  if (patterns.translation.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['translate_to_english_prompt', 'quiz'],
      kind: 'translation_prompt',
      reason: 'A message contains an explicit translation-to-English task.',
    });
  }

  if (containsOpenTextPrompt(markdown, patterns)) {
    issues.push({
      expectedBlockTypes: ['open_text_prompt', 'quiz'],
      kind: 'open_text_prompt',
      reason: 'A message asks the learner to submit an open-ended written answer.',
    });
  }

  if (patterns.unscramble.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['unscramble_sentence', 'quiz'],
      kind: 'unscramble_prompt',
      reason: 'A message asks the learner to reorder words or a sentence.',
    });
  }

  if (patterns.orderSentences.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['order_sentences', 'quiz'],
      kind: 'order_sentences_prompt',
      reason: 'A message asks the learner to put sentences or steps in order.',
    });
  }

  if (patterns.matching.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['matching_pairs', 'quiz'],
      kind: 'matching_prompt',
      reason: 'A message asks the learner to match related items.',
    });
  }

  if (patterns.multipleChoice.test(markdown)) {
    issues.push({
      expectedBlockTypes: ['multiple_choice', 'quiz'],
      kind: 'multiple_choice_prompt',
      reason: 'A message asks the learner to choose a correct answer among options.',
    });
  }

  if (containsInlineCorrectionMarkup(markdown, patterns)) {
    issues.push({
      expectedBlockTypes: ['sentence_evaluation'],
      kind: 'inline_correction_markup',
      reason: 'A message uses bracketed inline correction markup instead of a sentence_evaluation block.',
    });
  }

  if (containsInlineEvaluationJson(markdown, patterns)) {
    issues.push({
      expectedBlockTypes: ['sentence_evaluation'],
      kind: 'inline_evaluation_json',
      reason: 'A message contains JSON that imitates a sentence_evaluation block.',
    });
  }

  return issues;
}

function containsOpenTextPrompt(markdown: string, patterns: LeakagePatterns): boolean {
  return (
    patterns.openWriting.test(markdown) ||
    patterns.revision.test(markdown) ||
    patterns.ownWords.test(markdown) ||
    containsCorrectionAnalysisPrompt(markdown, patterns)
  );
}

function containsCorrectionAnalysisPrompt(
  markdown: string,
  patterns: LeakagePatterns,
): boolean {
  return (
    containsNumberedSentenceList(markdown) &&
    (
      patterns.correctionAnalysisPolite.test(markdown) ||
      patterns.correctionAnalysisDirect.test(markdown)
    )
  );
}

function containsNumberedSentenceList(markdown: string): boolean {
  const numberedItems = markdown.match(/(?:^|\n)\s*\d+[.)]\s+\S[^\n]{8,240}/gm) ?? [];
  const sentenceLikeItems = numberedItems.filter((item) => (
    /[A-Za-z]/.test(item) &&
    /[.!?]\s*$/.test(item.trim())
  ));

  return sentenceLikeItems.length >= 2;
}

function containsInlineCorrectionMarkup(
  markdown: string,
  patterns: LeakagePatterns,
): boolean {
  const bracketedWords = markdown.match(/\[[^\]\n]{2,80}\]/g) ?? [];
  if (bracketedWords.length >= 2) {
    return true;
  }

  return bracketedWords.length === 1 && patterns.correctionKeywords.test(markdown);
}

function containsInlineEvaluationJson(
  markdown: string,
  patterns: LeakagePatterns,
): boolean {
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
      patterns.evaluationKeywords.test(markdown) &&
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
