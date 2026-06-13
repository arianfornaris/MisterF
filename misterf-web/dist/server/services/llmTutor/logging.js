import { env } from '../../config/env.js';
import { resolveContextWindowTokens } from './modelMetadata.js';
import { getConfiguredModelId } from './providers.js';
export function logJson(label, value) {
    console.log(`${label} ${JSON.stringify(value, null, 2)}`);
}
export function logLlmRequest(messages, system, options, turn) {
    const modelId = getConfiguredModelId(options.llm);
    logJson(`[${options.actorLabel || 'Mr. F'} LLM request]`, {
        messageCount: messages.length,
        messages: messages.map((message, index) => ({
            content: message.content,
            index,
            role: message.role,
        })),
        model: modelId,
        options: {
            currentTitle: options.currentTitle,
            hasUserScopedOpenRouterKey: Boolean(options.llm?.openRouterApiKey),
            titleUpdatedByUser: options.titleUpdatedByUser,
            userId: options.llm?.userId,
        },
        provider: env.llmProvider,
        system,
        turn,
    });
}
export function logLlmResponse(object, finishReason, usage, providerMetadata, turn, actorLabel = 'Mr. F') {
    logJson(`[${actorLabel} LLM response]`, {
        finishReason,
        object,
        providerMetadata,
        reasoningTokens: usage?.reasoningTokens,
        turn,
        usage,
    });
}
export function logLlmToolCalls(input) {
    const stepsWithTools = input.steps
        .map((step, index) => ({
        index,
        text: step.text,
        toolCalls: (step.toolCalls ?? []).map((toolCall) => ({
            input: toolCall.input,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
        })),
        toolResults: (step.toolResults ?? []).map((toolResult) => ({
            output: toolResult.output,
            preliminary: toolResult.preliminary,
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
        })),
    }))
        .filter((step) => step.toolCalls.length > 0 || step.toolResults.length > 0);
    if (stepsWithTools.length === 0) {
        return;
    }
    logJson(`[${input.actorLabel || 'Mr. F'} LLM tool calls]`, {
        steps: stepsWithTools,
        turn: input.turn,
    });
}
export function logLlmInvalidRawResponse(input) {
    logJson(`[${input.actorLabel || 'Mr. F'} LLM invalid raw response]`, {
        error: input.error instanceof Error
            ? {
                message: input.error.message,
                name: input.error.name,
            }
            : input.error,
        rawText: input.rawText,
        turn: input.turn,
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
//# sourceMappingURL=logging.js.map