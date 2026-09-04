/**
 * Reads the attachments a submitted form refers to.
 *
 * The browser posts opaque staged ids, never attachment content: the server
 * already holds the validated, normalized bytes, so a replayed or edited form
 * field cannot inject material that never passed ingestion. Claiming is
 * ownership-checked and one-shot, which also means a double-submitted form does
 * not run the same inference twice with the same file.
 */

import type { Request } from 'express';

import { claimStagedAttachments } from './stagingStore.js';
import type { AttachmentDigest } from './types.js';

/** Form field carrying the staged ids, comma-separated. */
export const attachmentIdsField = 'attachmentIds';

export function readAttachmentIds(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export function claimRequestAttachments(
  request: Request,
  userId: string,
): AttachmentDigest[] {
  const ids = readAttachmentIds(request.body?.[attachmentIdsField]);
  if (ids.length === 0) {
    return [];
  }

  return claimStagedAttachments({ ids, userId });
}
