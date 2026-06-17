import { renderSystemPrompt } from '../systemPrompts.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import { isGenericConversationTitle } from './conversationTitles.js';
export function buildAgentSystemInstruction(options) {
    const currentTitle = options.currentTitle?.trim() || 'Nueva conversación';
    const base = renderTutorSystemPrompt({
        BLOCK_PROTOCOL: renderTutorBlockProtocol(),
        CURRENT_TITLE: currentTitle,
        TITLE_RULE: buildConversationTitleRule({
            currentTitle,
            titleUpdatedByUser: Boolean(options.titleUpdatedByUser),
        }),
    });
    if (!options.practiceModule) {
        if (!options.chatRoomReport && !options.tutorReport && !options.tutorPlanText) {
            const sections = [base];
            appendLearnerProfileContext(sections, options.learnerProfile);
            return sections.join('\n');
        }
        const sections = [base];
        appendLearnerProfileContext(sections, options.learnerProfile);
        appendTutorPlanContext(sections, options.tutorPlanText);
        if (options.chatRoomReport) {
            sections.push('', renderSystemPrompt('tutor/chatroom-report-context.md', {
                CHAT_ROOM_CONVERSATION_ID: options.chatRoomReport.chatRoomConversationId,
                REPORT_SLIDES_JSON: options.chatRoomReport.slidesJson,
                REPORT_SUMMARY_DESCRIPTION: options.chatRoomReport.reportSummaryDescription,
                REPORT_SUMMARY_TITLE: options.chatRoomReport.reportSummaryTitle,
                ROOM_DESCRIPTION: options.chatRoomReport.roomDescription,
                ROOM_TITLE: options.chatRoomReport.roomTitle,
            }));
        }
        if (options.tutorReport) {
            sections.push('', renderSystemPrompt('tutor/tutor-report-context.md', {
                REPORT_JSON: options.tutorReport.reportJson,
                REPORT_SUMMARY_DESCRIPTION: options.tutorReport.reportSummaryDescription,
                REPORT_SUMMARY_TITLE: options.tutorReport.reportSummaryTitle,
                SOURCE_CONVERSATION_ID: options.tutorReport.sourceConversationId,
            }));
        }
        return sections.join('\n');
    }
    const sections = [
        base,
        '',
        renderSystemPrompt('tutor/practice-module-context.md', {
            PRACTICE_MODULE_DESCRIPTION: options.practiceModule.description,
            PRACTICE_MODULE_TITLE: options.practiceModule.title,
            PRACTICE_MODULE_TUTOR_INSTRUCTIONS: options.practiceModule.tutorInstructions,
        }),
    ];
    appendLearnerProfileContext(sections, options.learnerProfile);
    appendTutorPlanContext(sections, options.tutorPlanText);
    if (options.chatRoomReport) {
        sections.push('', renderSystemPrompt('tutor/chatroom-report-context.md', {
            CHAT_ROOM_CONVERSATION_ID: options.chatRoomReport.chatRoomConversationId,
            REPORT_SLIDES_JSON: options.chatRoomReport.slidesJson,
            REPORT_SUMMARY_DESCRIPTION: options.chatRoomReport.reportSummaryDescription,
            REPORT_SUMMARY_TITLE: options.chatRoomReport.reportSummaryTitle,
            ROOM_DESCRIPTION: options.chatRoomReport.roomDescription,
            ROOM_TITLE: options.chatRoomReport.roomTitle,
        }));
    }
    if (options.tutorReport) {
        sections.push('', renderSystemPrompt('tutor/tutor-report-context.md', {
            REPORT_JSON: options.tutorReport.reportJson,
            REPORT_SUMMARY_DESCRIPTION: options.tutorReport.reportSummaryDescription,
            REPORT_SUMMARY_TITLE: options.tutorReport.reportSummaryTitle,
            SOURCE_CONVERSATION_ID: options.tutorReport.sourceConversationId,
        }));
    }
    return sections.join('\n');
}
function buildConversationTitleRule(input) {
    if (input.titleUpdatedByUser) {
        return 'The user has already changed this title manually. Do not call update_conversation_title unless the learner explicitly asks to rename the conversation in the current turn; in that case call it once with reason "explicit_user_request".';
    }
    if (!isGenericConversationTitle(input.currentTitle)) {
        return 'The current title is already specific. Do not call update_conversation_title unless the learner explicitly asks to rename the conversation in the current turn; in that case call it once with reason "explicit_user_request".';
    }
    return [
        'The current title is generic. If the learner has provided a clear topic, purpose, exercise direction, scenario, or repeated practice thread, call update_conversation_title at most once with reason "initial_topic" before or while producing your response.',
        'If the conversation is still only a greeting or the purpose is genuinely unclear, do not call update_conversation_title until the first response where the purpose becomes clear.',
        'After any title update attempt in this response, do not call update_conversation_title again unless the learner explicitly asks to rename the conversation in a later turn.',
        'The title must be short, Spanish, human-friendly, and specific; avoid generic titles such as "Práctica de inglés", "Conversación", or "Resumen de conversación".',
    ].join(' ');
}
function appendLearnerProfileContext(sections, learnerProfile) {
    if (!learnerProfile) {
        return;
    }
    const name = learnerProfile.name.trim();
    const description = learnerProfile.description.trim();
    const learningContext = learnerProfile.learningContext.trim();
    if (!name && !description && !learningContext) {
        return;
    }
    sections.push('', renderSystemPrompt('tutor/profile-context.md', {
        PROFILE_DESCRIPTION: description || 'No especificada.',
        PROFILE_LEARNING_CONTEXT: learningContext || 'No especificado.',
        PROFILE_NAME: name || 'No especificado.',
    }));
}
function appendTutorPlanContext(sections, tutorPlanText) {
    const text = tutorPlanText?.trim();
    if (!text) {
        return;
    }
    sections.push('', renderSystemPrompt('tutor/visible-plan-context.md', {
        TUTOR_PLAN_TEXT: text,
    }));
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
function renderTutorSystemPrompt(placeholders) {
    const rendered = renderSystemPrompt('tutor/system.md', placeholders);
    if (rendered.includes(placeholders.BLOCK_PROTOCOL)) {
        return rendered;
    }
    const startMarker = '## Structured Response Protocol';
    const endMarker = '## Practical Guidance';
    const startIndex = rendered.indexOf(startMarker);
    const endIndex = rendered.indexOf(endMarker, startIndex);
    if (startIndex === -1 || endIndex === -1) {
        return rendered;
    }
    const protocolSection = [
        startMarker,
        '',
        'You must always respond with exactly one JSON object and nothing else.',
        '',
        '```ts',
        'interface TutorResponse {',
        '  /** Ordered visible response blocks to render in the tutor chat. */',
        '  blocks: TutorResponseBlock[];',
        '}',
        '',
        placeholders.BLOCK_PROTOCOL,
        '```',
        '',
    ].join('\n');
    return [
        rendered.slice(0, startIndex),
        protocolSection,
        rendered.slice(endIndex),
    ].join('');
}
//# sourceMappingURL=prompt.js.map