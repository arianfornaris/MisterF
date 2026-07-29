export function listPracticeGuideModificationChanges(before, after) {
    const fields = [
        'title',
        'description',
        'tutorInstructions',
    ];
    return fields.flatMap((field) => (before[field] === after[field]
        ? []
        : [{ after: after[field], before: before[field], field }]));
}
//# sourceMappingURL=modificationChanges.js.map