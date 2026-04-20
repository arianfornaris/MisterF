import type { FunctionDeclaration } from '@google/genai';
import type { Server } from 'socket.io';

export type LlmToolCall = {
  args: Record<string, unknown>;
  id: string;
  name: string;
};

export type ToolExecutionContext = {
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  userId: string;
};

export interface LlmTool {
  declaration: FunctionDeclaration;
  name: string;
  execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
}
