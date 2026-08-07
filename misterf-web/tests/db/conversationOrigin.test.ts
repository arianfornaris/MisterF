import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const reportData = {
  difficultyAreas: [{ description: 'Past tense endings', title: 'Past tense' }],
  nextSteps: ['Practice irregular verbs'],
  practicedTopics: ['Introductions'],
  progressHighlights: ['Used greetings naturally'],
  recommendations: ['Review vocabulary daily'],
  usefulPhrases: ['Nice to meet you'],
  vocabulary: [{ example: 'I work as a nurse.', meaning: 'a job', term: 'occupation' }],
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-origin-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'origin.sqlite');
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

async function createLearner(seed: string) {
  const { createExternalUser } = await import('../../src/server/auth/repository.js');
  const { createProfile } = await import('../../src/server/db/repository.js');

  const user = createExternalUser({
    email: `${seed}@example.com`,
    emailVerified: true,
    fullName: `Learner ${seed}`,
    provider: 'google',
    providerSubject: seed,
  });

  return { profile: createProfile({ name: `${seed} profile`, userId: user.id }), user };
}

describe('conversation origin', () => {
  it('names the practice guide a session was started from', async () => {
    const {
      createConversationFromPracticeGuide,
      createPracticeGuide,
    } = await import('../../src/server/db/repository.js');
    const { resolveConversationOrigin } = await import(
      '../../src/server/services/conversationOrigin.js'
    );

    const { profile, user } = await createLearner('guide-owner');
    const guide = createPracticeGuide({
      description: 'Practice everyday conversation.',
      profileId: profile.id,
      title: 'Everyday Conversation',
      tutorInstructions: 'Guide the learner through greetings.',
      userId: user.id,
    });
    const conversation = createConversationFromPracticeGuide(user.id, guide, profile.id);

    expect(resolveConversationOrigin(conversation)).toEqual({
      kind: 'practice_guide',
      path: `/practice-guides/${guide.id}`,
      resultPath: null,
      title: 'Everyday Conversation',
      via: null,
    });
  });

  it('names the quiz and the result a follow-up practice came from', async () => {
    const {
      createConversationFromQuizAttempt,
      createQuiz,
      createQuizAttempt,
    } = await import('../../src/server/db/repository.js');
    const { resolveConversationOrigin } = await import(
      '../../src/server/services/conversationOrigin.js'
    );

    const { profile, user } = await createLearner('quiz-owner');
    const quiz = createQuiz({
      profileId: profile.id,
      quiz: { blocks: [], title: 'Past Simple At Work' },
      title: 'Past Simple At Work',
      userId: user.id,
    });
    const attempt = createQuizAttempt({
      profileId: profile.id,
      quizId: quiz.id,
      snapshot: { title: 'Past Simple At Work' },
      userId: user.id,
    });
    const conversation = createConversationFromQuizAttempt({
      attempt,
      profileId: profile.id,
      userId: user.id,
    });

    expect(resolveConversationOrigin(conversation)).toEqual({
      kind: 'quiz',
      path: `/quizzes/${quiz.id}`,
      resultPath: `/quiz-attempts/${attempt.id}/result`,
      title: 'Past Simple At Work',
      via: null,
    });
  });

  it('carries the resource a practiced summary itself came from', async () => {
    const {
      createConversationFromPracticeGuide,
      createConversationFromTutorReport,
      createPracticeGuide,
      saveTutorConversationReport,
    } = await import('../../src/server/db/repository.js');
    const { resolveConversationOrigin } = await import(
      '../../src/server/services/conversationOrigin.js'
    );

    const { profile, user } = await createLearner('summary-owner');
    const guide = createPracticeGuide({
      description: 'Practice everyday conversation.',
      profileId: profile.id,
      title: 'Everyday Conversation',
      tutorInstructions: 'Guide the learner through greetings.',
      userId: user.id,
    });
    const guideConversation = createConversationFromPracticeGuide(user.id, guide, profile.id);
    const report = saveTutorConversationReport({
      conversationId: guideConversation.id,
      profileId: profile.id,
      report: reportData,
      summaryDescription: 'A good first session.',
      summaryTitle: 'Session summary',
      userId: user.id,
    });

    const followUp = createConversationFromTutorReport({
      profileId: profile.id,
      report,
      userId: user.id,
    });

    expect(resolveConversationOrigin(followUp)).toEqual({
      kind: 'summary',
      path: `/c/${guideConversation.id}?tab=summary`,
      resultPath: null,
      title: 'Session summary',
      via: {
        kind: 'practice_guide',
        path: `/practice-guides/${guide.id}`,
        title: 'Everyday Conversation',
      },
    });
  });

  it('keeps naming an archived resource but stops linking to it', async () => {
    const {
      archivePracticeGuideForUser,
      createConversationFromPracticeGuide,
      createPracticeGuide,
    } = await import('../../src/server/db/repository.js');
    const { resolveConversationOrigin } = await import(
      '../../src/server/services/conversationOrigin.js'
    );

    const { profile, user } = await createLearner('archived-owner');
    const guide = createPracticeGuide({
      description: 'Practice everyday conversation.',
      profileId: profile.id,
      title: 'Everyday Conversation',
      tutorInstructions: 'Guide the learner through greetings.',
      userId: user.id,
    });
    const conversation = createConversationFromPracticeGuide(user.id, guide, profile.id);
    archivePracticeGuideForUser(guide.id, user.id);

    const origin = resolveConversationOrigin(conversation);
    expect(origin?.title).toBe('Everyday Conversation');
    expect(origin?.path).toBeNull();
  });

  it('has no origin for a conversation that was not derived from anything', async () => {
    const { createConversation } = await import('../../src/server/db/repository.js');
    const { resolveConversationOrigin } = await import(
      '../../src/server/services/conversationOrigin.js'
    );

    const { profile, user } = await createLearner('plain-chat');
    const conversation = createConversation(user.id, profile.id);

    expect(resolveConversationOrigin(conversation)).toBeNull();
  });
});
