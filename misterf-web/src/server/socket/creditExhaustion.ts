import {
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';

type SocketCreditEmitter = {
  emit(event: 'llm:credit_exhausted', payload: { message: string }): unknown;
};

type RoomCreditEmitter = {
  emit(event: 'llm:credit_exhausted', payload: { message: string }): unknown;
};

type RoomTarget = {
  to(roomId: string): RoomCreditEmitter;
};

export function emitCreditExhaustedIfNeeded(
  socket: SocketCreditEmitter,
  error: unknown,
): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  socket.emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
}

export function emitRoomCreditExhaustedIfNeeded(
  io: RoomTarget,
  conversationId: string,
  error: unknown,
): boolean {
  if (!isCreditExhaustedError(error)) {
    return false;
  }

  io.to(conversationId).emit('llm:credit_exhausted', {
    message: getCreditExhaustedMessage(),
  });
  return true;
}
