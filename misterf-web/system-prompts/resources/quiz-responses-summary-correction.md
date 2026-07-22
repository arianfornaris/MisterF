INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Correct the previous response and return exactly one JSON object matching this contract:

```ts
interface QuizResponsesSummaryResponse {
  /** Short Markdown summary for the quiz owner. Brief prose, at most one short list, no headings. */
  summary: string;
}
```

Do not use markdown fences or add text outside the JSON object.
Base the summary only on the tallies in the original request; do not invent numbers or details.
Correct only the structural, JSON, truncation, or validation problem described above.
Write the summary in {{INSTRUCTION_LANGUAGE_NAME}}.
