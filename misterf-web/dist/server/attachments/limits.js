/**
 * Hard bounds for source attachments.
 *
 * These are not advisory. The process runs under pm2 with
 * `max_memory_restart: '300M'` (see `ecosystem.config.cjs`), and attachment
 * bytes are held in memory and expand by roughly a third when base64-encoded
 * for the provider. Unbounded staging would trade a restart loop for a feature.
 */
const megabyte = 1024 * 1024;
/** Largest accepted upload, per source type. */
export const maxUploadBytes = {
    docx: 10 * megabyte,
    image: 8 * megabyte,
    pdf: 10 * megabyte,
    url: 1 * megabyte,
};
/**
 * Pages sent to the model from one PDF. Beyond this the user is asked to narrow
 * the range rather than being silently truncated: on Gemini each page bills as
 * a 258-token image, so a 200-page textbook is a cost accident, not a feature.
 */
export const maxPdfPages = 30;
/**
 * Characters of extracted text passed to a model. Roughly 10k tokens, which
 * keeps a document well clear of the configured context window while leaving
 * room for the system prompt and the conversation.
 */
export const maxExtractedTextChars = 40_000;
/** Characters kept in a persisted digest. Deliberately far smaller. */
export const maxDigestChars = 4_000;
/**
 * Longest edge, in pixels, of a normalized image. Gemini tiles anything above
 * 384px into 768x768 tiles at 258 tokens each, so this caps an attachment at a
 * predictable handful of tiles while staying legible for document photos.
 */
export const maxImageEdgePixels = 1_568;
/** Total bytes allowed across every staged attachment in the process. */
export const maxStagedBytesTotal = 48 * megabyte;
/** Staged attachments allowed per user at once. */
export const maxStagedPerUser = 3;
/** How long a staged attachment survives before it is swept. */
export const stagedTtlMs = 10 * 60 * 1000;
/** Ceiling on a decompressed DOCX, guarding against zip bombs. */
export const maxDocxDecompressedBytes = 60 * megabyte;
/** Wall-clock budget for fetching a user-supplied URL. */
export const urlFetchTimeoutMs = 10_000;
/** Redirects followed when fetching a user-supplied URL. */
export const maxUrlRedirects = 3;
//# sourceMappingURL=limits.js.map