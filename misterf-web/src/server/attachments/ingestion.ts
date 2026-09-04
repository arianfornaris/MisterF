/**
 * Turns raw user input into a `PreparedAttachment`.
 *
 * This stage does the mechanical work only: validate, normalize, and pull out
 * whatever text can be had without a model. Deciding what the attachment
 * finally says — including the vision pass that images and PDFs need — belongs
 * to `services/attachmentExtraction.ts`, which runs next.
 */

import { extractDocx } from './docxExtraction.js';
import { normalizeImageAttachment } from './imageNormalization.js';
import { extractPdf } from './pdfExtraction.js';
import { sniffAttachment } from './sniffing.js';
import { extractUrl } from './urlFetch.js';
import type {
  PreparedAttachment,
  RawAttachmentUpload,
} from './types.js';

type UnstagedAttachment = Omit<PreparedAttachment, 'id'>;

/**
 * Strips directory components and control characters from a client filename.
 * The result is display text and model-facing context, never a filesystem path,
 * so the goal is legibility and keeping escape sequences out of logs and
 * prompts rather than path safety.
 */
function safeDisplayName(fileName: string, fallback: string): string {
  const base = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  return base && base.length > 0 ? base.slice(0, 120) : fallback;
}

export async function prepareUploadedAttachment(
  upload: RawAttachmentUpload,
): Promise<UnstagedAttachment> {
  const sniffed = sniffAttachment(upload);
  const displayName = safeDisplayName(upload.fileName, 'attachment');

  if (sniffed.sourceType === 'image') {
    const normalized = await normalizeImageAttachment(
      upload.bytes,
      sniffed.contentType,
    );

    return {
      bytes: normalized.bytes,
      contentType: normalized.contentType,
      displayName,
      sizeBytes: normalized.bytes.length,
      sourceType: 'image',
      warnings: normalized.warnings,
    };
  }

  if (sniffed.sourceType === 'pdf') {
    const extraction = await extractPdf(upload.bytes);

    return {
      // The original bytes go to the model; the extracted text is kept only so
      // a digest can outlive them.
      bytes: upload.bytes,
      contentType: sniffed.contentType,
      displayName,
      extractedText: extraction.text,
      pageCount: extraction.pageCount,
      sizeBytes: upload.bytes.length,
      sourceType: 'pdf',
      warnings: extraction.warnings,
    };
  }

  const extraction = await extractDocx(upload.bytes);

  return {
    contentType: sniffed.contentType,
    displayName,
    extractedText: extraction.text,
    sizeBytes: upload.bytes.length,
    sourceType: 'docx',
    warnings: extraction.warnings,
  };
}

export async function prepareUrlAttachment(
  rawUrl: string,
): Promise<UnstagedAttachment> {
  const extraction = await extractUrl(rawUrl);

  return {
    contentType: 'text/plain',
    displayName: extraction.title,
    extractedText: extraction.text,
    sizeBytes: Buffer.byteLength(extraction.text, 'utf8'),
    sourceType: 'url',
    sourceUrl: extraction.finalUrl,
    warnings: extraction.warnings,
  };
}
