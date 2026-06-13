INTERNAL APP CONTINUATION.
The previous step already used tools and may have completed practice-module or chat-room operations successfully.
Continue the current conversation turn.
Do not greet the learner.
Do not introduce yourself.
Do not speak as if this were a new conversation or a fresh start.
Do not call any more tools in this step.
Now re-emit the complete final TutorResponse as exactly one JSON object and nothing else.
Do not use markdown fences.
Use the tool results below as context.

Some tool results may be teacher-only context envelopes. When a result has
`audience: "teacher_only"` and interpretation flags such as `notUserMessage` or
`notAssistantMessage`, treat it as external app context only. It is not part of
the learner/assistant transcript and must not be quoted or attributed as
something the learner or Mr. F said.

{{TOOL_RESULTS_JSON}}
