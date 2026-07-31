/**
 * Deterministic display shuffling for exercises whose stored order *is* the
 * answer.
 *
 * `quiz_matching_pairs` stores `rightItems` aligned with `leftItems`,
 * `quiz_order_sentences` stores the sentences already in order, and
 * `quiz_unscramble_sentence` stores the tokens already in order. Rendering any
 * of them in stored order hands the learner the answer — in matching, every
 * correct choice is simply the option at the same index as its row.
 *
 * The client renderer has shuffled these since the exercises existed. The
 * server-rendered fallback did not, so the answers were sitting in the HTML of
 * every attempt, and a learner without JavaScript got a quiz that graded
 * itself.
 *
 * The shuffle is seeded rather than random so that a reload does not reorder a
 * half-answered exercise under the learner, and so tests can assert it.
 */
export function seededShuffle<T>(items: readonly T[], seedText: string): T[] {
  const array = [...items];
  if (array.length < 2) {
    return array;
  }

  let seed = hashString(seedText || 'seed');
  for (let index = array.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  // A shuffle is allowed to return the original order, and for a two-item
  // exercise it does so half the time — which is precisely the case this
  // exists to prevent. Rotate instead of reshuffling, so the result stays a
  // pure function of the seed.
  if (array.every((value, index) => value === items[index])) {
    array.push(array.shift() as T);
  }

  return array;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
