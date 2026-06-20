INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid shape is:

{
  "id": "block_1",
  "item": { "kind": "...", "...": "..." }
}

Rules to preserve:
- The id must match ^[a-z][a-z0-9_-]*$.
- Use exactly one supported quiz item kind.
- The number of blanks must match the number of placeholders in fill-in-the-blank items.
- correctOptions must exist in options.
- correctPairs must cover all leftItems and rightItems.
- Return JSON only.
