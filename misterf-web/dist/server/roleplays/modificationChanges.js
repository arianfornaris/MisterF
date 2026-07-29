export function listRoleplayModificationChanges(before, after) {
    const changes = [];
    const add = (field, beforeValue, afterValue) => {
        if (beforeValue !== afterValue) {
            changes.push({ after: afterValue, before: beforeValue, field });
        }
    };
    const beforeLearner = before.characters.find((character) => character.id === 'learner');
    const afterLearner = after.characters.find((character) => character.id === 'learner');
    const beforeAi = before.characters.find((character) => character.id === 'ai');
    const afterAi = after.characters.find((character) => character.id === 'ai');
    add('title', before.title, after.title);
    add('description', before.description, after.description);
    add('level', before.level, after.level);
    add('learner.name', beforeLearner?.name ?? '', afterLearner?.name ?? '');
    add('learner.description', beforeLearner?.description ?? '', afterLearner?.description ?? '');
    add('learner.avatarId', beforeLearner?.avatarId ?? '', afterLearner?.avatarId ?? '');
    add('ai.name', beforeAi?.name ?? '', afterAi?.name ?? '');
    add('ai.description', beforeAi?.description ?? '', afterAi?.description ?? '');
    add('ai.avatarId', beforeAi?.avatarId ?? '', afterAi?.avatarId ?? '');
    return changes;
}
//# sourceMappingURL=modificationChanges.js.map