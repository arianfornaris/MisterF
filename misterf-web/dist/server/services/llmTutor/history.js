import { formatExerciseSubmissionForTutorHistory } from './exerciseSubmissions.js';
export function toTutorHistory(messages) {
    return messages.map((message) => ({
        content: getTutorHistoryContent(message),
        role: message.role,
    }));
}
export function getTutorHistoryContent(message) {
    if (message.role === 'user') {
        return getLearnerHistoryContent(message);
    }
    const blocks = message.metadata?.blocks;
    if (!Array.isArray(blocks)) {
        if (message.metadata?.source === 'initial_greeting') {
            return JSON.stringify({ blocks: [createInitialGreetingBlock(message.content)] }, null, 2);
        }
        return message.content;
    }
    return JSON.stringify({ blocks }, null, 2);
}
function getLearnerHistoryContent(message) {
    const exerciseSubmission = formatExerciseSubmissionForTutorHistory(message.metadata?.exerciseSubmission, message.content);
    return exerciseSubmission ?? message.content;
}
function createInitialGreetingBlock(content) {
    return {
        markdown: content,
        type: 'message',
    };
}
//# sourceMappingURL=history.js.map