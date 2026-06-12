INTERNAL APP CONTINUATION.

{{CORRECTION_REASON}}
Do not respond with explanations, apologies, loose markdown, or any text before or after the JSON object.
Re-emit the complete response as one JSON object that exactly satisfies the TutorResponse contract.
The only valid block types are: message, practice_module_link, dialogue_character_message, dialogue_transcript, matching_pairs, quiz, translate_to_english_prompt, understand_in_spanish_prompt, fill_in_the_blank_input, fill_in_the_blank_choice, multiple_choice, unscramble_sentence, tutor_plan, tutor_plan_update, sentence_evaluation, conversation_title.
Follow the block protocol JSDoc below as the source of truth for block-specific boundaries.
Do not hide typed block payloads inside `message`; split tutor prose and learner tasks into their proper blocks.

TutorResponse contract:

```ts
interface TutorResponse {
  /** Ordered visible response blocks to render in the tutor chat. */
  blocks: TutorResponseBlock[];
}

{{BLOCK_PROTOCOL}}
```
