import { loadSystemPrompt } from '../systemPrompts.js';

export const tutorBlockProtocolNames = [
  'message',
  'practice-module-link',
  'dialogue-character-message',
  'dialogue-transcript',
  'matching-pairs',
  'quiz',
  'translate-to-english-prompt',
  'understand-in-spanish-prompt',
  'fill-in-the-blank-input',
  'fill-in-the-blank-choice',
  'multiple-choice',
  'unscramble-sentence',
  'tutor-plan',
  'tutor-plan-update',
  'sentence-evaluation',
  'tutor-response-block',
] as const;

export type TutorBlockProtocolName = typeof tutorBlockProtocolNames[number];

const tutorBlockProtocolNameSet = new Set<string>(tutorBlockProtocolNames);

export function renderTutorBlockProtocol(
  names: readonly TutorBlockProtocolName[] = tutorBlockProtocolNames,
): string {
  return names
    .map((name) => loadSystemPrompt(`tutor/blocks/${name}.md`).trim())
    .join('\n\n');
}

export function toTutorBlockProtocolNames(
  names: Iterable<string>,
): TutorBlockProtocolName[] {
  const selected = new Set<TutorBlockProtocolName>(['message']);

  for (const name of names) {
    if (tutorBlockProtocolNameSet.has(name)) {
      selected.add(name as TutorBlockProtocolName);
    }
  }

  selected.add('tutor-response-block');

  return tutorBlockProtocolNames.filter((name) => selected.has(name));
}
