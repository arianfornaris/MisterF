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

/**
 * What an inference cost, as a first-class `info` event.
 *
 * This is deliberately **not** part of the trace above. `llm_request` and
 * `llm_response` are debugging output: they carry prompts and completions, so
 * they are `debug` and gated behind `LLM_TRACE_MODE`. Production runs at
 * `LOG_LEVEL=info` with tracing on `metadata`, so the cost figures inside
 * `llm_response` were written **nowhere in production** — the only cost data the
 * project ever had came from a developer's local box, which is why pricing a
 * learner's cycle kept coming back to guesswork.
 *
 * Emitted for every model call regardless of trace mode, with no prompt or
 * completion text, so it is safe to keep on permanently.
 *
 * `costUsd` is what the provider reported for this call. Note it is **not** the
 * same as the account's billed usage: reconcile against the key's `usage`
 * before quoting a price to anyone.
 */
export function logLlmCost(input: {
  context: LlmLogContext;
  finishReason?: FinishReason;
  providerMetadata?: ProviderMetadata;
  usage?: LanguageModelUsage;
}): void {
  const raw = readProviderCostDetails(input.providerMetadata, input.usage);

  logger.info('llm_cost', {
    ...buildLlmLogBase(input.context),
    costUsd: raw.costUsd,
    finishReason: input.finishReason,
    inputTokens: input.usage?.inputTokens,
    outputTokens: input.usage?.outputTokens,
    reasoningTokens: input.usage?.reasoningTokens,
    totalTokens: input.usage?.totalTokens,
    upstreamCostUsd: raw.upstreamCostUsd,
  });
}

/**
 * Pulls the provider's own cost numbers out of the usage payload.
 *
 * OpenRouter reports `cost` plus a `cost_details.upstream_inference_cost`. They
 * are equal on ordinary traffic, but they have diverged before — when the
 * account routed through its own provider key, `cost` read 0 and only the
 * upstream figure was real, which silently emptied the credit system of any
 * enforcement. Both are recorded so a future divergence is visible instead of
 * being averaged away.
 */
function readProviderCostDetails(
  providerMetadata: ProviderMetadata | undefined,
  usage: LanguageModelUsage | undefined,
): { costUsd: number | null; upstreamCostUsd: number | null } {
  const raw = (usage as { raw?: Record<string, unknown> } | undefined)?.raw
    ?? (providerMetadata?.openrouter as { usage?: Record<string, unknown> } | undefined)?.usage;

  if (!raw || typeof raw !== 'object') {
    return { costUsd: null, upstreamCostUsd: null };
  }

  const details = (raw as { cost_details?: Record<string, unknown> }).cost_details;
  const cost = (raw as { cost?: unknown }).cost;
  const upstream = details?.upstream_inference_cost;

  return {
    costUsd: typeof cost === 'number' ? cost : null,
    upstreamCostUsd: typeof upstream === 'number' ? upstream : null,
  };
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
      dynamic?: boolean;
      error?: unknown;
      input?: unknown;
      invalid?: boolean;
      providerExecuted?: boolean;
      toolCallId?: string;
      toolName?: string;
    }>;
    toolResults?: Array<{
      dynamic?: boolean;
      output?: unknown;
      preliminary?: boolean;
      providerExecuted?: boolean;
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
        dynamic: toolCall.dynamic,
        error: toolCall.error ? serializeError(toolCall.error) : undefined,
        input: fullTrace ? toolCall.input : summarizeLlmObject(toolCall.input),
        invalid: toolCall.invalid,
        providerExecuted: toolCall.providerExecuted,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
      })),
      toolResults: (step.toolResults ?? []).map((toolResult) => ({
        dynamic: toolResult.dynamic,
        output: fullTrace ? toolResult.output : summarizeLlmObject(toolResult.output),
        preliminary: toolResult.preliminary,
        providerExecuted: toolResult.providerExecuted,
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
