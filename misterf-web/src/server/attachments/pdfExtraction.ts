/**
 * PDF handling.
 *
 * The bytes go to the model directly — every configured tier is a Gemini 3.x
 * model, which reads a PDF with native vision and, on Gemini 3, does not bill
 * for the text it extracts itself. So extraction here is **not** how the model
 * sees the document. It exists for three things the model cannot give us:
 *
 * - a page count, to enforce the page cap before spending anything;
 * - scanned-PDF detection, so the user is warned before paying for a document
 *   the text layer says is empty;
 * - a text digest, which is what survives after the bytes are dropped and is
 *   all that later conversation turns will have.
 */

import { extractText, getDocumentProxy } from 'unpdf';

import { maxExtractedTextChars, maxPdfPages } from './limits.js';
import {
  AttachmentRejectedError,
  type AttachmentWarning,
} from './types.js';

export type PdfExtraction = {
  pageCount: number;
  /** Joined text layer. Empty or near-empty for a scanned document. */
  text: string;
  warnings: AttachmentWarning[];
};

/**
 * Characters of extractable text per page below which a PDF is treated as a
 * scan. A text PDF page carries hundreds of characters; a scanned page carries
 * a handful of stray artifacts or none at all.
 */
const scannedPageCharThreshold = 50;

export async function extractPdf(bytes: Buffer): Promise<PdfExtraction> {
  const warnings: AttachmentWarning[] = [];

  const document = await getDocumentProxy(new Uint8Array(bytes)).catch(
    () => null,
  );
  if (!document) {
    throw new AttachmentRejectedError('decode_failed');
  }

  const pageCount = document.numPages;
  if (pageCount > maxPdfPages) {
    throw new AttachmentRejectedError('too_many_pages', {
      limit: maxPdfPages,
      pages: pageCount,
    });
  }

  const extracted = await extractText(document, { mergePages: true }).catch(
    () => null,
  );
  const text = normalizeWhitespace(
    typeof extracted?.text === 'string'
      ? extracted.text
      : (extracted?.text ?? []).join('\n'),
  );

  if (text.length < pageCount * scannedPageCharThreshold) {
    // Not fatal: the native path still reads the page visually. It is a warning
    // because the digest that survives into later turns will be thin.
    warnings.push({ code: 'pdf_probably_scanned' });
  }

  if (text.length > maxExtractedTextChars) {
    warnings.push({ code: 'text_truncated' });
  }

  return { pageCount, text, warnings };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
