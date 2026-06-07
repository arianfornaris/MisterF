import type { Request, Response } from 'express';
import {
  findLearnerProgressProfile,
  listLearnerProgressEvents,
  type StoredLearnerProgressEvent,
} from '../db/repository.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';

function ensureVerifiedProgressUser(
  request: Request,
  response: Response,
): NonNullable<Request['authUser']> | null {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return null;
  }

  return user;
}

export function renderProgressPage(request: Request, response: Response): void {
  const user = ensureVerifiedProgressUser(request, response);
  if (!user) {
    return;
  }

  if (!request.activeProfile) {
    response.redirect('/profiles');
    return;
  }

  const progressProfile = findLearnerProgressProfile(
    user.id,
    request.activeProfile.id,
  );
  const events = listLearnerProgressEvents({
    limit: 50,
    profileId: request.activeProfile.id,
    userId: user.id,
  });
  const vocabularyItems = buildVocabularyItems(events);

  response.render('progress', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'progress',
      guestInitialGreeting: '',
      request,
      title: `Progreso · ${appDocumentTitle}`,
      user,
    }),
    events,
    progressProfile,
    selectedProgressTab: normalizeProgressTab(request.query.tab),
    vocabularyItems,
  });
}

function normalizeProgressTab(value: unknown): 'events' | 'general' | 'vocabulary' {
  return value === 'events' || value === 'vocabulary' ? value : 'general';
}

function buildVocabularyItems(events: StoredLearnerProgressEvent[]) {
  const items = new Map<
    string,
    {
      count: number;
      lastSeenAt: string;
      sourceLabels: string[];
      sourceTitles: string[];
      term: string;
    }
  >();

  for (const event of events) {
    for (const rawTerm of event.details.vocabulary) {
      const term = rawTerm.replace(/\s+/g, ' ').trim();
      if (!term) {
        continue;
      }

      const key = term.toLowerCase();
      const existing = items.get(key);
      const sourceLabel =
        event.sourceType === 'chat_room_conversation_report'
          ? 'Sala de chat'
          : 'Tutor';

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

function pushUnique(items: string[], value: string, limit: number): void {
  if (!items.includes(value)) {
    items.push(value);
  }

  if (items.length > limit) {
    items.length = limit;
  }
}
