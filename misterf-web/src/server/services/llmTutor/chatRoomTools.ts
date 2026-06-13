import { tool } from 'ai';
import { z } from 'zod';
import { findUserById } from '../../auth/repository.js';
import {
  createChatRoom,
  deleteChatRoomForUser,
  findChatRoomConversationForUser,
  findChatRoomConversationReport,
  findChatRoomForUser,
  listChatRoomCharacters,
  listChatRoomConversationsForRoom,
  listChatRoomMessages,
  listChatRoomsForProfile,
  saveChatRoomConversationReport,
  type StoredChatRoomConversationReport,
  type StoredChatRoom,
  type StoredChatRoomCharacter,
  type StoredChatRoomConversation,
  type StoredChatRoomMessage,
} from '../../db/repository.js';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../creditGate.js';
import { generateChatRoomConversationReport } from '../chatrooms.js';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTutorChatRoomTools(input: {
  onToolCall?: (toolName: string) => void;
  profileId: string | null;
  userId: string | null;
}) {
  if (!input.userId || !input.profileId) {
    return undefined;
  }

  const { onToolCall, profileId, userId } = input;

  function announceToolCall(toolName: string) {
    onToolCall?.(toolName);
  }

  return {
    list_chat_rooms: tool({
      description:
        'List the persistent chat rooms in the current profile only when the learner explicitly asks to find, list, show, open, or choose saved chat rooms. These chat rooms are standalone resources the learner can open later from the app to do separate social-writing practice. They are not inline exercises and they are not a continuation of the current Mr. F chat turn. Optionally filter by a text query in the title or description.',
      inputSchema: z.object({
        query: z.string().trim().min(1)
          .describe('Optional Spanish or English search text from the learner request. Use only to narrow the saved chat-room list by title or description. Do not invent a query when the learner asks to list all chat rooms.')
          .optional(),
      }),
      execute: async ({ query }) => {
        announceToolCall('list_chat_rooms');
        const normalizedQuery = normalizeSearchText(query || '');
        const chatRooms = listChatRoomsForProfile(userId, profileId)
          .filter((chatRoom) => {
            if (!normalizedQuery) {
              return true;
            }

            return normalizeSearchText(
              `${chatRoom.title}\n${chatRoom.description}`,
            ).includes(normalizedQuery);
          })
          .map((chatRoom) => summarizeChatRoom(chatRoom));

        return { chatRooms, count: chatRooms.length };
      },
    }),
    create_chat_room: tool({
      description:
        'Create a new persistent chat room in the current profile, but only when the learner explicitly asks for it or explicitly confirms your immediately preceding proposal to create it. A chat room is a standalone reusable resource the learner can access later from the app for separate chat-based practice. It is not an inline exercise for the current turn and it must not be treated as a continuation of the current Mr. F conversation. You may infer details from the learner request only after an explicit creation request or confirmation. The room needs a title, a description, and 1 to 3 AI characters.',
      inputSchema: z.object({
        characters: z.array(
          z.object({
            fullDescription: z.string().trim().min(1).max(4000)
              .describe('Spanish persistent character instructions for how this AI character should behave in the saved chat room: role, personality, speaking style, relationship to the learner, and practice purpose. Do not include temporary current-chat instructions.'),
            name: z.string().trim().min(1).max(120)
              .describe('Short visible character name for the saved chat room. Use a natural name or role from the learner request; do not invent unrelated characters when the learner specified them.'),
            shortDescription: z.string().trim().max(220)
              .describe('Optional short Spanish visible summary of the character role. Omit if the full description already makes the role obvious or the learner did not provide enough detail.')
              .optional(),
          }),
        ).min(1).max(3)
          .describe('One to three persistent AI characters for the saved chat room. Include only characters that fit the learner-authorized room concept.'),
        description: z.string().trim().min(1).max(2000)
          .describe('Spanish learner-facing description of what the saved chat room is for, what kind of English practice it supports, and the social situation it simulates. Do not describe the current tutor conversation.'),
        title: z.string().trim().min(1).max(220)
          .describe('Short Spanish title for the saved chat-room resource. Infer only from an explicit chat-room creation request or confirmation.'),
      }),
      execute: async ({ characters, description, title }) => {
        announceToolCall('create_chat_room');
        const chatRoom = createChatRoom({
          characters,
          description,
          profileId,
          title,
          userId,
        });

        return { chatRoom: summarizeChatRoom(chatRoom) };
      },
    }),
    delete_chat_room: tool({
      description:
        'Delete a persistent chat room from the current profile. This is for administering standalone chat-room resources that live outside the current Mr. F conversation. Only use it when the learner explicitly asks to delete a chat room resource.',
      inputSchema: z.object({
        chatRoomId: z.string().trim().min(1)
          .describe('Real saved chat-room id to delete, obtained from tool results, current context, or stored records. Never invent, slugify, translate, or guess this id.'),
      }),
      execute: async ({ chatRoomId }) => {
        announceToolCall('delete_chat_room');
        const current = findChatRoomForUser(chatRoomId, userId);
        if (!current) {
          return { error: `No chat room found with id ${chatRoomId}.` };
        }
        if (current.profileId !== profileId) {
          return { error: `Chat room ${chatRoomId} does not belong to the current profile.` };
        }

        const deleted = deleteChatRoomForUser(chatRoomId, userId);
        if (!deleted) {
          return { error: `Could not delete chat room ${chatRoomId}.` };
        }

        return {
          deletedChatRoom: {
            id: current.id,
            title: current.title,
          },
        };
      },
    }),
    list_chat_room_conversations: tool({
      description:
        'List the saved conversations inside one persistent chat-room resource. Use this only when the learner explicitly asks to inspect, review, or browse the history of a standalone chat room that exists outside the current Mr. F conversation. This is not for continuing the current tutor thread and not for inline exercises.',
      inputSchema: z.object({
        chatRoomId: z.string().trim().min(1)
          .describe('Real saved chat-room id whose conversation history should be listed. Use an id from tool results, current context, or stored records; never invent, slugify, translate, or guess it.'),
        limit: z.number().int().min(1).max(50)
          .describe('Optional maximum number of saved chat-room conversations to return. Omit for the default recent-history size unless the learner asks for a specific amount.')
          .optional(),
      }),
      execute: async ({ chatRoomId, limit }) => {
        announceToolCall('list_chat_room_conversations');
        const room = findChatRoomForUser(chatRoomId, userId);
        if (!room) {
          return { error: `No chat room found with id ${chatRoomId}.` };
        }
        if (room.profileId !== profileId) {
          return { error: `Chat room ${chatRoomId} does not belong to the current profile.` };
        }

        const conversations = listChatRoomConversationsForRoom(chatRoomId, userId)
          .slice(0, limit ?? 20)
          .map((conversation) => summarizeChatRoomConversation(conversation));

        return {
          chatRoom: {
            historyUrl: `/chatrooms/${encodeURIComponent(room.id)}/history`,
            id: room.id,
            title: room.title,
          },
          conversations,
          count: conversations.length,
        };
      },
    }),
    get_chat_room_conversation: tool({
      description:
        'Read a specific saved chat-room conversation transcript from a persistent chat-room resource. Use this only when the learner explicitly asks to inspect or review that saved conversation. This is a standalone resource outside the current Mr. F conversation, not an inline exercise and not a continuation of the current tutor thread.',
      inputSchema: z.object({
        chatRoomConversationId: z.string().trim().min(1)
          .describe('Real saved chat-room conversation id to read, obtained from tool results, current context, or stored records. Never invent, slugify, translate, or guess this id.'),
        messageLimit: z.number().int().min(1).max(200)
          .describe('Optional maximum number of transcript messages to return from the saved conversation. Omit for the default recent transcript size unless the learner asks for a specific amount or the transcript is too long.')
          .optional(),
      }),
      execute: async ({ chatRoomConversationId, messageLimit }) => {
        announceToolCall('get_chat_room_conversation');
        const conversation = findChatRoomConversationForUser(chatRoomConversationId, userId);
        if (!conversation) {
          return { error: `No chat room conversation found with id ${chatRoomConversationId}.` };
        }
        if (conversation.profileId !== profileId) {
          return {
            error: `Chat room conversation ${chatRoomConversationId} does not belong to the current profile.`,
          };
        }

        const room = findChatRoomForUser(conversation.roomId, userId);
        if (!room) {
          return { error: `Could not load the parent chat room for conversation ${chatRoomConversationId}.` };
        }

        const messages = listChatRoomMessages(conversation.id)
          .slice(-(messageLimit ?? 80))
          .map((message) => summarizeChatRoomMessage(message));

        return {
          chatRoom: {
            historyUrl: `/chatrooms/${encodeURIComponent(room.id)}/history`,
            id: room.id,
            title: room.title,
          },
          conversation: {
            ...summarizeChatRoomConversation(conversation),
            messageCount: messages.length,
            transcriptUrl: `/chatroom-conversations/${encodeURIComponent(conversation.id)}`,
          },
          messages,
        };
      },
    }),
    evaluate_chat_room_conversation: tool({
      description:
        'Evaluate a saved chat-room conversation and create its persistent report. Use this only when the learner explicitly asks to evaluate, assess, review, grade, analyze, or generate a report for a saved chat-room conversation resource. If a report already exists, return it instead of generating a duplicate unless regenerate is explicitly set to true.',
      inputSchema: z.object({
        chatRoomConversationId: z.string().trim().min(1)
          .describe('Real saved chat-room conversation id to evaluate, obtained from tool results, current context, or stored records. Never invent, slugify, translate, or guess this id.'),
        regenerate: z.boolean()
          .describe('Set true only when the learner explicitly asks to regenerate or redo an existing report. Omit or false to reuse an existing report when one already exists.')
          .optional(),
      }),
      execute: async ({ chatRoomConversationId, regenerate }) => {
        announceToolCall('evaluate_chat_room_conversation');
        const conversation = findChatRoomConversationForUser(chatRoomConversationId, userId);
        if (!conversation) {
          return { error: `No chat room conversation found with id ${chatRoomConversationId}.` };
        }
        if (conversation.profileId !== profileId) {
          return {
            error: `Chat room conversation ${chatRoomConversationId} does not belong to the current profile.`,
          };
        }

        const room = findChatRoomForUser(conversation.roomId, userId);
        if (!room) {
          return { error: `Could not load the parent chat room for conversation ${chatRoomConversationId}.` };
        }

        const existingReport = findChatRoomConversationReport(conversation.id, userId);
        if (existingReport && !regenerate) {
          return {
            chatRoom: summarizeChatRoom(room),
            conversation: summarizeChatRoomConversation(conversation),
            report: summarizeChatRoomConversationReport(existingReport),
          };
        }

        const currentUser = findUserById(userId);
        if (!currentUser) {
          return { error: 'Could not resolve the current user for report generation.' };
        }

        let savedReport: StoredChatRoomConversationReport;
        try {
          const messages = listChatRoomMessages(conversation.id);
          const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(userId);
          const generatedReport = await generateChatRoomConversationReport({
            messages,
            openRouterApiKey,
            room,
            userName: currentUser.fullName,
          });

          savedReport = saveChatRoomConversationReport({
            conversationId: conversation.id,
            profileId: conversation.profileId,
            roomId: room.id,
            slides: generatedReport.slides,
            summaryDescription: generatedReport.summaryDescription,
            summaryTitle: generatedReport.summaryTitle,
            userId,
          });
        } catch (error) {
          return {
            error: error instanceof Error
              ? `Could not generate the chat room conversation report: ${error.message}`
              : 'Could not generate the chat room conversation report.',
          };
        }

        return {
          chatRoom: summarizeChatRoom(room),
          conversation: summarizeChatRoomConversation(conversation),
          report: summarizeChatRoomConversationReport(savedReport),
        };
      },
    }),
    get_chat_room_conversation_report: tool({
      description:
        'Read the persistent report for a saved chat-room conversation. Use this only when the learner explicitly asks to inspect, review, summarize, or revisit the report of a saved chat-room conversation resource.',
      inputSchema: z.object({
        chatRoomConversationId: z.string().trim().min(1)
          .describe('Real saved chat-room conversation id whose persistent report should be read. Use an id from tool results, current context, or stored records; never invent, slugify, translate, or guess it.'),
      }),
      execute: async ({ chatRoomConversationId }) => {
        announceToolCall('get_chat_room_conversation_report');
        const conversation = findChatRoomConversationForUser(chatRoomConversationId, userId);
        if (!conversation) {
          return { error: `No chat room conversation found with id ${chatRoomConversationId}.` };
        }
        if (conversation.profileId !== profileId) {
          return {
            error: `Chat room conversation ${chatRoomConversationId} does not belong to the current profile.`,
          };
        }

        const room = findChatRoomForUser(conversation.roomId, userId);
        if (!room) {
          return { error: `Could not load the parent chat room for conversation ${chatRoomConversationId}.` };
        }

        const report = findChatRoomConversationReport(conversation.id, userId);
        if (!report) {
          return {
            error: `No report exists yet for chat room conversation ${chatRoomConversationId}. Use evaluate_chat_room_conversation first if the learner wants to generate one.`,
          };
        }

        return {
          chatRoom: summarizeChatRoom(room),
          conversation: summarizeChatRoomConversation(conversation),
          report: summarizeChatRoomConversationReport(report),
        };
      },
    }),
  };
}

function summarizeChatRoom(chatRoom: StoredChatRoom) {
  const characters = listChatRoomCharacters(chatRoom.id);
  return {
    characters: characters.map(summarizeChatRoomCharacter),
    description: chatRoom.description,
    historyUrl: `/chatrooms/${encodeURIComponent(chatRoom.id)}/history`,
    id: chatRoom.id,
    title: chatRoom.title,
    updatedAt: chatRoom.updatedAt,
    url: `/chatrooms/${encodeURIComponent(chatRoom.id)}`,
  };
}

function summarizeChatRoomCharacter(character: StoredChatRoomCharacter) {
  return {
    fullDescription: character.fullDescription,
    name: character.name,
    shortDescription: character.shortDescription,
  };
}

function summarizeChatRoomConversation(conversation: StoredChatRoomConversation) {
  const report = findChatRoomConversationReport(conversation.id, conversation.userId);
  return {
    createdAt: conversation.createdAt,
    id: conversation.id,
    report:
      report
        ? {
            createdAt: report.createdAt,
            id: report.id,
            reportUrl: `/chatroom-conversations/${encodeURIComponent(conversation.id)}/report`,
            summaryTitle: report.summaryTitle,
          }
        : null,
    roomId: conversation.roomId,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
  };
}

function summarizeChatRoomMessage(message: StoredChatRoomMessage) {
  return {
    content: message.content,
    createdAt: message.createdAt,
    evaluation:
      message.evaluationStatus === 'warning'
        ? {
            problem: message.evaluationProblem,
            status: 'warning' as const,
          }
        : message.evaluationStatus === 'ok'
        ? {
            status: 'ok' as const,
          }
        : null,
    id: message.id,
    senderName: message.senderName,
    senderType: message.senderType,
  };
}

function summarizeChatRoomConversationReport(report: StoredChatRoomConversationReport) {
  return {
    createdAt: report.createdAt,
    id: report.id,
    practiceModuleId: report.practiceModuleId,
    reportUrl: `/chatroom-conversations/${encodeURIComponent(report.conversationId)}/report`,
    slideCount: report.slides.length,
    slides: report.slides,
    summary: {
      description: report.summaryDescription,
      title: report.summaryTitle,
    },
    updatedAt: report.updatedAt,
  };
}
