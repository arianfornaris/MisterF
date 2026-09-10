// Browser twin of `formatRelativeTime` in src/server/i18n/dates.ts. Both word
// the result from the catalog's `common.relativeTime` keys, never from
// `Intl.RelativeTimeFormat`, which has no Haitian Creole and answers in
// English. Keep the thresholds identical to the server's so a label the
// client re-renders does not change wording.
import { t } from './i18n.js';

export function bucketElapsedTime(elapsedMs) {
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

export function formatRelativeTime(date) {
  const bucket = bucketElapsedTime(Date.now() - date.getTime());
  if (!bucket) {
    return t('common.relativeTime.justNow');
  }

  const plural = bucket.count === 1 ? 'one' : 'other';
  return t(`common.relativeTime.${bucket.unit}.${plural}`, { count: bucket.count });
}
