import { getActiveProfileIdFromCookieHeader } from '../auth/profiles.js';
import { findProfileForUser } from '../db/repository.js';
import { logger } from '../services/logger.js';
let sceneMediaSocketServer = null;
export function registerSceneMediaSocket(io) {
    sceneMediaSocketServer = io;
    io.on('connection', (socket) => {
        const userId = getSocketUserId(socket);
        const profileId = getActiveProfileIdFromCookieHeader(socket.handshake.headers.cookie);
        if (!userId || !profileId) {
            return;
        }
        const profile = findProfileForUser(profileId, userId);
        if (!profile) {
            return;
        }
        void socket.join(sceneMediaProfileRoom(profile.id));
    });
}
export function emitSceneMediaGenerationCreated(item) {
    emitSceneMediaGenerationEvent('media_generation:created', item);
}
export function emitSceneMediaGenerationUpdated(item) {
    emitSceneMediaGenerationEvent('media_generation:updated', item);
}
export function emitSceneMediaGenerationCompleted(item) {
    emitSceneMediaGenerationEvent('media_generation:completed', item);
}
export function emitSceneMediaGenerationFailed(item) {
    emitSceneMediaGenerationEvent('media_generation:failed', item);
}
function emitSceneMediaGenerationEvent(eventName, item) {
    if (!sceneMediaSocketServer || !item.ownerProfileId) {
        return;
    }
    sceneMediaSocketServer.to(sceneMediaProfileRoom(item.ownerProfileId)).emit(eventName, {
        mediaId: item.id,
        status: item.status,
    });
    logger.info('scene_media_generation_event_emitted', {
        eventName,
        mediaId: item.id,
        profileId: item.ownerProfileId,
        status: item.status,
    });
}
function sceneMediaProfileRoom(profileId) {
    return `profile:${profileId}`;
}
function getSocketUserId(socket) {
    const data = socket.data;
    return data.authenticatedUser?.sub ?? null;
}
//# sourceMappingURL=socket.js.map