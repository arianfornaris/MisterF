import { renderSystemPrompt } from '../systemPrompts.js';
import { renderTutorBlockProtocol } from './blockProtocol.js';
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
  tutorReport?: {
    reportJson: string;
    reportSummaryDescription: string;
    reportSummaryTitle: string;
    sourceConversationId: string;
  } | null;
  practiceModule?: {
    description: string;
    title: string;
    tutorInstructions: string;
  } | null;
  currentTitle?: string;
  titleUpdatedByUser?: boolean;
  tutorPlanText?: string | null;
}): string {
  const base = renderTutorSystemPrompt({
    BLOCK_PROTOCOL: renderTutorBlockProtocol(),
    CURRENT_TITLE: options.currentTitle || 'Nueva conversación',
    TITLE_RULE: options.titleUpdatedByUser
      ? 'The user has already changed this title manually. Do not include conversation_title.'
      : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
  });

  if (!options.practiceModule) {
    if (!options.chatRoomReport && !options.tutorReport && !options.tutorPlanText) {
      return base;
    }

    const sections = [base];

    appendTutorPlanContext(sections, options.tutorPlanText);

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
    renderSystemPrompt('tutor/practice-module-context.md', {
      PRACTICE_MODULE_DESCRIPTION: options.practiceModule.description,
      PRACTICE_MODULE_TITLE: options.practiceModule.title,
      PRACTICE_MODULE_TUTOR_INSTRUCTIONS: options.practiceModule.tutorInstructions,
    }),
  ];

  appendTutorPlanContext(sections, options.tutorPlanText);

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

function renderTutorSystemPrompt(placeholders: Record<string, string>): string {
  const rendered = renderSystemPrompt('tutor/system.md', placeholders);

  if (rendered.includes(placeholders.BLOCK_PROTOCOL)) {
    return rendered;
  }

  const startMarker = '## Structured Response Protocol';
  const endMarker = '## Practical Guidance';
  const startIndex = rendered.indexOf(startMarker);
  const endIndex = rendered.indexOf(endMarker, startIndex);

  if (startIndex === -1 || endIndex === -1) {
    return rendered;
  }

  const protocolSection = [
    startMarker,
    '',
    'You must always respond with exactly one JSON object and nothing else.',
    '',
    '```ts',
    'interface TutorResponse {',
    '  /** Ordered visible response blocks to render in the tutor chat. */',
    '  blocks: TutorResponseBlock[];',
    '}',
    '',
    placeholders.BLOCK_PROTOCOL,
    '```',
    '',
  ].join('\n');

  return [
    rendered.slice(0, startIndex),
    protocolSection,
    rendered.slice(endIndex),
  ].join('');
}
