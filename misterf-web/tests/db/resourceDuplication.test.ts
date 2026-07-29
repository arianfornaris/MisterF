import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const quizDraft = {
  blocks: [],
  description: 'Practice gerunds.',
  instructions: 'Evaluate verb patterns.',
  level: 'B1',
  targetTopic: 'Gerunds',
  title: 'Verb Pattern Check',
};

const roleplayCharacters = [
  { description: 'A learner.', id: 'learner' as const, name: 'Learner' },
  { description: 'A server.', id: 'ai' as const, name: 'Server' },
];

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-duplicate-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'duplicate.sqlite');
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

async function setup() {
  const { createExternalUser } = await import('../../src/server/auth/repository.js');
  const repo = await import('../../src/server/db/repository.js');
  const { duplicateResourceForProfile } = await import(
    '../../src/server/resources/duplicate.js'
  );

  const user = createExternalUser({
    email: 'duplicate@example.com',
    emailVerified: true,
    fullName: 'Duplicate Owner',
    provider: 'google',
    providerSubject: 'duplicate-owner',
  });
  const profile = repo.createProfile({ name: 'Owner profile', userId: user.id });

  return { duplicateResourceForProfile, profile, repo, user };
}

describe('duplicateResourceForProfile', () => {
  it('copies a quiz into an independent resource with a derived title', async () => {
    const { duplicateResourceForProfile, profile, repo, user } = await setup();
    const quiz = repo.createQuiz({
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: profile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: user.id,
    });

    const result = duplicateResourceForProfile({
      locale: 'es',
      profileId: profile.id,
      resourceId: quiz.id,
      userId: user.id,
    });

    expect(result).not.toBeNull();
    expect(result?.duplicatedCount).toBe(1);
    expect(result?.resource.id).not.toBe(quiz.id);
    expect(result?.resource.title).toBe('Copia de Verb Pattern Check');

    const copy = repo.findQuizForUser(result!.resource.id, user.id);
    expect(copy?.quiz).toEqual(quiz.quiz);
    expect(copy?.instructions).toBe(quiz.instructions);

    // A duplicate is a fresh original, not an import: nothing marks it as
    // shared or derived, so it starts clean for a new group.
    expect(result?.resource.sharedVia).toBeNull();
    expect(result?.resource.sourceResourceId).toBeNull();
  });

  it('does not carry the original participation or shares to the copy', async () => {
    const { duplicateResourceForProfile, profile, repo, user } = await setup();
    const quiz = repo.createQuiz({
      profileId: profile.id,
      quiz: quizDraft,
      title: quizDraft.title,
      userId: user.id,
    });
    repo.getOrCreateResourceShareLink(quiz.id);
    repo.createQuizAttempt({
      collectResults: true,
      profileId: profile.id,
      quizId: quiz.id,
      snapshot: quizDraft,
      userId: user.id,
    });

    const result = duplicateResourceForProfile({
      locale: 'es',
      profileId: profile.id,
      resourceId: quiz.id,
      userId: user.id,
    });

    const copyId = result!.resource.id;
    // The whole point of duplicating: the copy starts with no attempts and no
    // live share, so a second group's results stay separate from the first's.
    expect(
      repo.listCollectedQuizAttemptsForOwner({
        authorProfileId: profile.id,
        quizId: copyId,
      }),
    ).toEqual([]);
    expect(repo.findResourceShareLinkForResource(copyId)).toBeNull();
  });

  it('copies a folder with the resources filed inside it, recursing into subfolders', async () => {
    const { duplicateResourceForProfile, profile, repo, user } = await setup();
    const folder = repo.createResourceFolder({
      profileId: profile.id,
      title: 'Unit 1',
      userId: user.id,
    });
    const quiz = repo.createQuiz({
      profileId: profile.id,
      quiz: quizDraft,
      title: 'Filed Quiz',
      userId: user.id,
    });
    repo.addResourceToFolder({ folderId: folder.id, resourceId: quiz.id, userId: user.id });

    const subfolder = repo.createResourceFolder({
      profileId: profile.id,
      title: 'Unit 1.1',
      userId: user.id,
    });
    repo.addResourceToFolder({
      folderId: folder.id,
      resourceId: subfolder.id,
      userId: user.id,
    });
    const roleplay = repo.createRoleplay({
      characters: roleplayCharacters,
      profileId: profile.id,
      title: 'Nested Roleplay',
      userId: user.id,
    });
    repo.addResourceToFolder({
      folderId: subfolder.id,
      resourceId: roleplay.id,
      userId: user.id,
    });

    const result = duplicateResourceForProfile({
      locale: 'es',
      profileId: profile.id,
      resourceId: folder.id,
      userId: user.id,
    });

    // folder + quiz + subfolder + nested roleplay
    expect(result?.duplicatedCount).toBe(4);
    expect(result?.resource.title).toBe('Copia de Unit 1');

    const copiedItems = repo.listResourceFolderItems(result!.resource.id, user.id);
    expect(copiedItems).toHaveLength(2);
    // Contents keep their own titles; only the duplicated folder is renamed.
    const copiedTitles = copiedItems
      .map((item) => repo.findResourceForUser(item.resourceId, user.id)?.title)
      .sort();
    expect(copiedTitles).toEqual(['Filed Quiz', 'Unit 1.1']);

    // The originals stay where they were.
    expect(repo.listResourceFolderItems(folder.id, user.id)).toHaveLength(2);
  });

  it('refuses to duplicate an archived resource so Trash content is not resurrected', async () => {
    const { duplicateResourceForProfile, profile, repo, user } = await setup();
    const quiz = repo.createQuiz({
      profileId: profile.id,
      quiz: quizDraft,
      title: quizDraft.title,
      userId: user.id,
    });
    repo.archiveResourceForUser(quiz.id, user.id);

    expect(
      duplicateResourceForProfile({
        locale: 'es',
        profileId: profile.id,
        resourceId: quiz.id,
        userId: user.id,
      }),
    ).toBeNull();
  });

  it('refuses to duplicate a resource another profile owns', async () => {
    const { duplicateResourceForProfile, profile, repo, user } = await setup();
    const otherProfile = repo.createProfile({ name: 'Other profile', userId: user.id });
    const quiz = repo.createQuiz({
      profileId: otherProfile.id,
      quiz: quizDraft,
      title: quizDraft.title,
      userId: user.id,
    });

    expect(
      duplicateResourceForProfile({
        locale: 'es',
        profileId: profile.id,
        resourceId: quiz.id,
        userId: user.id,
      }),
    ).toBeNull();
  });
});
