import { tool } from 'ai';
import { z } from 'zod';
import { findConversationForUser, renameConversationForUser, } from '../../db/repository.js';
import { isGenericConversationTitle, normalizeConversationTitle, } from './conversationTitles.js';
const conversationTitleUpdateReasonSchema = z.enum([
    'initial_topic',
    'explicit_user_request',
]);
export function buildTutorConversationTools(input) {
    if (!input.userId || !input.conversationId) {
        return undefined;
    }
    const { conversationId, onConversationRenamed, userId, } = input;
    let titleUpdateAttemptedThisTurn = false;
    return {
        update_conversation_title: tool({
            description: 'Update the current tutor conversation title in the app sidebar. Use this internal runtime tool at most once for the first automatic title, only when the current title is generic and the learner has provided a clear topic, purpose, exercise direction, scenario, or repeated practice thread. You may use it later only when the learner explicitly asks in the current turn to rename or change the conversation title. Do not use it repeatedly to refine a title after normal progress, exercise completion, or topic drift. Do not use it when the conversation is still only a greeting with no clear purpose. This tool is only for app state; do not mention it to the learner.',
            inputSchema: z.object({
                reason: conversationTitleUpdateReasonSchema
                    .describe('Why this title update is allowed. Use "initial_topic" only for the first automatic title when the current title is generic and the conversation purpose is now clear. Use "explicit_user_request" only when the learner explicitly asks in the current turn to rename or change this conversation title.'),
                title: z.string().trim().min(1).max(90)
                    .describe('Short Spanish, human-friendly, specific title for the current conversation. Avoid generic titles such as "Práctica de inglés", "Conversación", or "Resumen de conversación". Do not use English unless the learner explicitly requested an English title.'),
            }),
            execute: async ({ reason, title }) => {
                if (titleUpdateAttemptedThisTurn) {
                    return {
                        renamed: false,
                        reason: 'already_attempted_this_turn',
                    };
                }
                const conversation = findConversationForUser(conversationId, userId);
                if (!conversation) {
                    return {
                        renamed: false,
                        reason: 'conversation_not_found',
                    };
                }
                const isExplicitUserRequest = reason === 'explicit_user_request';
                if (!isExplicitUserRequest && conversation.titleUpdatedByUser) {
                    return {
                        currentTitle: conversation.title,
                        renamed: false,
                        reason: 'manual_title',
                    };
                }
                if (!isExplicitUserRequest && !isGenericConversationTitle(conversation.title)) {
                    return {
                        currentTitle: conversation.title,
                        renamed: false,
                        reason: 'title_already_specific',
                    };
                }
                const normalizedTitle = normalizeConversationTitle(title);
                if (!normalizedTitle ||
                    isGenericConversationTitle(normalizedTitle) ||
                    normalizedTitle === conversation.title) {
                    return {
                        currentTitle: conversation.title,
                        renamed: false,
                        reason: 'invalid_or_unchanged_title',
                    };
                }
                titleUpdateAttemptedThisTurn = true;
                const renamedConversation = renameConversationForUser(conversationId, userId, normalizedTitle, { updatedByUser: isExplicitUserRequest });
                if (!renamedConversation) {
                    return {
                        currentTitle: conversation.title,
                        renamed: false,
                        reason: 'rename_failed',
                    };
                }
                onConversationRenamed?.(renamedConversation);
                return {
                    renamed: true,
                    title: renamedConversation.title,
                };
            },
        }),
    };
}
//# sourceMappingURL=conversationTools.js.map