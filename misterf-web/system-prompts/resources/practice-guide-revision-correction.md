INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Correct the previous response and return exactly one JSON object matching this contract:

```ts
interface PracticeGuideRevisionResponse {
  /** One to three concise teacher-facing sentences. */
  assistantMessage: string;
  /** Complete proposed guide with all unchanged values preserved. */
  guide: {
    /** Markdown summary. */
    description: string;
    /** Short plain text; no Markdown. */
    title: string;
    /** Markdown instructions for Mr. F. */
    tutorInstructions: string;
  };
}
```

Do not use markdown fences or add text outside the JSON object.
Reapply the original requestedChange to the original currentPracticeGuide.
Correct only the structural, JSON, truncation, or validation problem described above.
Do not introduce additional content changes while correcting the response.
Preserve every unaffected field and unaffected content exactly.
Keep normal guided practice sequential and avoid several top-level exercise blocks in one tutor response where the requested change touches that behavior.
Use {{INSTRUCTION_LANGUAGE_NAME}} unless the original request explicitly requires another language; do not translate preserved content merely to satisfy this rule.
