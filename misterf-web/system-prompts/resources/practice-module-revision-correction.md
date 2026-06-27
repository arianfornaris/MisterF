INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid shape is:
{"title":"...","description":"...","tutorInstructions":"..."}

Rules to preserve:
- title must be short, clear, and plain text.
- description and tutorInstructions must be learner/teacher-facing Spanish unless the request clearly requires another language.
- description and tutorInstructions must be Markdown content inside the JSON string values.
- Do not wrap the JSON response in markdown fences.
- Preserve current module content that was not part of the requested change.
- Keep normal guided practice sequential: one item, feedback, next item.
- Do not encourage several top-level exercise blocks in one tutor response.
