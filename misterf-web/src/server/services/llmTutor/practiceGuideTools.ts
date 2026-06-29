import { tool } from 'ai';
import { z } from 'zod';
import {
  createPracticeGuide,
  deletePracticeGuideForUser,
  findPracticeGuideForUser,
  listConversationsForPracticeGuide,
  listPracticeGuidesForProfile,
  updatePracticeGuide,
  type StoredPracticeGuide,
} from '../../db/repository.js';
import type { TutorPracticeGuideLinkBlock } from './types.js';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTutorPracticeGuideTools(input: {
  currentPracticeGuideId: string | null;
  onToolCall?: (toolName: string) => void;
  profileId: string | null;
  userId: string | null;
}) {
  if (!input.userId || !input.profileId) {
    return undefined;
  }

  const {
    currentPracticeGuideId,
    onToolCall,
    profileId,
    userId,
  } = input;

  function announceToolCall(toolName: string) {
    onToolCall?.(toolName);
  }

  return {
    list_practice_guides: tool({
      description:
        'List saved practice guides in the current profile only by explicit learner mandate. Use this tool only when the learner explicitly asks to find, list, show, open, or choose saved practice guides. Do not use it for normal tutoring, practice inside a guide, visible tutor plans, progress through the current lesson flow, or because listing guides could help you decide what to teach next. Optionally filter by a text query in the title or description.',
      inputSchema: z.object({
        query: z.string().trim().min(1)
          .describe('Optional Spanish or English search text copied or directly inferred from an explicit learner request to search saved practice guides. Use only to narrow the saved practice-guide list by title, description, or tutor instructions. Do not invent a query when the learner asks to list all guides.')
          .optional(),
      }),
      execute: async ({ query }) => {
        announceToolCall('list_practice_guides');
        const normalizedQuery = normalizeSearchText(query || '');
        const practiceGuides = listPracticeGuidesForProfile(userId, profileId)
          .filter((practiceGuide) => {
            if (!normalizedQuery) {
              return true;
            }

            return normalizeSearchText(
              `${practiceGuide.title}\n${practiceGuide.description}\n${practiceGuide.tutorInstructions}`,
            ).includes(normalizedQuery);
          })
          .map((practiceGuide) => summarizePracticeGuide(practiceGuide, userId));

        return { count: practiceGuides.length, practiceGuides };
      },
    }),
    create_practice_guide: tool({
      description:
        'Create a new saved practice guide in the current profile only by explicit learner mandate. Use this tool only when the learner explicitly asks to create a saved practice guide or explicitly confirms your immediately preceding proposal to create one. Do not use this tool proactively. Do not use it for inline exercises, ordinary tutoring, a visible tutor plan, a new plan, a lesson outline, a sequence of activities, review points, or general studying help unless the learner explicitly says they want a saved practice guide. Creating or updating `tutor_plan` is never permission to create a practice guide. You may infer title, description, and tutorInstructions from the learner request and chat context only after the learner has explicitly requested or confirmed creating the saved practice guide. All three fields must be written in Spanish. Never write title, description, or tutorInstructions in English.',
      inputSchema: z.object({
        description: z.string().trim().min(1).max(1500)
          .describe('Spanish learner-facing description of what the saved practice guide is for. Summarize the guide goal and scope from the explicit guide-creation mandate; do not include transient chat progress.'),
        title: z.string().trim().min(1).max(220)
          .describe('Short Spanish title for the saved practice guide. Infer only from an explicit guide-creation request or confirmation; do not use an English title.'),
        tutorInstructions: z.string().trim().min(1).max(12000)
          .describe('Spanish tutor-facing instructions that define how future chats should use this saved practice guide: goals, exercise types, constraints, sequence, and what to avoid. Base them on the explicit guide-creation mandate. Do not write a transcript, live chat plan, visible tutor plan, or progress report here.'),
      }),
      execute: async ({ description, title, tutorInstructions }) => {
        announceToolCall('create_practice_guide');
        const practiceGuide = createPracticeGuide({
          description,
          profileId,
          title,
          tutorInstructions,
          userId,
        });

        return { practiceGuide: summarizePracticeGuide(practiceGuide, userId) };
      },
    }),
    update_practice_guide: tool({
      description:
        'Update a saved practice guide resource in the current profile only by explicit learner mandate. Use this tool only when the learner explicitly asks to edit, update, rename, rewrite, or change a saved practice guide itself. Do not use this tool during ordinary tutoring, while practicing inside a guide, after a completed exercise, to record learner progress, to adjust the live tutor plan, to synchronize `tutor_plan`, to fix your own response, to repair your own instructions, to improve the current guide proactively, or because a current practice guide exists. If practiceGuideId is omitted, use the current practice guide only after the learner explicitly names the current saved practice guide as the target of the update. Any provided title, description, or tutorInstructions must be written in Spanish. Never write those fields in English. Never invent, slugify, translate, or infer a practiceGuideId.',
      inputSchema: z.object({
        practiceGuideId: z.string().trim().min(1)
          .describe('Real saved practice-guide id from tool results or current chat context. Omit only when the learner explicitly asks to modify the current saved practice guide, for example "actualiza esta guía". Never omit it merely because the chat has a currentPracticeGuideId. Never invent, slugify, translate, or guess this id.')
          .optional(),
        description: z.string().trim().min(1).max(1500)
          .describe('Replacement Spanish learner-facing description for the saved practice guide. Include only if the explicit saved-guide update mandate asks to change the description or requires a new description.')
          .optional(),
        title: z.string().trim().min(1).max(220)
          .describe('Replacement short Spanish title for the saved practice guide. Include only if the explicit saved-guide update mandate asks to rename the guide or requires a new title.')
          .optional(),
        tutorInstructions: z.string().trim().min(1).max(12000)
          .describe('Replacement Spanish tutor-facing instructions for future chats that use this saved practice guide. Include only if the explicit saved-guide update mandate asks to change how the saved guide should work. Do not use this field for the current chat plan, visible tutor plan, learner progress, corrections, completed exercises, or temporary tutoring decisions.')
          .optional(),
      }),
      execute: async ({ practiceGuideId, description, title, tutorInstructions }) => {
        announceToolCall('update_practice_guide');
        const resolvedPracticeGuideId = practiceGuideId || currentPracticeGuideId;
        if (!resolvedPracticeGuideId) {
          return { error: 'No practiceGuideId was provided and there is no current practice guide in this chat.' };
        }

        const current = findPracticeGuideForUser(resolvedPracticeGuideId, userId);
        if (!current) {
          return { error: `No practice guide found with id ${resolvedPracticeGuideId}.` };
        }
        if (current.profileId !== profileId) {
          return { error: `Practice guide ${resolvedPracticeGuideId} does not belong to the current profile.` };
        }

        const next = updatePracticeGuide({
          practiceGuideId: resolvedPracticeGuideId,
          description: description ?? current.description,
          title: title ?? current.title,
          tutorInstructions: tutorInstructions ?? current.tutorInstructions,
          userId,
        });
        if (!next) {
          return { error: `Could not update practice guide ${resolvedPracticeGuideId}.` };
        }

        return { practiceGuide: summarizePracticeGuide(next, userId) };
      },
    }),
    delete_practice_guide: tool({
      description:
        'Delete a saved practice guide from the current profile only by explicit learner mandate. Use this tool only when the learner explicitly asks to delete or remove a saved practice guide. Do not use it during normal tutoring, because a practice session is finished, because the current guide seems obsolete, or because deletion would clean up a previous mistake. Existing chats keep their historical snapshot.',
      inputSchema: z.object({
        practiceGuideId: z.string().trim().min(1)
          .describe('Real saved practice-guide id to delete. Omit only when the learner explicitly asks to delete the current saved practice guide, for example "elimina esta guía". Never omit it merely because the chat has a currentPracticeGuideId. Never invent, slugify, translate, or guess this id.')
          .optional(),
      }),
      execute: async ({ practiceGuideId }) => {
        announceToolCall('delete_practice_guide');
        const resolvedPracticeGuideId = practiceGuideId || currentPracticeGuideId;
        if (!resolvedPracticeGuideId) {
          return { error: 'No practiceGuideId was provided and there is no current practice guide in this chat.' };
        }

        const current = findPracticeGuideForUser(resolvedPracticeGuideId, userId);
        if (!current) {
          return { error: `No practice guide found with id ${resolvedPracticeGuideId}.` };
        }
        if (current.profileId !== profileId) {
          return { error: `Practice guide ${resolvedPracticeGuideId} does not belong to the current profile.` };
        }

        const deleted = deletePracticeGuideForUser(resolvedPracticeGuideId, userId);
        if (!deleted) {
          return { error: `Could not delete practice guide ${resolvedPracticeGuideId}.` };
        }

        return {
          deletedPracticeGuide: {
            id: current.id,
            title: current.title,
          },
        };
      },
    }),
    build_practice_guide_link: tool({
      description:
        'Build a practice guide link block for the UI so the chat can render a button to open a saved practice guide, only by explicit learner mandate. Use this tool only when the learner explicitly asks for a link, button, or way to open a saved practice guide. Do not use it merely because a guide exists, because the current chat belongs to a guide, after a completed exercise, after a plan update, after listing guides unless the learner explicitly asked to open/link one, or as part of the live exercise flow. Only call this with a real existing practiceGuideId obtained from tool results or the current chat context. Never invent, guess, infer, slugify, translate, or paraphrase a practiceGuideId.',
      inputSchema: z.object({
        practiceGuideId: z.string().trim().min(1)
          .describe('Real saved practice-guide id to link. Omit only when the learner explicitly asks for a link to the current saved practice guide, for example "dame el enlace de esta guía". Never omit it merely because the chat has a currentPracticeGuideId. Never invent, slugify, translate, or guess this id.')
          .optional(),
        label: z.string().trim().min(1).max(160)
          .describe('Optional short Spanish button label for opening the saved practice guide. Include only when helpful for the explicit link request. If omitted, the app builds a label from the guide title.')
          .optional(),
      }),
      execute: async ({ practiceGuideId, label }) => {
        announceToolCall('build_practice_guide_link');
        const resolvedPracticeGuideId = practiceGuideId || currentPracticeGuideId;
        if (!resolvedPracticeGuideId) {
          return { error: 'No practiceGuideId was provided and there is no current practice guide in this chat.' };
        }

        const practiceGuide = findPracticeGuideForUser(resolvedPracticeGuideId, userId);
        if (!practiceGuide) {
          return { error: `No practice guide found with id ${resolvedPracticeGuideId}.` };
        }
        if (practiceGuide.profileId !== profileId) {
          return { error: `Practice guide ${resolvedPracticeGuideId} does not belong to the current profile.` };
        }

        return {
          action: {
            practiceGuideId: resolvedPracticeGuideId,
            label: label || buildPracticeGuideLinkLabel(practiceGuide.title),
            type: 'practice_guide_link' as const,
          },
        };
      },
    }),
  };
}

function summarizePracticeGuide(practiceGuide: StoredPracticeGuide, userId: string) {
  return {
    conversationCount: listConversationsForPracticeGuide(practiceGuide.id, userId, practiceGuide.profileId).length,
    description: practiceGuide.description,
    id: practiceGuide.id,
    title: practiceGuide.title,
    tutorInstructions: practiceGuide.tutorInstructions,
    updatedAt: practiceGuide.updatedAt,
    url: `/practice-guides/${encodeURIComponent(practiceGuide.id)}`,
  };
}

export function extractInferredPracticeGuideLinkBlocks(
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>,
): TutorPracticeGuideLinkBlock[] {
  const actions: TutorPracticeGuideLinkBlock[] = [];

  for (const result of toolResults) {
    if (result.preliminary) {
      continue;
    }

    if (result.toolName === 'build_practice_guide_link') {
      const action = extractPracticeGuideLinkAction((result.output as { action?: unknown })?.action);
      if (action) {
        actions.push(action);
      }
      continue;
    }

    if (result.toolName === 'create_practice_guide' || result.toolName === 'update_practice_guide') {
      const practiceGuide = extractPracticeGuideRecord((result.output as { practiceGuide?: unknown })?.practiceGuide);
      if (practiceGuide) {
        actions.push({
          practiceGuideId: practiceGuide.id,
          label: buildPracticeGuideLinkLabel(practiceGuide.title),
          type: 'practice_guide_link',
        });
      }
    }
  }

  return Array.from(new Map(actions.map((action) => [action.practiceGuideId, action])).values());
}

function extractPracticeGuideLinkAction(value: unknown): TutorPracticeGuideLinkBlock | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.practiceGuideId !== 'string' || typeof record.label !== 'string') {
    return null;
  }

  return {
    practiceGuideId: record.practiceGuideId,
    label: record.label,
    type: 'practice_guide_link',
  };
}

function extractPracticeGuideRecord(value: unknown) {
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

function buildPracticeGuideLinkLabel(title: string) {
  return `Abrir guía de práctica: ${title}`;
}
