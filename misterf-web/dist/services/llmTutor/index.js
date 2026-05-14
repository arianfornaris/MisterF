import { generateText, stepCountIs, } from 'ai';
import { env } from '../../config/env.js';
import { LlmFinishReasonError } from './errors.js';
import { buildLlmRequestTokenUsage, logLlmInvalidRawResponse, logLlmRequest, logLlmResponse, logLlmToolCalls, } from './logging.js';
import { buildTutorPracticeModuleTools, extractInferredPracticeModuleLinkBlocks } from './practiceModuleTools.js';
import { buildTranslatorSystemInstruction, buildAgentSystemInstruction } from './prompt.js';
import { getConfiguredModelId, getLanguageModel, getProviderOptions, getUserFacingFinishReasonMessage, shouldUseTemperature } from './providers.js';
import { appendStructuredCorrectionRequest, buildStructuredValidationReason, extractGeneratedTextFromError, isCorrectableLlmOutputError } from './corrections.js';
import { translationResultSchema } from './schemas.js';
import { blocksToMarkdown, toModelMessage, validateTutorResponseBlocks } from './validation.js';
const firstChallengePrompt = `
Start the session.
`;
const maxAgentTurns = 6;
function mergeTutorPracticeModuleLinkBlocks(blocks, inferredLinks) {
    const seenPracticeModuleIds = new Set(blocks
        .filter((block) => block.type === 'practice_module_link')
        .map((block) => block.practiceModuleId));
    return [
        ...blocks,
        ...inferredLinks.filter((link) => !seenPracticeModuleIds.has(link.practiceModuleId)),
    ];
}
async function continueTutorResponseAfterToolUse(input) {
    const finalizedToolResults = input.toolResults.filter((result) => !result.preliminary);
    const messages = [
        {
            role: 'user',
            content: [
                'INTERNAL APP CONTINUATION.',
                'The previous step already used tools and may have completed practice-module operations successfully.',
                'Continue the current conversation turn.',
                'Do not greet the learner.',
                'Do not introduce yourself.',
                'Do not speak as if this were a new conversation or a fresh start.',
                'Do not call any more tools in this step.',
                'Now re-emit the complete final TutorResponse as exactly one JSON object and nothing else.',
                'Do not use markdown fences.',
                'Use the tool results below as context.',
                '',
                JSON.stringify(finalizedToolResults.map((result) => ({
                    output: result.output,
                    toolName: result.toolName,
                })), null, 2),
            ].join('\n'),
        },
    ];
    return generateText({
        abortSignal: input.abortSignal,
        maxOutputTokens: 1800,
        messages,
        model: getLanguageModel(input.llm),
        providerOptions: getProviderOptions(),
        system: input.system,
        temperature: shouldUseTemperature(input.llm) ? 0.25 : undefined,
    });
}
function parseJsonFromModelText(text) {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        throw new Error(`JSON parsing failed: ${message}`);
    }
}
function extractEmbeddedTutorResponseJson(text) {
    const blocksIndex = text.indexOf('"blocks"');
    if (blocksIndex === -1) {
        return null;
    }
    const startIndex = text.lastIndexOf('{', blocksIndex);
    if (startIndex === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let isEscaped = false;
    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (char === '\\') {
                isEscaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') {
            depth += 1;
            continue;
        }
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(startIndex, index + 1).trim();
            }
        }
    }
    return null;
}
function looksLikeJsonAttempt(text) {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') ||
        trimmed.startsWith('[') ||
        trimmed.startsWith('```json') ||
        trimmed.startsWith('```'));
}
function buildFallbackBlocksFromPlainText(input) {
    const inferredLinks = extractInferredPracticeModuleLinkBlocks(input.toolResults);
    const trimmedText = input.text.trim();
    if (!trimmedText) {
        return inferredLinks.length > 0
            ? inferredLinks
            : [{ type: 'message', markdown: 'Listo.' }];
    }
    return mergeTutorPracticeModuleLinkBlocks([{ type: 'message', markdown: trimmedText }], inferredLinks);
}
export async function runTutorAgentLoop(history, options) {
    const messages = history.map(toModelMessage);
    if (options.startConversation || messages.length === 0) {
        messages.push({
            content: firstChallengePrompt,
            role: 'user',
        });
    }
    const system = buildAgentSystemInstruction({
        ...options,
    });
    let lastError = null;
    const tools = buildTutorPracticeModuleTools({
        currentPracticeModuleId: options.currentPracticeModuleId ?? null,
        onToolCall: options.onToolCall,
        profileId: options.profileId ?? null,
        userId: options.userId ?? null,
    });
    for (let turn = 0; turn < maxAgentTurns; turn += 1) {
        logLlmRequest(messages, system, options, turn + 1);
        try {
            const result = await generateText({
                abortSignal: options.abortSignal,
                maxOutputTokens: 1800,
                messages,
                model: getLanguageModel(options.llm),
                providerOptions: getProviderOptions(),
                stopWhen: stepCountIs(6),
                system,
                temperature: shouldUseTemperature(options.llm) ? 0.45 : undefined,
                tools,
            });
            logLlmToolCalls({
                steps: result.steps,
                turn: turn + 1,
            });
            const toolResults = result.steps.flatMap((step) => step.toolResults);
            let effectiveResult = result;
            let finalBlocks = null;
            let parsedObject = null;
            const initialText = result.text.trim();
            if (!initialText) {
                finalBlocks = buildFallbackBlocksFromPlainText({
                    text: result.text,
                    toolResults,
                });
            }
            else {
                try {
                    parsedObject = parseJsonFromModelText(result.text);
                    finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject), extractInferredPracticeModuleLinkBlocks(toolResults));
                }
                catch (error) {
                    const embeddedJson = extractEmbeddedTutorResponseJson(result.text);
                    if (embeddedJson) {
                        try {
                            parsedObject = parseJsonFromModelText(embeddedJson);
                            finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject), extractInferredPracticeModuleLinkBlocks(toolResults));
                        }
                        catch (embeddedError) {
                            logLlmInvalidRawResponse({
                                error: embeddedError,
                                rawText: result.text,
                                turn: turn + 1,
                            });
                            throw embeddedError;
                        }
                    }
                    else if (!looksLikeJsonAttempt(result.text)) {
                        finalBlocks = buildFallbackBlocksFromPlainText({
                            text: result.text,
                            toolResults,
                        });
                    }
                    else {
                        effectiveResult = await continueTutorResponseAfterToolUse({
                            abortSignal: options.abortSignal,
                            llm: options.llm,
                            system,
                            toolResults,
                        });
                        try {
                            parsedObject = parseJsonFromModelText(effectiveResult.text);
                            finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject), extractInferredPracticeModuleLinkBlocks(toolResults));
                        }
                        catch (continuationError) {
                            logLlmInvalidRawResponse({
                                error: continuationError,
                                rawText: effectiveResult.text,
                                turn: turn + 1,
                            });
                            throw continuationError;
                        }
                    }
                }
            }
            logLlmResponse(parsedObject ?? { blocks: finalBlocks }, effectiveResult.finishReason, effectiveResult.usage, effectiveResult.providerMetadata, turn + 1);
            options.onTokenUsage?.(await buildLlmRequestTokenUsage({
                llm: options.llm,
                messages,
                system,
                turn: turn + 1,
                usage: effectiveResult.usage,
            }));
            const userFacingFinishMessage = getUserFacingFinishReasonMessage(effectiveResult.finishReason, undefined, effectiveResult.providerMetadata);
            if (userFacingFinishMessage) {
                throw new LlmFinishReasonError(result.finishReason, userFacingFinishMessage);
            }
            try {
                if (!finalBlocks || finalBlocks.length === 0) {
                    throw new Error('The model returned no usable response blocks.');
                }
                options.validateBlocks?.(finalBlocks);
                return {
                    blocks: finalBlocks,
                    content: blocksToMarkdown(finalBlocks),
                    model: getConfiguredModelId(options.llm),
                    provider: env.llmProvider,
                };
            }
            catch (error) {
                lastError = error;
                if (turn >= maxAgentTurns - 1) {
                    throw error;
                }
                appendStructuredCorrectionRequest(messages, {
                    error,
                    invalidOutput: effectiveResult.text,
                    reason: buildStructuredValidationReason(error),
                    turn: turn + 1,
                });
            }
        }
        catch (error) {
            lastError = error;
            if (error instanceof LlmFinishReasonError ||
                !isCorrectableLlmOutputError(error)) {
                throw error;
            }
            if (turn >= maxAgentTurns - 1) {
                throw error;
            }
            appendStructuredCorrectionRequest(messages, {
                error,
                invalidOutput: extractGeneratedTextFromError(error),
                reason: 'Your previous response was not valid JSON or could not be converted into a TutorResponse object.',
                turn: turn + 1,
            });
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error('The model did not return a usable structured response.');
}
export async function translateTextWithLlm(input) {
    const text = input.text.trim();
    if (!text) {
        throw new Error('No hay texto para traducir.');
    }
    const result = await generateText({
        maxOutputTokens: 1000,
        messages: [{ content: text, role: 'user' }],
        model: getLanguageModel(input.llm),
        providerOptions: getProviderOptions(),
        system: buildTranslatorSystemInstruction(input.mode),
        temperature: shouldUseTemperature(input.llm) ? 0.15 : undefined,
    });
    const userFacingFinishMessage = getUserFacingFinishReasonMessage(result.finishReason, undefined, result.providerMetadata);
    if (userFacingFinishMessage) {
        throw new LlmFinishReasonError(result.finishReason, userFacingFinishMessage);
    }
    const parsed = translationResultSchema.safeParse(parseJsonFromModelText(result.text));
    if (!parsed.success) {
        console.error('[Mr. F translator validation failed]', JSON.stringify({
            issues: parsed.error.issues,
            value: result.text,
        }, null, 2));
        throw new Error('El traductor no devolvió una respuesta válida.');
    }
    console.log('[Mr. F translator response]', JSON.stringify({
        detectedLanguage: parsed.data.detectedLanguage,
        mode: input.mode,
        model: getConfiguredModelId(input.llm),
        provider: env.llmProvider,
    }, null, 2));
    return {
        detectedLanguage: parsed.data.detectedLanguage,
        model: getConfiguredModelId(input.llm),
        provider: env.llmProvider,
        translatedText: parsed.data.translatedText,
    };
}
export * from './types.js';
export * from './errors.js';
//# sourceMappingURL=index.js.map