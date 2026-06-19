import { env } from '../config/env.js';
const logLevelPriority = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const sensitiveKeyPattern = /(api[-_]?key|authorization|bearer|cookie|csrf[-_]?token|password|refresh[-_]?token|secret|session[-_]?(secret|token))/i;
const maxStringLength = 20_000;
const maxDepth = 8;
export function normalizeLogLevel(value) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'debug' ||
        normalized === 'info' ||
        normalized === 'warn' ||
        normalized === 'error') {
        return normalized;
    }
    return 'info';
}
export function shouldWriteLogLevel(messageLevel, configuredLevel = normalizeLogLevel(env.logLevel)) {
    return logLevelPriority[messageLevel] >= logLevelPriority[configuredLevel];
}
export function serializeError(error) {
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
export function sanitizeLogValue(value, depth = 0) {
    if (depth >= maxDepth) {
        return '[Max depth reached]';
    }
    if (value instanceof Error) {
        return serializeError(value);
    }
    if (typeof value === 'string') {
        return truncateString(value, maxStringLength);
    }
    if (value === null ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'undefined') {
        return value;
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeLogValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const sanitized = {};
        for (const [key, childValue] of Object.entries(value)) {
            sanitized[key] = sensitiveKeyPattern.test(key)
                ? '[redacted]'
                : sanitizeLogValue(childValue, depth + 1);
        }
        return sanitized;
    }
    return String(value);
}
function writeLog(level, event, details = {}) {
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
function truncateString(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}...[truncated]`;
}
function isPlainRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export const logger = {
    debug(event, details) {
        writeLog('debug', event, details);
    },
    error(event, details) {
        writeLog('error', event, details);
    },
    info(event, details) {
        writeLog('info', event, details);
    },
    warn(event, details) {
        writeLog('warn', event, details);
    },
};
//# sourceMappingURL=logger.js.map