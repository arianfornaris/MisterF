import type {
  LanguageModelUsage,
  ModelMessage,
  ProviderMetadata,
  FinishReason,
} from 'ai';
import { env } from '../../config/env.js';
import type { LlmRequestOptions, LlmRequestTokenUsage } from './types.js';
import { resolveContextWindowTokens } from './modelMetadata.js';

export function logJson(label: string, value: unknown): void {
  console.log(`${label} ${JSON.stringify(value, null, 2)}`);
}

export function logLlmRequest(
  messages: ModelMessage[],
  system: string,
  options: {
    currentTitle?: string;
    llm?: LlmRequestOptions;
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
    options: {
      currentTitle: options.currentTitle,
      hasUserScopedOpenRouterKey: Boolean(options.llm?.openRouterApiKey),
      startConversation: options.startConversation,
      titleUpdatedByUser: options.titleUpdatedByUser,
      userId: options.llm?.userId,
    },
    provider: env.llmProvider,
    system,
    turn,
  });
}

export function logLlmResponse(
  object: unknown,
  finishReason: FinishReason,
  usage?: LanguageModelUsage,
  providerMetadata?: ProviderMetadata,
  turn?: number,
): void {
  logJson('[Mr. F LLM response]', {
    finishReason,
    object,
    providerMetadata,
    reasoningTokens: usage?.reasoningTokens,
    turn,
    usage,
  });
}

export function logLlmInvalidRawResponse(input: {
  error: unknown;
  rawText: string;
  turn?: number;
}): void {
  logJson('[Mr. F LLM invalid raw response]', {
    error:
      input.error instanceof Error
        ? {
            message: input.error.message,
            name: input.error.name,
          }
        : input.error,
    rawText: input.rawText,
    turn: input.turn,
  });
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

export async function buildLlmRequestTokenUsage(input: {
  messages: ModelMessage[];
  system: string;
  turn: number;
  usage?: LanguageModelUsage;
}): Promise<LlmRequestTokenUsage> {
  const inputTokens =
    input.usage?.inputTokens ?? estimateTokenCount(input.system, input.messages);
  const contextWindowTokens = await resolveContextWindowTokens(env.llmModel);

  return {
    contextWindowTokens,
    inputTokens,
    isEstimate: input.usage?.inputTokens === undefined,
    model: env.llmModel,
    percentUsed: Number(
      ((inputTokens / contextWindowTokens) * 100).toFixed(2),
    ),
    provider: env.llmProvider,
    reasoningTokens: input.usage?.reasoningTokens,
    turn: input.turn,
  };
}
