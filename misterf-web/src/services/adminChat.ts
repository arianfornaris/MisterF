import fs from 'node:fs';
import path from 'node:path';
import { generateText, stepCountIs, tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  createActivity,
  findActivityForUser,
  findAdminChatThreadForUser,
  findConversationForUser,
  listActivitiesForProfile,
  listConversationsForActivity,
  listConversationsForProfile,
  renameAdminChatThreadForUser,
  renameConversationForUser,
  deleteActivityForUser,
  updateActivity,
  type StoredActivity,
} from '../db/repository.js';
import { buildLlmRequestTokenUsage, logJson } from './llmTutor/logging.js';
import {
  getLanguageModel,
  getProviderOptions,
  getUserFacingFinishReasonMessage,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import type { LlmRequestOptions, LlmRequestTokenUsage, TutorMessage } from './llmTutor/types.js';
import { toModelMessage } from './llmTutor/validation.js';

let adminCapabilitiesInstruction: string | undefined;
const maxAdminTurns = 4;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const adminChatResponseSchema = z.object({
  blocks: z.array(
    z.union([
      z.object({
        type: z.literal('message'),
        markdown: z.string().trim().min(1).max(12000),
      }),
      z.object({
        type: z.literal('activity_link'),
        activityId: z.string().trim().min(1),
        label: z.string().trim().min(1).max(160),
      }),
    ]),
  ).min(1).max(16),
});

function getAdminCapabilitiesInstruction(): string {
  adminCapabilitiesInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/admin-chat-capabilities.md'),
    'utf8',
  );

  return adminCapabilitiesInstruction;
}

function buildAdminSystemInstruction(): string {
  return [
    'You are Mr. F in Admin Chat mode.',
    '',
    'Your role here is not to tutor English directly. Your role is to help the user administer their activities and conversations inside the app, and to help an educator design strong activities that match the real capabilities of the pedagogical tutor.',
    '',
    'Rules:',
    '- Use tools whenever the user asks for factual information about activities or conversations, or when they want to create, update, or rename something.',
    '- Never invent IDs, titles, counts, URLs, app state, or configuration when a tool can verify it.',
    '- Be concise, practical, and clear.',
    '- If a request is ambiguous, ask a short clarifying question before taking action.',
    '- After a tool changes something, confirm clearly what changed.',
    '- You may propose, draft, or refine activities and tutor instructions for the user.',
    '- When helping design an activity, rely only on the real supported exercise types described below.',
    '- Do not invent unsupported exercise types or product features.',
    '- Treat the product reference below as a lightweight map of real capabilities, not as a rigid pedagogy script.',
    '- Give the user room to design activities freely when their request does not require a strict structure.',
    '- When helping create an activity, the default recommendation is to focus on helping the learner acquire useful vocabulary and learn how to form the relevant sentences.',
    '- In most cases, creativity or the ability to understand more complex texts is not the main goal unless the user clearly asks for that.',
    '- Respond with one JSON object of the form {"blocks":[...]}. Do not write any text before or after the JSON object.',
    '- The only valid block types are: message, activity_link.',
    '- A message block has: type="message", markdown.',
    '- An activity_link block has: type="activity_link", activityId, and label.',
    '- When you want to point the user to an activity page, use the build_activity_link tool first and then emit an activity_link block. Do not paste raw URLs into the message text.',
    '- When you create, update, or otherwise change an activity or any other object, do not respond with only a link block.',
    '- In those cases, always include a message block that briefly explains what was created or changed and summarizes the important content.',
    '- If you create or update an activity, the message should mention the title and summarize the description, tutor instructions, or the main changes in natural language.',
    '- When you create an activity, also mention the exercise types that can naturally be used in that activity.',
    '- If the current admin chat still has a generic title, assign it a better title as soon as the purpose of the chat becomes clear from the first useful information the user gives you.',
    '- Do not wait for a long conversation if the main purpose is already obvious.',
    '- Use the auto_title_current_chat tool for that.',
    '- Respond in Spanish unless the user clearly asks for another language.',
    '',
    getAdminCapabilitiesInstruction(),
  ].join('\n');
}

export type AdminChatResult = {
  blocks: AdminChatResponseBlock[];
  content: string;
  model: string;
  provider: string;
};

type AdminChatMessageBlock = {
  type: 'message';
  markdown: string;
};

type AdminChatActivityLinkBlock = {
  type: 'activity_link';
  activityId: string;
  label: string;
};

type AdminChatResponseBlock = AdminChatMessageBlock | AdminChatActivityLinkBlock;

export async function runAdminChatLoop(
  history: TutorMessage[],
  options: {
    abortSignal?: AbortSignal;
    currentThreadId?: string | null;
    llm?: LlmRequestOptions;
    onTokenUsage?: (usage: LlmRequestTokenUsage) => void;
    profileId: string;
    userId: string;
  },
): Promise<AdminChatResult> {
  const messages = history.map(toModelMessage) as ModelMessage[];
  const systemInstruction = buildAdminSystemInstruction();
  let lastError: unknown = null;

  for (let turn = 0; turn < maxAdminTurns; turn += 1) {
    logJson('[Mr. F Admin LLM request]', {
      messageCount: messages.length,
      messages,
      model: env.llmModel,
      provider: env.llmProvider,
      system: systemInstruction,
      turn: turn + 1,
    });

    try {
      const result = await generateText({
        abortSignal: options.abortSignal,
        maxOutputTokens: 1800,
        messages,
        model: getLanguageModel(options.llm),
        providerOptions: getProviderOptions(),
        stopWhen: stepCountIs(6),
        system: systemInstruction,
        temperature: shouldUseTemperature() ? 0.25 : undefined,
        tools: buildAdminChatTools(
          options.userId,
          options.profileId,
          options.currentThreadId ?? null,
        ),
      });

      options.onTokenUsage?.(
        await buildLlmRequestTokenUsage({
          messages,
          system: systemInstruction,
          turn: turn + 1,
          usage: result.usage,
        }),
      );

      const userFacingFinishMessage = getUserFacingFinishReasonMessage(
        result.finishReason,
        undefined,
        result.providerMetadata,
      );
      if (userFacingFinishMessage) {
        throw new Error(userFacingFinishMessage);
      }

      logJson('[Mr. F Admin LLM response]', {
        finishReason: result.finishReason,
        providerMetadata: result.providerMetadata,
        reasoningTokens: result.usage?.reasoningTokens,
        text: result.text,
        usage: result.usage,
      });

      const parsedObject = parseJsonFromModelText(result.text);
      const inferredLinks = extractInferredLinkBlocks(result.steps.flatMap((step) => step.toolResults));
      const blocks = mergeAdminLinkBlocks(
        validateAdminResponseBlocks(parsedObject),
        inferredLinks,
      );
      const content = adminBlocksToMarkdown(blocks);

      return {
        blocks,
        content,
        model: env.llmModel,
        provider: env.llmProvider,
      };
    } catch (error) {
      lastError = error;

      if (turn >= maxAdminTurns - 1) {
        throw error;
      }

      messages.push({
        content: [
          'INTERNAL APP CONTINUATION.',
          '',
          'Your previous response was not valid for the Admin Chat response contract.',
          error instanceof Error ? error.message : 'Unknown validation error.',
          'Re-emit the complete response as one JSON object.',
          'Do not include any text before or after the JSON object.',
          'The only valid block types are: message, activity_link.',
        ].join('\n'),
        role: 'user',
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('El Admin Chat no devolvió una respuesta estructurada válida.');
}

function buildAdminChatTools(
  userId: string,
  profileId: string,
  currentThreadId: string | null,
) {
  return {
    list_activities: tool({
      description:
        'List the user activities. Optionally filter by a text query in the title or description.',
      inputSchema: z.object({
        query: z.string().trim().min(1).optional(),
      }),
      execute: async ({ query }) => {
        const normalizedQuery = normalizeSearchText(query || '');
        const activities = listActivitiesForProfile(userId, profileId)
          .filter((activity) => {
            if (!normalizedQuery) {
              return true;
            }

            const haystack = `${activity.title}\n${activity.description}`;
            return normalizeSearchText(haystack).includes(normalizedQuery);
          })
          .map((activity) => ({
            conversationCount: listConversationsForActivity(
              activity.id,
              userId,
              profileId,
            ).length,
            description: activity.description,
            id: activity.id,
            title: activity.title,
            tutorInstructions: activity.tutorInstructions,
            updatedAt: activity.updatedAt,
            url: `/activities/${encodeURIComponent(activity.id)}`,
          }));

        return {
          activities,
          count: activities.length,
        };
      },
    }),

    create_activity: tool({
      description: 'Create a new activity for the user.',
      inputSchema: z.object({
        description: z.string().trim().min(1).max(1500),
        title: z.string().trim().min(1).max(220),
        tutorInstructions: z.string().trim().min(1).max(12000),
      }),
      execute: async ({ description, title, tutorInstructions }) => {
        const activity = createActivity({
          description,
          profileId,
          title,
          tutorInstructions,
          userId,
        });

        return {
          activity: summarizeActivity(activity, 0),
          url: `/activities/${encodeURIComponent(activity.id)}`,
        };
      },
    }),

    update_activity: tool({
      description:
        'Update an existing activity. Use list_activities first if you need to discover the activity id.',
      inputSchema: z.object({
        activityId: z.string().trim().min(1),
        description: z.string().trim().min(1).max(1500).optional(),
        title: z.string().trim().min(1).max(220).optional(),
        tutorInstructions: z.string().trim().min(1).max(12000).optional(),
      }),
      execute: async ({ activityId, description, title, tutorInstructions }) => {
        const current = findActivityForUser(activityId, userId);
        if (!current) {
          return {
            error: `No activity found with id ${activityId}.`,
          };
        }
        if (current.profileId !== profileId) {
          return {
            error: `Activity ${activityId} does not belong to the current profile.`,
          };
        }

        const next = updateActivity({
          activityId,
          description: description ?? current.description,
          title: title ?? current.title,
          tutorInstructions: tutorInstructions ?? current.tutorInstructions,
          userId,
        });

        if (!next) {
          return {
            error: `Could not update activity ${activityId}.`,
          };
        }

        return {
          activity: summarizeActivity(
            next,
            listConversationsForActivity(next.id, userId, profileId).length,
          ),
          url: `/activities/${encodeURIComponent(next.id)}`,
        };
      },
    }),

    delete_activity: tool({
      description:
        'Delete an existing activity. Existing chats keep their historical snapshot, but the activity is removed from the activity library.',
      inputSchema: z.object({
        activityId: z.string().trim().min(1),
      }),
      execute: async ({ activityId }) => {
        const existing = findActivityForUser(activityId, userId);
        if (!existing) {
          return {
            error: `No activity found with id ${activityId}.`,
          };
        }
        if (existing.profileId !== profileId) {
          return {
            error: `Activity ${activityId} does not belong to the current profile.`,
          };
        }

        const deleted = deleteActivityForUser(activityId, userId);
        if (!deleted) {
          return {
            error: `Could not delete activity ${activityId}.`,
          };
        }

        return {
          deletedActivity: {
            id: existing.id,
            title: existing.title,
          },
        };
      },
    }),

    list_conversations: tool({
      description:
        'List the user conversations. Optionally filter by a query in the title.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional(),
        query: z.string().trim().min(1).optional(),
      }),
      execute: async ({ limit, query }) => {
        const normalizedQuery = query?.toLowerCase().trim() || '';
        const conversations = listConversationsForProfile(userId, profileId)
          .filter((conversation) => {
            if (!normalizedQuery) {
              return true;
            }

            return conversation.title.toLowerCase().includes(normalizedQuery);
          })
          .slice(0, limit ?? 12)
          .map((conversation) => ({
            activityId: conversation.activityId,
            id: conversation.id,
            title: conversation.title,
            updatedAt: conversation.updatedAt,
            url: `/c/${encodeURIComponent(conversation.id)}`,
          }));

        return {
          conversations,
          count: conversations.length,
        };
      },
    }),

    rename_conversation: tool({
      description: 'Rename a user conversation.',
      inputSchema: z.object({
        conversationId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(160),
      }),
      execute: async ({ conversationId, title }) => {
        const existing = findConversationForUser(conversationId, userId);
        if (!existing) {
          return {
            error: `No conversation found with id ${conversationId}.`,
          };
        }
        if (existing.profileId !== profileId) {
          return {
            error: `Conversation ${conversationId} does not belong to the current profile.`,
          };
        }

        const conversation = renameConversationForUser(
          conversationId,
          userId,
          title,
          { updatedByUser: true },
        );

        if (!conversation) {
          return {
            error: `Could not rename conversation ${conversationId}.`,
          };
        }

        return {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            updatedAt: conversation.updatedAt,
            url: `/c/${encodeURIComponent(conversation.id)}`,
          },
        };
      },
    }),

    build_activity_link: tool({
      description:
        'Build a UI activity link action so the interface can render an activity button instead of showing a raw URL.',
      inputSchema: z.object({
        activityId: z.string().trim().min(1),
        label: z.string().trim().min(1).max(160).optional(),
      }),
      execute: async ({ activityId, label }) => {
        const activity = findActivityForUser(activityId, userId);
        if (!activity) {
          return {
            error: `No activity found with id ${activityId}.`,
          };
        }
        if (activity.profileId !== profileId) {
          return {
            error: `Activity ${activityId} does not belong to the current profile.`,
          };
        }

        return {
          action: {
            activityId,
            label: label || 'Abrir actividad',
            type: 'activity_link' as const,
          },
        };
      },
    }),

    auto_title_current_chat: tool({
      description:
        'Assign a better title to the current admin chat thread when its purpose is already clear.',
      inputSchema: z.object({
        title: z.string().trim().min(1).max(160),
      }),
      execute: async ({ title }) => {
        if (!currentThreadId) {
          return {
            error: 'There is no current admin chat thread to rename.',
          };
        }

        const currentThread = findAdminChatThreadForUser(currentThreadId, userId);
        if (!currentThread) {
          return {
            error: `No admin chat thread found with id ${currentThreadId}.`,
          };
        }
        if (currentThread.profileId !== profileId) {
          return {
            error: `Admin chat thread ${currentThreadId} does not belong to the current profile.`,
          };
        }

        const renamedThread = renameAdminChatThreadForUser(
          currentThreadId,
          userId,
          title,
        );
        if (!renamedThread) {
          return {
            error: `Could not rename admin chat thread ${currentThreadId}.`,
          };
        }

        return {
          thread: {
            id: renamedThread.id,
            title: renamedThread.title,
            updatedAt: renamedThread.updatedAt,
          },
        };
      },
    }),
  };
}

function summarizeActivity(
  activity: StoredActivity,
  conversationCount: number,
) {
  return {
    conversationCount,
    description: activity.description,
    id: activity.id,
    title: activity.title,
    updatedAt: activity.updatedAt,
    url: `/activities/${encodeURIComponent(activity.id)}`,
  };
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`JSON parsing failed: ${message}`);
  }
}

function validateAdminResponseBlocks(value: unknown): AdminChatResponseBlock[] {
  const parsed = adminChatResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '));
  }

  return parsed.data.blocks as AdminChatResponseBlock[];
}

function adminBlocksToMarkdown(blocks: AdminChatResponseBlock[]): string {
  const messageMarkdown = blocks
    .filter((block): block is AdminChatMessageBlock => block.type === 'message')
    .map((block) => block.markdown.trim())
    .filter(Boolean);

  if (messageMarkdown.length > 0) {
    return messageMarkdown.join('\n\n');
  }

  return 'Listo.';
}

function mergeAdminLinkBlocks(
  blocks: AdminChatResponseBlock[],
  inferredLinks: AdminChatActivityLinkBlock[],
) {
  const merged = [...blocks];
  const existingKeys = new Set(
    merged
      .filter((block): block is AdminChatActivityLinkBlock => block.type === 'activity_link')
      .map((block) => `${block.activityId}::${block.label}`),
  );

  for (const link of inferredLinks) {
    const key = `${link.activityId}::${link.label}`;
    if (!existingKeys.has(key)) {
      merged.push(link);
      existingKeys.add(key);
    }
  }

  return merged;
}

function extractInferredLinkBlocks(
  toolResults: Array<{
    output: unknown;
    preliminary?: boolean;
    toolName: string;
  }>,
) : AdminChatActivityLinkBlock[] {
  const actions: AdminChatActivityLinkBlock[] = [];

  for (const result of toolResults) {
    if (result.preliminary) {
      continue;
    }

    if (result.toolName === 'build_activity_link') {
      const action = extractActionRecord((result.output as { action?: unknown })?.action);
      if (action) {
        actions.push({
          activityId: action.activityId,
          label: action.label,
          type: 'activity_link',
        });
      }
      continue;
    }

    if (result.toolName === 'create_activity' || result.toolName === 'update_activity') {
      const activity = extractActivityRecord((result.output as { activity?: unknown })?.activity);
      if (activity) {
        actions.push({
          activityId: activity.id,
          label: 'Abrir actividad',
          type: 'activity_link',
        });
      }
      continue;
    }
  }

  const deduped = new Map<string, AdminChatActivityLinkBlock>();
  for (const action of actions) {
    deduped.set(`${action.activityId}::${action.label}`, action);
  }

  return Array.from(deduped.values());
}

function extractActionRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.label !== 'string' || typeof record.activityId !== 'string') {
    return null;
  }

  return {
    activityId: record.activityId,
    label: record.label,
  };
}

function extractActivityRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.url !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    url: record.url,
  };
}
