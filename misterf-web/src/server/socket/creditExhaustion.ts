import {
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import { logger } from '../services/logger.js';

type SocketCreditEmitter = {
  emit(event: 'llm:credit_exhausted', payload: { message: string }): unknown;
};

type RoomCreditEmitter = {
  emit(event: 'llm:credit_exhausted', payload: { message: string }): unknown;
};

type RoomTarget = {
  to(roomId: string): RoomCreditEmitter;
};

type CreditExhaustionLogContext = {
  conversationId?: string | null;
  messageId?: number | string | null;
  profileId?: string | null;
  surface?: string;
  userId?: string | null;
};

export function emitCreditExhaustedIfNeeded(
  socket: SocketCreditEmitter,
  error: unknown,
  context: CreditExhaustionLogContext = {},
): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  logger.warn('credit_exhausted_socket_emit', {
    conversationId: context.conversationId ?? null,
    messageId: context.messageId ?? null,
    profileId: context.profileId ?? null,
    surface: context.surface ?? 'socket',
    userId: context.userId ?? null,
  });
  socket.emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
}

export function emitRoomCreditExhaustedIfNeeded(
  io: RoomTarget,
  conversationId: string,
  error: unknown,
  context: Omit<CreditExhaustionLogContext, 'conversationId'> = {},
): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  logger.warn('credit_exhausted_room_emit', {
    conversationId,
    messageId: context.messageId ?? null,
    profileId: context.profileId ?? null,
    surface: context.surface ?? 'room_socket',
    userId: context.userId ?? null,
  });
  io.to(conversationId).emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
}
