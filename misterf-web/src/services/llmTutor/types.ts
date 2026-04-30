export type TutorMessage = {
  role: 'user' | 'model';
  content: string;
};

export type LlmRequestOptions = {
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
  blanks: Array<{
    answers: string[];
  }>;
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
  answers: string[];
};

export type TutorSentenceEvaluationBlock = {
  type: 'sentence_evaluation';
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
  | TutorDialogueCharacterMessageBlock
  | TutorDialogueTranscriptBlock
  | TutorMatchingPairsBlock
  | TutorTranslateToEnglishPromptBlock
  | TutorUnderstandInSpanishPromptBlock
  | TutorFillInTheBlankInputBlock
  | TutorFillInTheBlankChoiceBlock
  | TutorMultipleChoiceBlock
  | TutorUnscrambleSentenceBlock
  | TutorSentenceEvaluationBlock
  | TutorConversationTitleBlock;

export type TutorResponseValidator = (blocks: TutorResponseBlock[]) => void;

export type TutorAgentResult = {
  blocks: TutorResponseBlock[];
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
