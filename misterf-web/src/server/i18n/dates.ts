import { languages, translate, type Locale } from './index.js';

/**
 * Every date a user reads goes through this module, so no caller picks a
 * locale on its own. Until 2026-09-10 the relative-time helper was a
 * module-level `Intl.RelativeTimeFormat('es')`, and every "updated … ago" label
 * in the app read "hace 3 meses" whatever the profile's language
 * (Roadmap V3 §2.8).
 */

/**
 * Parses a stored timestamp. SQLite `CURRENT_TIMESTAMP` values carry no zone
 * but are UTC, so they are read as UTC rather than as server-local time.
 */
export function parseAppTimestamp(value: string): number {
  const trimmed = value.trim();
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
  ) {
    return Date.parse(`${trimmed.replace(' ', 'T')}Z`);
  }

  return Date.parse(trimmed);
}

type RelativeTimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * Buckets an elapsed time into the unit a person would say. The browser twin,
 * `src/client/shared/relativeTime.js`, must keep the same thresholds so a
 * label does not change wording when the client re-renders it.
 */
export function bucketElapsedTime(
  elapsedMs: number,
): { unit: RelativeTimeUnit; count: number } | null {
  const seconds = Math.round(Math.max(0, elapsedMs) / 1000);
  if (seconds < 60) {
    return null;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return { unit: 'minute', count: minutes };
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return { unit: 'hour', count: hours };
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return { unit: 'day', count: days };
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return { unit: 'week', count: weeks };
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return { unit: 'month', count: months };
  }

  return { unit: 'year', count: Math.round(days / 365) };
}

/**
 * "3 months ago" in the given language. Worded from the catalog, not from
 * `Intl.RelativeTimeFormat`, because `Intl` has no Haitian Creole and would
 * answer in English. Timestamps in the future read as "just now".
 */
export function formatRelativeTime(value: string, locale: Locale): string {
  const timestamp = parseAppTimestamp(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const bucket = bucketElapsedTime(Date.now() - timestamp);
  if (!bucket) {
    return translate(locale, 'common.relativeTime.justNow');
  }

  const plural = bucket.count === 1 ? 'one' : 'other';
  return translate(locale, `common.relativeTime.${bucket.unit}.${plural}`, {
    count: bucket.count,
  });
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(intlLocale: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(intlLocale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    dateTimeFormatters.set(intlLocale, formatter);
  }
  return formatter;
}

/**
 * A date with its time, e.g. "9 sept 2026, 12:34". Unparseable input comes
 * back unchanged, as the views did before this helper existed.
 */
export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const dates = languages[locale].dates;
  if (dates.intlLocale) {
    return getDateTimeFormatter(dates.intlLocale).format(date);
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${dates.monthNames[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`;
}

/** Case- and accent-insensitive comparison for sorting titles. */
export function compareText(left: string, right: string, locale: Locale): number {
  return left.localeCompare(right, languages[locale].dates.intlLocale ?? undefined, {
    sensitivity: 'base',
  });
}
