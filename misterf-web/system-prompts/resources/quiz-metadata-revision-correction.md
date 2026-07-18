INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Correct the previous response and return exactly one JSON object matching this contract:

```ts
interface QuizMetadataRevisionResponse {
  /** Complete proposed metadata with all unchanged values preserved. */
  metadata: {
    /** Short plain text; no Markdown. */
    title: string;
    /** Plain-text teacher-facing summary. May be empty. */
    description: string;
    /** Grammar point, vocabulary, or theme. May be empty. */
    targetTopic: string;
    /** Learner level; free text. May be empty. */
    level: string;
    /** Learner-facing instructions. May be empty. */
    instructions: string;
    /** Private grading guidance for the AI evaluator. May be empty. */
    evaluationInstructions: string;
  };
}
```

Do not use markdown fences or add text outside the JSON object.
Reapply the original requestedChange to the original currentMetadata.
Correct only the structural, JSON, truncation, or validation problem described above.
Do not introduce additional content changes while correcting the response.
Preserve every unaffected field and unaffected content exactly.
Do not add, invent, or reference quiz blocks, questions, or sections.
Use {{INSTRUCTION_LANGUAGE_NAME}} unless the original request explicitly requires another language; do not translate preserved content merely to satisfy this rule.
