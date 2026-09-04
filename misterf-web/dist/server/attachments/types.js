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
/** A validation failure that should be shown to the user, not logged as a bug. */
export class AttachmentRejectedError extends Error {
    code;
    values;
    constructor(code, values = {}) {
        super(`Attachment rejected: ${code}`);
        this.code = code;
        this.name = 'AttachmentRejectedError';
        this.values = values;
    }
}
export function isAttachmentRejectedError(error) {
    return error instanceof AttachmentRejectedError;
}
//# sourceMappingURL=types.js.map