import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const assignmentDraft = {
  blocks: [],
  description: 'Practice gerunds and infinitives.',
  instructions: 'Evaluate verb pattern accuracy.',
  level: 'B1',
  targetTopic: 'Gerunds and infinitives',
  title: 'Verb Pattern Check',
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
      archiveAssignmentForUser,
      createAssignment,
      createPracticeModule,
      createProfile,
      createResourceFolder,
      findResourceFolderForResource,
      findResourceForUser,
      getOrCreateResourceShareLink,
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

    const assignment = createAssignment({
      description: assignmentDraft.description,
      instructions: assignmentDraft.instructions,
      level: assignmentDraft.level,
      profileId: profile.id,
      quiz: assignmentDraft,
      targetTopic: assignmentDraft.targetTopic,
      title: assignmentDraft.title,
      userId: user.id,
    });
    const practiceGuide = createPracticeModule({
      description: 'Practice guide description.',
      profileId: profile.id,
      title: 'Conversation Practice Guide',
      tutorInstructions: 'Practice short answers.',
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
    const otherAssignment = createAssignment({
      description: 'Other profile assignment.',
      instructions: '',
      profileId: otherProfile.id,
      quiz: { blocks: [], title: 'Other Assignment' },
      title: 'Other Assignment',
      userId: user.id,
    });

    expect(findResourceForUser(assignment.id, user.id)).toEqual(expect.objectContaining({
      id: assignment.id,
      level: assignmentDraft.level,
      title: assignmentDraft.title,
      topic: assignmentDraft.targetTopic,
      type: 'assignment',
    }));
    expect(findResourceForUser(practiceGuide.id, user.id)).toEqual(expect.objectContaining({
      id: practiceGuide.id,
      title: practiceGuide.title,
      type: 'practice_guide',
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
      'assignment',
      'practice_guide',
      'resource_folder',
    ]));

    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: assignment.id,
      userId: user.id,
    })).toBe(true);
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: practiceGuide.id,
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
      resourceId: otherAssignment.id,
      userId: user.id,
    })).toBe(false);

    expect(findResourceFolderForResource(assignment.id, user.id)).toEqual(expect.objectContaining({
      id: folder.id,
      title: folder.title,
      type: 'resource_folder',
    }));
    expect(findResourceFolderForResource(childFolder.id, user.id)).toEqual(expect.objectContaining({
      id: folder.id,
      title: folder.title,
      type: 'resource_folder',
    }));
    expect(findResourceFolderForResource(otherAssignment.id, user.id)).toBeNull();
    expect(listResourceFolderItems(folder.id, user.id).map((item) => item.resourceId)).toEqual([
      assignment.id,
      practiceGuide.id,
      childFolder.id,
    ]);
    expect(listResourcesForProfile({
      folderId: folder.id,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      assignment.id,
      practiceGuide.id,
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
      assignment.id,
      childFolder.id,
    ]);

    expect(archiveAssignmentForUser(assignment.id, user.id)?.archivedAt).not.toBeNull();
    expect(findResourceForUser(assignment.id, user.id)?.archivedAt).not.toBeNull();
    expect(listResourcesForProfile({
      folderId: folder.id,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      practiceGuide.id,
      childFolder.id,
    ]);
    expect(listResourcesForProfile({
      folderId: folder.id,
      includeArchived: true,
      profileId: profile.id,
      userId: user.id,
    }).map((resource) => resource.id)).toEqual([
      practiceGuide.id,
      assignment.id,
      childFolder.id,
    ]);

    expect(removeResourceFromFolder({
      folderId: folder.id,
      resourceId: practiceGuide.id,
      userId: user.id,
    })).toBe(true);
    expect(findResourceFolderForResource(practiceGuide.id, user.id)).toBeNull();
    expect(listResourceFolderItems(folder.id, user.id).map((item) => item.resourceId)).toEqual([
      assignment.id,
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

    const shareLink = getOrCreateResourceShareLink(folder.id);
    expect(getOrCreateResourceShareLink(folder.id).id).toBe(shareLink.id);
    expect(shareLink.resourceId).toBe(folder.id);
  });
});
