import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const assignmentDraft = {
  blocks: [
    {
      id: 'open_text',
      item: {
        kind: 'quiz_open_text',
        prompt: 'Write one sentence with present perfect.',
        rubric: 'Accept clear present perfect usage.',
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
  estimatedMinutes: 8,
  instructions: 'Evaluate present perfect meaning and form.',
  level: 'B1',
  rubric: 'Look for meaning, form, and clarity.',
  targetTopic: 'Present perfect',
  title: 'Present Perfect Check',
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-assignments-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'assignments.sqlite');
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

describe('assignment repository', () => {
  it('stores assignments, share links, authoring revisions, attempts, and follow-up snapshots', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createAssignment,
      createAssignmentAttempt,
      createAssignmentAuthoringRevision,
      createAssignmentAuthoringSession,
      createConversationFromAssignmentAttempt,
      createProfile,
      findAssignmentForUser,
      importAssignmentToProfile,
      getConversationAssignmentAttemptSnapshot,
      getOrCreateAssignmentShareLink,
      listAssignmentAttemptsForUser,
      listAssignmentAuthoringRevisions,
      listAssignmentsForProfile,
      saveAssignmentAttemptResult,
      submitAssignmentAttempt,
      updateAssignment,
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

    const assignment = createAssignment({
      description: assignmentDraft.description,
      estimatedMinutes: assignmentDraft.estimatedMinutes,
      instructions: assignmentDraft.instructions,
      level: assignmentDraft.level,
      profileId: profile.id,
      quiz: assignmentDraft,
      rubric: assignmentDraft.rubric,
      targetTopic: assignmentDraft.targetTopic,
      title: assignmentDraft.title,
      userId: user.id,
    });

    expect(findAssignmentForUser(assignment.id, user.id)?.title).toBe(assignmentDraft.title);
    expect(listAssignmentsForProfile({ profileId: profile.id, userId: user.id })).toHaveLength(1);

    const updated = updateAssignment({
      assignmentId: assignment.id,
      description: 'Updated description.',
      estimatedMinutes: 9,
      instructions: assignmentDraft.instructions,
      level: assignmentDraft.level,
      quiz: {
        ...assignmentDraft,
        description: 'Updated description.',
        estimatedMinutes: 9,
      },
      rubric: assignmentDraft.rubric,
      targetTopic: assignmentDraft.targetTopic,
      title: 'Updated assignment',
      userId: user.id,
    });
    expect(updated?.title).toBe('Updated assignment');

    const shareLink = getOrCreateAssignmentShareLink(assignment.id);
    expect(getOrCreateAssignmentShareLink(assignment.id).id).toBe(shareLink.id);

    const importedAssignment = importAssignmentToProfile({
      shareKind: 'profile',
      sourceAssignment: updated ?? assignment,
      targetProfileId: targetProfile.id,
      userId: user.id,
    });
    expect(importedAssignment.profileId).toBe(targetProfile.id);
    expect(importedAssignment.sharedVia).toBe('profile');
    expect(importedAssignment.sourceAssignmentId).toBe(assignment.id);
    expect(importedAssignment.sourceProfileId).toBe(profile.id);
    expect(importedAssignment.title).toBe('Updated assignment');
    expect(importedAssignment.quiz.title).toBe('Present Perfect Check');
    expect(importAssignmentToProfile({
      shareKind: 'profile',
      sourceAssignment: updated ?? assignment,
      targetProfileId: targetProfile.id,
      userId: user.id,
    }).id).toBe(importedAssignment.id);
    expect(listAssignmentsForProfile({
      profileId: targetProfile.id,
      userId: user.id,
    })).toHaveLength(1);

    const session = createAssignmentAuthoringSession({
      currentDraft: assignmentDraft,
      initialPrompt: 'Build a present perfect task.',
      profileId: profile.id,
      userId: user.id,
    });
    createAssignmentAuthoringRevision({
      draft: assignmentDraft,
      sessionId: session.id,
      source: 'assistant',
      userMessage: 'Build a present perfect task.',
    });
    expect(listAssignmentAuthoringRevisions(session.id)).toHaveLength(1);

    const previewAttempt = createAssignmentAttempt({
      authoringSessionId: session.id,
      isPreview: true,
      profileId: profile.id,
      snapshot: assignmentDraft,
      userId: user.id,
    });
    expect(previewAttempt.assignmentId).toBeNull();
    expect(previewAttempt.authoringSessionId).toBe(session.id);
    expect(previewAttempt.isPreview).toBe(true);

    const attempt = createAssignmentAttempt({
      assignmentId: assignment.id,
      profileId: profile.id,
      snapshot: assignmentDraft,
      userId: user.id,
    });
    const submitted = submitAssignmentAttempt({
      attemptId: attempt.id,
      responses: [
        { text: 'She has lived here for years.' },
        { selectedOptions: ['has lived'] },
      ],
    });
    expect(submitted?.status).toBe('submitted');

    const evaluated = saveAssignmentAttemptResult({
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
        title: assignmentDraft.title,
        type: 'quiz_result',
      },
    });
    expect(evaluated?.status).toBe('evaluated');
    expect(listAssignmentAttemptsForUser({
      assignmentId: assignment.id,
      profileId: profile.id,
      userId: user.id,
    })).toHaveLength(1);

    if (!evaluated) {
      throw new Error('Expected evaluated attempt.');
    }

    const conversation = createConversationFromAssignmentAttempt({
      attempt: evaluated,
      profileId: profile.id,
      userId: user.id,
    });
    const snapshot = getConversationAssignmentAttemptSnapshot(conversation.id);
    expect(snapshot?.assignmentAttemptId).toBe(attempt.id);
    expect(snapshot?.assignmentTitle).toBe(assignmentDraft.title);
  });
});
