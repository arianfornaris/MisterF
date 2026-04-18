import type { NextFunction, Request, Response } from 'express';
import {
  findUserBySessionTokenHash,
  type AuthUser,
} from './repository.js';
import { getSessionToken, hashSessionToken } from './session.js';

declare global {
  namespace Express {
    interface Request {
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
    request.authUser = null;
    request.sessionTokenHash = null;
    next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  request.authUser = findUserBySessionTokenHash(tokenHash);
  request.sessionTokenHash = request.authUser ? tokenHash : null;
  response.locals.authUser = request.authUser;
  next();
}
