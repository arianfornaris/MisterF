/** One completed turn in a finished dialogue recap. */
interface DialogueTranscriptTurn {
  /**
   * Optional registered avatar id for the speaker in this completed turn.
   *
   * Use this for fictional in-scene characters when their avatar is known from
   * the dialogue or can be chosen consistently from the available avatar list
   * below. Keep the same avatarId for every turn by the same speaker. Omit it
   * for learner labels when no in-scene learner character avatar was assigned.
   *
   * Available avatar ids:
   * {{DIALOGUE_AVATAR_OPTIONS}}
   */
  avatarId?: string;
  /** Fictional in-scene speaker name or learner label; use names/labels exactly as they appeared, but never Mr. F, the tutor, teacher, assistant, or AI as a scene speaker. */
  speaker: string;
  /** Exact completed line spoken by that speaker; preserve its original language. */
  markdown: string;
}

/**
 * A completed dialogue transcript.
 *
 * Use this only after the dialogue has clearly ended. Do not use it for a
 * partial dialogue or while the scene is still in progress. Include the full
 * dialogue as ordered turns with speaker names and exact lines. Speakers must
 * be fictional in-scene characters and the learner, never the tutor. Do not use
 * `Mr. F`, `Mr F`, `Mr. Fornaris`, `Fornaris`, `Tutor`, `Teacher`,
 * `Profesor`, `Maestro`, `Assistant`, or `AI` as a speaker.
 */
interface DialogueTranscriptBlock {
  /** Literal discriminator. */
  type: "dialogue_transcript";
  /** Full ordered dialogue recap. */
  turns: DialogueTranscriptTurn[];
}
