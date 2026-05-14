export function escapeHtml(value) {
  const wrapper = document.createElement('div');
  wrapper.textContent = value;
  return wrapper.innerHTML;
}

export function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    return escapeHtml(content).replaceAll('\n', '<br>');
  }

  const html = window.marked.parse(content || '');
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
