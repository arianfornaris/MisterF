import {
  listLearnerProgressEvents,
  type StoredChatRoom,
  type StoredChatRoomConversationReport,
  type StoredLearnerProgressEventDetails,
  type StoredLearnerProgressSummary,
  type StoredTutorConversationReport,
  upsertLearnerProgressEvent,
  upsertLearnerProgressProfile,
} from '../db/repository.js';

const maxTimelineSummaryLength = 280;

export function recordChatRoomConversationReportProgress(input: {
  report: StoredChatRoomConversationReport;
  room: StoredChatRoom;
}): void {
  upsertLearnerProgressEvent({
    details: buildChatRoomReportEventDetails(input),
    eventDate: input.report.createdAt,
    profileId: input.report.profileId,
    sourceId: input.report.id,
    sourceType: 'chat_room_conversation_report',
    summary: compactText(input.report.summaryDescription, maxTimelineSummaryLength),
    title: compactText(input.report.summaryTitle, 120),
    userId: input.report.userId,
  });

  refreshLearnerProgressSummary({
    profileId: input.report.profileId,
    userId: input.report.userId,
  });
}

export function recordTutorConversationReportProgress(
  report: StoredTutorConversationReport,
): void {
  upsertLearnerProgressEvent({
    details: buildTutorReportEventDetails(report),
    eventDate: report.createdAt,
    profileId: report.profileId,
    sourceId: report.id,
    sourceType: 'tutor_conversation_report',
    summary: compactText(report.summaryDescription, maxTimelineSummaryLength),
    title: compactText(report.summaryTitle, 120),
    userId: report.userId,
  });

  refreshLearnerProgressSummary({
    profileId: report.profileId,
    userId: report.userId,
  });
}

export function refreshLearnerProgressSummary(input: {
  profileId: string;
  userId: string;
}): StoredLearnerProgressSummary {
  const events = listLearnerProgressEvents({
    limit: 30,
    profileId: input.profileId,
    userId: input.userId,
  });

  const latest = events[0] ?? null;
  const strengths = uniqueLimited(
    events.flatMap((event) => event.details.progress),
    8,
  );
  const focusAreas = uniqueLimited(
    events.flatMap((event) => [
      ...event.details.difficulties,
      ...event.details.recommendations,
    ]),
    10,
  );
  const vocabulary = uniqueLimited(
    events.flatMap((event) => event.details.vocabulary),
    24,
  );
  const recommendedPractice = uniqueLimited(
    events.flatMap((event) => [
      ...event.details.practiced.map((item) => `Seguir practicando: ${item}`),
      ...event.details.recommendations,
    ]),
    10,
  );

  const summary: StoredLearnerProgressSummary = {
    focusAreas,
    overview: buildOverview({
      eventCount: events.length,
      latestSummary: latest?.summary ?? '',
      latestTitle: latest?.title ?? '',
    }),
    recommendedPractice,
    strengths,
    updatedFromEvents: events.length,
    vocabulary,
  };

  upsertLearnerProgressProfile({
    profileId: input.profileId,
    summary,
    userId: input.userId,
  });

  return summary;
}

function buildTutorReportEventDetails(
  report: StoredTutorConversationReport,
): StoredLearnerProgressEventDetails {
  return {
    difficulties: report.report.difficultyAreas
      .map((area) => area.title || area.description)
      .filter(Boolean)
      .map((item) => compactText(item, 120))
      .slice(0, 4),
    practiced: report.report.practicedTopics
      .map((item) => compactText(item, 120))
      .slice(0, 5),
    progress: report.report.progressHighlights
      .map((item) => compactText(item, 140))
      .slice(0, 4),
    recommendations: [...report.report.recommendations, ...report.report.nextSteps]
      .map((item) => compactText(item, 140))
      .slice(0, 5),
    vocabulary: report.report.vocabulary
      .map((item) => item.term)
      .filter(Boolean)
      .map((item) => compactText(item, 80))
      .slice(0, 12),
  };
}

function buildChatRoomReportEventDetails(input: {
  report: StoredChatRoomConversationReport;
  room: StoredChatRoom;
}): StoredLearnerProgressEventDetails {
  const slideTitles = input.report.slides
    .map((slide) => slide.title)
    .filter(Boolean)
    .map((item) => compactText(item, 120));
  const improvementNotes = input.report.slides
    .flatMap((slide) => [
      slide.evaluationDescription,
      ...slide.messageEvaluation.parts
        .filter((part) => part.status !== 'correct')
        .map((part) => part.explanation || part.text),
    ])
    .filter(Boolean)
    .map((item) => compactText(item, 140));

  return {
    difficulties: uniqueLimited(improvementNotes, 4),
    practiced: uniqueLimited([input.room.title, ...slideTitles], 5),
    progress: uniqueLimited([
      input.report.summaryTitle,
      input.report.summaryDescription,
    ], 3),
    recommendations: uniqueLimited(improvementNotes, 5),
    vocabulary: uniqueLimited(
      input.report.slides.flatMap((slide) =>
        slide.messageEvaluation.parts
          .filter((part) => part.status !== 'correct')
          .map((part) => part.text),
      ),
      12,
    ).map((item) => compactText(item, 80)),
  };
}

function buildOverview(input: {
  eventCount: number;
  latestSummary: string;
  latestTitle: string;
}): string {
  if (input.eventCount === 0) {
    return 'Todavía no hay suficiente actividad cerrada para construir un progreso global.';
  }

  const prefix =
    input.eventCount === 1
      ? 'Progreso basado en 1 práctica cerrada.'
      : `Progreso basado en ${input.eventCount} prácticas recientes.`;
  const latest = input.latestSummary || input.latestTitle;

  return latest
    ? `${prefix} Última señal importante: ${compactText(latest, 220)}`
    : prefix;
}

function uniqueLimited(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.replace(/\s+/g, ' ').trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
