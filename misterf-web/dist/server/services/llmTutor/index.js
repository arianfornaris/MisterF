import { generateText, stepCountIs, } from 'ai';
import { env } from '../../config/env.js';
import { renderSystemPrompt } from '../systemPrompts.js';
import { LlmFinishReasonError, QuizResultEvaluationValidationError, } from './errors.js';
import { buildLlmRequestTokenUsage, logLlmInvalidRawResponse, logLlmRequest, logLlmResponse, logLlmToolCalls, shouldLogFullLlmTrace, } from './logging.js';
import { buildTutorChatRoomTools } from './chatRoomTools.js';
import { repairTutorResponseBlocks } from './blockRepair.js';
import { buildTutorConversationTools } from './conversationTools.js';
import { buildTutorPracticeModuleTools, extractInferredPracticeModuleLinkBlocks } from './practiceModuleTools.js';
import { buildTutorProgressTools } from './progressTools.js';
import { buildTranslatorSystemInstruction, buildAgentSystemInstruction } from './prompt.js';
import { getConfiguredModelId, getLanguageModel, getProviderOptions, getUserFacingFinishReasonMessage, shouldUseTemperature } from './providers.js';
import { appendStructuredCorrectionRequest, buildStructuredValidationReason, extractGeneratedTextFromError, isCorrectableLlmOutputError } from './corrections.js';
import { quizResultEvaluationsSchema, translationResultSchema } from './schemas.js';
import { blocksToMarkdown, toModelMessage, validateTutorResponseBlocks } from './validation.js';
import { applyTutorPlanBlocks, formatTutorPlanForModel } from '../tutorPlans.js';
import { logger } from '../logger.js';
const maxAgentTurns = 6;
const maxQuizEvaluationCorrectionAttempts = 3;
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
            content: renderSystemPrompt('tutor/internal-tool-continuation.md', {
                TOOL_RESULTS_JSON: JSON.stringify(finalizedToolResults.map((result) => ({
                    output: result.output,
                    toolName: result.toolName,
                })), null, 2),
            }),
            role: 'user',
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
    const system = buildAgentSystemInstruction({
        ...options,
        tutorPlanText: formatTutorPlanForModel(options.tutorPlan ?? null),
    });
    let lastError = null;
    const practiceModuleTools = buildTutorPracticeModuleTools({
        currentPracticeModuleId: options.currentPracticeModuleId ?? null,
        onToolCall: options.onToolCall,
        profileId: options.profileId ?? null,
        userId: options.userId ?? null,
    });
    const chatRoomTools = buildTutorChatRoomTools({
        onToolCall: options.onToolCall,
        profileId: options.profileId ?? null,
        userId: options.userId ?? null,
    });
    const progressTools = buildTutorProgressTools({
        onToolCall: options.onToolCall,
        profileId: options.profileId ?? null,
        userId: options.userId ?? null,
    });
    const conversationTools = buildTutorConversationTools({
        conversationId: options.conversationId ?? null,
        onConversationRenamed: options.onConversationRenamed,
        onToolCall: options.onToolCall,
        userId: options.userId ?? null,
    });
    const mergedTools = {
        ...(practiceModuleTools || {}),
        ...(chatRoomTools || {}),
        ...(progressTools || {}),
        ...(conversationTools || {}),
    };
    const tools = Object.keys(mergedTools).length > 0
        ? mergedTools
        : undefined;
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
                actorLabel: 'Mr. F',
                conversationId: options.conversationId ?? null,
                llm: options.llm,
                operation: 'tutor',
                profileId: options.profileId ?? null,
                steps: result.steps,
                turn: turn + 1,
                userId: options.userId ?? null,
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
                    finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject, {
                        conversationId: options.conversationId ?? null,
                        generatedText: result.text,
                        llm: options.llm,
                        operation: 'tutor',
                        userId: options.userId ?? null,
                    }), extractInferredPracticeModuleLinkBlocks(toolResults));
                }
                catch (error) {
                    const embeddedJson = extractEmbeddedTutorResponseJson(result.text);
                    if (embeddedJson) {
                        try {
                            parsedObject = parseJsonFromModelText(embeddedJson);
                            finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject, {
                                conversationId: options.conversationId ?? null,
                                generatedText: embeddedJson,
                                llm: options.llm,
                                operation: 'tutor',
                                userId: options.userId ?? null,
                            }), extractInferredPracticeModuleLinkBlocks(toolResults));
                        }
                        catch (embeddedError) {
                            logLlmInvalidRawResponse({
                                actorLabel: 'Mr. F',
                                conversationId: options.conversationId ?? null,
                                error: embeddedError,
                                llm: options.llm,
                                operation: 'tutor',
                                profileId: options.profileId ?? null,
                                rawText: result.text,
                                turn: turn + 1,
                                userId: options.userId ?? null,
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
                            finalBlocks = mergeTutorPracticeModuleLinkBlocks(validateTutorResponseBlocks(parsedObject, {
                                conversationId: options.conversationId ?? null,
                                generatedText: effectiveResult.text,
                                llm: options.llm,
                                operation: 'tutor',
                                userId: options.userId ?? null,
                            }), extractInferredPracticeModuleLinkBlocks(toolResults));
                        }
                        catch (continuationError) {
                            logLlmInvalidRawResponse({
                                actorLabel: 'Mr. F',
                                conversationId: options.conversationId ?? null,
                                error: continuationError,
                                llm: options.llm,
                                operation: 'tutor',
                                profileId: options.profileId ?? null,
                                rawText: effectiveResult.text,
                                turn: turn + 1,
                                userId: options.userId ?? null,
                            });
                            throw continuationError;
                        }
                    }
                }
            }
            logLlmResponse(parsedObject ?? { blocks: finalBlocks }, effectiveResult.finishReason, effectiveResult.usage, effectiveResult.providerMetadata, turn + 1, {
                actorLabel: 'Mr. F',
                conversationId: options.conversationId ?? null,
                llm: options.llm,
                operation: 'tutor',
                profileId: options.profileId ?? null,
                userId: options.userId ?? null,
            });
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
                const repairResult = await repairTutorResponseBlocks({
                    abortSignal: options.abortSignal,
                    blocks: finalBlocks,
                    llm: options.llm,
                });
                finalBlocks = repairResult.blocks;
                if (repairResult.repaired) {
                    logger.info('llm_response_repaired', {
                        actorLabel: 'Mr. F',
                        blockTypes: finalBlocks.map((block) => block.type),
                        conversationId: options.conversationId ?? null,
                        profileId: options.profileId ?? null,
                        turn: turn + 1,
                        userId: options.userId ?? null,
                    });
                }
                options.validateBlocks?.(finalBlocks);
                applyTutorPlanBlocks(finalBlocks, options.tutorPlan ?? null);
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
        const fullTrace = shouldLogFullLlmTrace({
            userId: input.llm?.userId ?? null,
        });
        logger.warn('llm_translator_validation_failed', {
            fullTrace,
            issues: parsed.error.issues,
            model: getConfiguredModelId(input.llm),
            provider: env.llmProvider,
            value: fullTrace ? result.text : undefined,
            valueLength: result.text.length,
        });
        throw new Error('El traductor no devolvió una respuesta válida.');
    }
    logger.debug('llm_translator_response', {
        detectedLanguage: parsed.data.detectedLanguage,
        mode: input.mode,
        model: getConfiguredModelId(input.llm),
        provider: env.llmProvider,
        userId: input.llm?.userId ?? null,
    });
    return {
        detectedLanguage: parsed.data.detectedLanguage,
        model: getConfiguredModelId(input.llm),
        provider: env.llmProvider,
        translatedText: parsed.data.translatedText,
    };
}
export async function evaluateQuizResultItemsWithLlm(input) {
    const system = renderSystemPrompt('tutor/quiz-result-evaluation.md');
    const messages = [
        {
            content: JSON.stringify({
                quiz: input.quiz,
                responses: input.responses,
            }, null, 2),
            role: 'user',
        },
    ];
    let lastError = null;
    for (let attempt = 0; attempt < maxQuizEvaluationCorrectionAttempts; attempt += 1) {
        const result = await generateText({
            maxOutputTokens: 1600,
            messages,
            model: getLanguageModel(input.llm),
            providerOptions: getProviderOptions(),
            system,
            temperature: shouldUseTemperature(input.llm) ? 0.15 : undefined,
        });
        try {
            const userFacingFinishMessage = getUserFacingFinishReasonMessage(result.finishReason, undefined, result.providerMetadata);
            if (userFacingFinishMessage) {
                throw new LlmFinishReasonError(result.finishReason, userFacingFinishMessage);
            }
            const parsed = quizResultEvaluationsSchema.safeParse(parseJsonFromModelText(result.text));
            if (!parsed.success) {
                const fullTrace = shouldLogFullLlmTrace({
                    userId: input.llm?.userId ?? null,
                });
                logger.warn('llm_quiz_result_evaluation_failed', {
                    fullTrace,
                    issues: parsed.error.issues,
                    model: getConfiguredModelId(input.llm),
                    provider: env.llmProvider,
                    value: fullTrace ? result.text : undefined,
                    valueLength: result.text.length,
                });
                throw new QuizResultEvaluationValidationError({
                    generatedText: result.text,
                    issues: parsed.error.issues,
                });
            }
            return parsed.data.items;
        }
        catch (error) {
            lastError = error;
            if (attempt >= maxQuizEvaluationCorrectionAttempts - 1) {
                throw error;
            }
            appendQuizResultEvaluationCorrectionRequest(messages, {
                error,
                invalidOutput: result.text,
            });
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error('El evaluador del quiz no devolvió una respuesta válida.');
}
function appendQuizResultEvaluationCorrectionRequest(messages, input) {
    const invalidOutput = input.invalidOutput?.trim();
    if (invalidOutput) {
        messages.push({
            content: invalidOutput.slice(0, 6000),
            role: 'assistant',
        });
    }
    messages.push({
        content: renderSystemPrompt('tutor/quiz-result-evaluation-correction.md', {
            CORRECTION_REASON: buildQuizResultEvaluationCorrectionReason(input.error),
        }),
        role: 'user',
    });
}
function buildQuizResultEvaluationCorrectionReason(error) {
    if (error instanceof QuizResultEvaluationValidationError) {
        if (error.issues.length === 0) {
            return 'Your previous quiz evaluation JSON did not satisfy the required schema.';
        }
        return [
            'Your previous quiz evaluation JSON did not satisfy the required schema.',
            'Fix the invalid parts below and re-emit the full JSON object.',
            ...error.issues.map((issue, index) => {
                const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
                return `${index + 1}. path=${path} :: ${issue.message}`;
            }),
        ].join('\n');
    }
    if (error instanceof LlmFinishReasonError) {
        return [
            'Your previous quiz evaluation response could not be accepted.',
            error.message,
            'Re-emit the same evaluation more concisely so it fits, but keep the required structure and required explanations.',
        ].join('\n');
    }
    if (error instanceof Error) {
        return [
            'Your previous quiz evaluation response could not be accepted.',
            error.message.trim(),
            'Re-emit the full JSON object in the required shape.',
        ].join('\n');
    }
    return 'Your previous quiz evaluation response could not be accepted. Re-emit the full JSON object in the required shape.';
}
export * from './types.js';
export * from './errors.js';
//# sourceMappingURL=index.js.map