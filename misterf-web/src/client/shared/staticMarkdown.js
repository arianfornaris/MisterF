import { renderMarkdown } from '../chat/shared/markdown.js';

export function initializeStaticMarkdown(root = document) {
  for (const element of root.querySelectorAll('[data-render-markdown]')) {
    renderStaticMarkdownElement(element);
  }
}

function renderStaticMarkdownElement(element) {
  const rawContent = element.textContent || '';
  element.innerHTML = renderMarkdown(rawContent);

  for (const link of element.querySelectorAll('a')) {
    const url = new URL(link.getAttribute('href') || '', window.location.href);
    if (url.origin !== window.location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }
}
