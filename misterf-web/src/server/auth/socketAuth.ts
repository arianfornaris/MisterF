import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import type { AuthUser } from './repository.js';

type SocketAuthPayload = {
  exp: number;
  sub: string;
};

const tokenTtlSeconds = 60 * 60;

export function createSocketAuthToken(user: AuthUser): string {
  const payload: SocketAuthPayload = {
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
    sub: user.id,
  };

  const body = encode(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySocketAuthToken(token: unknown): SocketAuthPayload | null {
  if (typeof token !== 'string') {
    return null;
  }

  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) {
    return null;
  }

  const expectedSignature = sign(body);
  if (!safeEquals(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(body);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function parsePayload(body: string): SocketAuthPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      exp?: unknown;
      sub?: unknown;
    };

    if (typeof decoded.exp !== 'number' || typeof decoded.sub !== 'string') {
      return null;
    }

    return {
      exp: decoded.exp,
      sub: decoded.sub,
    };
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac('sha256', env.sessionSecret).update(value).digest('base64url');
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
