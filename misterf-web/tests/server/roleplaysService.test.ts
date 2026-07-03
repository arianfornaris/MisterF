import { describe, expect, it } from 'vitest';
import { buildRoleplayCharacterAvatarPromptOptions } from '../../src/server/roleplays/avatarRegistry.js';
import { roleplayDraftSchema } from '../../src/server/services/roleplays.js';

const baseRoleplayDraft = {
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
  description: 'A short roleplay.',
  level: 'A2',
  maxLearnerTurns: 6,
  pedagogicalFocus: 'Practice simple questions and answers.',
  scenario: 'The learner meets someone new and starts a short conversation.',
  title: 'Meeting Someone New',
};

describe('roleplay avatar registry', () => {
  it('allows registered avatar ids in roleplay drafts', () => {
    const parsed = roleplayDraftSchema.parse(baseRoleplayDraft);

    expect(parsed.characters[0]?.avatarId).toBe('amara');
    expect(parsed.characters[1]?.avatarId).toBe('lucas');
  });

  it('rejects avatar ids that are not registered', () => {
    const parsed = roleplayDraftSchema.safeParse({
      ...baseRoleplayDraft,
      characters: [
        {
          ...baseRoleplayDraft.characters[0],
          avatarId: 'invented-avatar',
        },
        baseRoleplayDraft.characters[1],
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('formats registered avatar options for roleplay authoring prompts', () => {
    const promptOptions = buildRoleplayCharacterAvatarPromptOptions();

    expect(promptOptions).toContain('- amara: Amara');
    expect(promptOptions).toContain('- lucas: Lucas');
  });
});
