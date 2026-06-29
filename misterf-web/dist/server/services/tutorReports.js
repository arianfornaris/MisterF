import { generateText } from 'ai';
import { z } from 'zod';
import { logLlmInvalidRawResponse, logLlmRequest, logLlmResponse, shouldLogFullLlmTrace, } from './llmTutor/logging.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { renderSystemPrompt } from './systemPrompts.js';
import { logger } from './logger.js';
const maxTutorReportGenerationTurns = 4;
const tutorConversationReportSchema = z
    .object({
    report: z
        .object({
        difficultyAreas: z
            .array(z
            .object({
            description: z.string().trim().min(1).max(1600),
            title: z.string().trim().min(1).max(180),
        })
            .strict())
            .max(8),
        nextSteps: z.array(z.string().trim().min(1).max(500)).max(10),
        practicedTopics: z.array(z.string().trim().min(1).max(300)).max(12),
        progressHighlights: z.array(z.string().trim().min(1).max(500)).max(10),
        recommendations: z.array(z.string().trim().min(1).max(700)).max(10),
        summary: z
            .object({
            description: z.string().trim().min(1).max(4000),
            title: z.string().trim().min(1).max(220),
        })
            .strict(),
        usefulPhrases: z.array(z.string().trim().min(1).max(300)).max(20),
        vocabulary: z
            .array(z
            .object({
            example: z.string().trim().min(1).max(500).optional(),
            meaning: z.string().trim().min(1).max(500),
            term: z.string().trim().min(1).max(160),
        })
            .strict())
            .max(24),
    })
        .strict(),
})
    .strict();
const generatedPracticeGuideFromTutorReportSchema = z
    .object({
    description: z.string().trim().min(1).max(1500),
    title: z.string().trim().min(1).max(220),
    tutorInstructions: z.string().trim().min(1).max(12000),
})
    .strict();
function logTutorReportEvent(event, details) {
    const logEvent = `tutor_report_${event.replace(/[^a-z0-9]+/gi, '_')}`;
    const payload = sanitizeTutorReportLogDetails({
        ...details,
        tutorReportEvent: event,
    });
    if (event.endsWith(':error')) {
        logger.error(logEvent, payload);
        return;
    }
    if (event.includes('structured-correction')) {
        logger.info(logEvent, payload);
        return;
    }
    if (event.includes('schema-mismatch')) {
        logger.warn(logEvent, payload);
        return;
    }
    logger.debug(logEvent, payload);
}
function sanitizeTutorReportLogDetails(details) {
    if (shouldLogFullLlmTrace()) {
        return details;
    }
    const sanitized = { ...details };
    delete sanitized.userName;
    return sanitized;
}
function parseJsonFromModelText(text) {
    return JSON.parse(text.trim());
}
function formatTutorTranscript(messages) {
    return messages
        .map((message) => {
        const speaker = message.role === 'user' ? 'Learner' : 'Mister F';
        return `${speaker}: ${message.content}`;
    })
        .join('\n\n');
}
function appendStructuredCorrectionRequest(messages, input) {
    const invalidOutput = input.invalidOutput?.trim();
    if (invalidOutput) {
        messages.push({
            content: invalidOutput.slice(0, 10000),
            role: 'assistant',
        });
    }
    messages.push({
        content: renderSystemPrompt(input.promptPath, {
            CORRECTION_REASON: input.reason,
        }),
        role: 'user',
    });
    logTutorReportEvent('structured-correction-requested', {
        hadInvalidOutput: Boolean(invalidOutput),
        promptPath: input.promptPath,
        reason: input.reason,
        turn: input.turn,
    });
}
export async function generateTutorConversationReport(input) {
    const system = renderSystemPrompt('tutor/conversation-report.md');
    const messages = [
        {
            content: [
                `Learner name: ${input.userName}`,
                '',
                'Full Mister F conversation transcript:',
                formatTutorTranscript(input.messages) || '(empty)',
            ].join('\n'),
            role: 'user',
        },
    ];
    logTutorReportEvent('report:start', {
        hasOpenRouterKey: Boolean(input.openRouterApiKey),
        messageCount: input.messages.length,
        userName: input.userName,
    });
    for (let turn = 0; turn < maxTutorReportGenerationTurns; turn += 1) {
        const turnNumber = turn + 1;
        try {
            logLlmRequest(messages, system, {
                actorLabel: 'Tutor report',
                llm: {
                    modelTier: 'regular',
                    openRouterApiKey: input.openRouterApiKey,
                },
                operation: 'tutor_report',
            }, turnNumber);
            const result = await generateText({
                maxOutputTokens: 2600,
                messages,
                model: getLanguageModel({
                    modelTier: 'regular',
                    openRouterApiKey: input.openRouterApiKey,
                }),
                providerOptions: getProviderOptions(),
                system,
                temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.4 : undefined,
            });
            logLlmResponse(result.text, result.finishReason, result.usage, result.providerMetadata, turnNumber, {
                actorLabel: 'Tutor report',
                operation: 'tutor_report',
            });
            let parsedSource;
            try {
                parsedSource = parseJsonFromModelText(result.text);
            }
            catch (error) {
                logLlmInvalidRawResponse({
                    actorLabel: 'Tutor report',
                    error,
                    operation: 'tutor_report',
                    rawText: result.text,
                    turn: turnNumber,
                });
                if (turn < maxTutorReportGenerationTurns - 1) {
                    appendStructuredCorrectionRequest(messages, {
                        invalidOutput: result.text,
                        promptPath: 'tutor/conversation-report-correction.md',
                        reason: 'Your previous response was not valid JSON because it was truncated or malformed.',
                        turn: turnNumber,
                    });
                }
                continue;
            }
            const parsed = tutorConversationReportSchema.safeParse(parsedSource);
            if (!parsed.success) {
                logTutorReportEvent('report:schema-mismatch', {
                    issues: parsed.error.issues.map((issue) => ({
                        code: issue.code,
                        message: issue.message,
                        path: issue.path.join('.'),
                    })),
                    turn: turnNumber,
                });
                if (turn < maxTutorReportGenerationTurns - 1) {
                    appendStructuredCorrectionRequest(messages, {
                        invalidOutput: result.text,
                        promptPath: 'tutor/conversation-report-correction.md',
                        reason: 'Your previous JSON did not match the required schema for the tutor conversation report.',
                        turn: turnNumber,
                    });
                }
                continue;
            }
            const report = parsed.data.report;
            return {
                report: {
                    difficultyAreas: report.difficultyAreas,
                    nextSteps: report.nextSteps,
                    practicedTopics: report.practicedTopics,
                    progressHighlights: report.progressHighlights,
                    recommendations: report.recommendations,
                    usefulPhrases: report.usefulPhrases,
                    vocabulary: report.vocabulary,
                },
                summaryDescription: report.summary.description,
                summaryTitle: report.summary.title,
            };
        }
        catch (error) {
            logTutorReportEvent('report:error', {
                error: error instanceof Error ? error.message : String(error),
                turn: turnNumber,
            });
        }
    }
    throw new Error('Could not generate a valid tutor conversation report.');
}
export async function generatePracticeGuideFromTutorConversationReport(input) {
    const system = renderSystemPrompt('tutor/report-to-practice-guide.md');
    const messages = [
        {
            content: JSON.stringify({
                report: {
                    ...input.report.report,
                    summary: {
                        description: input.report.summaryDescription,
                        title: input.report.summaryTitle,
                    },
                },
            }),
            role: 'user',
        },
    ];
    for (let turn = 0; turn < maxTutorReportGenerationTurns; turn += 1) {
        const turnNumber = turn + 1;
        try {
            logLlmRequest(messages, system, {
                actorLabel: 'Tutor report practice guide',
                llm: {
                    modelTier: 'regular',
                    openRouterApiKey: input.openRouterApiKey,
                },
                operation: 'tutor_report_practice_guide',
            }, turnNumber);
            const result = await generateText({
                maxOutputTokens: 1400,
                messages,
                model: getLanguageModel({
                    modelTier: 'regular',
                    openRouterApiKey: input.openRouterApiKey,
                }),
                providerOptions: getProviderOptions(),
                system,
                temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.35 : undefined,
            });
            logLlmResponse(result.text, result.finishReason, result.usage, result.providerMetadata, turnNumber, {
                actorLabel: 'Tutor report practice guide',
                operation: 'tutor_report_practice_guide',
            });
            let parsedSource;
            try {
                parsedSource = parseJsonFromModelText(result.text);
            }
            catch (error) {
                logLlmInvalidRawResponse({
                    actorLabel: 'Tutor report practice guide',
                    error,
                    operation: 'tutor_report_practice_guide',
                    rawText: result.text,
                    turn: turnNumber,
                });
                if (turn < maxTutorReportGenerationTurns - 1) {
                    appendStructuredCorrectionRequest(messages, {
                        invalidOutput: result.text,
                        promptPath: 'tutor/report-to-practice-guide-correction.md',
                        reason: 'Your previous response was not valid JSON because it was truncated or malformed.',
                        turn: turnNumber,
                    });
                }
                continue;
            }
            const parsed = generatedPracticeGuideFromTutorReportSchema.safeParse(parsedSource);
            if (!parsed.success) {
                if (turn < maxTutorReportGenerationTurns - 1) {
                    appendStructuredCorrectionRequest(messages, {
                        invalidOutput: result.text,
                        promptPath: 'tutor/report-to-practice-guide-correction.md',
                        reason: 'Your previous JSON did not match the required schema for the practice guide payload.',
                        turn: turnNumber,
                    });
                }
                continue;
            }
            return parsed.data;
        }
        catch (error) {
            logTutorReportEvent('report-practice-guide:error', {
                error: error instanceof Error ? error.message : String(error),
                reportId: input.report.id,
                turn: turnNumber,
            });
        }
    }
    throw new Error('Could not generate a valid practice guide from the tutor report.');
}
//# sourceMappingURL=tutorReports.js.map