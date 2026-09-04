/**
 * Reading attachments back out of stored message metadata.
 *
 * Digests are written into a free-form JSON column, so what comes back is
 * whatever was there — including rows written by an older shape. Validating on
 * the way out keeps the rest of the code able to assume a digest is a digest.
 */

import type { AttachmentDigest } from './types.js';

export function readAttachmentDigests(value: unknown): AttachmentDigest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is AttachmentDigest => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<AttachmentDigest>;
    return (
      typeof candidate.displayName === 'string' &&
      typeof candidate.id === 'string' &&
      typeof candidate.text === 'string'
    );
  });
}
