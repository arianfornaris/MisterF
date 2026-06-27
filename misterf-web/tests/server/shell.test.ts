import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../../src/server/pages/shell.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('app shell formatting', () => {
  it('treats SQLite CURRENT_TIMESTAMP values as UTC for relative time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T11:21:12Z'));

    expect(formatRelativeTime('2026-06-27 11:20:12')).toBe('hace 1 minuto');
  });
});
