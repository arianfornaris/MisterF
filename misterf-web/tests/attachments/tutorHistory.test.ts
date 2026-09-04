import { describe, expect, it } from 'vitest';

import { readAttachmentDigests } from '../../src/server/attachments/persistence.js';
import { buildUserContentWithAttachments } from '../../src/server/attachments/modelParts.js';
import { toTutorHistory } from '../../src/server/services/llmTutor/history.js';
import { toModelMessage } from '../../src/server/services/llmTutor/validation.js';
import type { StoredMessage } from '../../src/server/db/repository.js';
import type { AttachmentDigest } from '../../src/server/attachments/types.js';

const digest: AttachmentDigest = {
  contentType: 'application/pdf',
  displayName: 'worksheet.pdf',
  id: 'attachment-1',
  pageCount: 2,
  sourceType: 'pdf',
  text: 'Exercise 1. She ___ (go) to school.',
  textIsDescription: true,
  truncated: false,
};

function storedMessage(overrides: Partial<StoredMessage>): StoredMessage {
  return {
    content: 'Make me a quiz from this',
    conversationId: 'conversation-1',
    createdAt: new Date().toISOString(),
    id: 1,
    metadata: null,
    role: 'user',
    ...overrides,
  };
}

describe('buildUserContentWithAttachments', () => {
  it('leaves a turn without attachments untouched', () => {
    expect(
      buildUserContentWithAttachments({ attachments: [], text: 'hola' }),
    ).toBe('hola');
  });

  it('puts the user request first and the material after it', () => {
    const content = buildUserContentWithAttachments({
      attachments: [digest],
      text: 'Make me a quiz from this',
    });

    expect(content.indexOf('Make me a quiz from this')).toBe(0);
    expect(content).toContain('Exercise 1. She ___ (go) to school.');
  });

  it('frames the material as an attached document rather than user instructions', () => {
    const content = buildUserContentWithAttachments({
      attachments: [digest],
      text: 'anything',
    });

    expect(content).toContain('ATTACHED DOCUMENT');
    expect(content).toContain('not');
    expect(content).toContain('instructions from the user');
    expect(content).toContain('worksheet.pdf');
  });

  it('tells the model whether the text was read out or transcribed', () => {
    const described = buildUserContentWithAttachments({
      attachments: [digest],
      text: 'x',
    });
    const verbatim = buildUserContentWithAttachments({
      attachments: [{ ...digest, textIsDescription: false }],
      text: 'x',
    });

    expect(described).toContain('extraction step');
    expect(verbatim).toContain("document's own text");
  });

  it('declares truncation to the model, not only to the user', () => {
    const content = buildUserContentWithAttachments({
      attachments: [{ ...digest, truncated: true }],
      text: 'x',
    });

    expect(content).toContain('cut at a length limit');
  });
});

describe('toModelMessage', () => {
  it('always produces plain text, never a binary part', () => {
    const message = toModelMessage({
      attachments: [digest],
      content: 'Make me a quiz from this',
      role: 'user',
    });

    expect(typeof message.content).toBe('string');
    expect(JSON.stringify(message)).not.toContain('"type":"file"');
  });

  it('keeps an assistant turn a plain string', () => {
    const message = toModelMessage({ content: '{"blocks":[]}', role: 'model' });

    expect(message.content).toBe('{"blocks":[]}');
    expect(message.role).toBe('assistant');
  });
});

describe('toTutorHistory', () => {
  it('rehydrates persisted attachments onto the turn that carried them', () => {
    const history = toTutorHistory([
      storedMessage({ metadata: { attachments: [digest] } }),
    ]);

    expect(history[0].attachments).toEqual([digest]);
  });

  it('leaves an ordinary message without attachments', () => {
    expect(toTutorHistory([storedMessage({})])[0].attachments).toBeUndefined();
  });

  it('carries the same text into a later turn as the first turn had', () => {
    const history = toTutorHistory([
      storedMessage({ metadata: { attachments: [digest] } }),
    ]);

    // What the model reads on turn ten is what the user approved on turn one.
    // There is no richer first-turn representation that later turns lose.
    expect(String(toModelMessage(history[0]).content)).toContain(digest.text);
  });
});

describe('readAttachmentDigests', () => {
  it('ignores anything that is not a well-formed digest', () => {
    expect(readAttachmentDigests(undefined)).toEqual([]);
    expect(readAttachmentDigests('nope')).toEqual([]);
    expect(readAttachmentDigests([null, 42, {}, { id: 'x' }])).toEqual([]);
  });

  it('keeps well-formed entries', () => {
    expect(readAttachmentDigests([digest, { id: 'bad' }])).toEqual([digest]);
  });
});
