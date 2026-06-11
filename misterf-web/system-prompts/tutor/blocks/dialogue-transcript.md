/** One completed turn in a finished dialogue recap. */
interface DialogueTranscriptTurn {
  /** Fictional in-scene speaker name or learner label; use names/labels exactly as they appeared. */
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
 * be fictional in-scene characters and the learner, never the tutor.
 */
interface DialogueTranscriptBlock {
  /** Literal discriminator. */
  type: "dialogue_transcript";
  /** Full ordered dialogue recap. */
  turns: DialogueTranscriptTurn[];
}
