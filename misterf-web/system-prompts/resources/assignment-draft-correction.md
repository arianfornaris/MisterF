INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid top-level shape is:

{
  "title": "...",
  "description": "...",
  "targetTopic": "...",
  "level": "...",
  "instructions": "...",
  "blocks": [
    {
      "id": "block_1",
      "item": { "kind": "...", "...": "..." }
    }
  ]
}

Rules to preserve:
- Every block id must be unique and match ^[a-z][a-z0-9_-]*$.
- Use only supported quiz item kinds.
- The number of blanks must match the number of placeholders in fill-in-the-blank items.
- correctOptions must exist in options.
- correctPairs must cover all leftItems and rightItems.
- Return JSON only.
