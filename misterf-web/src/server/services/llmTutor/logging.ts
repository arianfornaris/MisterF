import type {
  LanguageModelUsage,
  ModelMessage,
  ProviderMetadata,
  FinishReason,
} from 'ai';
import { env } from '../../config/env.js';
import type { ResourceType } from '../../db/repository.js';
import { logger, serializeError } from '../logger.js';
import type { LlmRequestOptions, LlmRequestTokenUsage } from './types.js';
import { resolveContextWindowTokens } from './modelMetadata.js';
import { getConfiguredModelId } from './providers.js';

export type LlmTraceMode = 'off' | 'metadata' | 'full';

type LlmLogContext = {
  actorLabel?: string;
  conversationId?: string | null;
  currentTitle?: string;
  llm?: LlmRequestOptions;
  operation?: string;
  profileId?: string | null;
  resourceId?: string | null;
  resourceType?: ResourceType | null;
  titleUpdatedByUser?: boolean;
  userId?: string | null;
};

export function normalizeLlmTraceMode(value: string | undefined): LlmTraceMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'off' || normalized === 'metadata' || normalized === 'full') {
    return normalized;
  }

  return 'metadata';
}

export function shouldLogFullLlmTrace(context: {
  conversationId?: string | null;
  userId?: string | null;
} = {}): boolean {
  const mode = normalizeLlmTraceMode(env.llmTraceMode);
  if (mode === 'off') {
    return false;
  }

  if (mode === 'full') {
    return true;
  }

  return (
    matchesTraceSelector(env.llmTraceFullConversationIds, context.conversationId) ||
    matchesTraceSelector(env.llmTraceFullUserIds, context.userId)
  );
}

export function logLlmRequest(
  messages: ModelMessage[],
  system: string,
  options: LlmLogContext,
  turn: number,
): void {
  if (!shouldLogLlmTrace()) {
    return;
  }

  const modelId = getConfiguredModelId(options.llm);
  const fullTrace = shouldLogFullLlmTrace(resolveTraceContext(options));
  logger.debug('llm_request', {
    ...buildLlmLogBase(options, {
      model: modelId,
      turn,
    }),
    fullTrace,
    messageCount: messages.length,
    messages: fullTrace
      ? messages.map((message, index) => ({
          content: message.content,
          index,
          role: message.role,
        }))
      : summarizeModelMessages(messages),
    options: {
      currentTitle: fullTrace ? options.currentTitle : undefined,
      hasCurrentTitle: Boolean(options.currentTitle),
      hasUserScopedOpenRouterKey: Boolean(options.llm?.openRouterApiKey),
      titleUpdatedByUser: options.titleUpdatedByUser,
    },
    system: fullTrace ? system : undefined,
  });
}

export function logLlmResponse(
  object: unknown,
  finishReason: FinishReason,
  usage?: LanguageModelUsage,
  providerMetadata?: ProviderMetadata,
  turn?: number,
  actorLabelOrContext: string | LlmLogContext = 'Mr. F',
): void {
  if (!shouldLogLlmTrace()) {
    return;
  }

  const context = normalizeActorContext(actorLabelOrContext);
  const fullTrace = shouldLogFullLlmTrace(resolveTraceContext(context));
  logger.debug('llm_response', {
    ...buildLlmLogBase(context, {
      turn,
    }),
    finishReason,
    fullTrace,
    object: fullTrace ? object : summarizeLlmObject(object),
    providerMetadata: fullTrace ? providerMetadata : summarizeProviderMetadata(providerMetadata),
    reasoningTokens: usage?.reasoningTokens,
    usage,
  });
}

export function logLlmToolCalls(input: {
  actorLabel?: string;
  conversationId?: string | null;
  llm?: LlmRequestOptions;
  operation?: string;
  profileId?: string | null;
  resourceId?: string | null;
  resourceType?: ResourceType | null;
  steps: Array<{
    text?: string;
    toolCalls?: Array<{
      input?: unknown;
      toolCallId?: string;
      toolName?: string;
    }>;
    toolResults?: Array<{
      output?: unknown;
      preliminary?: boolean;
      toolCallId?: string;
      toolName?: string;
    }>;
  }>;
  turn?: number;
  userId?: string | null;
}): void {
  if (!shouldLogLlmTrace()) {
    return;
  }

  const fullTrace = shouldLogFullLlmTrace(resolveTraceContext(input));
  const stepsWithTools = input.steps
    .map((step, index) => ({
      index,
      text: fullTrace ? step.text : undefined,
      toolCalls: (step.toolCalls ?? []).map((toolCall) => ({
        input: fullTrace ? toolCall.input : summarizeLlmObject(toolCall.input),
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
      })),
      toolResults: (step.toolResults ?? []).map((toolResult) => ({
        output: fullTrace ? toolResult.output : summarizeLlmObject(toolResult.output),
        preliminary: toolResult.preliminary,
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
      })),
    }))
    .filter((step) => step.toolCalls.length > 0 || step.toolResults.length > 0);

  if (stepsWithTools.length === 0) {
    return;
  }

  logger.debug('llm_tool_calls', {
    ...buildLlmLogBase(input, {
      turn: input.turn,
    }),
    fullTrace,
    steps: stepsWithTools,
  });
}

export function logLlmInvalidRawResponse(input: {
  actorLabel?: string;
  conversationId?: string | null;
  error: unknown;
  llm?: LlmRequestOptions;
  operation?: string;
  profileId?: string | null;
  rawText: string;
  resourceId?: string | null;
  resourceType?: ResourceType | null;
  turn?: number;
  userId?: string | null;
}): void {
  const fullTrace = shouldLogFullLlmTrace(resolveTraceContext(input));
  logger.warn('llm_invalid_raw_response', {
    ...buildLlmLogBase(input, {
      turn: input.turn,
    }),
    error: serializeError(input.error),
    fullTrace,
    rawText: fullTrace ? input.rawText : undefined,
    rawTextLength: input.rawText.length,
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
  llm?: LlmRequestOptions;
  messages: ModelMessage[];
  system: string;
  turn: number;
  usage?: LanguageModelUsage;
}): Promise<LlmRequestTokenUsage> {
  const inputTokens =
    input.usage?.inputTokens ?? estimateTokenCount(input.system, input.messages);
  const modelId = getConfiguredModelId(input.llm);
  const contextWindowTokens = await resolveContextWindowTokens(modelId);

  return {
    contextWindowTokens,
    inputTokens,
    isEstimate: input.usage?.inputTokens === undefined,
    model: modelId,
    percentUsed: Number(
      ((inputTokens / contextWindowTokens) * 100).toFixed(2),
    ),
    provider: env.llmProvider,
    reasoningTokens: input.usage?.reasoningTokens,
    turn: input.turn,
  };
}

function shouldLogLlmTrace(): boolean {
  return normalizeLlmTraceMode(env.llmTraceMode) !== 'off';
}

function buildLlmLogBase(
  context: LlmLogContext,
  details: {
    model?: string;
    turn?: number;
  } = {},
): Record<string, unknown> {
  return {
    actorLabel: context.actorLabel || 'Mr. F',
    conversationId: context.conversationId ?? null,
    model: details.model ?? (context.llm ? getConfiguredModelId(context.llm) : undefined),
    operation: context.operation ?? 'tutor',
    profileId: context.profileId ?? null,
    provider: env.llmProvider,
    resourceId: context.resourceId ?? null,
    resourceType: context.resourceType ?? null,
    turn: details.turn,
    userId: context.userId ?? context.llm?.userId ?? null,
  };
}

function normalizeActorContext(
  actorLabelOrContext: string | LlmLogContext,
): LlmLogContext {
  if (typeof actorLabelOrContext === 'string') {
    return { actorLabel: actorLabelOrContext };
  }

  return actorLabelOrContext;
}

function resolveTraceContext(context: {
  conversationId?: string | null;
  llm?: LlmRequestOptions;
  userId?: string | null;
}): {
  conversationId?: string | null;
  userId?: string | null;
} {
  return {
    conversationId: context.conversationId,
    userId: context.userId ?? context.llm?.userId ?? null,
  };
}

function matchesTraceSelector(
  selectors: string[],
  value: string | null | undefined,
): boolean {
  return Boolean(value && selectors.includes(value));
}

function summarizeModelMessages(messages: ModelMessage[]): Array<{
  contentKind: string;
  contentLength: number | null;
  index: number;
  role: string;
}> {
  return messages.map((message, index) => ({
    contentKind: typeof message.content,
    contentLength:
      typeof message.content === 'string'
        ? message.content.length
        : JSON.stringify(message.content).length,
    index,
    role: message.role,
  }));
}

function summarizeLlmObject(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return {
      type: value === null ? 'null' : typeof value,
    };
  }

  if (Array.isArray(value)) {
    return {
      itemCount: value.length,
      type: 'array',
    };
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.blocks)) {
    return {
      blockCount: record.blocks.length,
      blockTypes: record.blocks
        .map((block) =>
          block && typeof block === 'object'
            ? (block as { type?: unknown }).type
            : undefined,
        )
        .filter(Boolean),
      keys: Object.keys(record),
      type: 'object',
    };
  }

  return {
    keys: Object.keys(record),
    type: 'object',
  };
}

function summarizeProviderMetadata(metadata: ProviderMetadata | undefined): unknown {
  if (!metadata) {
    return undefined;
  }

  return {
    providers: Object.keys(metadata),
  };
}
