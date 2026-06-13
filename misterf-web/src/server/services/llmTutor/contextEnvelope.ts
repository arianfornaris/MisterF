export type TutorContextEnvelopeScope = 'conversation' | 'current_turn';

export type TutorContextEnvelope<TData extends Record<string, unknown>> = {
  audience: 'teacher_only';
  contextBlockVersion: 1;
  data: TData;
  interpretation: {
    notAssistantMessage: true;
    notConversationTranscript: true;
    notUserMessage: true;
    rules: string[];
    useAsHistoricalContextOnly: true;
  };
  kind: string;
  purpose: string;
  scope: TutorContextEnvelopeScope;
  source: string;
};

export function createTeacherOnlyContextEnvelope<
  TData extends Record<string, unknown>,
>(input: {
  data: TData;
  kind: string;
  purpose: string;
  rules?: string[];
  scope: TutorContextEnvelopeScope;
  source: string;
}): TutorContextEnvelope<TData> {
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
