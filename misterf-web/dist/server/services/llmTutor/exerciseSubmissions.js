export function normalizeExerciseSubmissionForUserMessage(value, content) {
    const submission = normalizeFillInTheBlankInputExerciseSubmission(value);
    if (!submission || submission.completedSentence !== normalizeText(content)) {
        return null;
    }
    const computedSentence = fillSentenceBlanks(submission.block.sentence, submission.values, '___');
    return computedSentence === submission.completedSentence ? submission : null;
}
export function formatExerciseSubmissionForTutorHistory(value, content) {
    const submission = normalizeExerciseSubmissionForUserMessage(value, content);
    if (!submission) {
        return null;
    }
    return JSON.stringify({
        kind: 'learner_exercise_submission',
        visibleContent: content,
        exerciseSubmission: submission,
    }, null, 2);
}
function normalizeFillInTheBlankInputExerciseSubmission(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    if (record.type !== 'fill_in_the_blank_input') {
        return null;
    }
    const block = normalizeFillInTheBlankInputBlock(record.block);
    if (!block || !Array.isArray(record.values)) {
        return null;
    }
    const values = record.values
        .map((item) => (typeof item === 'string' ? normalizeText(item) : ''))
        .filter(Boolean);
    if (values.length === 0 ||
        values.length > 20 ||
        values.some((item) => item.length > 240) ||
        countSentencePlaceholders(block.sentence, '___') !== values.length) {
        return null;
    }
    const completedSentence = typeof record.completedSentence === 'string'
        ? normalizeText(record.completedSentence)
        : '';
    if (!completedSentence || completedSentence.length > 1600) {
        return null;
    }
    return {
        block,
        completedSentence,
        type: 'fill_in_the_blank_input',
        values,
    };
}
function normalizeFillInTheBlankInputBlock(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    if (record.type !== 'fill_in_the_blank_input') {
        return null;
    }
    const sentence = typeof record.sentence === 'string' ? normalizeText(record.sentence) : '';
    if (!sentence ||
        sentence.length > 1600 ||
        countSentencePlaceholders(sentence, '___') === 0) {
        return null;
    }
    const prompt = typeof record.prompt === 'string' ? normalizeText(record.prompt) : '';
    if (prompt.length > 1000) {
        return null;
    }
    return {
        type: 'fill_in_the_blank_input',
        ...(prompt ? { prompt } : {}),
        sentence,
    };
}
function fillSentenceBlanks(sentence, values, placeholderToken) {
    let nextSentence = sentence;
    for (const value of values) {
        nextSentence = nextSentence.replace(placeholderToken, value);
    }
    return normalizeText(nextSentence);
}
function countSentencePlaceholders(sentence, placeholderToken) {
    return sentence.split(placeholderToken).length - 1;
}
function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=exerciseSubmissions.js.map