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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-guides-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'guides.sqlite');
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

describe('practice guide repository', () => {
  it('lists finalized reports from collecting shared sessions for the owner', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createConversationFromPracticeGuide,
      createPracticeGuide,
      createProfile,
      listCollectedPracticeGuideReportsForOwner,
      saveTutorConversationReport,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'guide-owner@example.com',
      emailVerified: true,
      fullName: 'Guide Owner',
      provider: 'google',
      providerSubject: 'guide-owner',
    });
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = createExternalUser({
      email: 'guide-student@example.com',
      emailVerified: true,
      fullName: 'Guide Student',
      provider: 'google',
      providerSubject: 'guide-student',
    });
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const guide = createPracticeGuide({
      description: 'Practice everyday conversation.',
      profileId: ownerProfile.id,
      title: 'Everyday Conversation',
      tutorInstructions: 'Guide the learner through greetings.',
      userId: owner.id,
    });

    // Collecting shared session (student) → surfaces.
    const collectingConversation = createConversationFromPracticeGuide(
      student.id,
      guide,
      studentProfile.id,
      { collectResults: true },
    );
    saveTutorConversationReport({
      conversationId: collectingConversation.id,
      profileId: studentProfile.id,
      report: reportData,
      summaryDescription: 'A good first session.',
      summaryTitle: 'Session summary',
      userId: student.id,
    });

    // Non-collecting shared session (student) → excluded.
    const privateConversation = createConversationFromPracticeGuide(
      student.id,
      guide,
      studentProfile.id,
      { collectResults: false },
    );
    saveTutorConversationReport({
      conversationId: privateConversation.id,
      profileId: studentProfile.id,
      report: reportData,
      summaryDescription: 'Private session.',
      summaryTitle: 'Private summary',
      userId: student.id,
    });

    // The owner's own session, even if flagged, is never in their own list.
    const ownerConversation = createConversationFromPracticeGuide(
      owner.id,
      guide,
      ownerProfile.id,
      { collectResults: true },
    );
    saveTutorConversationReport({
      conversationId: ownerConversation.id,
      profileId: ownerProfile.id,
      report: reportData,
      summaryDescription: 'Owner session.',
      summaryTitle: 'Owner summary',
      userId: owner.id,
    });

    const collected = listCollectedPracticeGuideReportsForOwner({
      authorProfileId: ownerProfile.id,
      practiceGuideId: guide.id,
    });

    expect(collected.map((item) => item.conversationId)).toEqual([
      collectingConversation.id,
    ]);
    expect(collected[0]?.participantProfileName).toBe('Student profile');
    expect(collected[0]?.participantName).toBe('Guide Student');
    expect(collected[0]?.summaryTitle).toBe('Session summary');
  });
});
