import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;

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

describe('conversation runtime tools', () => {
  it('renames generic conversation titles through update_conversation_title', async () => {
    const context = await createConversationToolTestContext();
    let emittedTitle = '';
    let announcedToolCalls = 0;
    const tools = context.buildTutorConversationTools({
      conversationId: context.conversation.id,
      onConversationRenamed: (conversation) => {
        emittedTitle = conversation.title;
      },
      onToolCall: () => {
        announcedToolCalls += 1;
      },
      userId: context.user.id,
    });
    const updateTitleTool = tools?.update_conversation_title as unknown as {
      execute: (input: UpdateConversationTitleInput) => Promise<UpdateConversationTitleResult>;
    };

    const result = await updateTitleTool.execute({
      reason: 'initial_topic',
      title: 'Práctica de updates técnicos',
    });
    const renamedConversation = context.findConversationForUser(
      context.conversation.id,
      context.user.id,
    );

    expect(result).toEqual({
      renamed: true,
      title: 'Práctica de updates técnicos',
    });
    expect(renamedConversation?.title).toBe('Práctica de updates técnicos');
    expect(renamedConversation?.titleUpdatedByUser).toBe(false);
    expect(emittedTitle).toBe('Práctica de updates técnicos');
    expect(announcedToolCalls).toBe(0);
  });

  it('does not rename manually titled conversations', async () => {
    const context = await createConversationToolTestContext();
    let announcedToolCalls = 0;
    context.renameConversationForUser(
      context.conversation.id,
      context.user.id,
      'Mi título manual',
      { updatedByUser: true },
    );
    const tools = context.buildTutorConversationTools({
      conversationId: context.conversation.id,
      onToolCall: () => {
        announcedToolCalls += 1;
      },
      userId: context.user.id,
    });
    const updateTitleTool = tools?.update_conversation_title as unknown as {
      execute: (input: UpdateConversationTitleInput) => Promise<UpdateConversationTitleResult>;
    };

    const result = await updateTitleTool.execute({
      reason: 'initial_topic',
      title: 'Práctica de updates técnicos',
    });
    const conversation = context.findConversationForUser(
      context.conversation.id,
      context.user.id,
    );

    expect(result).toMatchObject({
      renamed: false,
      reason: 'manual_title',
    });
    expect(conversation?.title).toBe('Mi título manual');
    expect(announcedToolCalls).toBe(0);
  });

  it('does not announce automatic title updates as visible tool status', async () => {
    const context = await createConversationToolTestContext();
    let announcedToolCalls = 0;
    const tools = context.buildTutorConversationTools({
      conversationId: context.conversation.id,
      onToolCall: () => {
        announcedToolCalls += 1;
      },
      userId: context.user.id,
    });
    const updateTitleTool = tools?.update_conversation_title as unknown as {
      execute: (input: UpdateConversationTitleInput) => Promise<UpdateConversationTitleResult>;
    };

    const firstResult = await updateTitleTool.execute({
      reason: 'initial_topic',
      title: 'Práctica de reuniones técnicas',
    });
    const secondResult = await updateTitleTool.execute({
      reason: 'initial_topic',
      title: 'Práctica de entrevistas técnicas',
    });
    const conversation = context.findConversationForUser(
      context.conversation.id,
      context.user.id,
    );

    expect(firstResult).toMatchObject({
      renamed: true,
      title: 'Práctica de reuniones técnicas',
    });
    expect(secondResult).toMatchObject({
      renamed: false,
      reason: 'already_attempted_this_turn',
    });
    expect(conversation?.title).toBe('Práctica de reuniones técnicas');
    expect(announcedToolCalls).toBe(0);
  });

  it('allows explicit learner-requested title changes and marks them as user updates', async () => {
    const context = await createConversationToolTestContext();
    context.renameConversationForUser(
      context.conversation.id,
      context.user.id,
      'Práctica de reuniones',
    );
    const tools = context.buildTutorConversationTools({
      conversationId: context.conversation.id,
      userId: context.user.id,
    });
    const updateTitleTool = tools?.update_conversation_title as unknown as {
      execute: (input: UpdateConversationTitleInput) => Promise<UpdateConversationTitleResult>;
    };

    const result = await updateTitleTool.execute({
      reason: 'explicit_user_request',
      title: 'Roleplays de entrevistas',
    });
    const conversation = context.findConversationForUser(
      context.conversation.id,
      context.user.id,
    );

    expect(result).toMatchObject({
      renamed: true,
      title: 'Roleplays de entrevistas',
    });
    expect(conversation?.title).toBe('Roleplays de entrevistas');
    expect(conversation?.titleUpdatedByUser).toBe(true);
  });
});

type UpdateConversationTitleInput = {
  reason: 'explicit_user_request' | 'initial_topic';
  title: string;
};

type UpdateConversationTitleResult = {
  currentTitle?: string;
  reason?: string;
  renamed: boolean;
  title?: string;
};

async function createConversationToolTestContext() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-conversation-tools-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'tool.sqlite');
  process.env.ENV_FILE = '/dev/null';
  vi.resetModules();

  const { migrate } = await import('../../src/server/db/migrator.js');
  migrate();

  const { createLocalUser } = await import('../../src/server/auth/repository.js');
  const {
    createConversation,
    createProfile,
    findConversationForUser,
    renameConversationForUser,
  } = await import('../../src/server/db/repository.js');
  const { buildTutorConversationTools } = await import(
    '../../src/server/services/llmTutor/conversationTools.js'
  );

  const user = createLocalUser({
    email: 'tool-test@example.com',
    fullName: 'Tool Test',
    passwordHash: 'hashed-password',
  });
  const profile = createProfile({
    name: 'Default',
    userId: user.id,
  });
  const conversation = createConversation(user.id, profile.id);

  return {
    buildTutorConversationTools,
    conversation,
    findConversationForUser,
    renameConversationForUser,
    user,
  };
}
