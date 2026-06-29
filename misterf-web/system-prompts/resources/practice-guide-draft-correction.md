INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid shape is:
{"title":"...","description":"...","tutorInstructions":"..."}

Markdown rules:
- title must be plain text.
- description and tutorInstructions must be Markdown content inside the JSON string values.
- Do not wrap the JSON response in markdown fences.
