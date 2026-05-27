import { findConversationForUser, renameConversationForUser, updateMessageMetadata, } from '../../db/repository.js';
export function applyTutorBlocksRuntime(input) {
    for (const block of input.blocks) {
        switch (block.type) {
            case 'sentence_evaluation':
                handleSentenceEvaluationBlock({
                    block,
                    conversationId: input.conversationId,
                    io: input.io,
                    lastUserMessageId: input.lastUserMessageId,
                });
                break;
            case 'conversation_title':
                handleConversationTitleBlock({
                    conversationId: input.conversationId,
                    io: input.io,
                    title: block.title,
                    userId: input.userId,
                });
                break;
            case 'message':
            case 'practice_module_link':
            case 'dialogue_character_message':
            case 'dialogue_transcript':
            case 'matching_pairs':
            case 'quiz':
            case 'quiz_result':
            case 'translate_to_english_prompt':
            case 'understand_in_spanish_prompt':
            case 'fill_in_the_blank_input':
            case 'fill_in_the_blank_choice':
            case 'multiple_choice':
            case 'unscramble_sentence':
                break;
        }
    }
}
function handleSentenceEvaluationBlock(input) {
    if (!input.lastUserMessageId) {
        return;
    }
    const hasIssues = input.block.parts.some((part) => part.status === 'improve' || part.status === 'error');
    if (!hasIssues) {
        return;
    }
    const message = updateMessageMetadata(input.lastUserMessageId, input.conversationId, {
        sentenceEvaluation: {
            parts: input.block.parts,
        },
    });
    if (!message) {
        return;
    }
    input.io.to(input.conversationId).emit('message:evaluation_updated', {
        conversationId: input.conversationId,
        message,
        messageId: message.id,
        sentenceEvaluation: {
            parts: input.block.parts,
        },
    });
}
function handleConversationTitleBlock(input) {
    const conversation = findConversationForUser(input.conversationId, input.userId);
    if (!conversation || conversation.titleUpdatedByUser) {
        return;
    }
    const title = normalizeConversationTitle(input.title);
    if (!title || title.toLowerCase() === 'nueva conversación') {
        return;
    }
    const renamedConversation = renameConversationForUser(input.conversationId, input.userId, title);
    if (!renamedConversation) {
        return;
    }
    input.io.to(input.conversationId).emit('conversation:renamed', {
        conversation: renamedConversation,
        conversationId: input.conversationId,
    });
}
function normalizeConversationTitle(title) {
    return title?.replace(/\s+/g, ' ').trim().slice(0, 90) ?? '';
}
//# sourceMappingURL=index.js.map