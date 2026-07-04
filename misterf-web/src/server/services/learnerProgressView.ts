import type { StoredLearnerProgressEvent } from '../db/repository.js';
import { translate, type Locale } from '../i18n/index.js';

export type LearnerProgressVocabularyItem = {
  count: number;
  lastSeenAt: string;
  sourceLabels: string[];
  sourceTitles: string[];
  term: string;
};

export type LearnerProgressEventView = StoredLearnerProgressEvent & {
  sourceLabel: string;
};

export function buildLearnerProgressEventViews(
  events: StoredLearnerProgressEvent[],
  locale: Locale,
): LearnerProgressEventView[] {
  return events.map((event) => ({
    ...event,
    sourceLabel: getProgressEventSourceLabel(event, locale),
  }));
}

export function buildLearnerProgressVocabularyItems(
  events: StoredLearnerProgressEvent[],
  locale: Locale,
): LearnerProgressVocabularyItem[] {
  const items = new Map<string, LearnerProgressVocabularyItem>();

  for (const event of events) {
    for (const rawTerm of event.details.vocabulary) {
      const term = rawTerm.replace(/\s+/g, ' ').trim();
      if (!term) {
        continue;
      }

      const key = term.toLowerCase();
      const existing = items.get(key);
      const sourceLabel = getProgressEventSourceLabel(event, locale);

      if (existing) {
        existing.count += 1;
        if (Date.parse(event.eventDate) > Date.parse(existing.lastSeenAt)) {
          existing.lastSeenAt = event.eventDate;
        }
        pushUnique(existing.sourceLabels, sourceLabel, 3);
        pushUnique(existing.sourceTitles, event.title, 3);
        continue;
      }

      items.set(key, {
        count: 1,
        lastSeenAt: event.eventDate,
        sourceLabels: [sourceLabel],
        sourceTitles: [event.title],
        term,
      });
    }
  }

  return Array.from(items.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
  });
}

export function getProgressEventSourceLabel(
  event: StoredLearnerProgressEvent,
  locale: Locale,
): string {
  if (event.details.resourceType === 'quiz') {
    return 'Quiz';
  }

  if (event.details.resourceType === 'practice_guide') {
    return translate(locale, 'resources.typePracticeGuide');
  }

  if (event.details.resourceType === 'roleplay') {
    return 'Roleplay';
  }

  if (event.sourceType === 'quiz_attempt') {
    return 'Quiz';
  }

  if (event.sourceType === 'roleplay_attempt') {
    return 'Roleplay';
  }

  if (event.sourceType === 'tutor_conversation_report') {
    return translate(locale, 'progress.logKicker');
  }

  return translate(locale, 'progress.sourcePractice');
}

function pushUnique(items: string[], value: string, limit: number): void {
  if (!items.includes(value)) {
    items.push(value);
  }

  if (items.length > limit) {
    items.length = limit;
  }
}
