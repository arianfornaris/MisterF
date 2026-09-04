import express from 'express';

import {
  handleApproveAttachment,
  handleDiscardAttachment,
  handleProcessUploadedAttachment,
  handleProcessUrlAttachment,
} from './handlers.js';
import { maxUploadBytes } from './limits.js';

export const attachmentsRouter = express.Router();

/**
 * The upload body is the file itself, so it is parsed as a raw Buffer rather
 * than as a form. `express.raw` only claims the content types listed here,
 * which means anything else reaches the handler with an empty body and is
 * rejected by the same sniffing path as a corrupt file — the parser is not a
 * second, weaker gate on what is allowed.
 *
 * The limit here is the largest per-type ceiling; the exact per-type limit is
 * enforced during sniffing, where the real format is known.
 */
const rawUploadBody = express.raw({
  limit: Math.max(...Object.values(maxUploadBytes)),
  type: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
});

attachmentsRouter.post(
  '/attachments/process',
  rawUploadBody,
  handleProcessUploadedAttachment,
);
attachmentsRouter.post('/attachments/process-url', handleProcessUrlAttachment);
attachmentsRouter.post(
  '/attachments/:attachmentId/approve',
  handleApproveAttachment,
);
attachmentsRouter.delete('/attachments/:attachmentId', handleDiscardAttachment);
