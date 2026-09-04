/**
 * HTML to structured plain text, shared by the DOCX and URL paths.
 *
 * `html-to-text` is used rather than jsdom plus Readability: it parses with
 * htmlparser2 instead of emulating a DOM, which is roughly 180 KB against 7 MB
 * and, more importantly, avoids holding a document tree in a process that pm2
 * restarts at 300 MB.
 *
 * The tradeoff is that nothing here scores content the way Readability does, so
 * boilerplate is removed by dropping the elements that structurally are
 * boilerplate. That is cruder, and it is why a thin extraction produces a
 * warning rather than being silently accepted.
 */

import { convert } from 'html-to-text';

/** Elements that are chrome on essentially every page, plus non-content nodes. */
const droppedSelectors = [
  'aside',
  'button',
  'footer',
  'form',
  'head',
  'header',
  'iframe',
  'nav',
  'noscript',
  'script',
  'style',
  'svg',
  '[aria-hidden="true"]',
  '[role="banner"]',
  '[role="navigation"]',
];

export function htmlToPlainText(html: string): string {
  const text = convert(html, {
    selectors: [
      ...droppedSelectors.map((selector) => ({
        format: 'skip',
        selector,
      })),
      // Headings are uppercased by default, which silently rewrites the source:
      // a model reading "PAST SIMPLE" will reproduce it that way in generated
      // material. Source text must reach the model as it was written.
      ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((selector) => ({
        options: { uppercase: false },
        selector,
      })),
      // Link URLs are noise for comprehension and expensive in tokens; the link
      // text still survives.
      { options: { ignoreHref: true }, selector: 'a' },
      { options: { ignoreImage: true }, selector: 'img' },
      // Preserving list markers keeps numbered exercises legible as exercises.
      { options: { itemPrefix: '- ' }, selector: 'ul' },
    ],
    wordwrap: false,
  });

  return normalizeWhitespace(text);
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
