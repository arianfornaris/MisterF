import { findConversationForUser, getConversationTutorPlan, renameConversationForUser, saveConversationTutorPlan, } from '../../db/repository.js';
import { applyTutorPlanBlocks } from '../tutorPlans.js';
export function applyTutorBlocksRuntime(input) {
    let handledTutorPlan = false;
    for (const block of input.blocks) {
        switch (block.type) {
            case 'sentence_evaluation':
                break;
            case 'conversation_title':
                handleConversationTitleBlock({
                    conversationId: input.conversationId,
                    io: input.io,
                    title: block.title,
                    userId: input.userId,
                });
                break;
            case 'tutor_plan':
            case 'tutor_plan_update':
                if (!handledTutorPlan) {
                    handleTutorPlanBlock({
                        blocks: input.blocks,
                        conversationId: input.conversationId,
                        io: input.io,
                    });
                    handledTutorPlan = true;
                }
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
function handleTutorPlanBlock(input) {
    try {
        const currentPlan = getConversationTutorPlan(input.conversationId);
        const nextPlan = applyTutorPlanBlocks(input.blocks, currentPlan);
        if (!nextPlan) {
            return;
        }
        const savedPlan = saveConversationTutorPlan({
            conversationId: input.conversationId,
            plan: nextPlan,
        });
        input.io.to(input.conversationId).emit('tutor_plan:updated', {
            conversationId: input.conversationId,
            tutorPlan: savedPlan,
        });
    }
    catch (error) {
        console.error('Tutor plan side effect failed.', {
            conversationId: input.conversationId,
            error,
        });
    }
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