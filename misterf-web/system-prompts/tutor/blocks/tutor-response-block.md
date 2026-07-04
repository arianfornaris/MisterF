type TutorResponseBlock =
  | MessageBlock
  | DialogueCharacterMessageBlock
  | DialogueTranscriptBlock
  | MatchingPairsBlock
  | QuizBlock{{TRANSLATION_UNION_MEMBERS}}
  | OpenTextPromptBlock
  | FillInTheBlankInputBlock
  | FillInTheBlankChoiceBlock
  | MultipleChoiceBlock
  | UnscrambleSentenceBlock
  | OrderSentencesBlock
  | TutorPlanBlock
  | TutorPlanUpdateBlock
  | SentenceEvaluationBlock;
