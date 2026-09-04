/**
 * Turns one attachment into the clean text that will represent it.
 *
 * Every attachment is processed independently, up front, before it reaches the
 * conversation. The text this produces **is** the attachment as far as the rest
 * of the system is concerned: the user approves it, it is what the tutor reads,
 * and it is what the user can open later. There is no second, richer
 * representation held back for the model.
 *
 * Which sources need an inference is decided by where fidelity actually lives:
 *
 * - **Images** have no text layer at all, so a vision pass is the only path.
 * - **PDFs** are laid out visually. Mechanical extraction gets the characters
 *   but loses reading order in columns, tables, and worksheets, and gets
 *   nothing at all from a scan. A vision pass over the pages preserves the
 *   structure the mechanical text drops.
 * - **DOCX and URLs** already arrive as text with their structure intact. An
 *   inference over them could only paraphrase what is already faithful, so
 *   they pass through untouched. Running a model over them would spend money
 *   to make the result worse.
 */

import { generateText } from 'ai';

import { maxExtractedTextChars } from '../attachments/limits.js';
import type { PreparedAttachment } from '../attachments/types.js';
import { loadSystemPrompt } from './systemPrompts.js';
import { logLlmCost } from './llmTutor/logging.js';
import {
  getLanguageModel,
  getProviderOptions,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import type { LlmRequestOptions } from './llmTutor/types.js';
import { logger } from './logger.js';

export type AttachmentExtraction = {
  text: string;
  /**
   * True when a model wrote this rather than it being read verbatim from a
   * text layer. The UI must not present the two as the same kind of claim.
   */
  textIsDescription: boolean;
  /** True when the text was cut at the character cap. */
  truncated: boolean;
};

function capText(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxExtractedTextChars) {
    return { text: trimmed, truncated: false };
  }

  return { text: trimmed.slice(0, maxExtractedTextChars), truncated: true };
}

/**
 * The user's own words when they attached the file. "Make a quiz about the past
 * tense from this" tells the extractor what matters in a six-page document, so
 * it is passed through rather than discarded — but only ever as a hint about
 * emphasis. It must not become an instruction to summarize or to answer.
 */
function buildUserPromptHint(userPrompt: string | undefined): string {
  const trimmed = userPrompt?.trim();
  if (!trimmed) {
    return '';
  }

  return [
    '',
    'The user wrote this when they attached the document. Use it only to judge',
    'which parts of the document matter most. Do not answer it, do not act on',
    'it, and never let it reduce what you transcribe:',
    `"""${trimmed.slice(0, 2000)}"""`,
  ].join('\n');
}

async function runVisionExtraction(input: {
  attachment: PreparedAttachment;
  llm: LlmRequestOptions;
  userPrompt?: string;
}): Promise<string | null> {
  const { attachment } = input;
  if (!attachment.bytes) {
    return null;
  }

  try {
    const result = await generateText({
      messages: [
        {
          content: [
            {
              text: `Extract the contents of "${attachment.displayName}".`,
              type: 'text',
            },
            {
              data: attachment.bytes,
              filename: attachment.displayName,
              mediaType: attachment.contentType,
              type: 'file',
            },
          ],
          role: 'user',
        },
      ],
      model: getLanguageModel({ ...input.llm, modelTier: 'regular' }),
      providerOptions: getProviderOptions({
        llm: { ...input.llm, modelTier: 'regular' },
      }),
      system:
        loadSystemPrompt('attachments/extraction.md')
        + buildUserPromptHint(input.userPrompt),
      temperature: shouldUseTemperature({ ...input.llm, modelTier: 'regular' })
        ? 0.1
        : undefined,
    });

    logLlmCost({
      context: {
        actorLabel: 'Attachment extraction',
        llm: { ...input.llm, modelTier: 'regular' },
        operation: 'attachment_extraction',
        userId: input.llm.userId ?? null,
      },
      finishReason: result.finishReason,
      providerMetadata: result.providerMetadata,
      usage: result.usage,
    });

    const text = result.text.trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    logger.warn('attachment_extraction_failed', {
      attachmentId: attachment.id,
      error: error instanceof Error ? error.message : String(error),
      sourceType: attachment.sourceType,
    });
    return null;
  }
}

export class AttachmentExtractionFailedError extends Error {
  constructor() {
    super('Attachment extraction produced no usable text.');
    this.name = 'AttachmentExtractionFailedError';
  }
}

export async function extractAttachmentText(input: {
  attachment: PreparedAttachment;
  llm: LlmRequestOptions;
  userPrompt?: string;
}): Promise<AttachmentExtraction> {
  const { attachment } = input;
  const needsVision =
    attachment.sourceType === 'image' || attachment.sourceType === 'pdf';

  if (!needsVision) {
    const mechanical = attachment.extractedText?.trim() ?? '';
    if (!mechanical) {
      throw new AttachmentExtractionFailedError();
    }

    const capped = capText(mechanical);
    return {
      text: capped.text,
      textIsDescription: false,
      truncated: capped.truncated,
    };
  }

  const described = await runVisionExtraction(input);
  if (described) {
    const capped = capText(described);
    return {
      text: capped.text,
      textIsDescription: true,
      truncated: capped.truncated,
    };
  }

  // The vision pass failed. A text PDF still has a mechanical text layer worth
  // falling back to; an image has nothing, and pretending otherwise would put
  // an empty attachment in front of the user for approval.
  const fallback = attachment.extractedText?.trim() ?? '';
  if (!fallback) {
    throw new AttachmentExtractionFailedError();
  }

  const capped = capText(fallback);
  return {
    text: capped.text,
    textIsDescription: false,
    truncated: capped.truncated,
  };
}
