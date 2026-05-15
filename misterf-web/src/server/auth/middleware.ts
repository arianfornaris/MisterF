import type { NextFunction, Request, Response } from 'express';
import {
  ensureUserHasProfile,
  findProfileForUser,
  listProfilesForUser,
  type StoredProfile,
} from '../db/repository.js';
import {
  findUserBySessionTokenHash,
  type AuthUser,
} from './repository.js';
import { getActiveProfileId, setActiveProfileCookie } from './profiles.js';
import { getSessionToken, hashSessionToken } from './session.js';

declare global {
  namespace Express {
    interface Request {
      activeProfile: StoredProfile | null;
      availableProfiles: StoredProfile[];
      authUser: AuthUser | null;
      sessionTokenHash: string | null;
    }
  }
}

export function loadAuthSession(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const token = getSessionToken(request);
  if (!token) {
    request.activeProfile = null;
    request.availableProfiles = [];
    request.authUser = null;
    request.sessionTokenHash = null;
    next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  request.authUser = findUserBySessionTokenHash(tokenHash);
  request.sessionTokenHash = request.authUser ? tokenHash : null;
  response.locals.authUser = request.authUser;

  if (!request.authUser) {
    request.activeProfile = null;
    request.availableProfiles = [];
    next();
    return;
  }

  const firstProfile = ensureUserHasProfile(request.authUser.id);
  const availableProfiles = listProfilesForUser(request.authUser.id);
  const preferredProfileId = getActiveProfileId(request);
  const activeProfile =
    (preferredProfileId
      ? findProfileForUser(preferredProfileId, request.authUser.id)
      : null) ?? firstProfile;

  request.activeProfile = activeProfile;
  request.availableProfiles = availableProfiles;
  response.locals.activeProfile = activeProfile;
  response.locals.availableProfiles = availableProfiles;

  if (preferredProfileId !== activeProfile.id) {
    setActiveProfileCookie(response, activeProfile.id);
  }

  next();
}
