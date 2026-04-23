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
  turn: number;
};

export type TutorMessageBlock = {
  type: 'message';
  markdown: string;
};

export type TutorChallengeStartedBlock = {
  type: 'challenge_started';
} & (
  | {
      challengeType?: 'produce_en' | 'understand_en';
      level?: string;
      objective?: string;
      sourceSentence: string;
      topic?: string;
    }
  | {
      challengeType: 'dialogue_scene';
      dialogue: {
        characterName: string;
        characterRole: string;
        goals: string[];
        learnerRole: string;
        scenario: string;
      };
      level?: string;
      objective?: string;
      topic?: string;
    }
);

export type TutorCharacterMessageBlock = {
  type: 'character_message';
  name: string;
  markdown: string;
};

export type TutorDialogueProgressBlock = {
  type: 'dialogue_progress';
  completedGoals: string[];
};

export type TutorSentenceEvaluationBlock = {
  type: 'sentence_evaluation';
  parts: Array<{
    explanation?: string;
    status: 'correct' | 'improve' | 'error';
    text: string;
  }>;
};

export type TutorChallengeCompletedBlock = {
  type: 'challenge_completed';
  score: number;
};

export type TutorConversationTitleBlock = {
  title: string;
  type: 'conversation_title';
};

export type TutorResponseBlock =
  | TutorMessageBlock
  | TutorChallengeStartedBlock
  | TutorCharacterMessageBlock
  | TutorDialogueProgressBlock
  | TutorSentenceEvaluationBlock
  | TutorChallengeCompletedBlock
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

export type GeneratedProgressResult = {
  markdown: string;
  model: string;
  provider: string;
};

export type GeneratedVocabularyItem = {
  example?: string;
  explanation: string;
  sourceSentence?: string;
  term: string;
  translation: string;
};

export type GeneratedVocabularyResult = {
  items: GeneratedVocabularyItem[];
  model: string;
  provider: string;
};
