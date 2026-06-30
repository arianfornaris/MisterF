export function buildLearnerProgressEventViews(events) {
    return events.map((event) => ({
        ...event,
        sourceLabel: getProgressEventSourceLabel(event),
    }));
}
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
            const sourceLabel = getProgressEventSourceLabel(event);
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
export function getProgressEventSourceLabel(event) {
    if (event.details.resourceType === 'quiz') {
        return 'Quiz';
    }
    if (event.details.resourceType === 'practice_guide') {
        return 'Guía de Práctica';
    }
    if (event.details.resourceType === 'roleplay') {
        return 'Roleplay';
    }
    if (event.sourceType === 'quiz_attempt') {
        return 'Quiz';
    }
    if (event.sourceType === 'roleplay_attempt') {
        return 'Roleplay';
    }
    if (event.sourceType === 'tutor_conversation_report') {
        return 'Bitácora';
    }
    return 'Práctica';
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