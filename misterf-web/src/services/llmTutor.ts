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
Comienza la sesion.
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
        maxOutputTokens: 900,
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
            'El objeto JSON fue parseado, pero no cumple el contrato TutorResponse descrito en las instrucciones.',
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
          'Tu respuesta anterior no fue JSON valido o no pudo convertirse en un objeto TutorResponse.',
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
    maxOutputTokens: 500,
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
    maxOutputTokens: 800,
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
  if (!markdown) {
    throw new Error('El progreso no devolvió contenido.');
  }

  return {
    markdown,
    model: env.llmModel,
    provider: env.llmProvider,
  };
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
  const result = await generateObject({
    maxOutputTokens: 1300,
    messages,
    model: getLanguageModel(),
    providerOptions: getProviderOptions(),
    schema: jsonSchema(vocabularyJsonSchema),
    schemaDescription:
      'Useful vocabulary extracted from sentence challenges and user attempts.',
    schemaName: 'VocabularyResult',
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

  const parsed = vocabularyResultSchema.safeParse(result.object);
  if (!parsed.success) {
    console.error('[Mr. F vocabulary validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value: result.object,
    }, null, 2));
    throw new Error('El vocabulario no devolvió una respuesta válida.');
  }

  return {
    items: parsed.data.items,
    model: env.llmModel,
    provider: env.llmProvider,
  };
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
      'CONTINUACION INTERNA DE LA APP.',
      '',
      input.reason,
      'No respondas con explicaciones, disculpas, markdown suelto ni texto antes o despues del JSON.',
      'Reemite la respuesta completa como un unico objeto JSON que cumpla exactamente el contrato TutorResponse.',
      'Conserva la intención pedagógica de tu respuesta anterior, pero corrige exclusivamente el formato estructurado.',
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
    '## Estado interno actual',
    '',
    `Título actual: ${options.currentTitle || 'Nueva conversación'}`,
    options.titleUpdatedByUser
      ? 'El usuario ya cambió este título manualmente. No incluyas conversation_title.'
      : 'Puedes incluir conversation_title si el tema o propósito ya está claro y el título actual es genérico.',
    '',
    '## Protocolo de respuesta estructurada',
    '',
    'Debes responder siempre con un objeto JSON. No devuelvas markdown suelto ni texto fuera del JSON.',
    'La propiedad blocks es un array ordenado de acciones que la app aplicará en ese orden.',
    '',
    'Contrato exacto, escrito como tipos de TypeScript:',
    '',
    tutorResponseTypeContract,
    '',
    'Reglas de bloques:',
    '- Evalúa la ortografía inglesa con rigor. Si el usuario escribe una palabra mal, como "cal" en vez de "call", el intento no debe considerarse correcto.',
    '- Cuando el usuario escriba un intento de traducción o una corrección, incluye exactamente un bloque sentence_evaluation antes o junto al feedback.',
    '- Si sentence_evaluation tiene todas las partes con status correct, puedes incluir challenge_completed y luego challenge_started para la siguiente oración.',
    '- Cuando incluyas challenge_completed, el bloque message visible debe mostrar 2 o 3 formas alternativas de decir la misma idea en inglés, con una explicación breve de cuándo usar cada variante.',
    '- Si hay partes error o improve, no incluyas challenge_completed ni challenge_started; da feedback y pide otro intento.',
    '- Cuando propongas una oración nueva en español, incluye challenge_started y también un bloque message que muestre esa oración al usuario.',
    '- No incluyas progreso ni vocabulario en la respuesta del chat. La app los calcula bajo demanda con llamadas especializadas.',
    '- Incluye conversation_title si el título actual es genérico y ya existe suficiente contexto, salvo que el usuario haya renombrado manualmente.',
  ].join('\n');
}

function buildProgressSystemInstruction(): string {
  return [
    'Eres un analista pedagógico para una app de aprendizaje de inglés.',
    'Recibirás solo datos compactos de retos: oración y respuestas del usuario.',
    'Genera un progreso actualizado en español, conciso e informativo.',
    'No inventes datos fuera de los retos. Si algo no se puede inferir, dilo brevemente.',
    'Usa markdown con exactamente estas secciones:',
    '',
    '## Tema',
    '## Nivel',
    '## Resumen',
    '## Errores frecuentes',
    '## Vocabulario',
    '',
    'Mantén el resultado compacto: idealmente 120 a 180 palabras.',
    'Devuelve solo markdown. No devuelvas JSON. No uses bloque de código.',
  ].join('\n');
}

function buildVocabularySystemInstruction(): string {
  return [
    'Eres un extractor de vocabulario para una app de aprendizaje de inglés.',
    'Recibirás solo datos compactos de retos: oración y respuestas del usuario.',
    'Extrae vocabulario útil que aparezca o se derive directamente de esas oraciones e intentos.',
    'No inventes vocabulario fuera del contexto. Evita palabras triviales como "the", "a", "is" salvo que sean pedagógicamente relevantes.',
    'Cada item debe tener término en inglés, traducción al español y explicación breve en español.',
    'Incluye example solo si puedes dar un ejemplo corto y natural en inglés basado en el contexto.',
    'Incluye sourceSentence si ayuda a ubicar de dónde salió el vocabulario.',
    'Máximo 12 items.',
    'Responde solo con JSON que cumpla:',
    'type VocabularyResult = {',
    '  items: Array<{',
    '    term: string;',
    '    translation: string;',
    '    explanation: string;',
    '    example?: string;',
    '    sourceSentence?: string;',
    '  }>',
    '};',
  ].join('\n');
}

function buildTranslatorSystemInstruction(mode: TranslationMode): string {
  const direction =
    mode === 'es-en'
      ? 'Traduce de español a inglés.'
      : mode === 'en-es'
        ? 'Traduce de inglés a español.'
        : 'Detecta si el texto está en español o inglés y tradúcelo al otro idioma.';

  return [
    'Eres un traductor profesional para una app de aprendizaje de inglés.',
    direction,
    'Conserva el sentido, el tono y el registro del texto original.',
    'No expliques la traducción. No corrijas ni enseñes gramática. Solo traduce.',
    'Responde con un objeto JSON que cumpla TranslationResult.',
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

const vocabularyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      minItems: 0,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          term: { type: 'string' },
          translation: { type: 'string' },
          explanation: { type: 'string' },
          example: { type: 'string' },
          sourceSentence: { type: 'string' },
        },
        required: ['term', 'translation', 'explanation'],
      },
    },
  },
  required: ['items'],
} as const;

const translationResultSchema = z
  .object({
    detectedLanguage: z.string().trim().min(1).max(80),
    translatedText: z.string().trim().min(1).max(3000),
  })
  .strict();

const vocabularyResultSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            term: z.string().trim().min(1).max(90),
            translation: z.string().trim().min(1).max(160),
            explanation: z.string().trim().min(1).max(360),
            example: z.string().trim().min(1).max(240).optional(),
            sourceSentence: z.string().trim().min(1).max(320).optional(),
          })
          .strict(),
      )
      .max(12),
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
  | { type: "challenge_completed"; score: number } // score debe ser decimal de 0 a 1: usa 1 para perfecto, no 100.
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
