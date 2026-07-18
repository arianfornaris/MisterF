INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Correct the previous response and return exactly one JSON object matching this contract:

```ts
interface QuizBlockRevisionResponse {
  /** The complete revised item; its kind must equal the original requestedKind. */
  item: QuizItem;
}
```

Do not use markdown fences or add text outside the JSON object.
Fulfill the original requestedChange again: revise the original currentItem when it was present, or create the requested new item when it was absent.
Correct only the structural, JSON, truncation, or validation problem described above.
The returned item.kind must equal the original requestedKind exactly.
Keep the learner's target output in English and keep the item self-contained for automatic evaluation.
Do not add, invent, or reference other items, sections, or block numbers.
Use {{INSTRUCTION_LANGUAGE_NAME}} for learner-facing text unless the original request explicitly requires another language.
