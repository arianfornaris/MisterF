import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const quizDraft = {
  blocks: [],
  description: 'Practice gerunds and infinitives.',
  instructions: 'Evaluate verb pattern accuracy.',
  level: 'B1',
  targetTopic: 'Gerunds and infinitives',
  title: 'Verb Pattern Check',
};

const roleplayDraft = {
  characters: [
    {
      description: 'A learner practicing a restaurant interaction.',
      id: 'learner' as const,
      name: 'Learner',
    },
    {
      description: 'A restaurant server.',
      id: 'ai' as const,
      name: 'Server',
    },
  ],
  description: 'Restaurant roleplay description.',
  level: 'A2',
  maxLearnerTurns: 20,
  pedagogicalFocus: 'Practice polite requests and restaurant vocabulary.',
  scenario: 'A customer orders lunch in a small cafe.',
  title: 'Cafe Order Roleplay',
};

const roleplayEvaluationResult = {
  difficulties: ['Use complete polite request forms.'],
  entries: [
    {
      feedback: 'Good meaning, but the request can be more natural.',
      inlineReview: {
        parts: [
          {
            status: 'improve' as const,
            text: 'I want coffee',
            explanation: 'Use a polite request such as "I would like coffee."',
          },
        ],
        type: 'sentence_evaluation' as const,
      },
      scoreLabel: 'Needs polishing',
      text: 'I want coffee',
      turnNumber: 1,
    },
  ],
  overallFeedback: 'You communicated the order, but can make requests more polite.',
  recommendations: ['Practice would like for ordering.'],
  strengths: ['Clear basic restaurant vocabulary.'],
  summary: 'Practiced ordering food and making polite requests.',
  summaryTitle: 'Restaurant request practice',
  vocabulary: ['coffee', 'would like'],
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-resources-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'resources.sqlite');
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

describe('resource repository', () => {
  it('manages resource folders, membership, ordering, and generic share links', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      addResourceToFolder,
      archiveQuizForUser,
      createQuiz,
      createPracticeGuide,
      createProfile,
      createRoleplay,
      createResourceFolder,
      findResourceAccessForProfile,
      findResourceFolderForResource,
      findResourceForUser,
      getOrCreateResourceShareLink,
      grantResourceAccess,
      listAccessibleResourceFolderPath,
      listResourceFolderItems,
      listResourceFolderPath,
      listResourceFolderDescendantIds,
      listResourceFoldersForProfile,
      listResourcesForProfile,
      moveResourceFolderItem,
      removeResourceFromFolder,
    } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'resources@example.com',
      emailVerified: true,
      fullName: 'Resource Owner',
      provider: 'google',
      providerSubject: 'resources-owner',
    });
    const profile = createProfile({
      name: 'Resource profile',
      userId: user.id,
    });
    const otherProfile = createProfile({
      name: 'Other profile',
      userId: user.id,
    });
    const student = createExternalUser({
      email: 'student@example.com',
      emailVerified: true,
      fullName: 'Student',
      provider: 'google',
      providerSubject: 'student-1',
    });
    const studentProfile = createProfile({
      name: 'Student profile',
      userId: student.id,
    });

    const quiz = createQuiz({
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: profile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: user.id,
    });
    const practiceGuide = createPracticeGuide({
      description: 'Practice guide description.',
      profileId: profile.id,
      title: 'Conversation Practice Guide',
      tutorInstructions: 'Practice short answers.',
      userId: user.id,
    });
    const roleplay = createRoleplay({
      characters: [
        {
          description: 'A learner practicing a restaurant interaction and ordering lunch politely.',
          id: 'learner',
          name: 'Learner',
        },
        {
          description: 'A friendly restaurant server who helps the customer order naturally.',
          id: 'ai',
          name: 'Server',
        },
      ],
      description: 'Restaurant roleplay description.',
      level: 'A2',
      pedagogicalFocus: 'Evaluate polite requests and restaurant vocabulary.',
      profileId: profile.id,
      scenario: 'A customer orders lunch in a small cafe. The learner wants to order lunch politely.',
      title: 'Cafe Order Roleplay',
      userId: user.id,
    });
    const folder = createResourceFolder({
      description: 'Shared classroom resources.',
      profileId: profile.id,
      title: 'Week 1 Resources',
      userId: user.id,
    });
    const childFolder = createResourceFolder({
      description: 'Nested resources.',
      profileId: profile.id,
      title: 'Nested Folder',
      userId: user.id,
    });
    const grandchildFolder = createResourceFolder({
      description: 'Deeply nested resources.',
      profileId: profile.id,
      title: 'Deep Folder',
      userId: user.id,
    });
    const otherQuiz = createQuiz({
      description: 'Other profile quiz.',
      instructions: '',
      profileId: otherProfile.id,
      quiz: { blocks: [], title: 'Other Quiz' },
      title: 'Other Quiz',
      userId: user.id,
    });

    expect(findResourceForUser(quiz.id, user.id)).toEqual(expect.objectContaining({
      id: quiz.id,
      level: quizDraft.level,
      title: quizDraft.title,
      topic: quizDraft.targetTopic,
      type: 'quiz',
    }));
    expect(findResourceForUser(practiceGuide.id, user.id)).toEqual(expect.objectContaining({
      id: practiceGuide.id,
      title: practiceGuide.title,
      type: 'practice_guide',
    }));
    expect(findResourceForUser(roleplay.id, user.id)).toEqual(expect.objectContaining({
      id: roleplay.id,
      title: roleplay.title,
      topic: '',
      type: 'roleplay',
    }));
    expect(findResourceForUser(folder.id, user.id)).toEqual(expect.objectContaining({
      id: folder.id,
      title: folder.title,
      type: 'resource_folder',
    }));

    expect(listResourcesForProfile({
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.type)).toEqual(expect.arrayContaining([
      'quiz',
      'practice_guide',
      'roleplay',
      'resource_folder',
    ]));

    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: quiz.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: practiceGuide.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: roleplay.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: folder.id,
      userId: user.id,
    })).toBe(false);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: childFolder.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: childFolder.id,
      resourceId: grandchildFolder.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: grandchildFolder.id,
      resourceId: folder.id,
      userId: user.id,
    })).toBe(false);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: otherQuiz.id,
      userId: user.id,
    })).toBe(false);

    expect(findResourceFolderForResource(quiz.id, user.id)).toEqual(expect.objectContaining({
      id: folder.id,
      title: folder.title,
      type: 'resource_folder',
    }));
    expect(findResourceFolderForResource(childFolder.id, user.id)).toEqual(expect.objectContaining({
      id: folder.id,
      title: folder.title,
      type: 'resource_folder',
    }));
    expect(findResourceFolderForResource(otherQuiz.id, user.id)).toBeNull();
    expect(listResourceFolderItems(folder.id, user.id).map((item) => item.resourceId)).toEqual([
      quiz.id,
      practiceGuide.id,
      roleplay.id,
      childFolder.id,
    ]);
    expect(listResourcesForProfile({
      folderId: folder.id,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      quiz.id,
      practiceGuide.id,
      roleplay.id,
      childFolder.id,
    ]);
    expect(listResourceFolderPath(grandchildFolder.id, user.id).map((resource) => resource.id)).toEqual([
      folder.id,
      childFolder.id,
      grandchildFolder.id,
    ]);
    expect(listResourceFolderDescendantIds(folder.id, user.id)).toEqual(expect.arrayContaining([
      childFolder.id,
      grandchildFolder.id,
    ]));
    expect(listResourceFoldersForProfile({
      profileId: profile.id,
      userId: user.id,
    }).find((candidate) => candidate.id === childFolder.id)).toEqual(expect.objectContaining({
      parentFolderId: folder.id,
    }));

    expect(moveResourceFolderItem({
      direction: 'up',
      folderId: folder.id,
      resourceId: practiceGuide.id,
      userId: user.id,
    })).toBe(true);
    expect(listResourceFolderItems(folder.id, user.id).map((item) => item.resourceId)).toEqual([
      practiceGuide.id,
      quiz.id,
      roleplay.id,
      childFolder.id,
    ]);

    expect(archiveQuizForUser(quiz.id, user.id)?.archivedAt).not.toBeNull();
    expect(findResourceForUser(quiz.id, user.id)?.archivedAt).not.toBeNull();
    expect(listResourcesForProfile({
      folderId: folder.id,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      practiceGuide.id,
      roleplay.id,
      childFolder.id,
    ]);
    expect(listResourcesForProfile({
      folderId: folder.id,
      includeArchived: true,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      practiceGuide.id,
      quiz.id,
      roleplay.id,
      childFolder.id,
    ]);

    expect(removeResourceFromFolder({
      folderId: folder.id,
      resourceId: practiceGuide.id,
      userId: user.id,
    })).toBe(true);
    expect(findResourceFolderForResource(practiceGuide.id, user.id)).toBeNull();
    expect(listResourceFolderItems(folder.id, user.id).map((item) => item.resourceId)).toEqual([
      quiz.id,
      roleplay.id,
      childFolder.id,
    ]);
    expect(removeResourceFromFolder({
      folderId: folder.id,
      resourceId: childFolder.id,
      userId: user.id,
    })).toBe(true);
    expect(findResourceFolderForResource(childFolder.id, user.id)).toBeNull();
    expect(listResourceFolderPath(grandchildFolder.id, user.id).map((resource) => resource.id)).toEqual([
      childFolder.id,
      grandchildFolder.id,
    ]);

    const liveSharedQuiz = createQuiz({
      description: 'Visible through a shared folder.',
      instructions: '',
      profileId: profile.id,
      quiz: { blocks: [], title: 'Shared Folder Quiz' },
      title: 'Shared Folder Quiz',
      userId: user.id,
    });
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: liveSharedQuiz.id,
      userId: user.id,
    })).toBe(true);
    const privateParentFolder = createResourceFolder({
      description: 'Owner-only parent folder.',
      profileId: profile.id,
      title: 'Private Parent Folder',
      userId: user.id,
    });
    const sharedNestedFolder = createResourceFolder({
      description: 'Visible through a shared folder path.',
      profileId: profile.id,
      title: 'Shared Nested Folder',
      userId: user.id,
    });
    expect(addResourceToFolder({
      folderId: privateParentFolder.id,
      resourceId: folder.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: sharedNestedFolder.id,
      userId: user.id,
    })).toBe(true);

    const shareLink = getOrCreateResourceShareLink(folder.id);
    expect(getOrCreateResourceShareLink(folder.id).id).toBe(shareLink.id);
    expect(shareLink.resourceId).toBe(folder.id);

    const grant = grantResourceAccess({
      grantedByUserId: user.id,
      grantedVia: 'link',
      profileId: studentProfile.id,
      resourceId: folder.id,
      shareLinkId: shareLink.id,
      userId: student.id,
    });
    expect(grant).toEqual(expect.objectContaining({
      grantedVia: 'link',
      profileId: studentProfile.id,
      resourceId: folder.id,
      userId: student.id,
    }));
    expect(listResourcesForProfile({
      profileId: studentProfile.id,
      userId: student.id,
    })).toEqual([
      expect.objectContaining({
        accessKind: 'shared',
        id: folder.id,
      }),
    ]);
    expect(listResourcesForProfile({
      folderId: folder.id,
      profileId: studentProfile.id,
      userId: student.id,
    }).map((resource) => ({
      accessKind: resource.accessKind,
      id: resource.id,
    }))).toEqual([
      { accessKind: 'shared', id: roleplay.id },
      { accessKind: 'shared', id: liveSharedQuiz.id },
      { accessKind: 'shared', id: sharedNestedFolder.id },
    ]);
    expect(listAccessibleResourceFolderPath({
      folderId: sharedNestedFolder.id,
      profileId: studentProfile.id,
      userId: student.id,
    }).map((resource) => ({
      accessKind: resource.accessKind,
      id: resource.id,
    }))).toEqual([
      { accessKind: 'shared', id: folder.id },
      { accessKind: 'shared', id: sharedNestedFolder.id },
    ]);
    expect(findResourceAccessForProfile({
      profileId: studentProfile.id,
      resourceId: liveSharedQuiz.id,
      userId: student.id,
    })).toEqual(expect.objectContaining({
      accessKind: 'shared',
      id: liveSharedQuiz.id,
    }));
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: quiz.id,
      userId: student.id,
    })).toBe(false);
  });

  it('records evaluated roleplay attempts as learner progress events', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createRoleplay,
      createRoleplayAttempt,
      findRoleplayAttemptById,
      listLearnerProgressEvents,
      saveRoleplayAttemptResult,
    } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'roleplay-progress@example.com',
      emailVerified: true,
      fullName: 'Roleplay Learner',
      provider: 'google',
      providerSubject: 'roleplay-progress-user',
    });
    const profile = createProfile({
      name: 'Roleplay progress profile',
      userId: user.id,
    });
    const roleplay = createRoleplay({
      ...roleplayDraft,
      profileId: profile.id,
      userId: user.id,
    });
    const attempt = createRoleplayAttempt({
      profileId: profile.id,
      roleplayId: roleplay.id,
      snapshot: roleplayDraft,
      turns: [
        {
          characterId: 'ai',
          createdAt: '2026-06-29T12:00:00.000Z',
          speaker: 'ai',
          text: 'Hello, what would you like today?',
        },
        {
          characterId: 'learner',
          createdAt: '2026-06-29T12:01:00.000Z',
          speaker: 'learner',
          text: 'I want coffee',
        },
      ],
      userId: user.id,
    });
    const evaluated = saveRoleplayAttemptResult({
      attemptId: attempt.id,
      result: roleplayEvaluationResult,
    });

    if (!evaluated) {
      throw new Error('Expected evaluated roleplay attempt.');
    }

    const { recordRoleplayAttemptProgress } = await import('../../src/server/services/learnerProgress.js');
    recordRoleplayAttemptProgress(evaluated);

    const progressEvents = listLearnerProgressEvents({
      profileId: profile.id,
      userId: user.id,
    });
    expect(progressEvents[0]).toEqual(expect.objectContaining({
      sourceId: evaluated.id,
      sourceType: 'roleplay_attempt',
      title: `Roleplay: ${roleplayDraft.title}`,
    }));
    expect(progressEvents[0]?.details).toMatchObject({
      resourceId: roleplay.id,
      resourceType: 'roleplay',
    });
    expect(findRoleplayAttemptById(evaluated.id)?.progressEventId).toBe(
      progressEvents[0]?.id,
    );
  });
});
