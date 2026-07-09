import type { Server, Socket } from 'socket.io';
import { getActiveProfileIdFromCookieHeader } from '../auth/profiles.js';
import { findProfileForUser } from '../db/repository.js';
import { logger } from '../services/logger.js';
import type { SceneMediaLibraryItem } from './types.js';

type SocketAuthData = {
  authenticatedUser?: {
    sub: string;
  };
};

let sceneMediaSocketServer: Server | null = null;

export function registerSceneMediaSocket(io: Server): void {
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

export function emitSceneMediaGenerationCreated(item: SceneMediaLibraryItem): void {
  emitSceneMediaGenerationEvent('media_generation:created', item);
}

export function emitSceneMediaGenerationUpdated(item: SceneMediaLibraryItem): void {
  emitSceneMediaGenerationEvent('media_generation:updated', item);
}

export function emitSceneMediaGenerationCompleted(item: SceneMediaLibraryItem): void {
  emitSceneMediaGenerationEvent('media_generation:completed', item);
}

export function emitSceneMediaGenerationFailed(item: SceneMediaLibraryItem): void {
  emitSceneMediaGenerationEvent('media_generation:failed', item);
}

function emitSceneMediaGenerationEvent(
  eventName: string,
  item: SceneMediaLibraryItem,
): void {
  if (!sceneMediaSocketServer || !item.ownerProfileId) {
    return;
  }

  sceneMediaSocketServer.to(sceneMediaProfileRoom(item.ownerProfileId)).emit(
    eventName,
    {
      mediaId: item.id,
      status: item.status,
    },
  );

  logger.info('scene_media_generation_event_emitted', {
    eventName,
    mediaId: item.id,
    profileId: item.ownerProfileId,
    status: item.status,
  });
}

function sceneMediaProfileRoom(profileId: string): string {
  return `profile:${profileId}`;
}

function getSocketUserId(socket: Socket): string | null {
  const data = socket.data as SocketAuthData;
  return data.authenticatedUser?.sub ?? null;
}
