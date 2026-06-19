import { describe, expect, it } from 'vitest';
import {
  createClientTelemetryRateLimiter,
  normalizeClientErrorPayload,
} from '../../src/server/telemetry/clientErrors.js';

describe('client error telemetry', () => {
  it('normalizes and sanitizes browser error payloads', () => {
    const event = normalizeClientErrorPayload({
      column: 8,
      conversationId: 'conversation id with spaces!',
      fingerprint: 'fingerprint-1',
      level: 'error',
      line: 42,
      message: '  Cannot read properties of undefined  ',
      repeatCount: 3,
      route: '/c/conversation-1?secret=value',
      source: 'https://example.test/public/build/app.js',
      stack: 'TypeError: Cannot read properties\n    at render',
      timestamp: '2026-06-18T12:00:00.000Z',
      type: 'window_error',
      userAgent: 'Test Browser',
    });

    expect(event).toMatchObject({
      column: 8,
      conversationId: 'conversationidwithspaces',
      fingerprint: 'fingerprint-1',
      level: 'error',
      line: 42,
      message: 'Cannot read properties of undefined',
      repeatCount: 3,
      route: '/c/conversation-1',
      source: 'https://example.test/public/build/app.js',
      stack: 'TypeError: Cannot read properties\n    at render',
      timestamp: '2026-06-18T12:00:00.000Z',
      type: 'window_error',
      userAgent: 'Test Browser',
    });
  });

  it('rejects payloads without a message or fingerprint', () => {
    expect(normalizeClientErrorPayload({ message: 'Missing fingerprint' })).toBeNull();
    expect(normalizeClientErrorPayload({ fingerprint: 'missing-message' })).toBeNull();
    expect(normalizeClientErrorPayload('bad payload')).toBeNull();
  });

  it('rate limits repeated browser error reports per key and window', () => {
    const limiter = createClientTelemetryRateLimiter({
      maxReports: 2,
      windowMs: 1000,
    });

    expect(limiter.allow('user-1', 1000)).toBe(true);
    expect(limiter.allow('user-1', 1100)).toBe(true);
    expect(limiter.allow('user-1', 1200)).toBe(false);
    expect(limiter.allow('user-2', 1200)).toBe(true);
    expect(limiter.allow('user-1', 2100)).toBe(true);
  });
});
