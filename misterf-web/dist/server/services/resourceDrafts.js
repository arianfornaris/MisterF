import { generateText } from 'ai';
import { defaultProfileModelTier, } from '../profiles/modelTier.js';
import { z } from 'zod';
import { quizBlockSchema, quizDraftSchema, quizMetadataSchema, quizSectionSchema, } from './quizzes.js';
import { quizItemSchema } from './llmTutor/schemas.js';
import { normalizeRoleplayRevisionConversationHistory, roleplayAuthoringDraftSchema, roleplayRevisionSchema, } from './roleplays.js';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { logLlmCost, logLlmInvalidRawResponse, logLlmRequest, logLlmResponse, } from './llmTutor/logging.js';
import { logger } from './logger.js';
import { buildUserContentWithAttachments, } from '../attachments/modelParts.js';
import { renderSystemPrompt } from './systemPrompts.js';
import { instructionLanguageEnglishName, quizAuthoringPlaceholders, } from './llmTutor/languagePack.js';
import { buildRoleplayCharacterAvatarPromptOptions } from '../roleplays/avatarRegistry.js';
const maxDraftGenerationTurns = 4;
function languagePromptVariables(instructionLanguage = 'es') {
    return {
        INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(instructionLanguage),
    };
}
export const practiceGuideDraftSchema = z.object({
    description: z.string().trim().min(1).max(1500),
    title: z.string().trim().min(1).max(220),
    tutorInstructions: z.string().trim().min(1).max(12000),
}).strict();
const practiceGuideRevisionSchema = z.object({
    assistantMessage: z.string().trim().min(1).max(2000),
    guide: practiceGuideDraftSchema,
}).strict();
const quizMetadataRevisionSchema = z.object({
    metadata: quizMetadataSchema,
}).strict();
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
            ...(input.systemPromptVariables ?? {}),
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
    // The learner's own profile setting decides the model, like every other
    // inference. This was hardcoded to `regular` until 2026-08-03, so a profile
    // set to Lite still paid Regular for every quiz, roleplay, guide, and
    // summary it generated.
    const tier = input.modelTier ?? defaultProfileModelTier;
    const attachments = input.attachments ?? [];
    const system = renderSystemPrompt(input.systemPromptPath, input.systemPromptVariables);
    const messages = [
        {
            content: buildUserContentWithAttachments({
                attachments,
                text: input.initialUserMessage,
            }),
            role: 'user',
        },
    ];
    for (let turn = 0; turn < maxDraftGenerationTurns; turn += 1) {
        logLlmRequest(messages, system, {
            actorLabel: input.actorLabel,
            llm: {
                modelTier: tier,
                openRouterApiKey: input.openRouterApiKey,
            },
            operation: 'resource_draft',
        }, turn + 1);
        const result = await generateText({
            model: getLanguageModel({
                modelTier: tier,
                openRouterApiKey: input.openRouterApiKey,
            }),
            messages,
            providerOptions: getProviderOptions({
                reasoningEffort: input.reasoningEffort,
            }),
            system,
            temperature: shouldUseTemperature({ modelTier: tier }) ? 0.45 : undefined,
        });
        logLlmResponse(result.text, result.finishReason, result.usage, result.providerMetadata, turn + 1, {
            actorLabel: input.actorLabel,
            operation: 'resource_draft',
        });
        logLlmCost({
            context: {
                actorLabel: input.actorLabel,
                llm: { modelTier: tier, openRouterApiKey: input.openRouterApiKey },
                operation: 'resource_draft',
            },
            finishReason: result.finishReason,
            providerMetadata: result.providerMetadata,
            usage: result.usage,
        });
        if (result.finishReason === 'length') {
            logger.warn('resource_draft_output_truncated', {
                actorLabel: input.actorLabel,
                operation: 'resource_draft',
                turn: turn + 1,
            });
            if (turn < maxDraftGenerationTurns - 1) {
                appendCorrectionRequest(messages, {
                    actorLabel: input.actorLabel,
                    correctionPromptPath: input.correctionPromptPath,
                    reason: 'Your previous response exceeded the output budget. Return a complete, more concise JSON object and keep every required field.',
                    systemPromptVariables: input.systemPromptVariables,
                    turn: turn + 1,
                });
                continue;
            }
            throw new Error('La IA devolvió un borrador truncado.');
        }
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
                    systemPromptVariables: input.systemPromptVariables,
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
                    systemPromptVariables: input.systemPromptVariables,
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
        attachments: input.attachments,
        correctionPromptPath: 'resources/practice-guide-draft-correction.md',
        initialUserMessage: input.prompt,
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: practiceGuideDraftSchema,
        systemPromptPath: 'resources/practice-guide-draft.md',
        systemPromptVariables: languagePromptVariables(input.instructionLanguage),
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
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: practiceGuideRevisionSchema,
        systemPromptPath: 'resources/practice-guide-revision.md',
        systemPromptVariables: languagePromptVariables(input.instructionLanguage),
    });
}
export function safeParsePracticeGuideDraft(value) {
    const parsed = practiceGuideDraftSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}
export async function generateQuizDraft(input) {
    return generateStructuredDraft({
        actorLabel: 'Quiz draft',
        attachments: input.attachments,
        correctionPromptPath: 'resources/quiz-draft-correction.md',
        initialUserMessage: input.prompt,
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: quizDraftSchema,
        systemPromptPath: 'resources/quiz-draft.md',
        systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
    });
}
const quizResponsesSummarySchema = z
    .object({
    summary: z.string().trim().min(1).max(2000),
})
    .strict();
export async function generateQuizResponsesSummary(input) {
    return generateStructuredDraft({
        actorLabel: 'Quiz responses summary',
        correctionPromptPath: 'resources/quiz-responses-summary-correction.md',
        initialUserMessage: JSON.stringify(input.request, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: quizResponsesSummarySchema,
        systemPromptPath: 'resources/quiz-responses-summary.md',
        systemPromptVariables: languagePromptVariables(input.instructionLanguage ?? 'es'),
    });
}
/**
 * Participation summaries for roleplays and practice guides. Same contract as
 * the quiz responses summary: one Markdown blob written for the resource owner.
 */
const participationSummarySchema = z
    .object({
    summary: z.string().trim().min(1).max(2000),
})
    .strict();
export async function generateRoleplayParticipationSummary(input) {
    return generateStructuredDraft({
        actorLabel: 'Roleplay participation summary',
        correctionPromptPath: 'resources/roleplay-participation-summary-correction.md',
        initialUserMessage: JSON.stringify(input.request, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: participationSummarySchema,
        systemPromptPath: 'resources/roleplay-participation-summary.md',
        systemPromptVariables: languagePromptVariables(input.instructionLanguage ?? 'es'),
    });
}
export async function generateGuideParticipationSummary(input) {
    return generateStructuredDraft({
        actorLabel: 'Practice guide participation summary',
        correctionPromptPath: 'resources/guide-participation-summary-correction.md',
        initialUserMessage: JSON.stringify(input.request, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: participationSummarySchema,
        systemPromptPath: 'resources/guide-participation-summary.md',
        systemPromptVariables: languagePromptVariables(input.instructionLanguage ?? 'es'),
    });
}
export async function generateQuizMetadataRevision(input) {
    return generateStructuredDraft({
        actorLabel: 'Quiz metadata revision',
        correctionPromptPath: 'resources/quiz-metadata-revision-correction.md',
        initialUserMessage: JSON.stringify({
            currentMetadata: input.currentMetadata,
            requestedChange: input.prompt,
        }, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: quizMetadataRevisionSchema,
        systemPromptPath: 'resources/quiz-metadata-revision.md',
        systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
    });
}
/**
 * Revises a quiz's blocks and sections in one call while preserving its
 * metadata (title/description/topic/level/instructions). The model returns only
 * `{ blocks, sections }`; the current metadata is injected before validation so
 * the `Bloques`-tab operation can never rewrite the general details. The result
 * is a fully validated draft (unique ids, section cross-references).
 */
export async function generateQuizBlocksRevision(input) {
    // Validate the model's blocks/sections against the full draft schema (unique
    // ids, section cross-references) by assembling them with the current metadata,
    // so cross-cutting errors are caught inside the generation correction loop.
    const blocksRevisionSchema = z
        .object({
        blocks: z.array(quizBlockSchema).min(1),
        sections: z.array(quizSectionSchema).default([]),
    })
        .superRefine((value, ctx) => {
        const assembled = quizDraftSchema.safeParse({
            ...input.currentMetadata,
            blocks: value.blocks,
            sections: value.sections,
        });
        if (!assembled.success) {
            for (const issue of assembled.error.issues) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: issue.message,
                    path: issue.path,
                });
            }
        }
    });
    return generateStructuredDraft({
        actorLabel: 'Quiz blocks revision',
        correctionPromptPath: 'resources/quiz-blocks-revision-correction.md',
        initialUserMessage: JSON.stringify({
            currentBlocks: input.currentDraft.blocks,
            currentSections: input.currentDraft.sections,
            metadataContext: input.currentMetadata,
            requestedChange: input.prompt,
        }, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: blocksRevisionSchema,
        systemPromptPath: 'resources/quiz-blocks-revision.md',
        systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
    });
}
/**
 * Revises a quiz in one call, across whichever parts the author selected.
 *
 * This replaces the separate metadata-only and blocks-only operations. Scoping
 * used to be expressed by having two endpoints with two schemas; it is now a
 * choice the author makes, and the schema is assembled from that choice — so a
 * `general`-only request still cannot emit a block, and a `blocks`-only request
 * still cannot rewrite the title, exactly as before. What is new is that both
 * together are expressible at all: "take this B1 quiz down to A2" needs the
 * level field and every question, and previously could not be asked for.
 */
export async function generateQuizRevision(input) {
    const { currentDraft, currentMetadata, scope } = input;
    const shape = {};
    if (scope.general) {
        shape.metadata = quizMetadataSchema;
    }
    if (scope.blocks) {
        shape.blocks = z.array(quizBlockSchema).min(1);
        shape.sections = z.array(quizSectionSchema).default([]);
    }
    // Whatever the model returns is assembled with the parts it was not allowed
    // to touch and validated as a whole draft, so unique ids and section
    // cross-references are caught inside the correction loop rather than at save.
    const revisionSchema = z.object(shape).strict().superRefine((value, ctx) => {
        const candidate = value;
        const assembled = quizDraftSchema.safeParse({
            ...(candidate.metadata ?? currentMetadata),
            blocks: candidate.blocks ?? currentDraft.blocks,
            sections: candidate.sections ?? currentDraft.sections,
        });
        if (assembled.success) {
            return;
        }
        for (const issue of assembled.error.issues) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: issue.message,
                path: issue.path,
            });
        }
    });
    const revision = await generateStructuredDraft({
        actorLabel: 'Quiz revision',
        attachments: input.attachments,
        correctionPromptPath: 'resources/quiz-modification-correction.md',
        initialUserMessage: JSON.stringify({
            currentBlocks: scope.blocks ? currentDraft.blocks : undefined,
            currentMetadata,
            currentSections: scope.blocks ? currentDraft.sections : undefined,
            requestedChange: input.prompt,
        }, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: revisionSchema,
        systemPromptPath: 'resources/quiz-modification.md',
        systemPromptVariables: {
            ...quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
            REVISION_SCOPE_RULES: buildQuizRevisionScopeRules(scope),
        },
    });
    return revision;
}
/**
 * The scope the author chose, stated to the model as a rule rather than left
 * implicit in the schema. The schema alone would reject an out-of-scope key,
 * but only after a wasted generation and a correction turn.
 */
export function buildQuizRevisionScopeRules(scope) {
    if (scope.general && scope.blocks) {
        return [
            'You may change both the general details and the questions.',
            '',
            'Return `metadata`, `blocks`, and `sections`. Keep the three coherent with',
            'each other: if you change the level, the questions must match the new',
            'level; if you change the topic, the questions must practise it.',
        ].join('\n');
    }
    if (scope.general) {
        return [
            'You may change only the general details.',
            '',
            'Return `metadata` and nothing else. You must not return `blocks` or',
            '`sections`, and you must not propose changes to the questions. The',
            'questions are shown to you only so the general details stay coherent',
            'with them.',
        ].join('\n');
    }
    return [
        'You may change only the questions and their sections.',
        '',
        'Return `blocks` and `sections` and nothing else. You must not return',
        '`metadata`, and you must not change the title, description, topic, level,',
        'or instructions. The general details are shown to you only so the',
        'questions stay coherent with them.',
    ].join('\n');
}
/**
 * Generates a single quiz item, scoped so it can never touch other blocks.
 * When `currentItem` is provided the model revises it (the per-block modify
 * operation); when it is omitted the model creates a new item of `targetKind`
 * from the request (the add-block operation). Either way the returned
 * `item.kind` is enforced to equal `targetKind`.
 */
export async function generateQuizBlockRevision(input) {
    const blockRevisionSchema = z
        .object({
        item: quizItemSchema.refine((item) => item.kind === input.targetKind, {
            message: `item.kind must be "${input.targetKind}".`,
        }),
    })
        .strict();
    return generateStructuredDraft({
        actorLabel: input.currentItem ? 'Quiz block revision' : 'Quiz block creation',
        correctionPromptPath: 'resources/quiz-block-revision-correction.md',
        initialUserMessage: JSON.stringify({
            ...(input.currentItem ? { currentItem: input.currentItem } : {}),
            level: input.level,
            quizContext: input.quizContext,
            requestedChange: input.prompt,
            requestedKind: input.targetKind,
        }, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: blockRevisionSchema,
        systemPromptPath: 'resources/quiz-block-revision.md',
        systemPromptVariables: quizAuthoringPlaceholders(input.instructionLanguage ?? 'es'),
    });
}
export async function generateRoleplayDraft(input) {
    const roleplayAvatarOptions = buildRoleplayCharacterAvatarPromptOptions();
    return generateStructuredDraft({
        actorLabel: 'Roleplay draft',
        attachments: input.attachments,
        correctionPromptPath: 'resources/roleplay-draft-correction.md',
        initialUserMessage: input.prompt,
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        schema: roleplayAuthoringDraftSchema,
        systemPromptPath: 'resources/roleplay-draft.md',
        systemPromptVariables: {
            ...languagePromptVariables(input.instructionLanguage),
            ROLEPLAY_AVATAR_OPTIONS: roleplayAvatarOptions,
        },
    });
}
export async function generateRoleplayRevision(input) {
    const roleplayAvatarOptions = buildRoleplayCharacterAvatarPromptOptions();
    return generateStructuredDraft({
        actorLabel: 'Roleplay revision',
        correctionPromptPath: 'resources/roleplay-revision-correction.md',
        initialUserMessage: JSON.stringify({
            conversationHistory: normalizeRoleplayRevisionConversationHistory(input.conversationHistory ?? []),
            currentDraft: input.currentDraft,
            requestedChange: input.prompt,
        }, null, 2),
        modelTier: input.modelTier,
        openRouterApiKey: input.openRouterApiKey,
        reasoningEffort: 'minimal',
        schema: roleplayRevisionSchema,
        systemPromptPath: 'resources/roleplay-revision.md',
        systemPromptVariables: {
            ...languagePromptVariables(input.instructionLanguage),
            ROLEPLAY_AVATAR_OPTIONS: roleplayAvatarOptions,
        },
    });
}
//# sourceMappingURL=resourceDrafts.js.map