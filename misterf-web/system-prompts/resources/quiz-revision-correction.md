INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid top-level shape is:

{
  "assistantMessage": "A short message to the teacher explaining what changed.",
  "draft": {
    "title": "...",
    "description": "...",
    "targetTopic": "...",
    "level": "...",
    "instructions": "...",
    "evaluationInstructions": "...",
    "sections": [
      {
        "id": "section_a",
        "title": "...",
        "instructions": "..."
      }
    ],
    "blocks": [
      {
        "id": "block_1",
        "sectionId": "section_a",
        "item": { "kind": "...", "...": "..." }
      }
    ]
  }
}

Rules to preserve:
- assistantMessage must be a concise teacher-facing message, not learner-facing quiz text.
- Every block id in draft.blocks must be unique and match ^[a-z][a-z0-9_-]*$.
- sections is optional grouping metadata; use an empty array when the quiz has no distinct parts.
- Every section id must be unique and match ^[a-z][a-z0-9_-]*$.
- Every block sectionId must match the id of one entry in draft.sections; omit sectionId for ungrouped blocks.
- Keep blocks of the same section adjacent, in the order the sections are declared, with ungrouped blocks first.
- Use only these supported quiz item kinds: quiz_open_text, quiz_translate_to_english, quiz_understand_in_spanish, quiz_fill_in_the_blank_input, quiz_fill_in_the_blank_choice, quiz_multiple_choice, quiz_matching_pairs, quiz_unscramble_sentence, quiz_order_sentences.
- Do not use quiz_true_false, quiz_ordering, short-answer, essay, or any other unsupported kind; rewrite unsupported items as one of the supported kinds.
- For quiz_order_sentences, provide sentences in the correct order. Do not pre-shuffle them, number them, or add letter labels.
- Preserve that this is an English-learning quiz: prompts may be in Spanish, but target learner output and accepted/correct answers must be English except for `quiz_understand_in_spanish`.
- For `quiz_understand_in_spanish`, the sentence must be English and acceptableAnswers must be Spanish explanations of the English meaning.
- Do not rewrite invalid items into exercises that grade Spanish grammar, Spanish writing style, or Spanish vocabulary as the target skill.
- The number of blanks must match the number of placeholders in fill-in-the-blank items.
- correctOptions must exist in options.
- correctPairs must cover all leftItems and rightItems.
- Return JSON only.
