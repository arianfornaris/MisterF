import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import {
  generateText,
  jsonSchema,
  stepCountIs,
  type FinishReason,
  type LanguageModel,
  type ModelMessage,
  type ProviderMetadata,
  type Tool,
  type ToolSet,
} from 'ai';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import type { LlmToolDeclaration } from '../tools/types.js';

export type TutorMessage = {
  role: 'user' | 'model';
  content: string;
};

export type LlmToolCallLog = {
  args: Record<string, unknown>;
  name: string;
};

export type TutorToolCall = LlmToolCallLog & {
  id: string;
};

export type TutorAgentResult = {
  content: string;
  model: string;
  provider: string;
  toolCalls: LlmToolCallLog[];
};

export type TutorToolExecutor = (
  toolCall: TutorToolCall,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

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
    executeTool: TutorToolExecutor;
    startConversation?: boolean;
    titleUpdatedByUser?: boolean;
    toolDeclarations: LlmToolDeclaration[];
  },
): Promise<TutorAgentResult> {
  const messages = history.map(toModelMessage);
  const toolCalls: LlmToolCallLog[] = [];

  if (options.startConversation || messages.length === 0) {
    messages.push({
      content: firstChallengePrompt,
      role: 'user',
    });
  }

  const result = await generateText({
    maxOutputTokens: 900,
    messages,
    model: getLanguageModel(),
    providerOptions: getProviderOptions(),
    stopWhen: stepCountIs(6),
    system: buildAgentSystemInstruction(options),
    temperature: shouldUseTemperature() ? 0.45 : undefined,
    toolChoice: 'auto',
    tools: toAiSdkTools(options.toolDeclarations, options.executeTool, toolCalls),
  });

  const userFacingFinishMessage = getUserFacingFinishReasonMessage(
    result.finishReason,
    result.rawFinishReason,
    result.providerMetadata,
  );
  if (userFacingFinishMessage) {
    throw new LlmFinishReasonError(
      result.rawFinishReason ?? result.finishReason,
      userFacingFinishMessage,
    );
  }

  return {
    content: result.text.trim(),
    model: env.llmModel,
    provider: env.llmProvider,
    toolCalls,
  };
}

function toModelMessage(message: TutorMessage): ModelMessage {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  };
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

function toAiSdkTools(
  declarations: LlmToolDeclaration[],
  executeTool: TutorToolExecutor,
  toolCalls: LlmToolCallLog[],
): ToolSet {
  const tools: Record<string, Tool> = {};

  for (const declaration of declarations) {
    tools[declaration.name] = {
      description: declaration.description,
      inputSchema: jsonSchema(declaration.parametersJsonSchema),
      execute: async (input, executionOptions) => {
        const args =
          input && typeof input === 'object'
            ? (input as Record<string, unknown>)
            : {};
        const toolCall = {
          args,
          id: executionOptions.toolCallId,
          name: declaration.name,
        };

        toolCalls.push({ args: toolCall.args, name: toolCall.name });
        return executeTool(toolCall);
      },
    };
  }

  return tools;
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
      ? 'El usuario ya cambió este título manualmente. No llames update_conversation_title.'
      : 'Puedes llamar update_conversation_title si el tema o propósito ya está claro y el título actual es genérico.',
    '',
    'Progreso actual:',
    options.currentProgressMarkdown || '(todavía no hay progreso guardado)',
    '',
    '## Uso de tools',
    '',
    '- Evalúa la ortografía inglesa con rigor. Si el usuario escribe una palabra mal, como "cal" en vez de "call", el intento no debe considerarse correcto.',
    '- Debes llamar start_sentence_challenge cada vez que propongas una oración nueva en español para que el usuario la traduzca.',
    '- Puedes llamar update_learning_progress cuando haya información útil nueva sobre tema, nivel, resumen, errores frecuentes o vocabulario.',
    '- Debes llamar update_sentence_evaluation cada vez que estés corrigiendo o evaluando un intento de traducción del usuario.',
    '- Puedes llamar update_conversation_title cuando el título actual sea genérico y ya exista suficiente contexto.',
    '- Después de llamar tools, continúa con tu respuesta normal al usuario.',
    '- No menciones al usuario que llamaste tools.',
  ].join('\n');
}
