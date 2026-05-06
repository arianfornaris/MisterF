import { tool } from 'ai';
import { z } from 'zod';
import {
  createLesson,
  deleteLessonForUser,
  findLessonForUser,
  listConversationsForLesson,
  listLessonsForProfile,
  updateLesson,
  type StoredLesson,
} from '../../db/repository.js';
import type { TutorLessonLinkBlock } from './types.js';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTutorLessonTools(input: {
  currentLessonId: string | null;
  onToolCall?: (toolName: string) => void;
  profileId: string | null;
  userId: string | null;
}) {
  if (!input.userId || !input.profileId) {
    return undefined;
  }

  const { currentLessonId, onToolCall, profileId, userId } = input;

  function announceToolCall(toolName: string) {
    onToolCall?.(toolName);
  }

  return {
    list_lessons: tool({
      description:
        'List the lessons in the current profile. Optionally filter by a text query in the title or description.',
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

            return normalizeSearchText(
              `${lesson.title}\n${lesson.description}\n${lesson.tutorInstructions}`,
            ).includes(normalizedQuery);
          })
          .map((lesson) => summarizeLesson(lesson, userId));

        return { count: lessons.length, lessons };
      },
    }),
    create_lesson: tool({
      description:
        'Create a new lesson in the current profile. Provide title, description, and tutorInstructions. Infer them from the user request and chat context when possible.',
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
      description:
        'Update a lesson in the current profile. If lessonId is omitted, use the current lesson when this conversation already belongs to one.',
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
      description:
        'Delete a lesson from the current profile. Existing chats keep their historical snapshot.',
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
      description:
        'Build a lesson link block for the UI so the chat can render a button to open a lesson.',
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
            type: 'lesson_link' as const,
          },
        };
      },
    }),
  };
}

function summarizeLesson(lesson: StoredLesson, userId: string) {
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

export function extractInferredLessonLinkBlocks(
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>,
): TutorLessonLinkBlock[] {
  const actions: TutorLessonLinkBlock[] = [];

  for (const result of toolResults) {
    if (result.preliminary) {
      continue;
    }

    if (result.toolName === 'build_lesson_link') {
      const action = extractLessonLinkAction((result.output as { action?: unknown })?.action);
      if (action) {
        actions.push(action);
      }
      continue;
    }

    if (result.toolName === 'create_lesson' || result.toolName === 'update_lesson') {
      const lesson = extractLessonRecord((result.output as { lesson?: unknown })?.lesson);
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

function extractLessonLinkAction(value: unknown): TutorLessonLinkBlock | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.lessonId !== 'string' || typeof record.label !== 'string') {
    return null;
  }

  return {
    lessonId: record.lessonId,
    label: record.label,
    type: 'lesson_link',
  };
}

function extractLessonRecord(value: unknown) {
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

function buildLessonLinkLabel(title: string) {
  return `Abrir lección: ${title}`;
}
