INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Correct the previous response and return exactly one JSON object matching this contract:

```ts
interface QuizBlocksRevisionResponse {
  blocks: QuizBlock[];
  sections: QuizSection[];
}
```

Do not use markdown fences or add text outside the JSON object.
Reapply the original requestedChange to the original currentBlocks and currentSections.
Correct only the structural, JSON, truncation, or validation problem described above.
Return the complete revised block and section lists, not a diff, and do not return metadata fields.
Every block sectionId must match a declared section id; every section must keep at least one block; keep at least one block overall; ids must be unique.
Preserve the ids of blocks and sections that stay the same.
Keep the learner's target output in English and use {{INSTRUCTION_LANGUAGE_NAME}} for learner-facing text unless the original request explicitly requires another language.
