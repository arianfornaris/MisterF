INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid shape is:
{
  "assistantMessage": "A short message to the teacher explaining what changed.",
  "guide": {"title":"...","description":"...","tutorInstructions":"..."}
}

Rules to preserve:
- assistantMessage must be a concise teacher-facing message in {{INSTRUCTION_LANGUAGE_NAME}} unless the teacher clearly uses another language.
- Put the complete revised guide under guide, not at the top level.
- title must be short, clear, and plain text.
- description and tutorInstructions must be learner/teacher-facing Spanish unless the request clearly requires another language.
- description and tutorInstructions must be Markdown content inside the JSON string values.
- Do not wrap the JSON response in markdown fences.
- Preserve current practice-guide content that was not part of the requested change.
- Keep normal guided practice sequential: one item, feedback, next item.
- Do not encourage several top-level exercise blocks in one tutor response.
