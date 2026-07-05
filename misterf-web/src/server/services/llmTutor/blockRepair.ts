import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { renderSystemPrompt } from '../systemPrompts.js';
import { logger } from '../logger.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import {
  defaultInstructionLanguage,
  type InstructionLanguage,
} from './languagePack.js';
import { TutorResponseValidationError } from './errors.js';
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
  instructionLanguage: InstructionLanguage = defaultInstructionLanguage,
): MessageTaskLeakageIssue[] {
  const patterns = leakagePatterns[instructionLanguage];
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

export async function repairTutorResponseBlocks(input: {
  abortSignal?: AbortSignal;
  blocks: TutorAgentResponseBlock[];
  instructionLanguage?: InstructionLanguage;
  llm?: LlmRequestOptions;
}): Promise<TutorBlockRepairResult> {
  const language = input.instructionLanguage ?? defaultInstructionLanguage;
  const initialIssues = detectMessageTaskLeakage(input.blocks, language);
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
        BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, language),
        DETECTED_ISSUES_JSON: JSON.stringify(currentIssues, null, 2),
        ORIGINAL_BLOCKS_JSON: JSON.stringify({ blocks: currentBlocks }, null, 2),
      }),
      temperature: shouldUseTemperature(input.llm) ? 0.1 : undefined,
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
    const remainingIssues = detectMessageTaskLeakage(repairedBlocks, language);

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
    issues: currentIssues.map((issue) => ({
      code: z.ZodIssueCode.custom,
      message: `message block still simulates a typed tutor block: ${issue.reason}`,
      path: ['blocks', issue.blockIndex, 'markdown'],
    })),
  });
}

/**
 * Per-instruction-language patterns for the support-language instructions a
 * tutor might leak into a `message` (translate/unscramble/order/match/choose/
 * write tasks and inline correction cues). Structural cues that do not depend
 * on the support language (blank underscores, bracket markup, evaluation JSON
 * shape) live directly in the detectors and are shared across languages.
 */
type LeakagePatterns = {
  translation: RegExp;
  unscramble: RegExp;
  orderSentences: RegExp;
  matching: RegExp;
  multipleChoice: RegExp;
  openWriting: RegExp;
  revision: RegExp;
  ownWords: RegExp;
  correctionAnalysisPolite: RegExp;
  correctionAnalysisDirect: RegExp;
  correctionKeywords: RegExp;
  evaluationKeywords: RegExp;
};

const leakagePatterns: Record<InstructionLanguage, LeakagePatterns> = {
  es: {
    translation:
      /\btraduce(?:\s+(?:la\s+)?(?:siguiente\s+)?(?:frase|oraci[oó]n|texto))?\s+al\s+ingl[eé]s\b\s*:?/i,
    unscramble: /\b(?:ordena|reordena)\b[\s\S]{0,180}\b(?:palabras|oraci[oó]n|frase)\b/i,
    orderSentences:
      /\b(?:ordena|reordena|pon)\b[\s\S]{0,180}\b(?:pasos|oraciones|frases|instrucciones|eventos)\b/i,
    matching:
      /\b(?:une|relaciona|empareja)\b[\s\S]{0,180}\b(?:con|cada|correct[ao]s?|significado|traducci[oó]n|pareja)\b/i,
    multipleChoice:
      /\b(?:elige|escoge|selecciona|marca)\b[\s\S]{0,180}\b(?:opci[oó]n correcta|respuesta correcta|la correcta)\b/i,
    openWriting:
      /\b(?:escrib(?:e|es|a|as|an|ir|ir[ií]a(?:s|n)?|iendo)|redact(?:a|as|an|e|es|en|ar|ar[ií]a(?:s|n)?)|crea(?:r|s|n)?|forma(?:r|s|n)?|constru(?:ye|yes|ya|yas|yan|ir|ir[ií]a(?:s|n)?))\b[\s\S]{0,180}\b(?:oraci[oó]n(?:es)?|frase(?:s)?|respuesta|p[aá]rrafo|texto|ejemplo)\b/i,
    revision:
      /\b(?:corrige(?:s|n)?|corrija(?:s|n)?|corregir(?:[ií]a(?:s|n)?)?|reescrib(?:e|es|a|as|an|ir|ir[ií]a(?:s|n)?|iendo))\b[\s\S]{0,180}\b(?:oraci[oó]n(?:es)?|frase(?:s)?|respuesta|p[aá]rrafo|texto|ejemplo)\b/i,
    ownWords:
      /\b(?:respond(?:e|es|a|as|an|er|er[ií]a(?:s|n)?)|contest(?:a|as|an|e|es|en|ar|ar[ií]a(?:s|n)?))\b[\s\S]{0,180}\bcon\s+tus\s+propias\s+palabras\b/i,
    correctionAnalysisPolite:
      /\b(?:puedes|podr[ií]as|podr[ií]an|puede[sn]?)\s+(?:decirme|decirnos|identificar|se[nñ]alar|explicar|indicar|encontrar)\b[\s\S]{0,280}\b(?:error(?:es)?|equivocaci[oó]n(?:es)?|problema(?:s)?)\b[\s\S]{0,280}\b(?:corregir(?:lo|la|los|las)?|corregir[ií]as|corregir[ií]an|corrige(?:lo|la|los|las)?|corriges|corrigen|correcci[oó]n|correcciones)\b/i,
    correctionAnalysisDirect:
      /\b(?:cu[aá]l(?:es)?\s+(?:es|son)\s+(?:el|los)?\s*error(?:es)?|encuentra\s+(?:el|los)?\s*error(?:es)?|identifica\s+(?:el|los)?\s*error(?:es)?)\b[\s\S]{0,280}\b(?:corregir(?:lo|la|los|las)?|corregir[ií]as|corregir[ií]an|corrige(?:lo|la|los|las)?|corriges|corrigen|correcci[oó]n|correcciones)\b/i,
    correctionKeywords:
      /\b(?:corrige|correcci[oó]n|correcciones|errores|reescribe|reescribir|int[eé]ntalo)\b/i,
    evaluationKeywords: /\b(?:evaluaci[oó]n|revisemos esta parte|pista con la evaluaci[oó]n)\b/i,
  },
  en: {
    translation:
      /\btranslate\b(?:\s+(?:the\s+)?(?:following\s+)?(?:sentence|phrase|text))?\s+(?:in)?to\s+english\b\s*:?/i,
    unscramble: /\b(?:unscramble|reorder|rearrange|arrange)\b[\s\S]{0,180}\b(?:words?|sentence)\b/i,
    orderSentences:
      /\b(?:order|reorder|arrange|put)\b[\s\S]{0,180}\b(?:steps?|sentences?|events?|instructions?)\b[\s\S]{0,60}\bin\s+(?:the\s+)?(?:right\s+|correct\s+)?order\b/i,
    matching:
      /\b(?:match|pair|connect|link)\b[\s\S]{0,180}\b(?:with|each|correct|meaning|translation|pair)\b/i,
    multipleChoice:
      /\b(?:choose|pick|select|mark)\b[\s\S]{0,180}\b(?:correct\s+(?:option|answer)|right\s+(?:option|answer)|the\s+correct\s+one)\b/i,
    openWriting:
      /\b(?:write|compose|create)\b[\s\S]{0,180}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b/i,
    // "correct" is verb-only here (avoid the adjective in "the correct answer")
    // by requiring an imperative object determiner right after it.
    revision:
      /\b(?:rewrite|fix)\b[\s\S]{0,180}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b|\bcorrect\s+(?:this|the|your|these|that|it|them)\b[\s\S]{0,160}\b(?:sentences?|phrases?|answer|paragraphs?|text|examples?)\b/i,
    ownWords: /\b(?:answer|respond|explain|describe)\b[\s\S]{0,180}\bin\s+your\s+own\s+words\b/i,
    correctionAnalysisPolite:
      /\b(?:can|could)\s+you\s+(?:tell\s+me|point\s+out|identify|find|spot|explain)\b[\s\S]{0,280}\b(?:error|mistake|problem)s?\b[\s\S]{0,280}\b(?:correct|fix|rewrite)\b/i,
    correctionAnalysisDirect:
      /\b(?:what(?:'s| is| are)\s+(?:the\s+)?(?:error|mistake)s?|find\s+(?:the\s+)?(?:error|mistake)s?|identify\s+(?:the\s+)?(?:error|mistake)s?)\b[\s\S]{0,280}\b(?:correct|fix|rewrite)\b/i,
    correctionKeywords: /\b(?:correct|correction|errors?|mistakes?|rewrite|try\s+again)\b/i,
    evaluationKeywords: /\b(?:evaluation|let'?s\s+review\s+this\s+part|hint\s+with\s+the\s+evaluation)\b/i,
  },
  ht: {
    // No trailing \b after accented finals: JS \b is ASCII-only, so it fails
    // right after letters like "è" (anglè, erè).
    translation: /\btradui\b[\s\S]{0,40}\ban\s+angl[eè]/i,
    unscramble: /\b(?:ranje|reranje|mete)\b[\s\S]{0,180}\b(?:mo|fraz)\b/i,
    orderSentences:
      /\b(?:ranje|mete)\b[\s\S]{0,180}\b(?:etap|fraz|enstriksyon|evènman)\b[\s\S]{0,60}\ban\s+l[oò]d\b/i,
    matching:
      /\b(?:marye|konekte|asosye)\b[\s\S]{0,180}\b(?:ak|chak|k[oò]r[eè]k|siyifikasyon|tradiksyon|p[eè])\b/i,
    multipleChoice:
      /\b(?:chwazi|make)\b[\s\S]{0,180}\b(?:bon\s+(?:opsyon|repons)|opsyon\s+k[oò]r[eè]k|repons\s+k[oò]r[eè]k)\b/i,
    openWriting: /\b(?:ekri|kreye|fòme|konstwi)\b[\s\S]{0,180}\b(?:fraz|repons|paragraf|t[eè]ks|egzanp)\b/i,
    revision: /\b(?:korije|reekri)\b[\s\S]{0,180}\b(?:fraz|repons|paragraf|t[eè]ks)\b/i,
    ownWords: /\b(?:reponn|eksplike)\b[\s\S]{0,180}\bnan\s+pw[oò]p\s+mo\s+ou\b/i,
    correctionAnalysisPolite:
      /\b(?:[eè]ske\s+ou\s+ka(?:pab)?|ou\s+ka(?:pab)?)\s+(?:di\s+m|idantifye|montre|jwenn|eksplike)\b[\s\S]{0,280}\ber[eè][\s\S]{0,280}\bkorije\b/i,
    correctionAnalysisDirect:
      /\b(?:ki(?:l[eè]s)?\s+er[eè]|jwenn\s+er[eè]|idantifye\s+er[eè])[\s\S]{0,280}\bkorije\b/i,
    correctionKeywords: /\b(?:korije|koreksyon|er[eè]|reekri|eseye\s+ank[oò])/i,
    evaluationKeywords: /\b(?:evalyasyon|ann\s+revize\s+pati\s+sa)\b/i,
  },
};

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
