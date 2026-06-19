import { getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
export function emitCreditExhaustedIfNeeded(socket, error) {
    if (!isCreditExhaustedError(error)) {
        return false;
    }
    socket.emit('llm:credit_exhausted', {
        message: getCreditExhaustedMessage(),
    });
    return true;
}
export function emitRoomCreditExhaustedIfNeeded(io, conversationId, error) {
    if (!isCreditExhaustedError(error)) {
        return false;
    }
    io.to(conversationId).emit('llm:credit_exhausted', {
        message: getCreditExhaustedMessage(),
    });
    return true;
}
//# sourceMappingURL=creditExhaustion.js.map