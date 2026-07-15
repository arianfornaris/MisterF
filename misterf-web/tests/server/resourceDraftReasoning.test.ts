import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoleplayDraft } from '../../src/server/services/roleplays.js';

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: aiMocks.generateText,
}));

const originalEnvFile = process.env.ENV_FILE;

afterEach(() => {
  if (originalEnvFile === undefined) {
    delete process.env.ENV_FILE;
  } else {
    process.env.ENV_FILE = originalEnvFile;
  }
  vi.clearAllMocks();
  vi.resetModules();
});

describe('resource draft reasoning effort', () => {
  it('uses minimal reasoning for roleplay revisions', async () => {
    process.env.ENV_FILE = '/dev/null';
    const currentDraft: RoleplayDraft = {
      characters: [
        {
          avatarId: 'mateo',
          description: 'A developer reporting progress.',
          id: 'learner',
          name: 'Leo',
        },
        {
          avatarId: 'sofia',
          description: 'A team lead asking concise questions.',
          id: 'ai',
          name: 'Elena',
        },
      ],
      description: 'Leo reports his progress to Elena during a team meeting.',
      level: 'B1-B2',
      title: 'Team update',
    };
    aiMocks.generateText.mockResolvedValue({
      finishReason: 'stop',
      providerMetadata: {},
      text: JSON.stringify({
        assistantMessage: 'I changed the learner name and its direct reference.',
        draft: {
          ...currentDraft,
          characters: [
            { ...currentDraft.characters[0], name: 'Leonardo' },
            currentDraft.characters[1],
          ],
          description: 'Leonardo reports his progress to Elena during a team meeting.',
        },
      }),
      usage: {},
    });

    const { generateRoleplayRevision } = await import(
      '../../src/server/services/resourceDrafts.js'
    );
    await generateRoleplayRevision({
      currentDraft,
      openRouterApiKey: 'test-openrouter-key',
      prompt: 'Rename Leo to Leonardo.',
    });

    expect(aiMocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'minimal',
            exclude: true,
          },
        },
      },
    }));
  });
});
