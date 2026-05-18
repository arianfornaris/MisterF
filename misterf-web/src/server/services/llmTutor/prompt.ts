import { renderSystemPrompt } from '../systemPrompts.js';
import type { TranslationMode } from './types.js';

export function buildAgentSystemInstruction(options: {
  chatRoomReport?: {
    chatRoomConversationId: string;
    reportSummaryDescription: string;
    reportSummaryTitle: string;
    roomDescription: string;
    roomTitle: string;
    slidesJson: string;
  } | null;
  practiceModule?: {
    description: string;
    title: string;
    tutorInstructions: string;
  } | null;
  currentTitle?: string;
  titleUpdatedByUser?: boolean;
}): string {
  const base = renderSystemPrompt('tutor/system.md', {
    CURRENT_TITLE: options.currentTitle || 'Nueva conversación',
    TITLE_RULE: options.titleUpdatedByUser
      ? 'The user has already changed this title manually. Do not include conversation_title.'
      : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
  });

  if (!options.practiceModule) {
    if (!options.chatRoomReport) {
      return base;
    }

    return [
      base,
      '',
      renderSystemPrompt('tutor/chatroom-report-context.md', {
        CHAT_ROOM_CONVERSATION_ID: options.chatRoomReport.chatRoomConversationId,
        REPORT_SLIDES_JSON: options.chatRoomReport.slidesJson,
        REPORT_SUMMARY_DESCRIPTION: options.chatRoomReport.reportSummaryDescription,
        REPORT_SUMMARY_TITLE: options.chatRoomReport.reportSummaryTitle,
        ROOM_DESCRIPTION: options.chatRoomReport.roomDescription,
        ROOM_TITLE: options.chatRoomReport.roomTitle,
      }),
    ].join('\n');
  }

  const sections = [
    base,
    '',
    renderSystemPrompt('tutor/practice-module-context.md', {
      PRACTICE_MODULE_DESCRIPTION: options.practiceModule.description,
      PRACTICE_MODULE_TITLE: options.practiceModule.title,
      PRACTICE_MODULE_TUTOR_INSTRUCTIONS: options.practiceModule.tutorInstructions,
    }),
  ];

  if (options.chatRoomReport) {
    sections.push(
      '',
      renderSystemPrompt('tutor/chatroom-report-context.md', {
        CHAT_ROOM_CONVERSATION_ID: options.chatRoomReport.chatRoomConversationId,
        REPORT_SLIDES_JSON: options.chatRoomReport.slidesJson,
        REPORT_SUMMARY_DESCRIPTION: options.chatRoomReport.reportSummaryDescription,
        REPORT_SUMMARY_TITLE: options.chatRoomReport.reportSummaryTitle,
        ROOM_DESCRIPTION: options.chatRoomReport.roomDescription,
        ROOM_TITLE: options.chatRoomReport.roomTitle,
      }),
    );
  }

  return sections.join('\n');
}

export function buildTranslatorSystemInstruction(mode: TranslationMode): string {
  const translationDirection =
    mode === 'es-en'
      ? 'Translate from Spanish to English.'
      : mode === 'en-es'
        ? 'Translate from English to Spanish.'
        : 'Detect whether the text is Spanish or English and translate it into the other language.';

  return renderSystemPrompt('tutor/translator.md', {
    TRANSLATION_DIRECTION: translationDirection,
  });
}
