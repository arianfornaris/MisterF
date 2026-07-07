import { describe, expect, it } from 'vitest';
import { blocksToMarkdown } from '../../src/server/services/llmTutor/validation.js';
import type { TutorResponseBlock } from '../../src/server/services/llmTutor/types.js';

const fallbackBlocks: TutorResponseBlock[] = [
  {
    parts: [{ status: 'correct', text: 'I went to the store.' }],
    sourceText: 'I went to the store.',
    type: 'sentence_evaluation',
  },
  {
    pairs: [{ left: 'dog', right: 'perro' }],
    type: 'matching_pairs',
  },
  {
    sentences: ['First.', 'Second.'],
    type: 'order_sentences',
  },
];

describe('blocksToMarkdown', () => {
  it('keeps the Spanish fallback strings byte-for-byte by default', () => {
    const markdown = blocksToMarkdown(fallbackBlocks);

    expect(markdown).toContain('Revisemos esta parte:');
    expect(markdown).toContain('Ejercicio de emparejar.');
    expect(markdown).toContain('Ordena las oraciones.');
    expect(blocksToMarkdown(fallbackBlocks, 'es')).toBe(markdown);
  });

  it('authors fallback strings in the conversation locale', () => {
    const english = blocksToMarkdown(fallbackBlocks, 'en');
    expect(english).toContain('Let’s review this part:');
    expect(english).toContain('Matching exercise.');
    expect(english).toContain('Put the sentences in order.');
    expect(english).not.toMatch(/emparejar|Revisemos|Ordena/);

    const creole = blocksToMarkdown(fallbackBlocks, 'ht');
    expect(creole).toContain('Ann revize pati sa a:');
    expect(creole).toContain('Egzèsis marye eleman yo.');
    expect(creole).toContain('Mete fraz yo an lòd.');
  });

  it('interpolates translation prompts through the catalog', () => {
    const markdown = blocksToMarkdown(
      [{ sentence: 'El gato duerme.', type: 'translate_to_english_prompt' }],
      'es',
    );

    expect(markdown).toBe('Traduce al ingles: "El gato duerme."');
  });

  it('prefers author-provided prompts over the localized fallbacks', () => {
    const markdown = blocksToMarkdown(
      [
        {
          pairs: [{ left: 'dog', right: 'perro' }],
          prompt: 'Match the animals.',
          type: 'matching_pairs',
        },
      ],
      'en',
    );

    expect(markdown).toBe('Match the animals.');
  });
});
