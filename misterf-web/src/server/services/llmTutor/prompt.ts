import { renderSystemPrompt } from '../systemPrompts.js';
import type { Locale } from '../../i18n/index.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
import { isGenericConversationTitle } from './conversationTitles.js';
import {
  conversationTitleLanguageRule,
  defaultInstructionLanguage,
  tutorSystemLanguagePlaceholders,
  type InstructionLanguage,
} from './languagePack.js';
import type { TranslationDirection } from './types.js';

export function buildAgentSystemInstruction(options: {
  learnerProfile?: {
    description: string;
    learningContext: string;
    name: string;
  } | null;
  tutorReport?: {
    reportJson: string;
    reportSummaryDescription: string;
    reportSummaryTitle: string;
    sourceConversationId: string;
  } | null;
  quizAttempt?: {
    quizDescription: string;
    quizSnapshotJson: string;
    quizTargetTopic: string;
    quizTitle: string;
    responsesJson: string;
    resultJson: string;
  } | null;
  roleplayAttempt?: {
    resultJson: string;
    roleplayDescription: string;
    roleplaySnapshotJson: string;
    roleplayTitle: string;
    turnsJson: string;
  } | null;
  practiceGuide?: {
    description: string;
    title: string;
    tutorInstructions: string;
  } | null;
  currentTitle?: string;
  instructionLanguage?: Locale;
  titleUpdatedByUser?: boolean;
  tutorPlanText?: string | null;
}): string {
  const currentTitle = options.currentTitle?.trim() || 'Nueva conversación';
  const instructionLanguage =
    options.instructionLanguage ?? defaultInstructionLanguage;
  const base = renderSystemPrompt('tutor/system.md', {
    ...tutorSystemLanguagePlaceholders(instructionLanguage),
    BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, instructionLanguage),
    CURRENT_TITLE: currentTitle,
    TITLE_RULE: buildConversationTitleRule({
      currentTitle,
      instructionLanguage,
      titleUpdatedByUser: Boolean(options.titleUpdatedByUser),
    }),
  });

  if (!options.practiceGuide) {
    if (
      !options.quizAttempt &&
      !options.roleplayAttempt &&
      !options.tutorReport &&
      !options.tutorPlanText
    ) {
      const sections = [base];
      appendLearnerProfileContext(sections, options.learnerProfile);
      return sections.join('\n');
    }

    const sections = [base];

    appendLearnerProfileContext(sections, options.learnerProfile);
    appendTutorPlanContext(sections, options.tutorPlanText);

    if (options.quizAttempt) {
      appendQuizAttemptContext(sections, options.quizAttempt);
    }

    if (options.roleplayAttempt) {
      appendRoleplayAttemptContext(sections, options.roleplayAttempt);
    }

    if (options.tutorReport) {
      sections.push(
        '',
        renderSystemPrompt('tutor/tutor-report-context.md', {
          REPORT_JSON: options.tutorReport.reportJson,
          REPORT_SUMMARY_DESCRIPTION: options.tutorReport.reportSummaryDescription,
          REPORT_SUMMARY_TITLE: options.tutorReport.reportSummaryTitle,
          SOURCE_CONVERSATION_ID: options.tutorReport.sourceConversationId,
        }),
      );
    }

    return sections.join('\n');
  }

  const sections = [
    base,
    '',
    renderSystemPrompt('tutor/practice-guide-context.md', {
      PRACTICE_GUIDE_DESCRIPTION: options.practiceGuide.description,
      PRACTICE_GUIDE_TITLE: options.practiceGuide.title,
      PRACTICE_GUIDE_TUTOR_INSTRUCTIONS: options.practiceGuide.tutorInstructions,
    }),
  ];

  appendLearnerProfileContext(sections, options.learnerProfile);
  appendTutorPlanContext(sections, options.tutorPlanText);

  if (options.quizAttempt) {
    appendQuizAttemptContext(sections, options.quizAttempt);
  }

  if (options.roleplayAttempt) {
    appendRoleplayAttemptContext(sections, options.roleplayAttempt);
  }

  if (options.tutorReport) {
    sections.push(
      '',
      renderSystemPrompt('tutor/tutor-report-context.md', {
        REPORT_JSON: options.tutorReport.reportJson,
        REPORT_SUMMARY_DESCRIPTION: options.tutorReport.reportSummaryDescription,
        REPORT_SUMMARY_TITLE: options.tutorReport.reportSummaryTitle,
        SOURCE_CONVERSATION_ID: options.tutorReport.sourceConversationId,
      }),
    );
  }

  return sections.join('\n');
}

function appendQuizAttemptContext(
  sections: string[],
  quizAttempt: {
    quizDescription: string;
    quizSnapshotJson: string;
    quizTargetTopic: string;
    quizTitle: string;
    responsesJson: string;
    resultJson: string;
  },
): void {
  sections.push(
    '',
    renderSystemPrompt('tutor/quiz-attempt-context.md', {
      QUIZ_DESCRIPTION: quizAttempt.quizDescription,
      QUIZ_SNAPSHOT_JSON: quizAttempt.quizSnapshotJson,
      QUIZ_TARGET_TOPIC: quizAttempt.quizTargetTopic,
      QUIZ_TITLE: quizAttempt.quizTitle,
      RESPONSES_JSON: quizAttempt.responsesJson,
      RESULT_JSON: quizAttempt.resultJson,
    }),
  );
}

function appendRoleplayAttemptContext(
  sections: string[],
  roleplayAttempt: {
    resultJson: string;
    roleplayDescription: string;
    roleplaySnapshotJson: string;
    roleplayTitle: string;
    turnsJson: string;
  },
): void {
  sections.push(
    '',
    renderSystemPrompt('tutor/roleplay-attempt-context.md', {
      RESULT_JSON: roleplayAttempt.resultJson,
      ROLEPLAY_DESCRIPTION: roleplayAttempt.roleplayDescription,
      ROLEPLAY_SNAPSHOT_JSON: roleplayAttempt.roleplaySnapshotJson,
      ROLEPLAY_TITLE: roleplayAttempt.roleplayTitle,
      TURNS_JSON: roleplayAttempt.turnsJson,
    }),
  );
}

function buildConversationTitleRule(input: {
  currentTitle: string;
  instructionLanguage: InstructionLanguage;
  titleUpdatedByUser: boolean;
}): string {
  if (input.titleUpdatedByUser) {
    return 'The user has already changed this title manually. Do not call update_conversation_title unless the learner explicitly asks to rename the conversation in the current turn; in that case call it once with reason "explicit_user_request".';
  }

  if (!isGenericConversationTitle(input.currentTitle)) {
    return 'The current title is already specific. Do not call update_conversation_title unless the learner explicitly asks to rename the conversation in the current turn; in that case call it once with reason "explicit_user_request".';
  }

  return [
    'The current title is generic. If the learner has provided a clear topic, purpose, exercise direction, scenario, or repeated practice thread, call update_conversation_title at most once with reason "initial_topic" before or while producing your response.',
    'If the conversation is still only a greeting or the purpose is genuinely unclear, do not call update_conversation_title until the first response where the purpose becomes clear.',
    'After any title update attempt in this response, do not call update_conversation_title again unless the learner explicitly asks to rename the conversation in a later turn.',
    conversationTitleLanguageRule(input.instructionLanguage),
  ].join(' ');
}

function appendLearnerProfileContext(
  sections: string[],
  learnerProfile?: {
    description: string;
    learningContext: string;
    name: string;
  } | null,
): void {
  if (!learnerProfile) {
    return;
  }

  const name = learnerProfile.name.trim();
  const description = learnerProfile.description.trim();
  const learningContext = learnerProfile.learningContext.trim();
  if (!name && !description && !learningContext) {
    return;
  }

  sections.push(
    '',
    renderSystemPrompt('tutor/profile-context.md', {
      PROFILE_DESCRIPTION: description || 'No especificada.',
      PROFILE_LEARNING_CONTEXT: learningContext || 'No especificado.',
      PROFILE_NAME: name || 'No especificado.',
    }),
  );
}

function appendTutorPlanContext(sections: string[], tutorPlanText?: string | null): void {
  const text = tutorPlanText?.trim();
  if (!text) {
    return;
  }

  sections.push(
    '',
    renderSystemPrompt('tutor/visible-plan-context.md', {
      TUTOR_PLAN_TEXT: text,
    }),
  );
}

export function buildTranslatorSystemInstruction(
  direction: TranslationDirection,
  languageName: string,
): string {
  const translationDirection =
    direction === 'to-english'
      ? `Translate from ${languageName} to English.`
      : direction === 'from-english'
        ? `Translate from English to ${languageName}.`
        : `Detect whether the text is ${languageName} or English and translate it into the other language.`;

  return renderSystemPrompt('tutor/translator.md', {
    TRANSLATION_DIRECTION: translationDirection,
  });
}
