export function escapeHtml(value) {
  const wrapper = document.createElement('div');
  wrapper.textContent = value;
  return wrapper.innerHTML;
}

let hasConfiguredMarked = false;

export function renderMarkdown(content) {
  configureMarked();

  if (!window.marked || !window.DOMPurify) {
    return escapeHtml(content || '').replaceAll('\n', '<br>');
  }

  const html = window.marked.parse(content || '');
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

function configureMarked() {
  if (hasConfiguredMarked || !window.marked?.setOptions) {
    return;
  }

  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
  hasConfiguredMarked = true;
}
