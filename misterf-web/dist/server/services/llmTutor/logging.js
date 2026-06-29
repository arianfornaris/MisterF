import { env } from '../../config/env.js';
import { logger, serializeError } from '../logger.js';
import { resolveContextWindowTokens } from './modelMetadata.js';
import { getConfiguredModelId } from './providers.js';
export function normalizeLlmTraceMode(value) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'off' || normalized === 'metadata' || normalized === 'full') {
        return normalized;
    }
    return 'metadata';
}
export function shouldLogFullLlmTrace(context = {}) {
    const mode = normalizeLlmTraceMode(env.llmTraceMode);
    if (mode === 'off') {
        return false;
    }
    if (mode === 'full') {
        return true;
    }
    return (matchesTraceSelector(env.llmTraceFullConversationIds, context.conversationId) ||
        matchesTraceSelector(env.llmTraceFullUserIds, context.userId));
}
export function logLlmRequest(messages, system, options, turn) {
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
export function logLlmResponse(object, finishReason, usage, providerMetadata, turn, actorLabelOrContext = 'Mr. F') {
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
export function logLlmToolCalls(input) {
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
export function logLlmInvalidRawResponse(input) {
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
function estimateTokenCount(system, messages) {
    const text = [
        system,
        ...messages.map((message) => typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content)),
    ].join('\n\n');
    return Math.max(1, Math.ceil(text.length / 4));
}
export async function buildLlmRequestTokenUsage(input) {
    const inputTokens = input.usage?.inputTokens ?? estimateTokenCount(input.system, input.messages);
    const modelId = getConfiguredModelId(input.llm);
    const contextWindowTokens = await resolveContextWindowTokens(modelId);
    return {
        contextWindowTokens,
        inputTokens,
        isEstimate: input.usage?.inputTokens === undefined,
        model: modelId,
        percentUsed: Number(((inputTokens / contextWindowTokens) * 100).toFixed(2)),
        provider: env.llmProvider,
        reasoningTokens: input.usage?.reasoningTokens,
        turn: input.turn,
    };
}
function shouldLogLlmTrace() {
    return normalizeLlmTraceMode(env.llmTraceMode) !== 'off';
}
function buildLlmLogBase(context, details = {}) {
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
function normalizeActorContext(actorLabelOrContext) {
    if (typeof actorLabelOrContext === 'string') {
        return { actorLabel: actorLabelOrContext };
    }
    return actorLabelOrContext;
}
function resolveTraceContext(context) {
    return {
        conversationId: context.conversationId,
        userId: context.userId ?? context.llm?.userId ?? null,
    };
}
function matchesTraceSelector(selectors, value) {
    return Boolean(value && selectors.includes(value));
}
function summarizeModelMessages(messages) {
    return messages.map((message, index) => ({
        contentKind: typeof message.content,
        contentLength: typeof message.content === 'string'
            ? message.content.length
            : JSON.stringify(message.content).length,
        index,
        role: message.role,
    }));
}
function summarizeLlmObject(value) {
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
    const record = value;
    if (Array.isArray(record.blocks)) {
        return {
            blockCount: record.blocks.length,
            blockTypes: record.blocks
                .map((block) => block && typeof block === 'object'
                ? block.type
                : undefined)
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
function summarizeProviderMetadata(metadata) {
    if (!metadata) {
        return undefined;
    }
    return {
        providers: Object.keys(metadata),
    };
}
//# sourceMappingURL=logging.js.map