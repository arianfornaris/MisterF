import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const quizDraft = {
  blocks: [
    {
      id: 'open_text',
      item: {
        kind: 'quiz_open_text',
        prompt: 'Write one sentence with present perfect.',
      },
    },
    {
      id: 'multiple_choice',
      item: {
        correctOptions: ['has lived'],
        kind: 'quiz_multiple_choice',
        options: ['lived', 'has lived', 'living'],
        prompt: 'Choose the best form.',
        selectionMode: 'single',
      },
    },
  ],
  description: 'Present perfect practice.',
  instructions: 'Evaluate present perfect meaning and form.',
  level: 'B1',
  targetTopic: 'Present perfect',
  title: 'Present Perfect Check',
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-quizzes-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'quizzes.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();
});

afterEach(async () => {
  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  if (originalDatabasePath === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = originalDatabasePath;
  }

  if (originalEnvFile === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnvFile;
  }
});

describe('quiz repository', () => {
  it('stores quizzes, share links, attempts, and follow-up snapshots', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createQuiz,
      createQuizAttempt,
      createConversationFromQuizAttempt,
      createProfile,
      findQuizForUser,
      findQuizAttemptById,
      importQuizToProfile,
      getConversationQuizAttemptSnapshot,
      getOrCreateQuizShareLink,
      listQuizAttemptsForUser,
      listQuizzesForProfile,
      listLearnerProgressEvents,
      saveQuizAttemptResult,
      submitQuizAttempt,
      updateQuiz,
      updateQuizAuthoringMessages,
    } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'teacher@example.com',
      emailVerified: true,
      fullName: 'Teacher',
      provider: 'google',
      providerSubject: 'teacher-1',
    });
    const profile = createProfile({
      name: 'Class profile',
      userId: user.id,
    });
    const targetProfile = createProfile({
      name: 'Homework profile',
      userId: user.id,
    });

    const quiz = createQuiz({
      authoringMessages: [
        {
          content: 'Create a present perfect check.',
          createdAt: '2026-06-24T12:00:00.000Z',
          role: 'user',
        },
      ],
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: profile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: user.id,
    });

    expect(findQuizForUser(quiz.id, user.id)?.title).toBe(quizDraft.title);
    expect(findQuizForUser(quiz.id, user.id)?.authoringMessages).toEqual([
      {
        content: 'Create a present perfect check.',
        createdAt: '2026-06-24T12:00:00.000Z',
        role: 'user',
      },
    ]);
    expect(listQuizzesForProfile({ profileId: profile.id, userId: user.id })).toHaveLength(1);

    const updated = updateQuiz({
      quizId: quiz.id,
      description: 'Updated description.',
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      quiz: {
        ...quizDraft,
        description: 'Updated description.',
      },
      targetTopic: quizDraft.targetTopic,
      title: 'Updated quiz',
      userId: user.id,
    });
    expect(updated?.title).toBe('Updated quiz');
    expect(updated?.authoringMessages).toHaveLength(1);

    const quizWithAuthoringMessages = updateQuizAuthoringMessages({
      quizId: quiz.id,
      messages: [
        ...(updated?.authoringMessages ?? []),
        {
          content: 'Listo. Apliqué el cambio.',
          createdAt: '2026-06-24T12:05:00.000Z',
          draftSnapshot: {
            ...quizDraft,
            description: 'Updated description.',
          },
          role: 'assistant',
        },
      ],
      userId: user.id,
    });
    expect(quizWithAuthoringMessages?.authoringMessages).toHaveLength(2);
    const lastAuthoringMessage = quizWithAuthoringMessages?.authoringMessages[
      (quizWithAuthoringMessages?.authoringMessages.length ?? 1) - 1
    ];
    expect(lastAuthoringMessage).toEqual({
      content: 'Listo. Apliqué el cambio.',
      createdAt: '2026-06-24T12:05:00.000Z',
      draftSnapshot: {
        ...quizDraft,
        description: 'Updated description.',
      },
      role: 'assistant',
    });

    const shareLink = getOrCreateQuizShareLink(quiz.id);
    expect(getOrCreateQuizShareLink(quiz.id).id).toBe(shareLink.id);

    const importedQuiz = importQuizToProfile({
      shareKind: 'profile',
      sourceQuiz: quizWithAuthoringMessages ?? updated ?? quiz,
      targetProfileId: targetProfile.id,
      userId: user.id,
    });
    expect(importedQuiz.profileId).toBe(targetProfile.id);
    expect(importedQuiz.sharedVia).toBe('profile');
    expect(importedQuiz.sourceQuizId).toBe(quiz.id);
    expect(importedQuiz.sourceProfileId).toBe(profile.id);
    expect(importedQuiz.title).toBe('Updated quiz');
    expect(importedQuiz.quiz.title).toBe('Present Perfect Check');
    expect(importedQuiz.authoringMessages).toEqual([]);
    expect(importQuizToProfile({
      shareKind: 'profile',
      sourceQuiz: quizWithAuthoringMessages ?? updated ?? quiz,
      targetProfileId: targetProfile.id,
      userId: user.id,
    }).id).toBe(importedQuiz.id);
    expect(listQuizzesForProfile({
      profileId: targetProfile.id,
      userId: user.id,
    })).toHaveLength(1);

    const attempt = createQuizAttempt({
      quizId: quiz.id,
      profileId: profile.id,
      snapshot: quizDraft,
      userId: user.id,
    });
    const submitted = submitQuizAttempt({
      attemptId: attempt.id,
      responses: [
        { text: 'She has lived here for years.' },
        { selectedOptions: ['has lived'] },
      ],
    });
    expect(submitted?.status).toBe('submitted');

    const evaluated = saveQuizAttemptResult({
      attemptId: attempt.id,
      result: {
        items: [
          {
            evaluation: { feedback: 'Bien.', status: 'correct' },
            kind: 'quiz_open_text',
            prompt: 'Write one sentence with present perfect.',
            userResponse: { text: 'She has lived here for years.' },
          },
        ],
        title: quizDraft.title,
        type: 'quiz_result',
      },
    });
    expect(evaluated?.status).toBe('evaluated');
    expect(listQuizAttemptsForUser({
      quizId: quiz.id,
      profileId: profile.id,
      userId: user.id,
    })).toHaveLength(1);

    if (!evaluated) {
      throw new Error('Expected evaluated attempt.');
    }

    const { recordQuizAttemptProgress } = await import('../../src/server/services/learnerProgress.js');
    recordQuizAttemptProgress(evaluated);
    const progressEvents = listLearnerProgressEvents({
      profileId: profile.id,
      userId: user.id,
    });
    expect(progressEvents[0]).toEqual(expect.objectContaining({
      sourceId: evaluated.id,
      sourceType: 'quiz_attempt',
    }));
    expect(progressEvents[0]?.details).toMatchObject({
      resourceId: quiz.id,
      resourceType: 'quiz',
    });
    expect(findQuizAttemptById(evaluated.id)?.progressEventId).toBe(
      progressEvents[0]?.id,
    );

    const conversation = createConversationFromQuizAttempt({
      attempt: evaluated,
      profileId: profile.id,
      userId: user.id,
    });
    const snapshot = getConversationQuizAttemptSnapshot(conversation.id);
    expect(snapshot?.quizAttemptId).toBe(attempt.id);
    expect(snapshot?.quizTitle).toBe(quizDraft.title);
  });
});
