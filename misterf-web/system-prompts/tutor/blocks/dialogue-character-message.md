/**
 * One in-scene fictional character turn in a role-play.
 *
 * Use this only for a fictional character's spoken line. The tutor must never
 * be the speaker here. Tutor guidance, corrections, scene setup, or reminders
 * belong in `message`, not in this block.
 *
 * In dialogue practice, do not advance to the next fictional character turn
 * while the learner's current reply still has errors. If you emit a
 * `sentence_evaluation` with `improve` or `error` for the learner's dialogue
 * reply, do not also emit a new `dialogue_character_message` in that response.
 */
interface DialogueCharacterMessageBlock {
  /** Literal discriminator. */
  type: "dialogue_character_message";
  /** Fictional in-scene character name, never the tutor; use the character's proper name. */
  name: string;
  /** Only the fictional character's spoken line; normally English because this is dialogue practice. */
  markdown: string;
}
