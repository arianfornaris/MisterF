import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('chat composer architecture', () => {
  /*
   * The composer sends from two places — the form's submit and Enter in the
   * textarea — and the learning home's starter panel has to be dropped on
   * whichever one fires. It first shipped hooked to the submit handler only, so
   * the panel survived the way everyone actually sends a message.
   *
   * The invariant is that both paths go through one helper, and that the helper
   * acts on the result of `sendMessage` rather than on the keypress, because
   * `sendMessage` declines an empty box, a busy assistant, and a pending guest
   * prompt — and the panel must survive all three.
   */
  it('routes both composer send paths through one helper', () => {
    const source = readProjectFile('src/client/chat/index.js');

    expect(source).toContain('function sendComposerMessage()');
    expect(source).toContain('if (runtime.sendMessage()) {');
    expect(source).toContain('learningHomePanelEl?.remove();');

    // `sendMessage` is reached only through the helper: any bare call from a
    // handler is a send path that skips the panel.
    const bareSendCalls = source.match(/^\s*runtime\.sendMessage\(\);$/gm) ?? [];
    expect(bareSendCalls, 'call sendComposerMessage() instead').toEqual([]);

    const helperCalls = source.match(/\bsendComposerMessage\(\);/g) ?? [];
    expect(helperCalls.length).toBe(2);
  });
});
