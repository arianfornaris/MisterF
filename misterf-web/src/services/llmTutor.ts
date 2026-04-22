import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import {
  generateObject,
  generateText,
  jsonSchema,
  type FinishReason,
  type LanguageModelUsage,
  type LanguageModel,
  type ModelMessage,
  type ProviderMetadata,
} from 'ai';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env.js';

export type TutorMessage = {
  role: 'user' | 'model';
  content: string;
};

export type TutorAgentResult = {
  blocks: TutorResponseBlock[];
  content: string;
  model: string;
  provider: string;
};

export type LlmRequestTokenUsage = {
  contextWindowTokens: number;
  inputTokens: number;
  isEstimate: boolean;
  model: string;
  percentUsed: number;
  provider: string;
  turn: number;
};

export type TranslationMode = 'auto' | 'es-en' | 'en-es';

export type TranslationResult = {
  detectedLanguage: string;
  model: string;
  provider: string;
  translatedText: string;
};

export type GeneratedProgressResult = {
  markdown: string;
  model: string;
  provider: string;
};

export type GeneratedVocabularyItem = {
  example?: string;
  explanation: string;
  sourceSentence?: string;
  term: string;
  translation: string;
};

export type GeneratedVocabularyResult = {
  items: GeneratedVocabularyItem[];
  model: string;
  provider: string;
};

export type TutorResponseBlock =
  | TutorMessageBlock
  | TutorChallengeStartedBlock
  | TutorSentenceEvaluationBlock
  | TutorChallengeCompletedBlock
  | TutorConversationTitleBlock;

export type TutorMessageBlock = {
  type: 'message';
  markdown: string;
};

export type TutorChallengeStartedBlock = {
  type: 'challenge_started';
  level?: string;
  sourceSentence: string;
  topic?: string;
};

export type TutorSentenceEvaluationBlock = {
  type: 'sentence_evaluation';
  parts: Array<{
    explanation?: string;
    status: 'correct' | 'improve' | 'error';
    text: string;
  }>;
};

export type TutorChallengeCompletedBlock = {
  type: 'challenge_completed';
  score: number;
};

export type TutorConversationTitleBlock = {
  title: string;
  type: 'conversation_title';
};

export class MissingLlmApiKeyError extends Error {
  constructor(readonly provider: string) {
    super(`Missing API key for LLM provider: ${provider}.`);
    this.name = 'MissingLlmApiKeyError';
  }
}

export class LlmFinishReasonError extends Error {
  constructor(
    readonly finishReason: FinishReason | string,
    message: string,
  ) {
    super(message);
    this.name = 'LlmFinishReasonError';
  }
}

const firstChallengePrompt = `
Start the session.
`;

const maxAgentTurns = 6;

let systemInstruction: string | undefined;

function getSystemInstruction(): string {
  systemInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/gameplay-1.md'),
    'utf8',
  );

  return systemInstruction;
}

export async function runTutorAgentLoop(
  history: TutorMessage[],
  options: {
    currentTitle?: string;
    onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
    startConversation?: boolean;
    titleUpdatedByUser?: boolean;
  },
): Promise<TutorAgentResult> {
  const messages = history.map(toModelMessage);

  if (options.startConversation || messages.length === 0) {
    messages.push({
      content: firstChallengePrompt,
      role: 'user',
    });
  }

  const system = buildAgentSystemInstruction(options);
  let lastError: unknown = null;

  for (let turn = 0; turn < maxAgentTurns; turn += 1) {
    logLlmRequest(messages, system, options, turn + 1);

    try {
      const result = await generateObject({
        maxOutputTokens: 1800,
        messages,
        model: getLanguageModel(),
        providerOptions: getProviderOptions(),
        schema: jsonSchema(genericTutorResponseJsonSchema),
        schemaDescription:
          'A JSON object with a blocks array. The exact block contract is described in the system instructions and validated by the server.',
        schemaName: 'TutorResponse',
        system,
        temperature: shouldUseTemperature() ? 0.45 : undefined,
      });

      logLlmResponse(
        result.object,
        result.finishReason,
        result.providerMetadata,
        turn + 1,
      );
      options.onTokenUsage?.(
        buildLlmRequestTokenUsage({
          messages,
          system,
          turn: turn + 1,
          usage: result.usage,
        }),
      );

      const userFacingFinishMessage = getUserFacingFinishReasonMessage(
        result.finishReason,
        undefined,
        result.providerMetadata,
      );
      if (userFacingFinishMessage) {
        throw new LlmFinishReasonError(
          result.finishReason,
          userFacingFinishMessage,
        );
      }

      try {
        const blocks = validateTutorResponseBlocks(result.object);
        if (blocks.length === 0) {
          throw new Error('The model returned no usable response blocks.');
        }

        return {
          blocks,
          content: blocksToMarkdown(blocks),
          model: env.llmModel,
          provider: env.llmProvider,
        };
      } catch (error) {
        lastError = error;

        if (turn >= maxAgentTurns - 1) {
          throw error;
        }

        appendStructuredCorrectionRequest(messages, {
          error,
          invalidOutput: JSON.stringify(result.object, null, 2),
          reason:
            'The JSON object was parsed, but it does not satisfy the TutorResponse contract described in the instructions.',
          turn: turn + 1,
        });
      }
    } catch (error) {
      lastError = error;

      if (error instanceof LlmFinishReasonError || !isCorrectableLlmOutputError(error)) {
        throw error;
      }

      if (turn >= maxAgentTurns - 1) {
        throw error;
      }

      appendStructuredCorrectionRequest(messages, {
        error,
        invalidOutput: extractGeneratedTextFromError(error),
        reason:
          'Your previous response was not valid JSON or could not be converted into a TutorResponse object.',
        turn: turn + 1,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('The model did not return a usable structured response.');
}

export async function translateTextWithLlm(input: {
  mode: TranslationMode;
  text: string;
}): Promise<TranslationResult> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('No hay texto para traducir.');
  }

  const result = await generateObject({
    maxOutputTokens: 1000,
    messages: [
      {
        content: text,
        role: 'user',
      },
    ],
    model: getLanguageModel(),
    providerOptions: getProviderOptions(),
    schema: jsonSchema(translationJsonSchema),
    schemaDescription:
      'A small translation result. The translatedText field contains only the translation.',
    schemaName: 'TranslationResult',
    system: buildTranslatorSystemInstruction(input.mode),
    temperature: shouldUseTemperature() ? 0.15 : undefined,
  });

  const userFacingFinishMessage = getUserFacingFinishReasonMessage(
    result.finishReason,
    undefined,
    result.providerMetadata,
  );
  if (userFacingFinishMessage) {
    throw new LlmFinishReasonError(
      result.finishReason,
      userFacingFinishMessage,
    );
  }

  const parsed = translationResultSchema.safeParse(result.object);
  if (!parsed.success) {
    console.error('[Mr. F translator validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value: result.object,
    }, null, 2));
    throw new Error('El traductor no devolvió una respuesta válida.');
  }

  console.log('[Mr. F translator response]', JSON.stringify({
    detectedLanguage: parsed.data.detectedLanguage,
    mode: input.mode,
    model: env.llmModel,
    provider: env.llmProvider,
  }, null, 2));

  return {
    detectedLanguage: parsed.data.detectedLanguage,
    model: env.llmModel,
    provider: env.llmProvider,
    translatedText: parsed.data.translatedText,
  };
}

export async function generateProgressWithLlm(input: {
  compactDataset: string;
  onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
}): Promise<GeneratedProgressResult> {
  const system = buildProgressSystemInstruction();
  const messages: ModelMessage[] = [
    {
      content: input.compactDataset,
      role: 'user',
    },
  ];
  const result = await generateText({
    maxOutputTokens: 1600,
    messages,
    model: getLanguageModel(),
    providerOptions: getProviderOptions(),
    system,
    temperature: shouldUseTemperature() ? 0.2 : undefined,
  });

  input.onTokenUsage?.(
    buildLlmRequestTokenUsage({
      messages,
      system,
      turn: 1,
      usage: result.usage,
    }),
  );

  const userFacingFinishMessage = getUserFacingFinishReasonMessage(
    result.finishReason,
    undefined,
    result.providerMetadata,
  );
  if (userFacingFinishMessage) {
    throw new LlmFinishReasonError(
      result.finishReason,
      userFacingFinishMessage,
    );
  }

  const markdown = result.text.trim();
  assertUsableProgressMarkdown(markdown);

  return {
    markdown,
    model: env.llmModel,
    provider: env.llmProvider,
  };
}

function assertUsableProgressMarkdown(markdown: string): void {
  if (!markdown) {
    throw new Error('El progreso no devolvió contenido.');
  }

  const requiredHeadings = [
    'Tema',
    'Nivel',
    'Resumen',
    'Errores frecuentes',
    'Vocabulario',
  ];

  const missingHeadings = requiredHeadings.filter(
    (heading) => !new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'im').test(markdown),
  );
  if (missingHeadings.length > 0) {
    throw new Error(
      `El progreso del modelo llegó incompleto. Faltan secciones: ${missingHeadings.join(', ')}.`,
    );
  }

  const meaningfulText = markdown
    .replace(/^##\s+.+$/gim, '')
    .replace(/[#*_`>\-\s]/g, '');
  if (meaningfulText.length < 80) {
    throw new Error('El progreso del modelo llegó demasiado corto para ser útil.');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function generateVocabularyWithLlm(input: {
  compactDataset: string;
  onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
}): Promise<GeneratedVocabularyResult> {
  const system = buildVocabularySystemInstruction();
  const messages: ModelMessage[] = [
    {
      content: input.compactDataset,
      role: 'user',
    },
  ];
  const result = await generateText({
    maxOutputTokens: 2600,
    messages,
    model: getLanguageModel(),
    providerOptions: getProviderOptions(),
    system,
    temperature: shouldUseTemperature() ? 0.2 : undefined,
  });

  input.onTokenUsage?.(
    buildLlmRequestTokenUsage({
      messages,
      system,
      turn: 1,
      usage: result.usage,
    }),
  );

  const parsedItems = parseVocabularyJsonLines(result.text);
  if (parsedItems.length === 0) {
    const userFacingFinishMessage = getUserFacingFinishReasonMessage(
      result.finishReason,
      undefined,
      result.providerMetadata,
    );
    if (userFacingFinishMessage) {
      throw new LlmFinishReasonError(
        result.finishReason,
        userFacingFinishMessage,
      );
    }

    console.error('[Mr. F vocabulary JSONL parse failed]', JSON.stringify({
      finishReason: result.finishReason,
      text: result.text,
    }, null, 2));
    throw new Error('El vocabulario no devolvió líneas JSON válidas.');
  }

  const userFacingFinishMessage = getUserFacingFinishReasonMessage(
    result.finishReason,
    undefined,
    result.providerMetadata,
  );
  if (userFacingFinishMessage) {
    console.warn('[Mr. F vocabulary partial result accepted]', JSON.stringify({
      finishReason: result.finishReason,
      itemCount: parsedItems.length,
      message: userFacingFinishMessage,
    }, null, 2));
  }

  return {
    items: parsedItems,
    model: env.llmModel,
    provider: env.llmProvider,
  };
}

function parseVocabularyJsonLines(text: string): GeneratedVocabularyItem[] {
  const items: GeneratedVocabularyItem[] = [];
  const invalidLines: Array<{ line: string; lineNumber: number; reason: string }> = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line === '```' || line.startsWith('```')) {
      continue;
    }

    const normalizedLine = line.replace(/,$/, '');
    try {
      const parsed = JSON.parse(normalizedLine) as unknown;
      const item = vocabularyItemSchema.safeParse(parsed);
      if (item.success) {
        items.push(item.data);
        continue;
      }

      invalidLines.push({
        line: normalizedLine.slice(0, 240),
        lineNumber: index + 1,
        reason: item.error.issues.map((issue) => issue.message).join('; '),
      });
    } catch (error) {
      invalidLines.push({
        line: normalizedLine.slice(0, 240),
        lineNumber: index + 1,
        reason: error instanceof Error ? error.message : 'Invalid JSON',
      });
    }
  }

  if (invalidLines.length > 0) {
    console.warn('[Mr. F vocabulary JSONL invalid lines ignored]', JSON.stringify({
      invalidLines,
      validItemCount: items.length,
    }, null, 2));
  }

  return items.slice(0, 12);
}

function toModelMessage(message: TutorMessage): ModelMessage {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  };
}

function logLlmRequest(
  messages: ModelMessage[],
  system: string,
  options: {
    currentTitle?: string;
    onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
    startConversation?: boolean;
    titleUpdatedByUser?: boolean;
  },
  turn: number,
): void {
  logJson('[Mr. F LLM request]', {
    messageCount: messages.length,
    messages: messages.map((message, index) => ({
      content: message.content,
      index,
      role: message.role,
    })),
    model: env.llmModel,
    options,
    provider: env.llmProvider,
    system,
    turn,
  });
}

function buildLlmRequestTokenUsage(input: {
  messages: ModelMessage[];
  system: string;
  turn: number;
  usage?: LanguageModelUsage;
}): LlmRequestTokenUsage {
  const inputTokens =
    input.usage?.inputTokens ?? estimateTokenCount(input.system, input.messages);
  const contextWindowTokens = Math.max(1, env.llmContextWindow);

  return {
    contextWindowTokens,
    inputTokens,
    isEstimate: input.usage?.inputTokens === undefined,
    model: env.llmModel,
    percentUsed: Number(
      ((inputTokens / contextWindowTokens) * 100).toFixed(2),
    ),
    provider: env.llmProvider,
    turn: input.turn,
  };
}

function estimateTokenCount(system: string, messages: ModelMessage[]): number {
  const text = [
    system,
    ...messages.map((message) =>
      typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content),
    ),
  ].join('\n\n');

  return Math.max(1, Math.ceil(text.length / 4));
}

function logLlmResponse(
  object: unknown,
  finishReason: FinishReason,
  providerMetadata?: ProviderMetadata,
  turn?: number,
): void {
  logJson('[Mr. F LLM response]', {
    finishReason,
    object,
    providerMetadata,
    turn,
  });
}

function logJson(label: string, value: unknown): void {
  console.log(`${label} ${JSON.stringify(value, null, 2)}`);
}

function appendStructuredCorrectionRequest(
  messages: ModelMessage[],
  input: {
    error: unknown;
    invalidOutput?: string | null;
    reason: string;
    turn: number;
  },
): void {
  const invalidOutput = input.invalidOutput?.trim();

  if (invalidOutput) {
    messages.push({
      content: invalidOutput.slice(0, 6000),
      role: 'assistant',
    });
  }

  messages.push({
    content: [
      'INTERNAL APP CONTINUATION.',
      '',
      input.reason,
      'Do not respond with explanations, apologies, loose markdown, or any text before or after the JSON object.',
      'Re-emit the complete response as one JSON object that exactly satisfies the TutorResponse contract.',
      'Preserve the pedagogical intent of your previous response, but correct only the structured format.',
    ].join('\n'),
    role: 'user',
  });

  logJson('[Mr. F LLM structured correction requested]', {
    error: serializeLlmError(input.error),
    hadInvalidOutput: Boolean(invalidOutput),
    reason: input.reason,
    turn: input.turn,
  });
}

function isCorrectableLlmOutputError(error: unknown): boolean {
  const text = JSON.stringify(serializeLlmError(error)).toLowerCase();
  return (
    text.includes('no object generated') ||
    text.includes('json parsing failed') ||
    text.includes('could not parse') ||
    text.includes('type validation') ||
    text.includes('invalid') ||
    text.includes('schema')
  );
}

function extractGeneratedTextFromError(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }

  return extractGeneratedTextFromError(record.cause);
}

function serializeLlmError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      cause: serializeLlmError(error.cause),
      message: error.message,
      name: error.name,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      text: typeof record.text === 'string' ? record.text.slice(0, 6000) : undefined,
    };
  }

  return error;
}

function getLanguageModel(): LanguageModel {
  switch (env.llmProvider) {
    case 'openai':
      if (!env.openaiApiKey) {
        throw new MissingLlmApiKeyError('openai');
      }
      return createOpenAI({ apiKey: env.openaiApiKey })(env.llmModel);

    case 'openrouter':
      if (!env.openrouterApiKey) {
        throw new MissingLlmApiKeyError('openrouter');
      }
      return createOpenRouter({
        apiKey: env.openrouterApiKey,
        appName: 'Mister F',
        appUrl: env.appBaseUrl,
        baseURL: env.openrouterBaseUrl,
      }).chat(env.llmModel);

    case 'anthropic':
      if (!env.anthropicApiKey) {
        throw new MissingLlmApiKeyError('anthropic');
      }
      return createAnthropic({ apiKey: env.anthropicApiKey })(env.llmModel);

    case 'gemini':
    case 'google':
      if (
        !env.geminiApiKey ||
        env.geminiApiKey === 'replace_with_your_gemini_api_key'
      ) {
        throw new MissingLlmApiKeyError('google');
      }
      return createGoogleGenerativeAI({ apiKey: env.geminiApiKey })(
        env.llmModel,
      );

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${env.llmProvider}". Use google, openai, openrouter, or anthropic.`,
      );
  }
}

function getProviderOptions(): ProviderOptions | undefined {
  if (env.llmProvider === 'google' || env.llmProvider === 'gemini') {
    return {
      google: {
        thinkingConfig: {
          includeThoughts: false,
          thinkingBudget: env.geminiThinkingBudget,
        },
      },
    };
  }

  if (env.llmProvider === 'openai') {
    return {
      openai: {
        reasoningEffort: env.openaiReasoningEffort,
        textVerbosity: 'medium',
      },
    };
  }

  return undefined;
}

function shouldUseTemperature(): boolean {
  return !(
    (env.llmProvider === 'openai' || env.llmProvider === 'openrouter') &&
    /^(gpt-5|o[134]|o4)/i.test(env.llmModel)
  );
}

function getUserFacingFinishReasonMessage(
  finishReason: FinishReason,
  rawFinishReason?: string,
  providerMetadata?: ProviderMetadata,
): string | null {
  const normalizedRawFinishReason = rawFinishReason?.toUpperCase() ?? '';
  const metadataText = JSON.stringify(providerMetadata ?? {}).toUpperCase();

  if (finishReason === 'length' || normalizedRawFinishReason === 'MAX_TOKENS') {
    return 'La respuesta del modelo se cortó porque alcanzó el límite máximo de tokens. Intenta enviar un mensaje más corto o vuelve a pedirlo en partes.';
  }

  if (finishReason === 'content-filter' || normalizedRawFinishReason === 'SAFETY') {
    return 'El modelo detuvo la respuesta por sus filtros de seguridad. Prueba reformulando tu mensaje con un contexto más claro y neutral.';
  }

  if (
    normalizedRawFinishReason === 'RECITATION' ||
    metadataText.includes('RECITATION')
  ) {
    return 'El modelo detuvo la respuesta porque detectó una posible recitación de contenido protegido. Intenta pedir una explicación o una versión original en vez de una reproducción exacta.';
  }

  return null;
}

function buildAgentSystemInstruction(options: {
  currentProgressMarkdown?: string;
  currentTitle?: string;
  titleUpdatedByUser?: boolean;
}): string {
  return [
    getSystemInstruction(),
    '',
    '## Current Internal State',
    '',
    `Current title: ${options.currentTitle || 'Nueva conversación'}`,
    options.titleUpdatedByUser
      ? 'The user has already changed this title manually. Do not include conversation_title.'
      : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
    '',
    '## Structured Response Protocol',
    '',
    'You must always respond with one JSON object. Do not return loose markdown or any text outside the JSON object.',
    'The blocks property is an ordered array of actions that the app will apply in that exact order.',
    '',
    'Exact contract, written as TypeScript types:',
    '',
    tutorResponseTypeContract,
    '',
    'Block rules:',
    '- Evaluate English spelling strictly. If the learner misspells a word, such as "cal" instead of "call", the attempt must not be considered correct.',
    '- When the learner writes a translation attempt or a correction, include exactly one sentence_evaluation block before or together with the feedback.',
    '- If sentence_evaluation has all parts with status correct, you may include challenge_completed and then challenge_started for the next sentence.',
    '- When you include challenge_completed, the visible message block must show 2 or 3 alternative ways to express the same idea in English, with a brief Spanish explanation of when to use each variant.',
    '- If any parts are error or improve, do not include challenge_completed or challenge_started; give feedback and ask for another attempt.',
    '- When you propose a new Spanish sentence, include challenge_started and also a message block that shows that sentence to the learner.',
    '- Do not include progress or vocabulary in the chat response. The app computes those on demand with specialized calls.',
    '- Include conversation_title if the current title is generic and there is enough context, unless the user renamed it manually.',
  ].join('\n');
}

function buildProgressSystemInstruction(): string {
  return [
    'You are a pedagogical analyst for an English-learning app.',
    'You will receive only compact challenge data: source sentence and learner attempts.',
    'Generate an updated progress report in Spanish. Keep it concise and informative.',
    'Do not invent facts outside the challenge data. If something cannot be inferred, say so briefly in Spanish.',
    'Use markdown with exactly these Spanish section headings:',
    '',
    '## Tema',
    '## Nivel',
    '## Resumen',
    '## Errores frecuentes',
    '## Vocabulario',
    '',
    'Keep the result compact: ideally 120 to 180 Spanish words.',
    'Return only markdown. Do not return JSON. Do not use a code block.',
  ].join('\n');
}

function buildVocabularySystemInstruction(): string {
  return [
    'You are a vocabulary extractor for an English-learning app.',
    'You will receive only compact challenge data: source sentence and learner attempts.',
    'Extract useful vocabulary that appears in, or is directly derived from, those sentences and attempts.',
    'Do not invent vocabulary outside the context. Avoid trivial words like "the", "a", or "is" unless they are pedagogically relevant.',
    'Each item must have an English term, a Spanish translation, and a brief Spanish explanation.',
    'Include example only if you can provide a short, natural English example based on the context.',
    'Include sourceSentence if it helps locate where the vocabulary came from.',
    'Maximum 12 items.',
    'Return only JSON Lines: one line per item, no array, no wrapper object, no markdown, and no code fence.',
    'Each line must be a complete JSON object matching:',
    'type VocabularyLine = {',
    '    term: string;',
    '    translation: string;',
    '    explanation: string;',
    '    example?: string;',
    '    sourceSentence?: string;',
    '};',
    'Format example:',
    '{"term":"love song","translation":"canción de amor","explanation":"Canción cuyo tema principal es el amor.","example":"She sings a love song.","sourceSentence":"Ella canta una canción de amor."}',
    '{"term":"all night long","translation":"toda la noche","explanation":"Expresa que algo ocurre durante toda la noche.","sourceSentence":"Nosotros bailamos toda la noche."}',
  ].join('\n');
}

function buildTranslatorSystemInstruction(mode: TranslationMode): string {
  const direction =
    mode === 'es-en'
      ? 'Translate from Spanish to English.'
      : mode === 'en-es'
        ? 'Translate from English to Spanish.'
        : 'Detect whether the text is Spanish or English and translate it into the other language.';

  return [
    'You are a professional translator for an English-learning app.',
    direction,
    'Preserve the meaning, tone, and register of the original text.',
    'Do not explain the translation. Do not correct or teach grammar. Only translate.',
    'Respond with a JSON object matching TranslationResult.',
    '',
    'type TranslationResult = {',
    '  detectedLanguage: string;',
    '  translatedText: string;',
    '};',
  ].join('\n');
}

const genericTutorResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blocks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
  required: ['blocks'],
} as const;

const translationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedLanguage: {
      type: 'string',
    },
    translatedText: {
      type: 'string',
    },
  },
  required: ['detectedLanguage', 'translatedText'],
} as const;

const translationResultSchema = z
  .object({
    detectedLanguage: z.string().trim().min(1).max(80),
    translatedText: z.string().trim().min(1).max(3000),
  })
  .strict();

const vocabularyItemSchema = z
  .object({
    term: z.string().trim().min(1).max(90),
    translation: z.string().trim().min(1).max(160),
    explanation: z.string().trim().min(1).max(360),
    example: z.string().trim().min(1).max(240).optional(),
    sourceSentence: z.string().trim().min(1).max(320).optional(),
  })
  .strict();

const tutorResponseTypeContract = `type TutorResponse = {
  blocks: TutorResponseBlock[];
};

type TutorResponseBlock =
  | { type: "message"; markdown: string }
  | {
      type: "challenge_started";
      sourceSentence: string;
      topic?: string;
      level?: string;
    }
  | {
      type: "sentence_evaluation";
      parts: Array<{
        text: string;
        status: "correct" | "improve" | "error";
        explanation?: string;
      }>;
    }
  | { type: "challenge_completed"; score: number } // score must be a decimal from 0 to 1: use 1 for perfect, not 100.
  | { type: "conversation_title"; title: string };`;

const messageBlockSchema = z
  .object({
    type: z.literal('message'),
    markdown: z.string().trim().min(1).max(2400),
  })
  .strict();

const challengeStartedBlockSchema = z
  .object({
    type: z.literal('challenge_started'),
    sourceSentence: z.string().trim().min(1).max(320),
    topic: z.string().trim().min(1).max(80).optional(),
    level: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const sentenceEvaluationBlockSchema = z
  .object({
    type: z.literal('sentence_evaluation'),
    parts: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(140),
            status: z.enum(['correct', 'improve', 'error']),
            explanation: z.string().trim().max(320).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();

const challengeCompletedBlockSchema = z
  .object({
    type: z.literal('challenge_completed'),
    score: z
      .number()
      .nonnegative()
      .max(100)
      .transform((score) => (score > 1 ? score / 100 : score))
      .pipe(z.number().min(0).max(1)),
  })
  .strict();

const conversationTitleBlockSchema = z
  .object({
    type: z.literal('conversation_title'),
    title: z.string().trim().min(1).max(90),
  })
  .strict();

const tutorResponseSchema = z
  .object({
    blocks: z
      .array(
        z.discriminatedUnion('type', [
          messageBlockSchema,
          challengeStartedBlockSchema,
          sentenceEvaluationBlockSchema,
          challengeCompletedBlockSchema,
          conversationTitleBlockSchema,
        ]),
      )
      .min(1)
      .max(8),
  })
  .strict();

function validateTutorResponseBlocks(value: unknown): TutorResponseBlock[] {
  const parsed = tutorResponseSchema.safeParse(value);
  if (!parsed.success) {
    console.error('[Mr. F LLM response validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value,
    }, null, 2));
    throw new Error(
      'El modelo no devolvió una respuesta estructurada válida. Intenta de nuevo en unos segundos.',
    );
  }

  return parsed.data.blocks;
}

function blocksToMarkdown(blocks: TutorResponseBlock[]): string {
  const messageMarkdown = blocks
    .filter((block): block is TutorMessageBlock => block.type === 'message')
    .map((block) => block.markdown.trim())
    .filter(Boolean);

  if (messageMarkdown.length > 0) {
    return messageMarkdown.join('\n\n');
  }

  const started = [...blocks]
    .reverse()
    .find(
      (block): block is TutorChallengeStartedBlock =>
        block.type === 'challenge_started',
    );
  if (started) {
    return `Vamos con esta oración:\n\n**${started.sourceSentence}**`;
  }

  return 'Listo.';
}
