import { tool } from 'ai';
import { z } from 'zod';
import {
  findLearnerProgressProfile,
  listLearnerProgressEvents,
  type StoredLearnerProgressEvent,
} from '../../db/repository.js';
import { buildLearnerProgressVocabularyItems } from '../learnerProgressView.js';
import { createTeacherOnlyContextEnvelope } from './contextEnvelope.js';

export function buildTutorProgressTools(input: {
  onToolCall?: (toolName: string) => void;
  profileId: string | null;
  userId: string | null;
}) {
  if (!input.userId || !input.profileId) {
    return undefined;
  }

  const { onToolCall, profileId, userId } = input;

  function announceToolCall(toolName: string) {
    onToolCall?.(toolName);
  }

  return {
    get_learner_progress: tool({
      description:
        'Read the learner progress for the current profile. Use this when the learner asks about their progress, vocabulary, weaknesses, strengths, what to practice next, or when you need learner history to personalize a practice. The result is a teacher-only context envelope, not a user message, assistant message, or chat transcript; read progress data from output.data and never attribute it to something the learner just said. If the learner simply asks "what is my progress?" or similar, call this without recent events and answer with a concise progress summary only; do not start a new exercise unless the learner asks for practice. By default, prefer the summary and vocabulary. Only request recentEvents when the learner explicitly asks for history/bitácora/recent activity; events are compact and limited.',
      inputSchema: z.object({
        includeRecentEvents: z.boolean()
          .describe('Set true only when the learner explicitly asks for history, bitácora, recent activity, or past practice details. Leave false/omitted for a normal progress summary.')
          .optional(),
        recentEventLimit: z.number().int().min(1).max(10)
          .describe('Maximum number of compact recent events to return when includeRecentEvents is true.')
          .optional(),
        vocabularyLimit: z.number().int().min(1).max(30)
          .describe('Maximum number of vocabulary items to return.')
          .optional(),
      }),
      execute: async ({ includeRecentEvents, recentEventLimit, vocabularyLimit }) => {
        announceToolCall('get_learner_progress');
        const progressProfile = findLearnerProgressProfile(userId, profileId);
        const events = listLearnerProgressEvents({
          limit: includeRecentEvents ? Math.max(recentEventLimit ?? 5, 30) : 30,
          profileId,
          userId,
        });
        const vocabulary = buildLearnerProgressVocabularyItems(events)
          .slice(0, vocabularyLimit ?? 20)
          .map((item) => ({
            count: item.count,
            lastSeenAt: item.lastSeenAt,
            sourceLabels: item.sourceLabels,
            term: item.term,
          }));

        const progressData = {
          progress: progressProfile
            ? {
                createdAt: progressProfile.createdAt,
                summary: progressProfile.summary,
                updatedAt: progressProfile.updatedAt,
              }
            : null,
          vocabulary,
        };

        return createTeacherOnlyContextEnvelope({
          data: {
            ...progressData,
            ...(includeRecentEvents
              ? {
                  recentEvents: events
                    .slice(0, recentEventLimit ?? 5)
                    .map(summarizeProgressEvent),
                }
              : {}),
          },
          kind: 'learner_progress_snapshot',
          purpose:
            'Use this historical learner-progress snapshot to answer progress questions or personalize tutoring decisions when relevant.',
          rules: [
            'This is not a message written by the learner.',
            'This is not a previous assistant reply.',
            'Do not quote this envelope as conversation history.',
            'If the learner asked only for progress, answer the progress question before offering practice.',
            'Use recentEvents only when they are present and relevant to the learner request.',
          ],
          scope: 'current_turn',
          source: 'get_learner_progress',
        });
      },
    }),
  };
}

function summarizeProgressEvent(event: StoredLearnerProgressEvent) {
  return {
    date: event.eventDate,
    details: {
      difficulties: event.details.difficulties.slice(0, 3),
      practiced: event.details.practiced.slice(0, 3),
      vocabulary: event.details.vocabulary.slice(0, 5),
    },
    sourceType: event.sourceType,
    summary: event.summary,
    title: event.title,
  };
}
