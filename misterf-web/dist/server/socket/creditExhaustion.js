import { getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { logger } from '../services/logger.js';
export function emitCreditExhaustedIfNeeded(socket, error, context = {}) {
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
export function emitRoomCreditExhaustedIfNeeded(io, conversationId, error, context = {}) {
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
//# sourceMappingURL=creditExhaustion.js.map