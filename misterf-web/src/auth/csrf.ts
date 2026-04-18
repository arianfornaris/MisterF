import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requireSessionSecret } from './session.js';

const tokenTtlMs = 2 * 60 * 60 * 1000;

export function csrfProtection(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.locals.csrfToken = createCsrfToken();

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    next();
    return;
  }

  const token = typeof request.body?._csrf === 'string'
    ? request.body._csrf
    : '';

  if (!isSameOrigin(request) || !verifyCsrfToken(token)) {
    response.status(403).send('Invalid CSRF token.');
    return;
  }

  next();
}

function createCsrfToken(): string {
  const exp = Date.now() + tokenTtlMs;
  const nonce = randomBytes(16).toString('base64url');
  const body = `${exp}.${nonce}`;
  return `${body}.${sign(body)}`;
}

function verifyCsrfToken(token: string): boolean {
  const [exp, nonce, signature, extra] = token.split('.');
  if (!exp || !nonce || !signature || extra) {
    return false;
  }

  const expiresAt = Number.parseInt(exp, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  return safeEquals(signature, sign(`${exp}.${nonce}`));
}

function isSameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  if (!origin) {
    return true;
  }

  const host = request.get('host');
  return Boolean(host && origin === `${request.protocol}://${host}`);
}

function sign(value: string): string {
  return createHmac('sha256', requireSessionSecret())
    .update(`csrf:${value}`)
    .digest('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
