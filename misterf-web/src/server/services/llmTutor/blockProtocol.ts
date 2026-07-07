import { loadSystemPrompt } from '../systemPrompts.js';
import { buildRoleplayCharacterAvatarPromptOptions } from '../../roleplays/avatarRegistry.js';
import { languages } from '../../i18n/index.js';
import {
  defaultInstructionLanguage,
  tutorBlockProtocolPlaceholders,
  type InstructionLanguage,
} from './languagePack.js';

export const tutorBlockProtocolNames = [
  'message',
  'dialogue-character-message',
  'dialogue-transcript',
  'matching-pairs',
  'quiz',
  'translate-to-english-prompt',
  'understand-in-spanish-prompt',
  'open-text-prompt',
  'fill-in-the-blank-input',
  'fill-in-the-blank-choice',
  'multiple-choice',
  'unscramble-sentence',
  'order-sentences',
  'tutor-plan',
  'tutor-plan-update',
  'sentence-evaluation',
  'tutor-response-block',
] as const;

export type TutorBlockProtocolName = typeof tutorBlockProtocolNames[number];

/**
 * Blocks that only make sense when the instruction language is Spanish. For an
 * English-instruction (monolingual) profile the tutor teaches English through
 * English, so translation-based exercises are excluded from the block set.
 */
const spanishOnlyTutorBlockNames = new Set<TutorBlockProtocolName>([
  'translate-to-english-prompt',
  'understand-in-spanish-prompt',
]);

export function tutorBlockNamesForInstructionLanguage(
  instructionLanguage: InstructionLanguage,
): TutorBlockProtocolName[] {
  if (languages[instructionLanguage].tutor.includesSpanishTranslationBlocks) {
    return [...tutorBlockProtocolNames];
  }

  return tutorBlockProtocolNames.filter(
    (name) => !spanishOnlyTutorBlockNames.has(name),
  );
}

export function renderTutorBlockProtocol(
  names?: readonly TutorBlockProtocolName[],
  instructionLanguage: InstructionLanguage = defaultInstructionLanguage,
): string {
  const avatarOptions = buildRoleplayCharacterAvatarPromptOptions();
  const languagePlaceholders = tutorBlockProtocolPlaceholders(instructionLanguage);
  const selectedNames =
    names ?? tutorBlockNamesForInstructionLanguage(instructionLanguage);

  return selectedNames
    .map((name) => {
      let doc = loadSystemPrompt(`tutor/blocks/${name}.md`)
        .replaceAll('{{DIALOGUE_AVATAR_OPTIONS}}', avatarOptions);

      for (const [key, value] of Object.entries(languagePlaceholders)) {
        doc = doc.replaceAll(`{{${key}}}`, value);
      }

      return doc.trim();
    })
    .join('\n\n');
}
