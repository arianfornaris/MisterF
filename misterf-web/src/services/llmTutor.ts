import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import {
  generateObject,
  jsonSchema,
  type FinishReason,
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

export type TutorResponseBlock =
  | TutorMessageBlock
  | TutorChallengeStartedBlock
  | TutorSentenceEvaluationBlock
  | TutorChallengeCompletedBlock
  | TutorLearningProgressBlock
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

export type TutorLearningProgressBlock = {
  type: 'learning_progress';
  markdown: string;
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
    currentProgressMarkdown?: string;
    currentTitle?: string;
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
  logLlmRequest(messages, system, options);

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

  logLlmResponse(result.object, result.finishReason, result.providerMetadata);

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
    currentProgressMarkdown?: string;
    currentTitle?: string;
    startConversation?: boolean;
    titleUpdatedByUser?: boolean;
  },
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
  });
}

function logLlmResponse(
  object: unknown,
  finishReason: FinishReason,
  providerMetadata?: ProviderMetadata,
): void {
  logJson('[Mr. F LLM response]', {
    finishReason,
    object,
    providerMetadata,
  });
}

function logJson(label: string, value: unknown): void {
  console.log(`${label} ${JSON.stringify(value, null, 2)}`);
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
    'Progreso actual:',
    options.currentProgressMarkdown || '(todavía no hay progreso guardado)',
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
    '- Si hay partes error o improve, no incluyas challenge_completed ni challenge_started; da feedback y pide otro intento.',
    '- Cuando propongas una oración nueva en español, incluye challenge_started y también un bloque message que muestre esa oración al usuario.',
    '- Incluye learning_progress solo cuando haya información nueva útil sobre tema, nivel, errores frecuentes o vocabulario.',
    '- Incluye conversation_title si el título actual es genérico y ya existe suficiente contexto, salvo que el usuario haya renombrado manualmente.',
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
  | { type: "learning_progress"; markdown: string }
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

const learningProgressBlockSchema = z
  .object({
    type: z.literal('learning_progress'),
    markdown: z.string().trim().min(1).max(2400),
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
          learningProgressBlockSchema,
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
