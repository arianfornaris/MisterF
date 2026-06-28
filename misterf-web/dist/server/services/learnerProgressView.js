export function buildLearnerProgressVocabularyItems(events) {
    const items = new Map();
    for (const event of events) {
        for (const rawTerm of event.details.vocabulary) {
            const term = rawTerm.replace(/\s+/g, ' ').trim();
            if (!term) {
                continue;
            }
            const key = term.toLowerCase();
            const existing = items.get(key);
            const sourceLabel = event.sourceType === 'assignment_attempt'
                ? 'Tarea'
                : event.sourceType === 'tutor_conversation_report'
                    ? 'Tutor'
                    : 'Práctica';
            if (existing) {
                existing.count += 1;
                if (Date.parse(event.eventDate) > Date.parse(existing.lastSeenAt)) {
                    existing.lastSeenAt = event.eventDate;
                }
                pushUnique(existing.sourceLabels, sourceLabel, 3);
                pushUnique(existing.sourceTitles, event.title, 3);
                continue;
            }
            items.set(key, {
                count: 1,
                lastSeenAt: event.eventDate,
                sourceLabels: [sourceLabel],
                sourceTitles: [event.title],
                term,
            });
        }
    }
    return Array.from(items.values()).sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
    });
}
function pushUnique(items, value, limit) {
    if (!items.includes(value)) {
        items.push(value);
    }
    if (items.length > limit) {
        items.length = limit;
    }
}
//# sourceMappingURL=learnerProgressView.js.map