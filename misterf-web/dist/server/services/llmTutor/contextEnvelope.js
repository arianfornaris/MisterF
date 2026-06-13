export function createTeacherOnlyContextEnvelope(input) {
    return {
        audience: 'teacher_only',
        contextBlockVersion: 1,
        data: input.data,
        interpretation: {
            notAssistantMessage: true,
            notConversationTranscript: true,
            notUserMessage: true,
            rules: input.rules ?? [],
            useAsHistoricalContextOnly: true,
        },
        kind: input.kind,
        purpose: input.purpose,
        scope: input.scope,
        source: input.source,
    };
}
//# sourceMappingURL=contextEnvelope.js.map