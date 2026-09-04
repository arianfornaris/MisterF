/**
 * Source attachments let a user put their own material — a photo, a PDF, a Word
 * document, or a web page — in front of an inference.
 *
 * Every attachment is converted to text **before** it enters a conversation,
 * and that text is the whole of it: the user reviews and approves it, the model
 * reads it, and the user can open it again later. There is no richer parallel
 * representation kept for the model, which is what makes "the user sees what
 * the system sees" literally true rather than approximately true.
 *
 * The binary is never persisted, and is released as soon as extraction is done.
 * That keeps object storage, retention, and signed-URL delivery out of this
 * feature entirely; the cost is that a source cannot be re-processed later
 * without uploading it again.
 */

/** What the user handed us. Drives validation, normalization, and routing. */
export type AttachmentSourceType = 'docx' | 'image' | 'pdf' | 'url';

/** Raw upload as received, before any validation has run. */
export type RawAttachmentUpload = {
  bytes: Buffer;
  /** Content type claimed by the client. Never trusted on its own. */
  declaredContentType: string;
  /** Original file name, used for display and extension cross-checks only. */
  fileName: string;
};

/**
 * An attachment that passed validation and normalization. This is a transient
 * ingestion value: it carries the bytes only until extraction has run, and is
 * never stored in this form.
 */
export type PreparedAttachment = {
  /** Released as soon as extraction is done. */
  bytes?: Buffer;
  /** Effective media type after sniffing and normalization. */
  contentType: string;
  /** Display name shown to the user and given to the model as context. */
  displayName: string;
  /**
   * Text obtained mechanically, without a model — a PDF's text layer, a DOCX
   * conversion, a page's readable content. For visual sources this is a
   * fallback; for DOCX and URLs it is the final answer.
   */
  extractedText?: string;
  /** Opaque id used to reference the attachment across a request boundary. */
  id: string;
  /** Pages for a PDF; undefined for every other source type. */
  pageCount?: number;
  sizeBytes: number;
  sourceType: AttachmentSourceType;
  /** Original URL for `url` sources; absent otherwise. */
  sourceUrl?: string;
  /** Non-fatal problems the user should see, e.g. a suspected scan. */
  warnings: AttachmentWarning[];
};

/**
 * A user-visible, non-fatal problem. `code` drives the i18n key so the message
 * stays in the locale catalogs rather than being built here.
 */
export type AttachmentWarning = {
  code: AttachmentWarningCode;
  /** Optional interpolation values for the catalog message. */
  values?: Record<string, string | number>;
};

export type AttachmentWarningCode =
  | 'docx_tables_simplified'
  | 'image_downscaled'
  | 'pdf_pages_truncated'
  | 'pdf_probably_scanned'
  | 'text_truncated'
  | 'url_content_thin';

/**
 * The attachment as everything downstream sees it: the user in the review step
 * and in the transcript, the model in its input, and the message metadata that
 * persists it. Small enough to live in a JSON column.
 */
export type AttachmentDigest = {
  contentType: string;
  displayName: string;
  id: string;
  pageCount?: number;
  sourceType: AttachmentSourceType;
  sourceUrl?: string;
  /** The extracted contents. Plain text by contract, for every source type. */
  text: string;
  /**
   * True when a model wrote this rather than it being read verbatim from a text
   * layer. "This is what the document says" and "this is what Mr. F saw" are
   * different claims and the UI must not present them identically.
   */
  textIsDescription: boolean;
  /** True when `text` was cut at the character cap. */
  truncated: boolean;
  /**
   * True when the user corrected the extracted text before approving it. The
   * viewer says so, because "what the extraction read" and "what the user
   * decided it should say" are different claims about the same document.
   */
  edited?: boolean;
};

/** A validation failure that should be shown to the user, not logged as a bug. */
export class AttachmentRejectedError extends Error {
  readonly code: AttachmentRejectionCode;

  readonly values: Record<string, string | number>;

  constructor(
    code: AttachmentRejectionCode,
    values: Record<string, string | number> = {},
  ) {
    super(`Attachment rejected: ${code}`);
    this.code = code;
    this.name = 'AttachmentRejectedError';
    this.values = values;
  }
}

export type AttachmentRejectionCode =
  | 'content_mismatch'
  | 'decode_failed'
  | 'empty_file'
  | 'empty_text'
  | 'staging_full'
  | 'too_large'
  | 'too_many_pages'
  | 'extraction_failed'
  | 'unsupported_type'
  | 'url_blocked'
  | 'url_fetch_failed';

export function isAttachmentRejectedError(
  error: unknown,
): error is AttachmentRejectedError {
  return error instanceof AttachmentRejectedError;
}
