import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { createLesson, deleteLessonForUser, findLessonForUser, listConversationsForLesson, listLessonsForProfile, updateLesson, } from '../../db/repository.js';
import { buildLlmRequestTokenUsage, logLlmRequest, logLlmResponse, logLlmToolCalls, } from '../llmTutor/logging.js';
import { buildAdministrationSystemInstruction } from '../llmTutor/prompt.js';
import { getLanguageModel, getProviderOptions, getUserFacingFinishReasonMessage, shouldUseTemperature, } from '../llmTutor/providers.js';
function normalizeSearchText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
function adminBlocksToMarkdown(blocks) {
    const parts = blocks
        .map((block) => (block.type === 'message' ? block.markdown.trim() : block.label.trim()))
        .filter(Boolean);
    return parts.join('\n\n');
}
async function continueAdministrationResponseAfterToolUse(input) {
    const finalizedToolResults = input.toolResults.filter((result) => !result.preliminary);
    const messages = [
        {
            role: 'user',
            content: [
                'Original administration instruction:',
                input.instruction,
                '',
                'INTERNAL APP CONTINUATION.',
                'The previous step already used tools and may have completed lesson actions successfully.',
                'Do not call any more tools in this step.',
                'Now produce the internal administration result in neutral Spanish text only.',
                'Do not speak as Mr. F.',
                'Do not present yourself as a person or second speaker.',
                'Use impersonal result language such as "Se creó la lección..." when appropriate.',
                'Do not return JSON.',
                'Do not return markdown fences.',
                'Explain briefly what happened.',
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
        maxOutputTokens: 1200,
        messages,
        model: getLanguageModel(input.llm),
        providerOptions: getProviderOptions(),
        system: input.system,
        temperature: shouldUseTemperature() ? 0.2 : undefined,
    });
}
export async function runAdministrationLoop(input) {
    const instruction = input.instruction.trim();
    if (!instruction) {
        throw new Error('No pude procesar una instrucción administrativa vacía.');
    }
    const messages = [{ role: 'user', content: instruction }];
    const system = buildAdministrationSystemInstruction({
        currentLessonTitle: input.currentLessonTitle ?? null,
    });
    logLlmRequest(messages, system, { ...input, actorLabel: 'Administration' }, 1);
    const result = await generateText({
        abortSignal: input.abortSignal,
        maxOutputTokens: 1200,
        messages,
        model: getLanguageModel(input.llm),
        providerOptions: getProviderOptions(),
        stopWhen: stepCountIs(6),
        system,
        temperature: shouldUseTemperature() ? 0.2 : undefined,
        tools: buildAdministrationLessonTools({
            currentLessonId: input.currentLessonId ?? null,
            onToolCall: input.onToolCall,
            profileId: input.profileId ?? null,
            userId: input.userId ?? null,
        }),
    });
    logLlmToolCalls({
        actorLabel: 'Administration',
        steps: result.steps,
        turn: 1,
    });
    const toolResults = result.steps.flatMap((step) => step.toolResults);
    const effectiveResult = (!result.text.trim() || toolResults.length > 0)
        ? await continueAdministrationResponseAfterToolUse({
            abortSignal: input.abortSignal,
            instruction,
            llm: input.llm,
            system,
            toolResults,
        })
        : result;
    const text = effectiveResult.text.trim();
    if (!text) {
        throw new Error('El administrador no devolvió una respuesta usable.');
    }
    const blocks = mergeAdministrationLessonLinkBlocks([
        {
            type: 'message',
            markdown: text,
        },
    ], extractInferredLessonLinkBlocks(toolResults));
    logLlmResponse({ blocks }, effectiveResult.finishReason, effectiveResult.usage, effectiveResult.providerMetadata, 1, 'Administration');
    input.onTokenUsage?.(await buildLlmRequestTokenUsage({
        messages,
        system,
        turn: 1,
        usage: effectiveResult.usage,
    }));
    const userFacingFinishMessage = getUserFacingFinishReasonMessage(effectiveResult.finishReason, undefined, effectiveResult.providerMetadata);
    if (userFacingFinishMessage) {
        throw new Error(userFacingFinishMessage);
    }
    return {
        blocks,
        content: adminBlocksToMarkdown(blocks),
        model: env.llmModel,
        provider: env.llmProvider,
    };
}
function buildAdministrationLessonTools(input) {
    if (!input.userId || !input.profileId) {
        return undefined;
    }
    const { currentLessonId, onToolCall, profileId, userId } = input;
    function announceToolCall(toolName) {
        onToolCall?.(toolName);
    }
    return {
        list_lessons: tool({
            description: 'List the lessons in the current profile. Optionally filter by a text query in the title or description.',
            inputSchema: z.object({
                query: z.string().trim().min(1).optional(),
            }),
            execute: async ({ query }) => {
                announceToolCall('list_lessons');
                const normalizedQuery = normalizeSearchText(query || '');
                const lessons = listLessonsForProfile(userId, profileId)
                    .filter((lesson) => {
                    if (!normalizedQuery) {
                        return true;
                    }
                    return normalizeSearchText(`${lesson.title}\n${lesson.description}\n${lesson.tutorInstructions}`).includes(normalizedQuery);
                })
                    .map((lesson) => summarizeLesson(lesson, userId));
                return { count: lessons.length, lessons };
            },
        }),
        create_lesson: tool({
            description: 'Create a new lesson in the current profile. You must provide title, description, and tutorInstructions. Infer those fields from the administration instruction whenever possible instead of asking for them separately.',
            inputSchema: z.object({
                description: z.string().trim().min(1).max(1500),
                title: z.string().trim().min(1).max(220),
                tutorInstructions: z.string().trim().min(1).max(12000),
            }),
            execute: async ({ description, title, tutorInstructions }) => {
                announceToolCall('create_lesson');
                const lesson = createLesson({
                    description,
                    profileId,
                    title,
                    tutorInstructions,
                    userId,
                });
                return { lesson: summarizeLesson(lesson, userId) };
            },
        }),
        update_lesson: tool({
            description: 'Update a lesson in the current profile. If lessonId is omitted, use the current lesson when this conversation already belongs to one.',
            inputSchema: z.object({
                lessonId: z.string().trim().min(1).optional(),
                description: z.string().trim().min(1).max(1500).optional(),
                title: z.string().trim().min(1).max(220).optional(),
                tutorInstructions: z.string().trim().min(1).max(12000).optional(),
            }),
            execute: async ({ lessonId, description, title, tutorInstructions }) => {
                announceToolCall('update_lesson');
                const resolvedLessonId = lessonId || currentLessonId;
                if (!resolvedLessonId) {
                    return { error: 'No lessonId was provided and there is no current lesson in this chat.' };
                }
                const current = findLessonForUser(resolvedLessonId, userId);
                if (!current) {
                    return { error: `No lesson found with id ${resolvedLessonId}.` };
                }
                if (current.profileId !== profileId) {
                    return { error: `Lesson ${resolvedLessonId} does not belong to the current profile.` };
                }
                const next = updateLesson({
                    lessonId: resolvedLessonId,
                    description: description ?? current.description,
                    title: title ?? current.title,
                    tutorInstructions: tutorInstructions ?? current.tutorInstructions,
                    userId,
                });
                if (!next) {
                    return { error: `Could not update lesson ${resolvedLessonId}.` };
                }
                return { lesson: summarizeLesson(next, userId) };
            },
        }),
        delete_lesson: tool({
            description: 'Delete a lesson from the current profile. Existing chats keep their historical snapshot.',
            inputSchema: z.object({
                lessonId: z.string().trim().min(1).optional(),
            }),
            execute: async ({ lessonId }) => {
                announceToolCall('delete_lesson');
                const resolvedLessonId = lessonId || currentLessonId;
                if (!resolvedLessonId) {
                    return { error: 'No lessonId was provided and there is no current lesson in this chat.' };
                }
                const current = findLessonForUser(resolvedLessonId, userId);
                if (!current) {
                    return { error: `No lesson found with id ${resolvedLessonId}.` };
                }
                if (current.profileId !== profileId) {
                    return { error: `Lesson ${resolvedLessonId} does not belong to the current profile.` };
                }
                const deleted = deleteLessonForUser(resolvedLessonId, userId);
                if (!deleted) {
                    return { error: `Could not delete lesson ${resolvedLessonId}.` };
                }
                return {
                    deletedLesson: {
                        id: current.id,
                        title: current.title,
                    },
                };
            },
        }),
        build_lesson_link: tool({
            description: 'Build a lesson link block for the UI so the chat can render a button to open a lesson.',
            inputSchema: z.object({
                lessonId: z.string().trim().min(1).optional(),
                label: z.string().trim().min(1).max(160).optional(),
            }),
            execute: async ({ lessonId, label }) => {
                announceToolCall('build_lesson_link');
                const resolvedLessonId = lessonId || currentLessonId;
                if (!resolvedLessonId) {
                    return { error: 'No lessonId was provided and there is no current lesson in this chat.' };
                }
                const lesson = findLessonForUser(resolvedLessonId, userId);
                if (!lesson) {
                    return { error: `No lesson found with id ${resolvedLessonId}.` };
                }
                if (lesson.profileId !== profileId) {
                    return { error: `Lesson ${resolvedLessonId} does not belong to the current profile.` };
                }
                return {
                    action: {
                        lessonId: resolvedLessonId,
                        label: label || buildLessonLinkLabel(lesson.title),
                        type: 'lesson_link',
                    },
                };
            },
        }),
    };
}
function summarizeLesson(lesson, userId) {
    return {
        conversationCount: listConversationsForLesson(lesson.id, userId, lesson.profileId).length,
        description: lesson.description,
        id: lesson.id,
        title: lesson.title,
        tutorInstructions: lesson.tutorInstructions,
        updatedAt: lesson.updatedAt,
        url: `/lessons/${encodeURIComponent(lesson.id)}`,
    };
}
function extractInferredLessonLinkBlocks(toolResults) {
    const actions = [];
    for (const result of toolResults) {
        if (result.preliminary) {
            continue;
        }
        if (result.toolName === 'build_lesson_link') {
            const action = extractLessonLinkAction(result.output?.action);
            if (action) {
                actions.push(action);
            }
            continue;
        }
        if (result.toolName === 'create_lesson' || result.toolName === 'update_lesson') {
            const lesson = extractLessonRecord(result.output?.lesson);
            if (lesson) {
                actions.push({
                    lessonId: lesson.id,
                    label: buildLessonLinkLabel(lesson.title),
                    type: 'lesson_link',
                });
            }
        }
    }
    return Array.from(new Map(actions.map((action) => [action.lessonId, action])).values());
}
function extractLessonLinkAction(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    if (typeof record.lessonId !== 'string' || typeof record.label !== 'string') {
        return null;
    }
    return {
        lessonId: record.lessonId,
        label: record.label,
        type: 'lesson_link',
    };
}
function extractLessonRecord(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    if (typeof record.id !== 'string' || typeof record.title !== 'string') {
        return null;
    }
    return {
        id: record.id,
        title: record.title,
    };
}
function buildLessonLinkLabel(title) {
    return `Abrir lección: ${title}`;
}
function mergeAdministrationLessonLinkBlocks(blocks, inferredLinks) {
    const seenLessonIds = new Set(blocks.filter((block) => block.type === 'lesson_link').map((block) => block.lessonId));
    return [
        ...blocks,
        ...inferredLinks.filter((link) => !seenLessonIds.has(link.lessonId)),
    ];
}
//# sourceMappingURL=index.js.map