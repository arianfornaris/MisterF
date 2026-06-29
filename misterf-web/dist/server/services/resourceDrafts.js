import { generateText } from 'ai';
import { z } from 'zod';
import { assignmentBlockSchema, assignmentDraftSchema, } from './assignments.js';
import { normalizeRoleplayRevisionConversationHistory, roleplayDraftSchema, roleplayRevisionSchema, } from './roleplays.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature } from './llmTutor/providers.js';
import { logLlmInvalidRawResponse, logLlmRequest, logLlmResponse } from './llmTutor/logging.js';
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';
const maxDraftGenerationTurns = 4;
const practiceGuideDraftSchema = z.object({
    description: z.string().trim().min(1).max(1500),
    title: z.string().trim().min(1).max(220),
    tutorInstructions: z.string().trim().min(1).max(12000),
}).strict();
const assignmentRevisionSchema = z.object({
    assistantMessage: z.string().trim().min(1).max(2000),
    draft: assignmentDraftSchema,
}).strict();
function parseJsonFromModelText(text) {
    return JSON.parse(text.trim());
}
function appendCorrectionRequest(messages, input) {
    const invalidOutput = input.invalidOutput?.trim();
    if (invalidOutput) {
        messages.push({
            content: invalidOutput.slice(0, 10000),
            role: 'assistant',
        });
    }
    messages.push({
        content: renderSystemPrompt(input.correctionPromptPath, {
            CORRECTION_REASON: input.reason,
        }),
        role: 'user',
    });
    logger.info('resource_draft_structured_correction', {
        actorLabel: input.actorLabel,
        hadInvalidOutput: Boolean(invalidOutput),
        reason: input.reason,
        turn: input.turn,
    });
}
function summarizeParsedJsonShape(value) {
    if (!isPlainRecord(value)) {
        return {
            valueType: Array.isArray(value) ? 'array' : typeof value,
        };
    }
    const blocks = Array.isArray(value.blocks) ? value.blocks : null;
    return {
        blockCount: blocks?.length,
        itemKinds: blocks?.slice(0, 32).map((block, index) => {
            const blockRecord = isPlainRecord(block) ? block : {};
            const itemRecord = isPlainRecord(blockRecord.item) ? blockRecord.item : {};
            return {
                id: typeof blockRecord.id === 'string' ? blockRecord.id : undefined,
                index,
                kind: typeof itemRecord.kind === 'string' ? itemRecord.kind : undefined,
            };
        }),
        topLevelKeys: Object.keys(value).slice(0, 24),
    };
}
function summarizeZodIssues(issues, maxIssues = 16) {
    const summaries = [];
    const addIssue = (issue, pathPrefix = []) => {
        if (summaries.length >= maxIssues) {
            return;
        }
        const issueRecord = issue;
        summaries.push({
            code: issue.code,
            expected: issueRecord.expected,
            keys: issueRecord.keys,
            message: issue.message,
            path: formatZodPath([...pathPrefix, ...issue.path]),
            values: issueRecord.values,
        });
    };
    const visitIssue = (issue, pathPrefix = []) => {
        if (summaries.length >= maxIssues) {
            return;
        }
        const issueRecord = issue;
        const nestedErrors = issueRecord.errors;
        if (issue.code === 'invalid_union' && Array.isArray(nestedErrors)) {
            const nestedPath = [...pathPrefix, ...issue.path];
            for (const branch of nestedErrors) {
                if (!Array.isArray(branch)) {
                    continue;
                }
                for (const childIssue of branch) {
                    visitIssue(childIssue, nestedPath);
                    if (summaries.length >= maxIssues) {
                        return;
                    }
                }
            }
            return;
        }
        addIssue(issue, pathPrefix);
    };
    for (const issue of issues) {
        visitIssue(issue);
        if (summaries.length >= maxIssues) {
            break;
        }
    }
    return summaries;
}
function formatZodPath(path) {
    if (path.length === 0) {
        return '(root)';
    }
    return path.map((segment) => String(segment)).join('.');
}
function isPlainRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
async function generateStructuredDraft(input) {
    const system = renderSystemPrompt(input.systemPromptPath);
    const messages = [
        {
            content: input.initialUserMessage,
            role: 'user',
        },
    ];
    for (let turn = 0; turn < maxDraftGenerationTurns; turn += 1) {
        logLlmRequest(messages, system, {
            actorLabel: input.actorLabel,
            llm: {
                modelTier: 'regular',
                openRouterApiKey: input.openRouterApiKey,
            },
            operation: 'resource_draft',
        }, turn + 1);
        const result = await generateText({
            maxOutputTokens: input.maxOutputTokens ?? 1800,
            model: getLanguageModel({
                modelTier: 'regular',
                openRouterApiKey: input.openRouterApiKey,
            }),
            messages,
            providerOptions: getProviderOptions(),
            system,
            temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.45 : undefined,
        });
        logLlmResponse(result.text, result.finishReason, result.usage, result.providerMetadata, turn + 1, {
            actorLabel: input.actorLabel,
            operation: 'resource_draft',
        });
        let parsedJson;
        try {
            parsedJson = parseJsonFromModelText(result.text);
        }
        catch (error) {
            logLlmInvalidRawResponse({
                actorLabel: input.actorLabel,
                error,
                operation: 'resource_draft',
                rawText: result.text,
                turn: turn + 1,
            });
            if (turn < maxDraftGenerationTurns - 1) {
                appendCorrectionRequest(messages, {
                    actorLabel: input.actorLabel,
                    correctionPromptPath: input.correctionPromptPath,
                    invalidOutput: result.text,
                    reason: 'Your previous response was not valid JSON.',
                    turn: turn + 1,
                });
                continue;
            }
            throw new Error('La IA devolvió un borrador inválido.');
        }
        const parsed = input.schema.safeParse(parsedJson);
        if (!parsed.success) {
            logger.warn('resource_draft_validation_failed', {
                actorLabel: input.actorLabel,
                issueCount: parsed.error.issues.length,
                issues: summarizeZodIssues(parsed.error.issues),
                operation: 'resource_draft',
                parsedShape: summarizeParsedJsonShape(parsedJson),
                turn: turn + 1,
            });
            if (turn < maxDraftGenerationTurns - 1) {
                appendCorrectionRequest(messages, {
                    actorLabel: input.actorLabel,
                    correctionPromptPath: input.correctionPromptPath,
                    invalidOutput: result.text,
                    reason: 'Your previous JSON did not match the required schema.',
                    turn: turn + 1,
                });
                continue;
            }
            throw new Error('La IA devolvió un borrador incompleto.');
        }
        return parsed.data;
    }
    throw new Error('No pude generar un borrador usable.');
}
export async function generatePracticeGuideDraft(input) {
    return generateStructuredDraft({
        actorLabel: 'Practice guide draft',
        correctionPromptPath: 'resources/practice-guide-draft-correction.md',
        initialUserMessage: input.prompt,
        openRouterApiKey: input.openRouterApiKey,
        schema: practiceGuideDraftSchema,
        systemPromptPath: 'resources/practice-guide-draft.md',
    });
}
export async function generatePracticeGuideRevision(input) {
    return generateStructuredDraft({
        actorLabel: 'Practice guide revision',
        correctionPromptPath: 'resources/practice-guide-revision-correction.md',
        initialUserMessage: JSON.stringify({
            currentPracticeGuide: input.currentPracticeGuide,
            requestedChange: input.prompt,
        }, null, 2),
        maxOutputTokens: 4000,
        openRouterApiKey: input.openRouterApiKey,
        schema: practiceGuideDraftSchema,
        systemPromptPath: 'resources/practice-guide-revision.md',
    });
}
export async function generateAssignmentDraft(input) {
    return generateStructuredDraft({
        actorLabel: 'Assignment draft',
        correctionPromptPath: 'resources/assignment-draft-correction.md',
        initialUserMessage: input.prompt,
        maxOutputTokens: 6000,
        openRouterApiKey: input.openRouterApiKey,
        schema: assignmentDraftSchema,
        systemPromptPath: 'resources/assignment-draft.md',
    });
}
export async function generateAssignmentRevision(input) {
    return generateStructuredDraft({
        actorLabel: 'Assignment revision',
        correctionPromptPath: 'resources/assignment-revision-correction.md',
        initialUserMessage: JSON.stringify({
            conversationHistory: normalizeAssignmentRevisionConversationHistory(input.conversationHistory ?? []),
            currentDraft: input.currentDraft,
            requestedChange: input.prompt,
        }, null, 2),
        maxOutputTokens: 7600,
        openRouterApiKey: input.openRouterApiKey,
        schema: assignmentRevisionSchema,
        systemPromptPath: 'resources/assignment-revision.md',
    });
}
function normalizeAssignmentRevisionConversationHistory(messages) {
    const recentMessages = messages
        .flatMap((message) => {
        const content = message.content.trim();
        if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
            return [];
        }
        const draftSnapshot = assignmentDraftSchema.safeParse(message.draftSnapshot);
        return [{
                content: content.slice(0, 4000),
                createdAt: message.createdAt?.trim() || undefined,
                draftSnapshot: draftSnapshot.success ? draftSnapshot.data : undefined,
                role: message.role,
            }];
    })
        .slice(-24);
    let includedSnapshots = 0;
    return recentMessages
        .slice()
        .reverse()
        .map((message) => {
        if (!message.draftSnapshot || includedSnapshots >= 6) {
            return {
                content: message.content,
                createdAt: message.createdAt,
                role: message.role,
            };
        }
        includedSnapshots += 1;
        return message;
    })
        .reverse();
}
export async function generateAssignmentBlock(input) {
    return generateStructuredDraft({
        actorLabel: 'Assignment block',
        correctionPromptPath: 'resources/assignment-block-correction.md',
        initialUserMessage: JSON.stringify({
            blockKind: input.blockKind,
            currentDraft: input.currentDraft,
            requestedBlock: input.prompt,
        }, null, 2),
        maxOutputTokens: 2400,
        openRouterApiKey: input.openRouterApiKey,
        schema: assignmentBlockSchema,
        systemPromptPath: 'resources/assignment-block.md',
    });
}
export async function generateRoleplayDraft(input) {
    return generateStructuredDraft({
        actorLabel: 'Roleplay draft',
        correctionPromptPath: 'resources/roleplay-draft-correction.md',
        initialUserMessage: input.prompt,
        maxOutputTokens: 4800,
        openRouterApiKey: input.openRouterApiKey,
        schema: roleplayDraftSchema,
        systemPromptPath: 'resources/roleplay-draft.md',
    });
}
export async function generateRoleplayRevision(input) {
    return generateStructuredDraft({
        actorLabel: 'Roleplay revision',
        correctionPromptPath: 'resources/roleplay-revision-correction.md',
        initialUserMessage: JSON.stringify({
            conversationHistory: normalizeRoleplayRevisionConversationHistory(input.conversationHistory ?? []),
            currentDraft: input.currentDraft,
            requestedChange: input.prompt,
        }, null, 2),
        maxOutputTokens: 5600,
        openRouterApiKey: input.openRouterApiKey,
        schema: roleplayRevisionSchema,
        systemPromptPath: 'resources/roleplay-revision.md',
    });
}
//# sourceMappingURL=resourceDrafts.js.map