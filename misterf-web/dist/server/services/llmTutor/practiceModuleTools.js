import { tool } from 'ai';
import { z } from 'zod';
import { createPracticeModule, deletePracticeModuleForUser, findPracticeModuleForUser, listConversationsForPracticeModule, listPracticeModulesForProfile, updatePracticeModule, } from '../../db/repository.js';
function normalizeSearchText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
export function buildTutorPracticeModuleTools(input) {
    if (!input.userId || !input.profileId) {
        return undefined;
    }
    const { currentPracticeModuleId, onToolCall, profileId, userId, } = input;
    function announceToolCall(toolName) {
        onToolCall?.(toolName);
    }
    return {
        list_practice_modules: tool({
            description: 'List the saved practice modules in the current profile only when the learner explicitly asks to find, list, show, open, or choose saved modules. Do not use this tool for normal tutoring, practice inside a module, or progress through the current lesson flow. Optionally filter by a text query in the title or description.',
            inputSchema: z.object({
                query: z.string().trim().min(1)
                    .describe('Optional Spanish or English search text from the learner request. Use only to narrow the saved module list by title, description, or tutor instructions. Do not invent a query when the learner asks to list all modules.')
                    .optional(),
            }),
            execute: async ({ query }) => {
                announceToolCall('list_practice_modules');
                const normalizedQuery = normalizeSearchText(query || '');
                const practiceModules = listPracticeModulesForProfile(userId, profileId)
                    .filter((practiceModule) => {
                    if (!normalizedQuery) {
                        return true;
                    }
                    return normalizeSearchText(`${practiceModule.title}\n${practiceModule.description}\n${practiceModule.tutorInstructions}`).includes(normalizedQuery);
                })
                    .map((practiceModule) => summarizePracticeModule(practiceModule, userId));
                return { count: practiceModules.length, practiceModules };
            },
        }),
        create_practice_module: tool({
            description: 'Create a new saved practice module in the current profile, but only when the learner explicitly asks to create a module and clearly uses the word "module" or "módulo", or when the learner clearly approves a previous assistant proposal to create a module. Do not use this tool proactively. Do not use it for inline exercises, ordinary tutoring, a visible tutor plan, a practice plan, a guide, a lesson outline, a sequence of activities, review points, or general studying help unless the learner explicitly says they want a module. Creating or updating `tutor_plan` is never permission to create a practice module. You may infer title, description, and tutorInstructions from the user request and chat context only after the learner has explicitly requested or approved creating the practice module as a module. All three fields must be written in Spanish. Never write title, description, or tutorInstructions in English.',
            inputSchema: z.object({
                description: z.string().trim().min(1).max(1500)
                    .describe('Spanish learner-facing description of what the saved module is for. Summarize the module goal and scope; do not include transient chat progress.'),
                title: z.string().trim().min(1).max(220)
                    .describe('Short Spanish title for the saved module. Infer only from an explicit module-creation request or approval; do not use an English title.'),
                tutorInstructions: z.string().trim().min(1).max(12000)
                    .describe('Spanish tutor-facing instructions that define how future chats should use this saved module: goals, exercise types, constraints, sequence, and what to avoid. Do not write a transcript, live chat plan, or progress report here.'),
            }),
            execute: async ({ description, title, tutorInstructions }) => {
                announceToolCall('create_practice_module');
                const practiceModule = createPracticeModule({
                    description,
                    profileId,
                    title,
                    tutorInstructions,
                    userId,
                });
                return { practiceModule: summarizePracticeModule(practiceModule, userId) };
            },
        }),
        update_practice_module: tool({
            description: 'Update a saved practice module resource in the current profile only when the learner explicitly asks to edit, update, rename, rewrite, or change that saved module itself. Do not use this tool during ordinary tutoring, while practicing inside a module, to record learner progress, to adjust the live tutoring plan, to fix your own instructions, or to improve the current module proactively. If practiceModuleId is omitted, use the current practice module only after the learner explicitly asked to modify the current saved module. Any provided title, description, or tutorInstructions must be written in Spanish. Never write those fields in English. Never invent, slugify, translate, or infer a practiceModuleId.',
            inputSchema: z.object({
                practiceModuleId: z.string().trim().min(1)
                    .describe('Real saved practice-module id from tool results or current chat context. Omit only when the learner explicitly asks to modify the current saved module. Never invent, slugify, translate, or guess this id.')
                    .optional(),
                description: z.string().trim().min(1).max(1500)
                    .describe('Replacement Spanish learner-facing description for the saved module. Include only if the learner asked to change the saved module description or if the requested saved-module edit requires a new description.')
                    .optional(),
                title: z.string().trim().min(1).max(220)
                    .describe('Replacement short Spanish title for the saved module. Include only if the learner asked to rename the saved module or the requested saved-module edit requires a new title.')
                    .optional(),
                tutorInstructions: z.string().trim().min(1).max(12000)
                    .describe('Replacement Spanish tutor-facing instructions for future chats that use this saved module. Include only if the learner asked to change how the saved module should work. Do not use this field for the current chat plan, learner progress, corrections, or temporary tutoring decisions.')
                    .optional(),
            }),
            execute: async ({ practiceModuleId, description, title, tutorInstructions }) => {
                announceToolCall('update_practice_module');
                const resolvedPracticeModuleId = practiceModuleId || currentPracticeModuleId;
                if (!resolvedPracticeModuleId) {
                    return { error: 'No practiceModuleId was provided and there is no current practice module in this chat.' };
                }
                const current = findPracticeModuleForUser(resolvedPracticeModuleId, userId);
                if (!current) {
                    return { error: `No practice module found with id ${resolvedPracticeModuleId}.` };
                }
                if (current.profileId !== profileId) {
                    return { error: `Practice module ${resolvedPracticeModuleId} does not belong to the current profile.` };
                }
                const next = updatePracticeModule({
                    practiceModuleId: resolvedPracticeModuleId,
                    description: description ?? current.description,
                    title: title ?? current.title,
                    tutorInstructions: tutorInstructions ?? current.tutorInstructions,
                    userId,
                });
                if (!next) {
                    return { error: `Could not update practice module ${resolvedPracticeModuleId}.` };
                }
                return { practiceModule: summarizePracticeModule(next, userId) };
            },
        }),
        delete_practice_module: tool({
            description: 'Delete a saved practice module from the current profile only when the learner explicitly asks to delete or remove that saved module. Do not use this tool during normal tutoring or because a practice session is finished. Existing chats keep their historical snapshot.',
            inputSchema: z.object({
                practiceModuleId: z.string().trim().min(1)
                    .describe('Real saved practice-module id to delete. Omit only when the learner explicitly asks to delete the current saved module. Never invent, slugify, translate, or guess this id.')
                    .optional(),
            }),
            execute: async ({ practiceModuleId }) => {
                announceToolCall('delete_practice_module');
                const resolvedPracticeModuleId = practiceModuleId || currentPracticeModuleId;
                if (!resolvedPracticeModuleId) {
                    return { error: 'No practiceModuleId was provided and there is no current practice module in this chat.' };
                }
                const current = findPracticeModuleForUser(resolvedPracticeModuleId, userId);
                if (!current) {
                    return { error: `No practice module found with id ${resolvedPracticeModuleId}.` };
                }
                if (current.profileId !== profileId) {
                    return { error: `Practice module ${resolvedPracticeModuleId} does not belong to the current profile.` };
                }
                const deleted = deletePracticeModuleForUser(resolvedPracticeModuleId, userId);
                if (!deleted) {
                    return { error: `Could not delete practice module ${resolvedPracticeModuleId}.` };
                }
                return {
                    deletedPracticeModule: {
                        id: current.id,
                        title: current.title,
                    },
                };
            },
        }),
        build_practice_module_link: tool({
            description: 'Build a practice module link block for the UI so the chat can render a button to open a saved practice module. Use this only when the learner asks for or needs a link to a saved module, or immediately after a create/update/list tool result identifies a real module. Do not use this for normal tutoring or as part of the live exercise flow. Only call this with a real existing practiceModuleId obtained from tool results or the current chat context. Never invent, guess, infer, slugify, translate, or paraphrase a practiceModuleId.',
            inputSchema: z.object({
                practiceModuleId: z.string().trim().min(1)
                    .describe('Real saved practice-module id to link. Omit only when linking the current saved module after the learner asked for that link. Never invent, slugify, translate, or guess this id.')
                    .optional(),
                label: z.string().trim().min(1).max(160)
                    .describe('Optional short Spanish button label for opening the saved module. If omitted, the app builds a label from the module title.')
                    .optional(),
            }),
            execute: async ({ practiceModuleId, label }) => {
                announceToolCall('build_practice_module_link');
                const resolvedPracticeModuleId = practiceModuleId || currentPracticeModuleId;
                if (!resolvedPracticeModuleId) {
                    return { error: 'No practiceModuleId was provided and there is no current practice module in this chat.' };
                }
                const practiceModule = findPracticeModuleForUser(resolvedPracticeModuleId, userId);
                if (!practiceModule) {
                    return { error: `No practice module found with id ${resolvedPracticeModuleId}.` };
                }
                if (practiceModule.profileId !== profileId) {
                    return { error: `Practice module ${resolvedPracticeModuleId} does not belong to the current profile.` };
                }
                return {
                    action: {
                        practiceModuleId: resolvedPracticeModuleId,
                        label: label || buildPracticeModuleLinkLabel(practiceModule.title),
                        type: 'practice_module_link',
                    },
                };
            },
        }),
    };
}
function summarizePracticeModule(practiceModule, userId) {
    return {
        conversationCount: listConversationsForPracticeModule(practiceModule.id, userId, practiceModule.profileId).length,
        description: practiceModule.description,
        id: practiceModule.id,
        title: practiceModule.title,
        tutorInstructions: practiceModule.tutorInstructions,
        updatedAt: practiceModule.updatedAt,
        url: `/practice-modules/${encodeURIComponent(practiceModule.id)}`,
    };
}
export function extractInferredPracticeModuleLinkBlocks(toolResults) {
    const actions = [];
    for (const result of toolResults) {
        if (result.preliminary) {
            continue;
        }
        if (result.toolName === 'build_practice_module_link') {
            const action = extractPracticeModuleLinkAction(result.output?.action);
            if (action) {
                actions.push(action);
            }
            continue;
        }
        if (result.toolName === 'create_practice_module' || result.toolName === 'update_practice_module') {
            const practiceModule = extractPracticeModuleRecord(result.output?.practiceModule);
            if (practiceModule) {
                actions.push({
                    practiceModuleId: practiceModule.id,
                    label: buildPracticeModuleLinkLabel(practiceModule.title),
                    type: 'practice_module_link',
                });
            }
        }
    }
    return Array.from(new Map(actions.map((action) => [action.practiceModuleId, action])).values());
}
function extractPracticeModuleLinkAction(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    if (typeof record.practiceModuleId !== 'string' || typeof record.label !== 'string') {
        return null;
    }
    return {
        practiceModuleId: record.practiceModuleId,
        label: record.label,
        type: 'practice_module_link',
    };
}
function extractPracticeModuleRecord(value) {
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
function buildPracticeModuleLinkLabel(title) {
    return `Abrir módulo de práctica: ${title}`;
}
//# sourceMappingURL=practiceModuleTools.js.map