import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const quizDraft = {
  blocks: [
    { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
  ],
  description: 'Practice gerunds.',
  instructions: 'Evaluate verb patterns.',
  level: 'B1',
  targetTopic: 'Gerunds',
  title: 'Verb Pattern Check',
};

const roleplayCharacters = [
  { avatarId: 'server-01', description: 'A learner.', id: 'learner' as const, name: 'Learner' },
  { description: 'A server.', id: 'ai' as const, name: 'Server' },
];

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-copy-links-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'copy-links.sqlite');
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
  const { copyResourceFromLink } = await import('../../src/server/resources/duplicate.js');

  function createTeacher(name: string) {
    const user = createExternalUser({
      email: `${name}@example.com`,
      emailVerified: true,
      fullName: name,
      provider: 'google',
      providerSubject: name,
    });
    const profile = repo.createProfile({ name: `${name} profile`, userId: user.id });
    return { profile, target: { profileId: profile.id, userId: user.id }, user };
  }

  const author = createTeacher('copy-author');
  const colleague = createTeacher('copy-colleague');

  function createAuthorQuiz() {
    return repo.createQuiz({
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: author.profile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: author.user.id,
    });
  }

  return { author, colleague, copyResourceFromLink, createAuthorQuiz, createTeacher, repo };
}

describe('resource copy links', () => {
  it('keeps one active link per resource and never revives a revoked one', async () => {
    const { createAuthorQuiz, repo } = await setup();
    const quiz = createAuthorQuiz();

    expect(repo.findActiveResourceCopyLinkForResource(quiz.id)).toBeNull();
    const link = repo.createResourceCopyLink(quiz.id);
    expect(repo.createResourceCopyLink(quiz.id).id).toBe(link.id);

    repo.revokeResourceCopyLink(quiz.id);
    expect(repo.findActiveResourceCopyLinkForResource(quiz.id)).toBeNull();
    expect(repo.findResourceCopyLinkById(link.id)?.revokedAt).not.toBeNull();

    const next = repo.createResourceCopyLink(quiz.id);
    expect(next.id).not.toBe(link.id);
    expect(repo.findResourceCopyLinkById(link.id)?.revokedAt).not.toBeNull();
  });

  it('copies a quiz into another account, answer key included, and records its origin', async () => {
    const { author, colleague, copyResourceFromLink, createAuthorQuiz, repo } = await setup();
    const quiz = createAuthorQuiz();
    const link = repo.createResourceCopyLink(quiz.id);

    const result = copyResourceFromLink({
      copyLinkId: link.id,
      resource: repo.findResourceById(quiz.id)!,
      target: colleague.target,
    });

    expect(result?.duplicatedCount).toBe(1);
    const copy = result!.resource;
    expect(copy.id).not.toBe(quiz.id);
    expect(copy.userId).toBe(colleague.user.id);
    expect(copy.profileId).toBe(colleague.profile.id);
    // The colleague's own resource, not a "Copia de".
    expect(copy.title).toBe(quizDraft.title);
    // Owned, not shared: none of the marks detail pages read as "shared by".
    expect(copy.sharedVia).toBeNull();
    expect(copy.sourceProfileId).toBeNull();
    expect(repo.findQuizForUser(copy.id, colleague.user.id)?.quiz).toEqual(
      repo.findQuizForUser(quiz.id, author.user.id)?.quiz,
    );

    expect(repo.findResourceCopyOrigin(copy.id)).toEqual(expect.objectContaining({
      copyLinkId: link.id,
      originProfileId: author.profile.id,
      originUserId: author.user.id,
      sourceResourceId: quiz.id,
    }));
    expect(repo.findResourceCopyOrigin(quiz.id)).toBeNull();
    expect(repo.findActiveCopyOfResourceForProfile({
      profileId: colleague.profile.id,
      sourceResourceId: quiz.id,
      userId: colleague.user.id,
    })?.id).toBe(copy.id);
  });

  it('keeps the root author as the origin along a chain of copies', async () => {
    const { author, colleague, copyResourceFromLink, createAuthorQuiz, createTeacher, repo } =
      await setup();
    const quiz = createAuthorQuiz();
    const firstCopy = copyResourceFromLink({
      copyLinkId: repo.createResourceCopyLink(quiz.id).id,
      resource: repo.findResourceById(quiz.id)!,
      target: colleague.target,
    })!.resource;

    const third = createTeacher('copy-third');
    const secondCopy = copyResourceFromLink({
      copyLinkId: repo.createResourceCopyLink(firstCopy.id).id,
      resource: repo.findResourceById(firstCopy.id)!,
      target: third.target,
    })!.resource;

    expect(repo.findResourceCopyOrigin(secondCopy.id)).toEqual(expect.objectContaining({
      originProfileId: author.profile.id,
      originUserId: author.user.id,
      sourceResourceId: firstCopy.id,
    }));
  });

  it('copies a folder with its contents and credits every copied resource', async () => {
    const { author, colleague, copyResourceFromLink, createAuthorQuiz, repo } = await setup();
    const folder = repo.createResourceFolder({
      description: 'Unit 3',
      profileId: author.profile.id,
      title: 'Unit 3 activities',
      userId: author.user.id,
    });
    const quiz = createAuthorQuiz();
    const roleplay = repo.createRoleplay({
      characters: roleplayCharacters,
      description: 'Ordering food.',
      level: 'A2',
      profileId: author.profile.id,
      title: 'At the cafe',
      userId: author.user.id,
    });
    for (const resource of [quiz, roleplay]) {
      repo.addResourceToFolder({ folderId: folder.id, resourceId: resource.id, userId: author.user.id });
    }

    const result = copyResourceFromLink({
      copyLinkId: repo.createResourceCopyLink(folder.id).id,
      resource: repo.findResourceById(folder.id)!,
      target: colleague.target,
    });

    expect(result?.duplicatedCount).toBe(3);
    const folderCopy = result!.resource;
    expect(folderCopy.title).toBe('Unit 3 activities');
    const children = repo.listResourceFolderItems(folderCopy.id, colleague.user.id);
    expect(children.map((child) => child.resourceId)).not.toContain(quiz.id);
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(repo.findResourceById(child.resourceId)?.userId).toBe(colleague.user.id);
      expect(repo.findResourceCopyOrigin(child.resourceId)?.originProfileId).toBe(author.profile.id);
    }
    // Built-in avatars are global, so the copied characters keep their faces.
    const roleplayCopyId = children.find((child) => child.resourceType === 'roleplay')!.resourceId;
    expect(repo.findRoleplayForUser(roleplayCopyId, colleague.user.id)?.characters[0]?.avatarId)
      .toBe('server-01');
  });

  it('refuses to copy an archived resource', async () => {
    const { colleague, copyResourceFromLink, createAuthorQuiz, repo } = await setup();
    const quiz = createAuthorQuiz();
    const link = repo.createResourceCopyLink(quiz.id);
    const archived = { ...repo.findResourceById(quiz.id)!, archivedAt: new Date().toISOString() };

    expect(copyResourceFromLink({
      copyLinkId: link.id,
      resource: archived,
      target: colleague.target,
    })).toBeNull();
  });
});
