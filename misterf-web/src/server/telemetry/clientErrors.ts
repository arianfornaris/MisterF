import express, { type NextFunction, type Request, type Response } from 'express';
import {
  findUserBySessionTokenHash,
  type AuthUser,
} from '../auth/repository.js';
import {
  getSessionTokenFromCookieHeader,
  hashSessionToken,
} from '../auth/session.js';
import { logger } from '../services/logger.js';

const maxPayloadLength = 16 * 1024;
const maxReportsPerWindow = 20;
const rateLimitWindowMs = 60 * 1000;

type RateLimitBucket = {
  count: number;
  rateLimitLogged: boolean;
  windowStartedAt: number;
};

export type ClientErrorTelemetry = {
  column: number | null;
  conversationId: string;
  fingerprint: string;
  level: 'error' | 'warning';
  line: number | null;
  message: string;
  repeatCount: number;
  route: string;
  source: string;
  stack: string;
  timestamp: string;
  type: string;
  userAgent: string;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export const clientTelemetryRouter = express.Router();

clientTelemetryRouter.post(
  '/telemetry/client-error',
  express.text({
    limit: maxPayloadLength,
    type: 'application/json',
  }),
  handleClientErrorTelemetry,
);

clientTelemetryRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      response.status(204).end();
      return;
    }

    next(error);
  },
);

export function normalizeClientErrorPayload(
  payload: unknown,
): ClientErrorTelemetry | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const message = sanitizeText(record.message, 500);
  const fingerprint = sanitizeText(record.fingerprint, 160);

  if (!message || !fingerprint) {
    return null;
  }

  const level = record.level === 'warning' ? 'warning' : 'error';

  return {
    column: sanitizePositiveInteger(record.column),
    conversationId: sanitizeIdentifier(record.conversationId, 160),
    fingerprint,
    level,
    line: sanitizePositiveInteger(record.line),
    message,
    repeatCount: sanitizeRepeatCount(record.repeatCount),
    route: sanitizeRoute(record.route),
    source: sanitizeText(record.source, 500),
    stack: sanitizeStack(record.stack),
    timestamp: sanitizeTimestamp(record.timestamp),
    type: sanitizeText(record.type, 80) || 'frontend_error',
    userAgent: sanitizeText(record.userAgent, 500),
  };
}

export function createClientTelemetryRateLimiter(input: {
  maxReports: number;
  windowMs: number;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  return {
    allow(key: string, now = Date.now()): boolean {
      return allowClientTelemetryReport({
        buckets,
        key,
        maxReports: input.maxReports,
        now,
        windowMs: input.windowMs,
      }).allowed;
    },
  };
}

async function handleClientErrorTelemetry(
  request: Request,
  response: Response,
): Promise<void> {
  if (!isSameOrigin(request)) {
    response.status(204).end();
    return;
  }

  const parsed = parseJsonBody(request.body);
  const event = normalizeClientErrorPayload(parsed);
  if (!event) {
    response.status(204).end();
    return;
  }

  const sessionTokenHash = getSessionTokenHashFromRequest(request);
  const rateLimitKey = buildRateLimitKey(request, sessionTokenHash);
  const rateLimit = allowClientTelemetryReport({
    buckets: rateLimitBuckets,
    key: rateLimitKey,
    maxReports: maxReportsPerWindow,
    now: Date.now(),
    windowMs: rateLimitWindowMs,
  });

  if (!rateLimit.allowed) {
    if (rateLimit.shouldLogLimit) {
      logClientTelemetryRateLimit({
        key: rateLimitKey,
      });
    }
    response.status(204).end();
    return;
  }

  const user = resolveRequestUser(sessionTokenHash);
  logClientErrorTelemetry({
    event,
    ip: request.ip,
    user,
  });
  response.status(204).end();
}

function allowClientTelemetryReport(input: {
  buckets: Map<string, RateLimitBucket>;
  key: string;
  maxReports: number;
  now: number;
  windowMs: number;
}): { allowed: boolean; shouldLogLimit: boolean } {
  const bucket = input.buckets.get(input.key);
  if (!bucket || input.now - bucket.windowStartedAt >= input.windowMs) {
    input.buckets.set(input.key, {
      count: 1,
      rateLimitLogged: false,
      windowStartedAt: input.now,
    });
    return { allowed: true, shouldLogLimit: false };
  }

  if (bucket.count >= input.maxReports) {
    if (bucket.rateLimitLogged) {
      return { allowed: false, shouldLogLimit: false };
    }

    bucket.rateLimitLogged = true;
    return { allowed: false, shouldLogLimit: true };
  }

  bucket.count += 1;
  return { allowed: true, shouldLogLimit: false };
}

function logClientErrorTelemetry(input: {
  event: ClientErrorTelemetry;
  ip: string | undefined;
  user: AuthUser | null;
}): void {
  const payload = {
    column: input.event.column,
    conversationId: input.event.conversationId || null,
    fingerprint: input.event.fingerprint,
    ip: input.ip || null,
    level: input.event.level,
    line: input.event.line,
    message: input.event.message,
    repeatCount: input.event.repeatCount,
    route: input.event.route || null,
    source: input.event.source || null,
    stack: input.event.stack || null,
    timestamp: input.event.timestamp,
    type: input.event.type,
    userAgent: input.event.userAgent || null,
    userId: input.user?.id ?? null,
  };

  if (input.event.level === 'warning') {
    logger.warn('frontend_error', payload);
    return;
  }

  logger.error('frontend_error', payload);
}

function logClientTelemetryRateLimit(input: {
  key: string;
}): void {
  logger.warn('frontend_error_rate_limited', {
    key: input.key.slice(0, 80),
  });
}

function getSessionTokenHashFromRequest(request: Request): string {
  const token = getSessionTokenFromCookieHeader(request.headers.cookie);
  if (!token) {
    return '';
  }

  return hashSessionToken(token);
}

function resolveRequestUser(sessionTokenHash: string): AuthUser | null {
  if (!sessionTokenHash) {
    return null;
  }

  return findUserBySessionTokenHash(sessionTokenHash);
}

function buildRateLimitKey(request: Request, sessionTokenHash: string): string {
  if (sessionTokenHash) {
    return `session:${sessionTokenHash}`;
  }

  return `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  if (!origin) {
    return true;
  }

  const host = request.get('host');
  return Boolean(host && origin === `${request.protocol}://${host}`);
}

function parseJsonBody(body: unknown): unknown {
  if (typeof body !== 'string' || body.length > maxPayloadLength) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function sanitizeStack(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 2500) : '';
}

function sanitizeRoute(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '';
  }

  return trimmed.split('#')[0].split('?')[0].slice(0, 500);
}

function sanitizeIdentifier(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.trim().replace(/[^\w:.-]/g, '').slice(0, maxLength)
    : '';
}

function sanitizePositiveInteger(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function sanitizeRepeatCount(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    return 1;
  }

  return Math.min(numericValue, 1000);
}

function sanitizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date().toISOString();
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? new Date().toISOString()
    : timestamp.toISOString();
}
