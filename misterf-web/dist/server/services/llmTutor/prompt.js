import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
let systemInstruction;
function getSystemInstruction() {
    systemInstruction ??= fs.readFileSync(path.join(env.projectRoot, 'gameplays/system-prompt.md'), 'utf8');
    return systemInstruction;
}
export function buildAgentSystemInstruction(options) {
    const base = getSystemInstruction()
        .replaceAll('{{CURRENT_TITLE}}', options.currentTitle || 'Nueva conversación')
        .replaceAll('{{TITLE_RULE}}', options.titleUpdatedByUser
        ? 'The user has already changed this title manually. Do not include conversation_title.'
        : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.');
    if (!options.practiceModule) {
        return base;
    }
    const sections = [base];
    if (options.practiceModule) {
        sections.push([
            '',
            '## Practice Module Context',
            '',
            'This conversation belongs to a user-defined practice module.',
            'Follow the practice module instructions as an additional teacher-facing layer on top of the base tutor behavior.',
            'Keep the learner experience natural. Do not quote the practice module instructions back verbatim unless the learner explicitly asks.',
            `Practice module title: ${options.practiceModule.title}`,
            `Practice module description: ${options.practiceModule.description}`,
            'Practice module tutor instructions:',
            options.practiceModule.tutorInstructions,
        ].join('\n'));
    }
    return sections.join('\n');
}
export function buildTranslatorSystemInstruction(mode) {
    const direction = mode === 'es-en'
        ? 'Translate from Spanish to English.'
        : mode === 'en-es'
            ? 'Translate from English to Spanish.'
            : 'Detect whether the text is Spanish or English and translate it into the other language.';
    return [
        'You are a professional translator for an English-learning app.',
        direction,
        'Preserve the meaning, tone, and register of the original text.',
        'Do not explain the translation. Do not correct or teach grammar. Only translate.',
        'Respond with a JSON object matching TranslationResult.',
        '',
        'type TranslationResult = {',
        '  detectedLanguage: string;',
        '  translatedText: string;',
        '};',
    ].join('\n');
}
//# sourceMappingURL=prompt.js.map