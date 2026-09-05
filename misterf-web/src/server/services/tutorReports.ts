import { generateText, type ModelMessage } from 'ai';
import { readAttachmentDigests } from '../attachments/persistence.js';
import { buildUserContentWithAttachments } from '../attachments/modelParts.js';
import {
  defaultProfileModelTier,
  type ProfileModelTier,
} from '../profiles/modelTier.js';
import type { Locale } from '../i18n/index.js';
import { z } from 'zod';
import type {
  StoredMessage,
  StoredTutorConversationReport,
  StoredTutorConversationReportData,
} from '../db/repository.js';
import {
  logLlmInvalidRawResponse,
  logLlmRequest,
  logLlmCost,
  logLlmResponse,
  shouldLogFullLlmTrace,
} from './llmTutor/logging.js';
import {
  getLanguageModel,
  getProviderOptions,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import { renderSystemPrompt } from './systemPrompts.js';
import { isCreditExhaustedError } from './creditGate.js';
import { instructionLanguageEnglishName } from './llmTutor/languagePack.js';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { logger } from './logger.js';

const maxTutorReportGenerationTurns = 4;

const tutorConversationReportSchema = z
  .object({
    report: z
      .object({
        difficultyAreas: z
          .array(
            z
              .object({
                description: z.string().trim().min(1).max(1600),
                title: z.string().trim().min(1).max(180),
              })
              .strict(),
          )
          .max(8),
        nextSteps: z.array(z.string().trim().min(1).max(500)).max(10),
        practicedTopics: z.array(z.string().trim().min(1).max(300)).max(12),
        progressHighlights: z.array(z.string().trim().min(1).max(500)).max(10),
        recommendations: z.array(z.string().trim().min(1).max(700)).max(10),
        summary: z
          .object({
            description: z.string().trim().min(1).max(4000),
            title: z.string().trim().min(1).max(220),
          })
          .strict(),
        usefulPhrases: z.array(z.string().trim().min(1).max(300)).max(20),
        vocabulary: z
          .array(
            z
              .object({
                example: z.string().trim().min(1).max(500).optional(),
                meaning: z.string().trim().min(1).max(500),
                term: z.string().trim().min(1).max(160),
              })
              .strict(),
          )
          .max(24),
      })
      .strict(),
  })
  .strict();

function logTutorReportEvent(
  event: string,
  details: Record<string, unknown>,
): void {
  const logEvent = `tutor_report_${event.replace(/[^a-z0-9]+/gi, '_')}`;
  const payload = sanitizeTutorReportLogDetails({
    ...details,
    tutorReportEvent: event,
  });

  if (event.endsWith(':error')) {
    logger.error(logEvent, payload);
    return;
  }

  if (event.includes('structured-correction')) {
    logger.info(logEvent, payload);
    return;
  }

  if (event.includes('schema-mismatch')) {
    logger.warn(logEvent, payload);
    return;
  }

  logger.debug(logEvent, payload);
}

function sanitizeTutorReportLogDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  if (shouldLogFullLlmTrace()) {
    return details;
  }

  const sanitized = { ...details };
  delete sanitized.userName;
  return sanitized;
}

/**
 * Builds the transcript the report is written from.
 *
 * Attachments are included: a document the learner attached is still live
 * context for the tutor, so a report that cannot see it would summarize a
 * conversation without knowing what it was about. The report is not obliged to
 * mention it — the model decides what matters — but it must be able to.
 */
function formatTutorTranscript(messages: StoredMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? 'Learner' : 'Mister F';
      const content = buildUserContentWithAttachments({
        attachments: readAttachmentDigests(message.metadata?.attachments),
        text: message.content,
      });
      return `${speaker}: ${content}`;
    })
    .join('\n\n');
}

function appendStructuredCorrectionRequest(
  messages: ModelMessage[],
  input: {
    instructionLanguage?: Locale;
    invalidOutput?: string | null;
    promptPath: string;
    reason: string;
    turn: number;
  },
): void {
  const invalidOutput = input.invalidOutput?.trim();
  if (invalidOutput) {
    messages.push({
      content: invalidOutput.slice(0, 10000),
      role: 'assistant',
    });
  }

  messages.push({
    content: renderSystemPrompt(input.promptPath, {
      CORRECTION_REASON: input.reason,
      INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(
        input.instructionLanguage ?? 'es',
      ),
    }),
    role: 'user',
  });

  logTutorReportEvent('structured-correction-requested', {
    hadInvalidOutput: Boolean(invalidOutput),
    promptPath: input.promptPath,
    reason: input.reason,
    turn: input.turn,
  });
}

export async function generateTutorConversationReport(input: {
  instructionLanguage?: Locale;
  messages: StoredMessage[];
  modelTier?: ProfileModelTier;
  openRouterApiKey?: string | null;
  userName: string;
}): Promise<{
  report: StoredTutorConversationReportData;
  summaryDescription: string;
  summaryTitle: string;
}> {
  // Profile-configured model, like every other inference.
  const tier = input.modelTier ?? defaultProfileModelTier;
  const system = renderSystemPrompt('tutor/conversation-report.md', {
    INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(
      input.instructionLanguage ?? 'es',
    ),
  });
  const messages: ModelMessage[] = [
    {
      content: [
        `Learner name: ${input.userName}`,
        '',
        'Full Mister F conversation transcript:',
        formatTutorTranscript(input.messages) || '(empty)',
      ].join('\n'),
      role: 'user',
    },
  ];

  // Keeps the provider's error when every turn fails, so a credit refusal is
  // reported as such rather than as a generic report failure.
  let lastRequestError: unknown;

  logTutorReportEvent('report:start', {
    hasOpenRouterKey: Boolean(input.openRouterApiKey),
    messageCount: input.messages.length,
    userName: input.userName,
  });

  for (let turn = 0; turn < maxTutorReportGenerationTurns; turn += 1) {
    const turnNumber = turn + 1;
    try {
      logLlmRequest(
        messages,
        system,
        {
          actorLabel: 'Tutor report',
          llm: {
            modelTier: tier,
            openRouterApiKey: input.openRouterApiKey,
          },
          operation: 'tutor_report',
        },
        turnNumber,
      );

      const result = await generateText({
        messages,
        model: getLanguageModel({
          modelTier: tier,
          openRouterApiKey: input.openRouterApiKey,
        }),
        providerOptions: getProviderOptions(),
        system,
        temperature: shouldUseTemperature({ modelTier: tier }) ? 0.4 : undefined,
      });

      logLlmResponse(
        result.text,
        result.finishReason,
        result.usage,
        result.providerMetadata,
        turnNumber,
        {
          actorLabel: 'Tutor report',
          operation: 'tutor_report',
        },
      );
      logLlmCost({
        context: {
          actorLabel: 'Tutor report',
          llm: { modelTier: tier, openRouterApiKey: input.openRouterApiKey },
          operation: 'tutor_report',
        },
        finishReason: result.finishReason,
        providerMetadata: result.providerMetadata,
        usage: result.usage,
      });

      let parsedSource: unknown;
      try {
        parsedSource = parseJsonFromModelText(result.text);
      } catch (error) {
        logLlmInvalidRawResponse({
          actorLabel: 'Tutor report',
          error,
          operation: 'tutor_report',
          rawText: result.text,
          turn: turnNumber,
        });
        if (turn < maxTutorReportGenerationTurns - 1) {
          appendStructuredCorrectionRequest(messages, {
            instructionLanguage: input.instructionLanguage,
            invalidOutput: result.text,
            promptPath: 'tutor/conversation-report-correction.md',
            reason: 'Your previous response was not valid JSON because it was truncated or malformed.',
            turn: turnNumber,
          });
        }
        continue;
      }

      const parsed = tutorConversationReportSchema.safeParse(parsedSource);
      if (!parsed.success) {
        logTutorReportEvent('report:schema-mismatch', {
          issues: parsed.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join('.'),
          })),
          turn: turnNumber,
        });
        if (turn < maxTutorReportGenerationTurns - 1) {
          appendStructuredCorrectionRequest(messages, {
            instructionLanguage: input.instructionLanguage,
            invalidOutput: result.text,
            promptPath: 'tutor/conversation-report-correction.md',
            reason: 'Your previous JSON did not match the required schema for the tutor conversation report.',
            turn: turnNumber,
          });
        }
        continue;
      }

      const report = parsed.data.report;
      return {
        report: {
          difficultyAreas: report.difficultyAreas,
          nextSteps: report.nextSteps,
          practicedTopics: report.practicedTopics,
          progressHighlights: report.progressHighlights,
          recommendations: report.recommendations,
          usefulPhrases: report.usefulPhrases,
          vocabulary: report.vocabulary,
        },
        summaryDescription: report.summary.description,
        summaryTitle: report.summary.title,
      };
    } catch (error) {
      logTutorReportEvent('report:error', {
        error: error instanceof Error ? error.message : String(error),
        turn: turnNumber,
      });
      lastRequestError = error;
      // A provider refusal (no credit, or a max_tokens the key cannot afford)
      // fails identically on every retry, so stop instead of burning the loop,
      // and let the caller classify the original error.
      if (isCreditExhaustedError(error)) {
        throw error;
      }
    }
  }

  // Surface the provider's own error when the call never succeeded; the generic
  // message below would otherwise hide a credit problem behind
  // "unexpected error".
  if (lastRequestError !== undefined) {
    throw lastRequestError;
  }

  throw new Error('Could not generate a valid tutor conversation report.');
}
