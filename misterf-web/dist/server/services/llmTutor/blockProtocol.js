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
    'conversation-title',
    'tutor-response-block',
];
const tutorBlockProtocolNameSet = new Set(tutorBlockProtocolNames);
export function renderTutorBlockProtocol(names = tutorBlockProtocolNames) {
    return names
        .map((name) => loadSystemPrompt(`tutor/blocks/${name}.md`).trim())
        .join('\n\n');
}
export function toTutorBlockProtocolNames(names) {
    const selected = new Set(['message']);
    for (const name of names) {
        if (tutorBlockProtocolNameSet.has(name)) {
            selected.add(name);
        }
    }
    selected.add('tutor-response-block');
    return tutorBlockProtocolNames.filter((name) => selected.has(name));
}
//# sourceMappingURL=blockProtocol.js.map