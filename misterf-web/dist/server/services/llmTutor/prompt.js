import { renderSystemPrompt } from '../systemPrompts.js';
export function buildAgentSystemInstruction(options) {
    const base = renderSystemPrompt('tutor/system.md', {
        CURRENT_TITLE: options.currentTitle || 'Nueva conversación',
        TITLE_RULE: options.titleUpdatedByUser
            ? 'The user has already changed this title manually. Do not include conversation_title.'
            : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
    });
    if (!options.practiceModule) {
        return base;
    }
    return [
        base,
        '',
        renderSystemPrompt('tutor/practice-module-context.md', {
            PRACTICE_MODULE_DESCRIPTION: options.practiceModule.description,
            PRACTICE_MODULE_TITLE: options.practiceModule.title,
            PRACTICE_MODULE_TUTOR_INSTRUCTIONS: options.practiceModule.tutorInstructions,
        }),
    ].join('\n');
}
export function buildTranslatorSystemInstruction(mode) {
    const translationDirection = mode === 'es-en'
        ? 'Translate from Spanish to English.'
        : mode === 'en-es'
            ? 'Translate from English to Spanish.'
            : 'Detect whether the text is Spanish or English and translate it into the other language.';
    return renderSystemPrompt('tutor/translator.md', {
        TRANSLATION_DIRECTION: translationDirection,
    });
}
//# sourceMappingURL=prompt.js.map