import { describe, expect, it } from 'vitest';
import { buildRoleplayCharacterAvatarPromptOptions } from '../../src/server/roleplays/avatarRegistry.js';
import {
  createRoleplayDraftFromManualInput,
  roleplayAuthoringDraftSchema,
  roleplayDraftSchema,
  roleplayLevelOptions,
  safeParseRoleplayDraft,
} from '../../src/server/services/roleplays.js';

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
  description: 'The learner meets someone new and starts a short conversation.',
  level: 'A1-A2',
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

  it('restricts new and manually edited roleplays to the media level bands', () => {
    const parsedBaseDraft = roleplayDraftSchema.parse(baseRoleplayDraft);

    expect(roleplayLevelOptions).toEqual(['A1-A2', 'B1-B2', 'C1']);
    expect(roleplayAuthoringDraftSchema.safeParse(baseRoleplayDraft).success).toBe(true);
    expect(roleplayAuthoringDraftSchema.safeParse({
      ...baseRoleplayDraft,
      level: 'A2',
    }).success).toBe(false);
    expect(createRoleplayDraftFromManualInput({
      characters: parsedBaseDraft.characters,
      description: parsedBaseDraft.description,
      level: 'B1-B2',
      previousDraft: parsedBaseDraft,
      title: parsedBaseDraft.title,
    })?.level).toBe('B1-B2');
  });

  it('normalizes legacy roleplay snapshots into the simplified draft shape', () => {
    const parsed = safeParseRoleplayDraft({
      ...baseRoleplayDraft,
      description: 'Legacy short summary.',
      maxLearnerTurns: 6,
      pedagogicalFocus: 'Legacy evaluation instructions.',
      scenario: 'The complete legacy learner-facing situation.',
    });

    expect(parsed).toEqual({
      ...baseRoleplayDraft,
      description: 'The complete legacy learner-facing situation.',
    });
  });
});
