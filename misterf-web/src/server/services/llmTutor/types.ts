export type TutorMessage = {
  role: 'user' | 'model';
  content: string;
};

export type LlmRequestOptions = {
  modelId?: string;
  modelTier?: 'advanced' | 'max' | 'regular';
  openRouterApiKey?: string | null;
  userId?: string;
};

export type LlmRequestTokenUsage = {
  contextWindowTokens: number;
  inputTokens: number;
  isEstimate: boolean;
  model: string;
  percentUsed: number;
  provider: string;
  reasoningTokens?: number;
  turn: number;
};

export type TutorMessageBlock = {
  type: 'message';
  markdown: string;
};

export type TutorPracticeModuleLinkBlock = {
  type: 'practice_module_link';
  practiceModuleId: string;
  label: string;
};

export type TutorDialogueCharacterMessageBlock = {
  type: 'dialogue_character_message';
  name: string;
  markdown: string;
};

export type TutorDialogueTranscriptBlock = {
  type: 'dialogue_transcript';
  turns: Array<{
    markdown: string;
    speaker: string;
  }>;
};

export type TutorMatchingPairsBlock = {
  type: 'matching_pairs';
  prompt?: string;
  pairs: Array<{
    left: string;
    right: string;
  }>;
};

export type TutorTranslateToEnglishPromptBlock = {
  type: 'translate_to_english_prompt';
  sentence: string;
};

export type TutorUnderstandInSpanishPromptBlock = {
  type: 'understand_in_spanish_prompt';
  sentence: string;
};

export type TutorFillInTheBlankInputBlock = {
  type: 'fill_in_the_blank_input';
  prompt?: string;
  sentence: string;
};

export type TutorFillInTheBlankChoiceBlock = {
  type: 'fill_in_the_blank_choice';
  prompt?: string;
  sentence: string;
  blanks: Array<{
    answers: string[];
    choices: string[];
  }>;
};

export type TutorMultipleChoiceBlock = {
  type: 'multiple_choice';
  prompt?: string;
  question: string;
  selectionMode: 'single' | 'multiple';
  options: Array<{
    isCorrect: boolean;
    text: string;
  }>;
};

export type TutorUnscrambleSentenceBlock = {
  type: 'unscramble_sentence';
  prompt?: string;
  tokens: string[];
};

export type TutorPlanStepStatus = 'active' | 'done' | 'pending';

export type TutorPlanBlock = {
  type: 'tutor_plan';
  title: string;
  summary?: string;
  steps: Array<{
    id: string;
    label: string;
    status: TutorPlanStepStatus;
  }>;
};

export type TutorPlanUpdateOperation =
  | {
      action: 'update_step';
      id: string;
      label?: string;
      status?: TutorPlanStepStatus | 'skipped';
    }
  | {
      action: 'add_step';
      afterId?: string;
      id: string;
      label: string;
      status?: 'active' | 'pending';
    };

export type TutorPlanUpdateBlock = {
  type: 'tutor_plan_update';
  operations: TutorPlanUpdateOperation[];
};

export type TutorQuizItemOpenText = {
  kind: 'quiz_open_text';
  prompt: string;
  placeholder?: string;
  rubric?: string;
};

export type TutorQuizItemTranslateToEnglish = {
  kind: 'quiz_translate_to_english';
  prompt: string;
  sentence: string;
  acceptableAnswers?: string[];
  rubric?: string;
};

export type TutorQuizItemUnderstandInSpanish = {
  kind: 'quiz_understand_in_spanish';
  prompt: string;
  sentence: string;
  acceptableAnswers?: string[];
  rubric?: string;
};

export type TutorQuizItemFillInTheBlankInput = {
  kind: 'quiz_fill_in_the_blank_input';
  prompt: string;
  sentence: string;
  blanks: Array<{
    acceptableAnswers?: string[];
    rubric?: string;
  }>;
};

export type TutorQuizItemFillInTheBlankChoice = {
  kind: 'quiz_fill_in_the_blank_choice';
  prompt: string;
  sentence: string;
  blanks: Array<{
    acceptableAnswers?: string[];
    choices: string[];
    rubric?: string;
  }>;
};

export type TutorQuizItemMultipleChoice = {
  kind: 'quiz_multiple_choice';
  prompt: string;
  selectionMode: 'single' | 'multiple';
  options: string[];
  correctOptions: string[];
  rubric?: string;
};

export type TutorQuizItemMatchingPairs = {
  kind: 'quiz_matching_pairs';
  prompt: string;
  leftItems: string[];
  rightItems: string[];
  correctPairs: Array<{
    left: string;
    right: string;
  }>;
  rubric?: string;
};

export type TutorQuizItemUnscrambleSentence = {
  kind: 'quiz_unscramble_sentence';
  prompt: string;
  tokens: string[];
  acceptableAnswers?: string[];
  rubric?: string;
};

export type TutorQuizItem =
  | TutorQuizItemOpenText
  | TutorQuizItemTranslateToEnglish
  | TutorQuizItemUnderstandInSpanish
  | TutorQuizItemFillInTheBlankInput
  | TutorQuizItemFillInTheBlankChoice
  | TutorQuizItemMultipleChoice
  | TutorQuizItemMatchingPairs
  | TutorQuizItemUnscrambleSentence;

export type TutorQuizBlock = {
  type: 'quiz';
  title?: string;
  prompt: string;
  rubric?: string;
  items: TutorQuizItem[];
};

export type TutorQuizResultItemOpenText = {
  kind: 'quiz_open_text';
  prompt: string;
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    parts: TutorSentenceEvaluationBlock['parts'];
  };
  userResponse: {
    text: string;
  };
};

export type TutorQuizResultItemTranslateToEnglish = {
  kind: 'quiz_translate_to_english';
  prompt: string;
  sentence: string;
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    parts: TutorSentenceEvaluationBlock['parts'];
  };
  userResponse: {
    text: string;
  };
};

export type TutorQuizResultItemUnderstandInSpanish = {
  kind: 'quiz_understand_in_spanish';
  prompt: string;
  sentence: string;
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    parts: TutorSentenceEvaluationBlock['parts'];
  };
  userResponse: {
    text: string;
  };
};

export type TutorQuizResultItemFillInTheBlankInput = {
  kind: 'quiz_fill_in_the_blank_input';
  prompt: string;
  sentence: string;
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    blanks: Array<{
      explanation?: string;
      status: 'correct' | 'improve' | 'error';
    }>;
  };
  userResponse: {
    completedSentence?: string;
    values: string[];
  };
};

export type TutorQuizResultItemFillInTheBlankChoice = {
  kind: 'quiz_fill_in_the_blank_choice';
  prompt: string;
  sentence: string;
  blanks: Array<{
    choices: string[];
  }>;
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    blanks: Array<{
      explanation?: string;
      status: 'correct' | 'improve' | 'error';
    }>;
  };
  userResponse: {
    completedSentence?: string;
    values: string[];
  };
};

export type TutorQuizResultItemMultipleChoice = {
  kind: 'quiz_multiple_choice';
  prompt: string;
  selectionMode: 'single' | 'multiple';
  options: string[];
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    options: Array<{
      explanation?: string;
      selectedByUser: boolean;
      status: 'correct' | 'neutral' | 'missed' | 'error';
      text: string;
    }>;
  };
  userResponse: {
    selectedOptions: string[];
  };
};

export type TutorQuizResultItemMatchingPairs = {
  kind: 'quiz_matching_pairs';
  prompt: string;
  leftItems: string[];
  rightItems: string[];
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    pairs: Array<{
      explanation?: string;
      left: string;
      right: string;
      status: 'correct' | 'error';
    }>;
  };
  userResponse: {
    pairs: Array<{
      left: string;
      right: string;
    }>;
  };
};

export type TutorQuizResultItemUnscrambleSentence = {
  kind: 'quiz_unscramble_sentence';
  prompt: string;
  tokens: string[];
  evaluation: {
    feedback: string;
    status: 'correct' | 'incorrect' | 'partial';
  };
  inlineReview?: {
    parts: TutorSentenceEvaluationBlock['parts'];
  };
  userResponse: {
    selectedTokens: string[];
    sentence?: string;
  };
};

export type TutorQuizResultItem =
  | TutorQuizResultItemOpenText
  | TutorQuizResultItemTranslateToEnglish
  | TutorQuizResultItemUnderstandInSpanish
  | TutorQuizResultItemFillInTheBlankInput
  | TutorQuizResultItemFillInTheBlankChoice
  | TutorQuizResultItemMultipleChoice
  | TutorQuizResultItemMatchingPairs
  | TutorQuizResultItemUnscrambleSentence;

export type TutorQuizResultBlock = {
  type: 'quiz_result';
  title?: string;
  prompt?: string;
  items: TutorQuizResultItem[];
};

export type TutorSentenceEvaluationBlock = {
  type: 'sentence_evaluation';
  sourceText: string;
  parts: Array<{
    explanation?: string;
    status: 'correct' | 'improve' | 'error';
    text: string;
  }>;
};

export type TutorConversationTitleBlock = {
  title: string;
  type: 'conversation_title';
};

export type TutorResponseBlock =
  | TutorMessageBlock
  | TutorPracticeModuleLinkBlock
  | TutorDialogueCharacterMessageBlock
  | TutorDialogueTranscriptBlock
  | TutorMatchingPairsBlock
  | TutorQuizBlock
  | TutorQuizResultBlock
  | TutorTranslateToEnglishPromptBlock
  | TutorUnderstandInSpanishPromptBlock
  | TutorFillInTheBlankInputBlock
  | TutorFillInTheBlankChoiceBlock
  | TutorMultipleChoiceBlock
  | TutorUnscrambleSentenceBlock
  | TutorPlanBlock
  | TutorPlanUpdateBlock
  | TutorSentenceEvaluationBlock
  | TutorConversationTitleBlock;

export type TutorAgentResponseBlock = Exclude<TutorResponseBlock, TutorQuizResultBlock>;

export type TutorResponseValidator = (blocks: TutorAgentResponseBlock[]) => void;

export type TutorAgentResult = {
  blocks: TutorAgentResponseBlock[];
  content: string;
  model: string;
  provider: string;
};

export type TranslationMode = 'auto' | 'es-en' | 'en-es';

export type TranslationResult = {
  detectedLanguage: string;
  model: string;
  provider: string;
  translatedText: string;
};
