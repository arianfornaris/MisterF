import type { NextFunction, Request, Response } from 'express';
import {
  buildProfileOnboardingPath,
  profileNeedsOnboarding,
} from './fields.js';

const bypassExactPaths = new Set([
  '/auth/google',
  '/auth/google/callback',
  '/change-password',
  '/forgot-password',
  '/login',
  '/logout',
  '/privacy',
  '/profiles/onboarding',
  '/profiles/onboarding/skip',
  '/register',
  '/reset-password',
  '/signup',
  '/terms',
  '/verify-needed',
]);

const bypassPathPrefixes = [
  '/assets/',
  '/favicon',
  '/node_modules/',
  '/public/',
  '/socket.io/',
  '/stripe/',
];

export function redirectIncompleteProfileOnboarding(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!shouldConsiderProfileOnboarding(request)) {
    next();
    return;
  }

  if (!request.authUser?.emailVerified || !profileNeedsOnboarding(request.activeProfile)) {
    next();
    return;
  }

  response.redirect(buildProfileOnboardingPath(request.originalUrl || request.path));
}

function shouldConsiderProfileOnboarding(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }

  if (!request.accepts('html')) {
    return false;
  }

  const pathname = request.path;
  if (bypassExactPaths.has(pathname)) {
    return false;
  }

  return !bypassPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}
