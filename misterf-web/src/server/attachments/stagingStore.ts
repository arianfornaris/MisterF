/**
 * Bounded in-memory store for attachments between processing and sending.
 *
 * The wizard splits attaching into three requests: process, review, approve.
 * Something has to hold the extracted attachment across them, and this is it.
 * Only the extracted **text** is held — the binary was released the moment
 * extraction finished — so an entry costs kilobytes rather than megabytes.
 *
 * Entries are approved once, claimed once, expire on a short TTL, and are
 * capped per user. The store is per-process; pm2 runs this app as a single
 * `fork` instance (`ecosystem.config.cjs`), so an entry is reachable from the
 * request that claims it, and a restart simply drops pending work.
 */

import { randomUUID } from 'node:crypto';

import {
  maxDigestChars,
  maxStagedBytesTotal,
  maxStagedPerUser,
  stagedTtlMs,
} from './limits.js';
import {
  AttachmentRejectedError,
  type AttachmentDigest,
  type AttachmentWarning,
} from './types.js';

export type StagedAttachment = {
  /** True once the user has seen the extracted text and accepted it. */
  approved: boolean;
  digest: AttachmentDigest;
  warnings: AttachmentWarning[];
};

type StagedEntry = StagedAttachment & {
  chargedBytes: number;
  createdAt: number;
  userId: string;
};

const entries = new Map<string, StagedEntry>();
let stagedBytesTotal = 0;

function dropEntry(id: string): void {
  const entry = entries.get(id);
  if (!entry) {
    return;
  }

  stagedBytesTotal -= entry.chargedBytes;
  entries.delete(id);
}

function sweepExpired(now = Date.now()): void {
  const cutoff = now - stagedTtlMs;
  for (const [id, entry] of entries) {
    if (entry.createdAt < cutoff) {
      dropEntry(id);
    }
  }
}

function countForUser(userId: string): number {
  let count = 0;
  for (const entry of entries.values()) {
    if (entry.userId === userId) {
      count += 1;
    }
  }
  return count;
}

/**
 * Stages an extracted attachment awaiting the user's approval, and returns the
 * id the browser sends back to approve or discard it.
 */
export function stageAttachment(input: {
  digest: Omit<AttachmentDigest, 'id'>;
  userId: string;
  warnings: AttachmentWarning[];
}): StagedAttachment {
  sweepExpired();

  const chargedBytes = Buffer.byteLength(input.digest.text, 'utf8');
  if (stagedBytesTotal + chargedBytes > maxStagedBytesTotal) {
    throw new AttachmentRejectedError('staging_full');
  }

  if (countForUser(input.userId) >= maxStagedPerUser) {
    throw new AttachmentRejectedError('staging_full', {
      limit: maxStagedPerUser,
    });
  }

  const staged: StagedAttachment = {
    approved: false,
    digest: { ...input.digest, id: randomUUID() },
    warnings: input.warnings,
  };

  entries.set(staged.digest.id, {
    ...staged,
    chargedBytes,
    createdAt: Date.now(),
    userId: input.userId,
  });
  stagedBytesTotal += chargedBytes;

  return staged;
}

function readEntry(input: {
  id: string;
  userId: string;
}): StagedEntry | null {
  sweepExpired();

  const entry = entries.get(input.id);
  // Ownership is checked here so a leaked id cannot be redeemed by another
  // account, and a missing entry is indistinguishable from a foreign one.
  return entry && entry.userId === input.userId ? entry : null;
}

export function peekStagedAttachment(input: {
  id: string;
  userId: string;
}): StagedAttachment | null {
  return readEntry(input);
}

/**
 * Marks an attachment approved, optionally replacing the extracted text with
 * the user's own correction.
 *
 * Accepting edited text is not a new trust boundary: an attachment is already
 * treated as one more form of user input, and a user who wants the model to
 * read a particular sentence can simply type it. What the correction changes is
 * accuracy — a teacher who can see a column was read out of order fixes it in
 * seconds instead of re-shooting the photo.
 */
export function approveStagedAttachment(input: {
  correctedText?: string;
  id: string;
  userId: string;
}): StagedAttachment | null {
  const entry = readEntry(input);
  if (!entry) {
    return null;
  }

  const corrected = input.correctedText?.trim();
  if (corrected !== undefined && corrected !== entry.digest.text) {
    if (corrected.length === 0) {
      throw new AttachmentRejectedError('empty_text');
    }

    const capped = corrected.slice(0, maxDigestChars);
    const nextBytes = Buffer.byteLength(capped, 'utf8');
    if (stagedBytesTotal - entry.chargedBytes + nextBytes > maxStagedBytesTotal) {
      throw new AttachmentRejectedError('staging_full');
    }

    stagedBytesTotal += nextBytes - entry.chargedBytes;
    entry.chargedBytes = nextBytes;
    entry.digest = {
      ...entry.digest,
      edited: true,
      text: capped,
      // The user's version is neither a verbatim read nor the extractor's; it
      // is theirs, and `edited` is what the UI reports.
      truncated: corrected.length > maxDigestChars,
    };
  }

  entry.approved = true;
  return entry;
}

/**
 * Takes an approved attachment and removes it from the store. An entry the user
 * never accepted is refused rather than silently attached: the approval step is
 * the product contract, so bypassing it must not be possible from the client.
 */
export function claimStagedAttachment(input: {
  id: string;
  userId: string;
}): AttachmentDigest | null {
  const entry = readEntry(input);
  if (!entry?.approved) {
    return null;
  }

  dropEntry(input.id);
  return entry.digest;
}

/** Claims several approved attachments, skipping any that are missing or unapproved. */
export function claimStagedAttachments(input: {
  ids: string[];
  userId: string;
}): AttachmentDigest[] {
  return input.ids
    .map((id) => claimStagedAttachment({ id, userId: input.userId }))
    .filter((digest): digest is AttachmentDigest => digest !== null);
}

/** Discards a staged attachment, for cancel or an explicit remove. */
export function discardStagedAttachment(input: {
  id: string;
  userId: string;
}): boolean {
  if (!readEntry(input)) {
    return false;
  }

  dropEntry(input.id);
  return true;
}

/** Test seam: current staging pressure, for assertions and diagnostics. */
export function getStagingStats(): {
  entryCount: number;
  stagedBytesTotal: number;
} {
  sweepExpired();
  return { entryCount: entries.size, stagedBytesTotal };
}

/** Test seam: drops everything. Never called from product code. */
export function resetStagingStoreForTests(): void {
  entries.clear();
  stagedBytesTotal = 0;
}
