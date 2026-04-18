import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  MissingGeminiApiKeyError,
  streamTutorReply,
  type TutorMessage,
} from '../services/geminiTutor.js';

type JoinPayload = {
  conversationId?: string | null;
};

type SendMessagePayload = {
  conversationId?: string | null;
  content?: string;
};

type ChatMessage = TutorMessage & {
  id: string;
  conversationId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const runningConversations = new Set<string>();
const conversations = new Map<string, ChatMessage[]>();

export function registerChatSocket(io: Server): void {
  io.on('connection', (socket) => {
    let currentConversationId: string | null = null;

    socket.on('conversation:join', async (payload: JoinPayload = {}) => {
      const conversationId = getOrCreateConversation(payload.conversationId);
      joinConversationRoom(socket, currentConversationId, conversationId);
      currentConversationId = conversationId;

      const messages = listMessages(conversationId);
      socket.emit('conversation:ready', { conversationId, messages });

      if (messages.length === 0) {
        await streamAssistantMessage(io, conversationId, true);
      }
    });

    socket.on('message:send', async (payload: SendMessagePayload = {}) => {
      const content = payload.content?.trim();
      if (!content) {
        return;
      }

      const conversationId = getOrCreateConversation(payload.conversationId);
      joinConversationRoom(socket, currentConversationId, conversationId);
      currentConversationId = conversationId;

      if (runningConversations.has(conversationId)) {
        socket.emit('assistant:error', {
          message: 'Espera un momento: Mister F todavia esta respondiendo.',
        });
        return;
      }

      const userMessage = addMessage(conversationId, 'user', content);
      io.to(conversationId).emit('message:created', userMessage);

      await streamAssistantMessage(io, conversationId);
    });

    socket.on('conversation:reset', async () => {
      const conversationId = createConversation();
      joinConversationRoom(socket, currentConversationId, conversationId);
      currentConversationId = conversationId;
      socket.emit('conversation:ready', { conversationId, messages: [] });
      await streamAssistantMessage(io, conversationId, true);
    });
  });
}

function createConversation(): string {
  const conversationId = randomUUID();
  conversations.set(conversationId, []);
  return conversationId;
}

function getOrCreateConversation(conversationId?: string | null): string {
  if (conversationId) {
    conversations.set(conversationId, conversations.get(conversationId) ?? []);
    return conversationId;
  }

  return createConversation();
}

function listMessages(conversationId: string): ChatMessage[] {
  return conversations.get(conversationId) ?? [];
}

function addMessage(
  conversationId: string,
  role: TutorMessage['role'],
  content: string,
  metadata: Record<string, unknown> | null = null,
): ChatMessage {
  const message = {
    id: randomUUID(),
    conversationId,
    role,
    content,
    metadata,
    createdAt: new Date().toISOString(),
  };

  const messages = conversations.get(conversationId) ?? [];
  messages.push(message);
  conversations.set(conversationId, messages);

  return message;
}

function joinConversationRoom(
  socket: Socket,
  previousConversationId: string | null,
  nextConversationId: string,
): void {
  if (previousConversationId && previousConversationId !== nextConversationId) {
    socket.leave(previousConversationId);
  }

  socket.join(nextConversationId);
}

async function streamAssistantMessage(
  io: Server,
  conversationId: string,
  startConversation = false,
): Promise<void> {
  if (runningConversations.has(conversationId)) {
    return;
  }

  runningConversations.add(conversationId);
  io.to(conversationId).emit('assistant:start');

  let content = '';

  try {
    const history = listMessages(conversationId);
    for await (const chunk of streamTutorReply(history, { startConversation })) {
      content += chunk;
      io.to(conversationId).emit('assistant:chunk', { chunk });
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error('Gemini returned an empty response.');
    }

    const assistantMessage = addMessage(
      conversationId,
      'model',
      trimmedContent,
      { model: 'gemini' },
    );

    io.to(conversationId).emit('assistant:done', assistantMessage);
  } catch (error) {
    io.to(conversationId).emit('assistant:error', {
      message: toUserFacingError(error),
    });
  } finally {
    runningConversations.delete(conversationId);
  }
}

function toUserFacingError(error: unknown): string {
  if (error instanceof MissingGeminiApiKeyError) {
    return 'Falta configurar GEMINI_API_KEY en ecosystem.config.cjs.';
  }

  if (error instanceof Error) {
    return `No pude hablar con Gemini: ${error.message}`;
  }

  return 'No pude hablar con Gemini por un error inesperado.';
}
