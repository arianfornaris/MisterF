import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const quizDraft = {
  blocks: [
    {
      id: 'block_1',
      kind: 'multiple_choice',
      options: ['a', 'b'],
      prompt: 'Pick one',
    },
  ],
  title: 'Past simple',
  type: 'quiz',
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-home-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'home.sqlite');
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

async function createAccount(seed: string) {
  const { createExternalUser } = await import('../../src/server/auth/repository.js');

  return createExternalUser({
    email: `${seed}@example.com`,
    emailVerified: true,
    fullName: `Account ${seed}`,
    provider: 'google',
    providerSubject: seed,
  });
}

describe('profile home mode', () => {
  it('defaults to learning and is updated on its own', async () => {
    const { createProfile, findProfileForUser, updateProfileHomeMode } = await import(
      '../../src/server/db/repository.js'
    );

    const user = await createAccount('mode');
    const profile = createProfile({ name: 'Mode profile', userId: user.id });
    expect(profile.homeMode).toBe('learn');

    const updated = updateProfileHomeMode({
      homeMode: 'teach',
      profileId: profile.id,
      userId: user.id,
    });
    expect(updated?.homeMode).toBe('teach');
    // The description and name are untouched: the switch writes one column.
    expect(updated?.name).toBe('Mode profile');
    expect(findProfileForUser(profile.id, user.id)?.homeMode).toBe('teach');
  });

  it('never changes a profile that belongs to another account', async () => {
    const { createProfile, findProfileForUser, updateProfileHomeMode } = await import(
      '../../src/server/db/repository.js'
    );

    const owner = await createAccount('owner-mode');
    const stranger = await createAccount('stranger-mode');
    const profile = createProfile({ name: 'Owned profile', userId: owner.id });

    expect(
      updateProfileHomeMode({
        homeMode: 'teach',
        profileId: profile.id,
        userId: stranger.id,
      }),
    ).toBeNull();
    expect(findProfileForUser(profile.id, owner.id)?.homeMode).toBe('learn');
  });
});

describe('teaching home participation', () => {
  it('counts collected participations per shared resource and separates recent ones', async () => {
    const {
      createProfile,
      createQuiz,
      createQuizAttempt,
      getOrCreateResourceShareLink,
      listSharedResourceParticipationForProfile,
    } = await import('../../src/server/db/repository.js');

    const owner = await createAccount('teach-owner');
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = await createAccount('teach-student');
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const sharedQuiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Shared quiz',
      userId: owner.id,
    });
    const unsharedQuiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Unshared quiz',
      userId: owner.id,
    });
    getOrCreateResourceShareLink(sharedQuiz.id);

    createQuizAttempt({
      collectResults: true,
      profileId: studentProfile.id,
      quizId: sharedQuiz.id,
      snapshot: quizDraft,
      userId: student.id,
    });
    // Not collected, so it never reaches the owner.
    createQuizAttempt({
      profileId: studentProfile.id,
      quizId: sharedQuiz.id,
      snapshot: quizDraft,
      userId: student.id,
    });
    // The owner's own `Probar` run is excluded by author profile.
    createQuizAttempt({
      collectResults: true,
      profileId: ownerProfile.id,
      quizId: sharedQuiz.id,
      snapshot: quizDraft,
      userId: owner.id,
    });

    const activities = listSharedResourceParticipationForProfile({
      profileId: ownerProfile.id,
      recencyWindowStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      userId: owner.id,
    });

    expect(activities.map((activity) => activity.id)).toEqual([sharedQuiz.id]);
    expect(activities.map((activity) => activity.id)).not.toContain(unsharedQuiz.id);
    expect(activities[0].participantCount).toBe(1);
    expect(activities[0].recentParticipantCount).toBe(1);
    expect(activities[0].lastParticipationAt).not.toBeNull();
  });

  it('lists a shared resource with no participation and an empty recency window', async () => {
    const {
      createProfile,
      createQuiz,
      createQuizAttempt,
      getOrCreateResourceShareLink,
      listSharedResourceParticipationForProfile,
    } = await import('../../src/server/db/repository.js');

    const owner = await createAccount('teach-quiet');
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = await createAccount('teach-quiet-student');
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Quiet quiz',
      userId: owner.id,
    });
    getOrCreateResourceShareLink(quiz.id);
    createQuizAttempt({
      collectResults: true,
      profileId: studentProfile.id,
      quizId: quiz.id,
      snapshot: quizDraft,
      userId: student.id,
    });

    // A window that starts in the future counts nothing as recent, while the
    // resource still reports its lifetime participation.
    const activities = listSharedResourceParticipationForProfile({
      profileId: ownerProfile.id,
      recencyWindowStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      userId: owner.id,
    });

    expect(activities).toHaveLength(1);
    expect(activities[0].participantCount).toBe(1);
    expect(activities[0].recentParticipantCount).toBe(0);
  });
});

describe('learning home shared activities', () => {
  it('lists activities granted to the profile and marks the ones not started', async () => {
    const {
      createProfile,
      createQuiz,
      createQuizAttempt,
      grantResourceAccess,
      listResourcesSharedWithProfile,
    } = await import('../../src/server/db/repository.js');

    const owner = await createAccount('learn-owner');
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = await createAccount('learn-student');
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const startedQuiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Started quiz',
      userId: owner.id,
    });
    const pendingQuiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Pending quiz',
      userId: owner.id,
    });
    const ungrantedQuiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Ungranted quiz',
      userId: owner.id,
    });

    for (const quiz of [startedQuiz, pendingQuiz]) {
      grantResourceAccess({
        grantedByUserId: owner.id,
        grantedVia: 'link',
        profileId: studentProfile.id,
        resourceId: quiz.id,
        userId: student.id,
      });
    }

    createQuizAttempt({
      profileId: studentProfile.id,
      quizId: startedQuiz.id,
      snapshot: quizDraft,
      userId: student.id,
    });

    const shared = listResourcesSharedWithProfile({
      profileId: studentProfile.id,
      userId: student.id,
    });

    expect(shared.map((item) => item.id)).not.toContain(ungrantedQuiz.id);
    // Not-yet-started activities come first, which is the order the panel shows.
    expect(shared.map((item) => item.id)).toEqual([pendingQuiz.id, startedQuiz.id]);
    expect(shared.map((item) => item.hasStarted)).toEqual([false, true]);
  });

  it('drops an activity the owner archived', async () => {
    const {
      archiveResourceForUser,
      createProfile,
      createQuiz,
      grantResourceAccess,
      listResourcesSharedWithProfile,
    } = await import('../../src/server/db/repository.js');

    const owner = await createAccount('archive-owner');
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = await createAccount('archive-student');
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: quizDraft,
      title: 'Archived quiz',
      userId: owner.id,
    });
    grantResourceAccess({
      grantedByUserId: owner.id,
      grantedVia: 'profile',
      profileId: studentProfile.id,
      resourceId: quiz.id,
      userId: student.id,
    });
    expect(
      listResourcesSharedWithProfile({ profileId: studentProfile.id, userId: student.id }),
    ).toHaveLength(1);

    archiveResourceForUser(quiz.id, owner.id);

    expect(
      listResourcesSharedWithProfile({ profileId: studentProfile.id, userId: student.id }),
    ).toEqual([]);
  });
});
