import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

const roleplayDraft = {
  characters: [
    {
      avatarId: 'amara',
      description: 'A learner practicing a friendly everyday conversation.',
      id: 'learner',
      name: 'Learner',
    },
    {
      avatarId: 'lucas',
      description: 'A friendly person who keeps the conversation natural.',
      id: 'ai',
      name: 'Lucas',
    },
  ],
  description: 'The learner meets someone new and starts a short conversation.',
  level: 'A1-A2',
  title: 'Meeting Someone New',
};

beforeEach(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-roleplays-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'roleplays.sqlite');
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

describe('roleplay repository', () => {
  it('snapshots the collect_results flag per attempt and lists collected attempts for the owner', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createRoleplay,
      createRoleplayAttempt,
      findRoleplayAttemptById,
      listCollectedRoleplayAttemptsForOwner,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'rp-owner@example.com',
      emailVerified: true,
      fullName: 'Roleplay Owner',
      provider: 'google',
      providerSubject: 'rp-owner',
    });
    const ownerProfile = createProfile({ name: 'Owner profile', userId: owner.id });
    const student = createExternalUser({
      email: 'rp-student@example.com',
      emailVerified: true,
      fullName: 'Roleplay Student',
      provider: 'google',
      providerSubject: 'rp-student',
    });
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });

    const roleplay = createRoleplay({
      characters: roleplayDraft.characters,
      description: roleplayDraft.description,
      level: roleplayDraft.level,
      profileId: ownerProfile.id,
      title: roleplayDraft.title,
      userId: owner.id,
    });

    const collectedStudentAttempt = createRoleplayAttempt({
      collectResults: true,
      profileId: studentProfile.id,
      roleplayId: roleplay.id,
      snapshot: roleplayDraft,
      turns: [],
      userId: student.id,
    });
    const uncollectedAttempt = createRoleplayAttempt({
      profileId: studentProfile.id,
      roleplayId: roleplay.id,
      snapshot: roleplayDraft,
      turns: [],
      userId: student.id,
    });
    const ownerAttempt = createRoleplayAttempt({
      collectResults: true,
      profileId: ownerProfile.id,
      roleplayId: roleplay.id,
      snapshot: roleplayDraft,
      turns: [],
      userId: owner.id,
    });

    expect(findRoleplayAttemptById(collectedStudentAttempt.id)?.collectResults).toBe(true);
    expect(findRoleplayAttemptById(uncollectedAttempt.id)?.collectResults).toBe(false);

    // The owner list contains only collected attempts and never the roleplay
    // author profile's own runs, with the participant identity joined in.
    const collected = listCollectedRoleplayAttemptsForOwner({
      authorProfileId: ownerProfile.id,
      roleplayId: roleplay.id,
    });
    expect(collected.map((item) => item.id)).toEqual([collectedStudentAttempt.id]);
    expect(collected.map((item) => item.id)).not.toContain(ownerAttempt.id);
    expect(collected.map((item) => item.id)).not.toContain(uncollectedAttempt.id);
    expect(collected[0]?.participantProfileName).toBe('Student profile');
    expect(collected[0]?.participantName).toBe('Roleplay Student');
  });
});
