import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogDetails = Record<string, unknown>;

const logLevelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sensitiveKeyPattern =
  /(api[-_]?key|authorization|bearer|cookie|csrf[-_]?token|password|refresh[-_]?token|secret|session[-_]?(secret|token))/i;
const maxStringLength = 20_000;
const maxDepth = 8;

export function normalizeLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
  ) {
    return normalized;
  }

  return 'info';
}

export function shouldWriteLogLevel(
  messageLevel: LogLevel,
  configuredLevel = normalizeLogLevel(env.logLevel),
): boolean {
  return logLevelPriority[messageLevel] >= logLevelPriority[configuredLevel];
}

export function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    cause: error.cause ? serializeError(error.cause) : undefined,
    message: error.message,
    name: error.name,
    stack: truncateString(error.stack ?? '', maxStringLength),
  };
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth >= maxDepth) {
    return '[Max depth reached]';
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === 'string') {
    return truncateString(value, maxStringLength);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      sanitized[key] = sensitiveKeyPattern.test(key)
        ? '[redacted]'
        : sanitizeLogValue(childValue, depth + 1);
    }
    return sanitized;
  }

  return String(value);
}

function writeLog(
  level: LogLevel,
  event: string,
  details: LogDetails = {},
): void {
  if (!shouldWriteLogLevel(level)) {
    return;
  }

  const sanitizedDetails = sanitizeLogValue(details);
  const payload = {
    ...(isPlainRecord(sanitizedDetails) ? sanitizedDetails : {}),
    event,
    level,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated]`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export const logger = {
  debug(event: string, details?: LogDetails): void {
    writeLog('debug', event, details);
  },
  error(event: string, details?: LogDetails): void {
    writeLog('error', event, details);
  },
  info(event: string, details?: LogDetails): void {
    writeLog('info', event, details);
  },
  warn(event: string, details?: LogDetails): void {
    writeLog('warn', event, details);
  },
};
