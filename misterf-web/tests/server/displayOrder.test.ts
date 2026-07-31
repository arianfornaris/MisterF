import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { seededShuffle } from '../../src/server/services/displayOrder.js';

/**
 * Matching pairs, ordered sentences, and unscramble tokens are all stored in
 * the order that *is* the answer. The learner-facing server render has to
 * break that order, and has to break it the same way on every render of the
 * same attempt.
 */
describe('seededShuffle', () => {
  it('is stable for a given seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    expect(seededShuffle(items, 'attempt-1:block-2')).toEqual(
      seededShuffle(items, 'attempt-1:block-2'),
    );
  });

  it('gives different attempts different orders', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];

    expect(seededShuffle(items, 'attempt-1:block-2')).not.toEqual(
      seededShuffle(items, 'attempt-9:block-2'),
    );
  });

  it('keeps every element exactly once', () => {
    const items = ['a', 'b', 'c', 'd'];
    const shuffled = seededShuffle(items, 'seed');

    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('never returns the stored order, whatever the seed', () => {
    // The case that matters: a two-item exercise, where an honest shuffle
    // reproduces the answer half the time.
    for (let index = 0; index < 200; index += 1) {
      expect(seededShuffle(['first', 'second'], `seed-${index}`)).not.toEqual([
        'first',
        'second',
      ]);
    }
  });

  it('leaves nothing to shuffle alone', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['only'], 'seed')).toEqual(['only']);
  });
});

describe('quiz item card', () => {
  /**
   * The client renderer has always shuffled; the server fallback did not, so
   * every attempt shipped its own answer key in the HTML and a learner without
   * JavaScript got a quiz that answered itself. This stops the raw arrays from
   * being rendered back into a learner-facing mode.
   */
  it('never renders a learner the stored order of an answer-bearing array', () => {
    const partial = fs.readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../views/partials/quiz-item-card.ejs',
      ),
      'utf8',
    );

    for (const field of ['rightItems', 'sentences', 'tokens']) {
      expect(partial).toContain(`orderForDisplay(item.${field})`);
    }

    // `leftItems` is the prompt column and keeps its order. Of the three
    // answer-bearing arrays, the only raw iteration left is the design view's
    // ordered list — the author's answer key — so one occurrence of
    // `item.sentences` and none of the other two.
    expect(partial.match(/item\.rightItems\.forEach/g)).toBeNull();
    expect(partial.match(/item\.tokens\.forEach/g)).toBeNull();
    expect(partial.match(/item\.sentences\.forEach/g)).toHaveLength(1);
  });
});
