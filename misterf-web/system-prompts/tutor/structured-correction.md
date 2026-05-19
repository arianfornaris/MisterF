INTERNAL APP CONTINUATION.

{{CORRECTION_REASON}}
Do not respond with explanations, apologies, loose markdown, or any text before or after the JSON object.
Re-emit the complete response as one JSON object that exactly satisfies the TutorResponse contract.
The only valid block types are: message, practice_module_link, dialogue_character_message, dialogue_transcript, matching_pairs, quiz, translate_to_english_prompt, understand_in_spanish_prompt, fill_in_the_blank_input, fill_in_the_blank_choice, multiple_choice, unscramble_sentence, sentence_evaluation, conversation_title.
Do not place fictional dialogue lines, exercise payloads, prompt sentences, answer options, or any other structured learner task inside a plain `message` block. Re-emit those items only in their proper block types.
Do not simulate those block types inside `message` using plain text or markdown formatting. For example, do not fake dialogue with `Name: ...`, do not fake blanks with `___` or `{{blank}}`, and do not fake exercise options or token lists inside `message`.
