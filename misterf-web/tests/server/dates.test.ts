import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bucketElapsedTime,
  compareText,
  formatDateTime,
  formatRelativeTime,
} from '../../src/server/i18n/dates.js';
// @ts-expect-error No TypeScript declaration is generated for client modules.
import { bucketElapsedTime as clientBucketElapsedTime } from '../../src/client/shared/relativeTime.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('relative time', () => {
  it('treats SQLite CURRENT_TIMESTAMP values as UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T11:21:12Z'));

    expect(formatRelativeTime('2026-06-27 11:20:12', 'es')).toBe('hace 1 minuto');
  });

  it('words the same elapsed time in each instruction language', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));

    // Roadmap V3 §2.8: this read "hace 3 meses" for every profile.
    expect(formatRelativeTime('2026-06-12 12:00:00', 'es')).toBe('hace 3 meses');
    expect(formatRelativeTime('2026-06-12 12:00:00', 'en')).toBe('3 months ago');
    // Intl has no Haitian Creole and would answer in English here.
    expect(formatRelativeTime('2026-06-12 12:00:00', 'ht')).toBe('sa gen 3 mwa');
  });

  it('uses the singular for a count of one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));

    expect(formatRelativeTime('2026-09-09 12:00:00', 'en')).toBe('1 day ago');
    expect(formatRelativeTime('2026-09-08 12:00:00', 'en')).toBe('2 days ago');
  });

  it('reads under a minute, and clock skew into the future, as just now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));

    expect(formatRelativeTime('2026-09-10 11:59:30', 'en')).toBe('just now');
    expect(formatRelativeTime('2026-09-10 12:05:00', 'es')).toBe('hace un momento');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatRelativeTime('not a date', 'en')).toBe('not a date');
  });

  it('buckets elapsed time exactly as the browser twin does', () => {
    const minute = 60_000;
    for (const elapsed of [
      0, 59_000, 90_000, 59 * minute, 61 * minute, 23 * 60 * minute,
      25 * 60 * minute, 6 * 1440 * minute, 13 * 1440 * minute,
      40 * 1440 * minute, 200 * 1440 * minute, 800 * 1440 * minute,
    ]) {
      expect(clientBucketElapsedTime(elapsed)).toEqual(bucketElapsedTime(elapsed));
    }
  });
});

describe('absolute date and time', () => {
  const date = new Date(2026, 6, 23, 12, 34);

  it('words Haitian Creole dates from the registry, not from Intl', () => {
    expect(formatDateTime(date, 'ht')).toBe('23 jiyè 2026, 12:34');
  });

  it('uses Intl for languages it has data for', () => {
    expect(formatDateTime(date, 'en')).toContain('Jul');
    expect(formatDateTime(date, 'es')).toContain('jul');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatDateTime('not a date', 'ht')).toBe('not a date');
  });
});

describe('text comparison', () => {
  it('ignores case and accents in every language', () => {
    for (const locale of ['es', 'en', 'ht'] as const) {
      expect(compareText('Árbol', 'arbol', locale)).toBe(0);
    }
  });
});
