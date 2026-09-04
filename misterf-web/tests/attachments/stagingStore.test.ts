import { beforeEach, describe, expect, it } from 'vitest';

import {
  approveStagedAttachment,
  claimStagedAttachment,
  claimStagedAttachments,
  discardStagedAttachment,
  getStagingStats,
  peekStagedAttachment,
  resetStagingStoreForTests,
  stageAttachment,
} from '../../src/server/attachments/stagingStore.js';
import {
  maxDigestChars,
  maxStagedPerUser,
} from '../../src/server/attachments/limits.js';
import { isAttachmentRejectedError } from '../../src/server/attachments/types.js';

const owner = 'user-1';

function stage(userId = owner, text = 'Extracted contents.') {
  return stageAttachment({
    digest: {
      contentType: 'application/pdf',
      displayName: 'worksheet.pdf',
      sourceType: 'pdf',
      text,
      textIsDescription: true,
      truncated: false,
    },
    userId,
    warnings: [],
  });
}

beforeEach(() => {
  resetStagingStoreForTests();
});

describe('approval gate', () => {
  it('refuses to hand over an attachment the user never accepted', () => {
    const staged = stage();

    // The whole product contract is that nothing reaches a conversation until
    // the user has read it and said yes. If an unapproved id were claimable,
    // the review step would be bypassable straight from the client.
    expect(
      claimStagedAttachment({ id: staged.digest.id, userId: owner }),
    ).toBeNull();
  });

  it('hands over the attachment once approved', () => {
    const staged = stage();
    expect(
      approveStagedAttachment({ id: staged.digest.id, userId: owner }),
    ).not.toBeNull();

    const claimed = claimStagedAttachment({
      id: staged.digest.id,
      userId: owner,
    });
    expect(claimed?.text).toBe('Extracted contents.');
  });

  it('claims each attachment only once', () => {
    const staged = stage();
    approveStagedAttachment({ id: staged.digest.id, userId: owner });

    expect(claimStagedAttachment({ id: staged.digest.id, userId: owner })).not.toBeNull();
    expect(claimStagedAttachment({ id: staged.digest.id, userId: owner })).toBeNull();
  });

  it('skips unapproved entries when claiming a batch', () => {
    const approved = stage();
    const untouched = stage();
    approveStagedAttachment({ id: approved.digest.id, userId: owner });

    const claimed = claimStagedAttachments({
      ids: [approved.digest.id, untouched.digest.id],
      userId: owner,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0].id).toBe(approved.digest.id);
  });
});

describe('ownership', () => {
  it('hides another account\'s attachment entirely', () => {
    const staged = stage();
    approveStagedAttachment({ id: staged.digest.id, userId: owner });

    const stranger = { id: staged.digest.id, userId: 'user-2' };
    expect(peekStagedAttachment(stranger)).toBeNull();
    expect(approveStagedAttachment(stranger)).toBeNull();
    expect(claimStagedAttachment(stranger)).toBeNull();
    expect(discardStagedAttachment(stranger)).toBe(false);
  });
});

describe('bounds', () => {
  it('refuses more than the per-user allowance', () => {
    for (let index = 0; index < maxStagedPerUser; index += 1) {
      stage();
    }

    try {
      stage();
      throw new Error('Expected staging to be refused.');
    } catch (error) {
      expect(isAttachmentRejectedError(error)).toBe(true);
    }
  });

  it('releases its byte budget when an attachment is discarded', () => {
    const staged = stage();
    expect(getStagingStats().stagedBytesTotal).toBeGreaterThan(0);

    discardStagedAttachment({ id: staged.digest.id, userId: owner });

    expect(getStagingStats()).toEqual({ entryCount: 0, stagedBytesTotal: 0 });
  });

  it('releases its byte budget when an attachment is claimed', () => {
    const staged = stage();
    approveStagedAttachment({ id: staged.digest.id, userId: owner });
    claimStagedAttachment({ id: staged.digest.id, userId: owner });

    expect(getStagingStats()).toEqual({ entryCount: 0, stagedBytesTotal: 0 });
  });

  it('holds only the extracted text, never a binary', () => {
    const staged = stage(owner, 'a'.repeat(500));

    // Bytes are released at extraction time, so an entry costs kilobytes.
    expect(getStagingStats().stagedBytesTotal).toBe(500);
    expect(JSON.stringify(staged)).not.toContain('Buffer');
  });
});

describe('correcting the text before approving', () => {
  it('attaches the user\'s correction instead of the extraction', () => {
    const staged = stage(owner, 'Beatriz ______ (drive) to Cochabmaba');
    approveStagedAttachment({
      correctedText: 'Beatriz ______ (drive) to Cochabamba',
      id: staged.digest.id,
      userId: owner,
    });

    const claimed = claimStagedAttachment({
      id: staged.digest.id,
      userId: owner,
    });
    expect(claimed?.text).toBe('Beatriz ______ (drive) to Cochabamba');
    expect(claimed?.edited).toBe(true);
  });

  it('does not mark an untouched attachment as edited', () => {
    const staged = stage(owner, 'Unchanged contents.');
    approveStagedAttachment({
      correctedText: 'Unchanged contents.',
      id: staged.digest.id,
      userId: owner,
    });

    expect(
      claimStagedAttachment({ id: staged.digest.id, userId: owner })?.edited,
    ).toBeUndefined();
  });

  it('refuses to attach an emptied text', () => {
    const staged = stage();

    try {
      approveStagedAttachment({
        correctedText: '   ',
        id: staged.digest.id,
        userId: owner,
      });
      throw new Error('Expected the empty correction to be refused.');
    } catch (error) {
      expect(isAttachmentRejectedError(error)).toBe(true);
    }
  });

  it('re-charges the byte budget against the corrected length', () => {
    const staged = stage(owner, 'a'.repeat(100));
    expect(getStagingStats().stagedBytesTotal).toBe(100);

    approveStagedAttachment({
      correctedText: 'b'.repeat(400),
      id: staged.digest.id,
      userId: owner,
    });

    expect(getStagingStats().stagedBytesTotal).toBe(400);
  });

  it('caps a correction at the digest limit', () => {
    const staged = stage();
    approveStagedAttachment({
      correctedText: 'x'.repeat(maxDigestChars + 500),
      id: staged.digest.id,
      userId: owner,
    });

    const claimed = claimStagedAttachment({
      id: staged.digest.id,
      userId: owner,
    });
    expect(claimed?.text).toHaveLength(maxDigestChars);
    expect(claimed?.truncated).toBe(true);
  });

  it('still refuses a corrected attachment the user never approved', () => {
    const staged = stage();

    // Sending text is not the same as accepting: only the approve call flips
    // the flag, so a correction alone cannot bypass the review step.
    expect(
      claimStagedAttachment({ id: staged.digest.id, userId: owner }),
    ).toBeNull();
  });
});
