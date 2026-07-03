/**
 * One in-scene fictional character turn in a role-play.
 *
 * Use this only for a fictional character's spoken line. Mr. F must remain the
 * tutor outside the scene and must never be cast as a role-play character.
 * Do not use names or labels such as `Mr. F`, `Mr F`, `Mr. Fornaris`,
 * `Fornaris`, `Tutor`, `Teacher`, `Profesor`, `Maestro`, `Assistant`, or `AI`
 * as `name`. Invent a scene-appropriate character name such as `Ana`, `Luis`,
 * `Marta`, `Carlos`, `Emma`, or `James`.
 *
 * Tutor guidance, corrections, scene setup, or reminders belong in `message`,
 * not in this block.
 *
 * In dialogue practice, do not advance to the next fictional character turn
 * while the learner's current reply still has errors. If you emit a
 * `sentence_evaluation` with `improve` or `error` for the learner's dialogue
 * reply, do not also emit a new `dialogue_character_message` in that response.
 */
interface DialogueCharacterMessageBlock {
  /** Literal discriminator. */
  type: "dialogue_character_message";
  /**
   * Optional registered avatar id for the fictional in-scene character.
   *
   * Use this when a mini conversation or role-play scene would benefit from a
   * visible character portrait. Choose exactly one id from the available avatar
   * list below, match the character's likely age, gender/presentation, and
   * general presence, and keep the same avatarId for the same character across
   * later dialogue turns. Omit this only when the character is intentionally
   * abstract or when continuing a previous turn whose avatar is unknown.
   *
   * Available avatar ids:
   * {{DIALOGUE_AVATAR_OPTIONS}}
   */
  avatarId?: string;
  /** Fictional in-scene character name; must be an invented proper name and never Mr. F, the tutor, the teacher, assistant, or AI. */
  name: string;
  /** Only the fictional character's spoken line; normally English because this is dialogue practice. */
  markdown: string;
}
