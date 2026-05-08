import { tool } from 'ai';
import { z } from 'zod';
import {
  createPracticeModule,
  deletePracticeModuleForUser,
  findPracticeModuleForUser,
  listConversationsForPracticeModule,
  listPracticeModulesForProfile,
  updatePracticeModule,
  type StoredPracticeModule,
} from '../../db/repository.js';
import type { TutorPracticeModuleLinkBlock } from './types.js';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTutorPracticeModuleTools(input: {
  currentPracticeModuleId: string | null;
  onToolCall?: (toolName: string) => void;
  profileId: string | null;
  userId: string | null;
}) {
  if (!input.userId || !input.profileId) {
    return undefined;
  }

  const { currentPracticeModuleId, onToolCall, profileId, userId } = input;

  function announceToolCall(toolName: string) {
    onToolCall?.(toolName);
  }

  return {
    list_practice_modules: tool({
      description:
        'List the practice modules in the current profile. Optionally filter by a text query in the title or description.',
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
      }),
      execute: async ({ query }) => {
        announceToolCall('list_practice_modules');
        const normalizedQuery = normalizeSearchText(query || '');
        const practiceModules = listPracticeModulesForProfile(userId, profileId)
          .filter((practiceModule) => {
            if (!normalizedQuery) {
              return true;
            }

            return normalizeSearchText(
              `${practiceModule.title}\n${practiceModule.description}\n${practiceModule.tutorInstructions}`,
            ).includes(normalizedQuery);
          })
          .map((practiceModule) => summarizePracticeModule(practiceModule, userId));

        return { count: practiceModules.length, practiceModules };
      },
    }),
    create_practice_module: tool({
      description:
        'Create a new practice module in the current profile. Provide title, description, and tutorInstructions. Infer them from the user request and chat context when possible. All three fields must be written in Spanish. Never write title, description, or tutorInstructions in English.',
      inputSchema: z.object({
        description: z.string().trim().min(1).max(1500),
        title: z.string().trim().min(1).max(220),
        tutorInstructions: z.string().trim().min(1).max(12000),
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
      description:
        'Update a practice module in the current profile. If practiceModuleId is omitted, use the current practice module when this conversation already belongs to one. Any provided title, description, or tutorInstructions must be written in Spanish. Never write those fields in English.',
      inputSchema: z.object({
        practiceModuleId: z.string().trim().min(1).optional(),
        description: z.string().trim().min(1).max(1500).optional(),
        title: z.string().trim().min(1).max(220).optional(),
        tutorInstructions: z.string().trim().min(1).max(12000).optional(),
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
      description:
        'Delete a practice module from the current profile. Existing chats keep their historical snapshot.',
      inputSchema: z.object({
        practiceModuleId: z.string().trim().min(1).optional(),
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
      description:
        'Build a practice module link block for the UI so the chat can render a button to open a practice module.',
      inputSchema: z.object({
        practiceModuleId: z.string().trim().min(1).optional(),
        label: z.string().trim().min(1).max(160).optional(),
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
            type: 'practice_module_link' as const,
          },
        };
      },
    }),
  };
}

function summarizePracticeModule(practiceModule: StoredPracticeModule, userId: string) {
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

export function extractInferredPracticeModuleLinkBlocks(
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>,
): TutorPracticeModuleLinkBlock[] {
  const actions: TutorPracticeModuleLinkBlock[] = [];

  for (const result of toolResults) {
    if (result.preliminary) {
      continue;
    }

    if (result.toolName === 'build_practice_module_link') {
      const action = extractPracticeModuleLinkAction((result.output as { action?: unknown })?.action);
      if (action) {
        actions.push(action);
      }
      continue;
    }

    if (result.toolName === 'create_practice_module' || result.toolName === 'update_practice_module') {
      const practiceModule = extractPracticeModuleRecord((result.output as { practiceModule?: unknown })?.practiceModule);
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

function extractPracticeModuleLinkAction(value: unknown): TutorPracticeModuleLinkBlock | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.practiceModuleId !== 'string' || typeof record.label !== 'string') {
    return null;
  }

  return {
    practiceModuleId: record.practiceModuleId,
    label: record.label,
    type: 'practice_module_link',
  };
}

function extractPracticeModuleRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
  };
}

function buildPracticeModuleLinkLabel(title: string) {
  return `Abrir módulo de práctica: ${title}`;
}
