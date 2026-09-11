import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

/*
 * The learning home's "Ask Mr. F" box (Roadmap V3 §1.16) hands its text to the
 * chat. Two things must hold, and neither is visible in a route test: the text
 * never travels in the URL, and the chat places it in the composer without
 * sending it — opening the chat from the home must not start a paid tutor turn.
 */
describe('home draft handoff', () => {
  it('places the home draft in the composer without sending it', () => {
    const source = readProjectFile('src/client/chat/index.js');
    const start = source.indexOf('function restoreHomeDraft()');
    expect(start, 'restoreHomeDraft() is missing').toBeGreaterThan(-1);

    const body = source.slice(start, source.indexOf('\n}\n', start));
    expect(body).toContain('consumeHomeDraft()');
    // Attachments are listed again in the composer's picker, not claimed.
    expect(body).toContain('attachmentPicker?.restore(');
    expect(body).not.toMatch(/sendMessage/);
  });

  it('hands attachments over as summaries, never their extracted text', () => {
    const source = readProjectFile('src/client/shared/attachmentPicker.js');
    const start = source.indexOf('getAttachedSummaries()');
    expect(start, 'getAttachedSummaries() is missing').toBeGreaterThan(-1);

    const body = source.slice(start, source.indexOf('\n    },', start));
    expect(body).toContain('id: String(item.id)');
    expect(body).not.toMatch(/\btext:/);
  });

  it('keeps the home draft out of the query string', () => {
    const view = readProjectFile('views/home-learning.ejs');
    // Sliced rather than matched: the placeholder's EJS tag contains a `>`.
    const start = view.indexOf('<textarea');
    const textarea = start === -1 ? '' : view.slice(start, view.indexOf('</textarea>', start));

    expect(textarea).toContain('data-home-ask-input');
    // A named field inside a GET form would be submitted as `?name=…`.
    expect(textarea).not.toMatch(/\sname=/);
  });
});
