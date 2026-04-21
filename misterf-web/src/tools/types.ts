import type { Server } from 'socket.io';

export type LlmToolDeclaration = {
  description?: string;
  name: string;
  parametersJsonSchema: Record<string, unknown>;
};

export type LlmToolCall = {
  args: Record<string, unknown>;
  id: string;
  name: string;
};

export type ToolExecutionContext = {
  conversationId: string;
  io: Server;
  lastUserMessageId?: number;
  turnState?: {
    challengeCompletedThisTurn?: boolean;
  };
  userId: string;
};

export interface LlmTool {
  declaration: LlmToolDeclaration;
  name: string;
  execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
}
