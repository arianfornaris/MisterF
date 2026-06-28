import EasyMDE from 'easymde';
import { renderMarkdown } from '../chat/shared/markdown.js';

const editorInstances = new WeakMap();

const defaultToolbar = [
  'heading-2',
  'bold',
  'italic',
  '|',
  'unordered-list',
  'ordered-list',
  'quote',
  '|',
  'link',
  'preview',
];

const toolbarButtonPresentation = {
  bold: { iconClass: 'bi bi-type-bold', label: 'Negrita' },
  'heading-2': { iconClass: 'bi bi-type-h2', label: 'Encabezado' },
  italic: { iconClass: 'bi bi-type-italic', label: 'Cursiva' },
  link: { iconClass: 'bi bi-link-45deg', label: 'Enlace' },
  'ordered-list': { iconClass: 'bi bi-list-ol', label: 'Lista numerada' },
  preview: { iconClass: 'bi bi-eye', label: 'Vista previa' },
  quote: { iconClass: 'bi bi-quote', label: 'Cita' },
  'unordered-list': { iconClass: 'bi bi-list-ul', label: 'Lista' },
};

export function initializeMarkdownEditors(root = document) {
  const editorsByForm = new Map();

  for (const textareaEl of root.querySelectorAll('[data-markdown-editor]')) {
    if (!(textareaEl instanceof HTMLTextAreaElement) || editorInstances.has(textareaEl)) {
      continue;
    }

    const editor = createEditor(textareaEl);
    editorInstances.set(textareaEl, editor);

    const formEl = textareaEl.form;
    if (formEl instanceof HTMLFormElement) {
      const formEditors = editorsByForm.get(formEl) || [];
      formEditors.push({ editor, textareaEl });
      editorsByForm.set(formEl, formEditors);
    }
  }

  for (const [formEl, formEditors] of editorsByForm.entries()) {
    bindFormValidation(formEl, formEditors);
  }
}

function createEditor(textareaEl) {
  const editor = new EasyMDE({
    autoDownloadFontAwesome: false,
    autoRefresh: true,
    element: textareaEl,
    forceSync: true,
    lineNumbers: false,
    maxHeight: textareaEl.dataset.markdownEditorMaxHeight || undefined,
    minHeight: textareaEl.dataset.markdownEditorMinHeight || `${Math.max(textareaEl.rows || 6, 4) * 1.65}rem`,
    nativeSpellcheck: true,
    placeholder: textareaEl.getAttribute('placeholder') || '',
    previewRender: (markdownPlaintext) => renderMarkdown(markdownPlaintext),
    sideBySideFullscreen: false,
    spellChecker: false,
    status: false,
    tabSize: 2,
    toolbar: defaultToolbar,
    toolbarTips: true,
  });

  textareaEl.required = false;
  localizeToolbar(editor);

  const maxLength = textareaEl.maxLength;
  if (maxLength > -1) {
    editor.codemirror.on('change', () => {
      const value = editor.value();
      if (value.length <= maxLength) {
        return;
      }

      const cursor = editor.codemirror.getCursor();
      editor.value(value.slice(0, maxLength));
      editor.codemirror.setCursor(cursor);
    });
  }

  editor.codemirror.on('change', () => clearEditorError(textareaEl, editor));

  return editor;
}

function localizeToolbar(editor) {
  for (const [name, { iconClass, label }] of Object.entries(toolbarButtonPresentation)) {
    const buttonEl = editor.toolbarElements?.[name];
    if (!(buttonEl instanceof HTMLElement)) {
      continue;
    }

    buttonEl.title = label;
    buttonEl.setAttribute('aria-label', label);
    buttonEl.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span class="visually-hidden">${label}</span>`;
  }
}

function bindFormValidation(formEl, formEditors) {
  if (formEl.dataset.markdownEditorValidationBound === 'true') {
    return;
  }

  formEl.dataset.markdownEditorValidationBound = 'true';
  formEl.addEventListener('submit', (event) => {
    for (const { editor, textareaEl } of formEditors) {
      editor.codemirror.save();

      if (!textareaEl.dataset.markdownEditorRequired || editor.value().trim()) {
        clearEditorError(textareaEl, editor);
        continue;
      }

      event.preventDefault();
      showEditorError(textareaEl, editor);
      return;
    }
  });
}

function showEditorError(textareaEl, editor) {
  editor.codemirror.focus();
  editor.codemirror.getWrapperElement().classList.add('is-invalid');

  const errorEl = getEditorErrorElement(textareaEl);
  if (errorEl) {
    errorEl.classList.add('d-block');
    errorEl.hidden = false;
  }
}

function clearEditorError(textareaEl, editor) {
  editor.codemirror.getWrapperElement().classList.remove('is-invalid');

  const errorEl = getEditorErrorElement(textareaEl);
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.classList.remove('d-block');
  }
}

function getEditorErrorElement(textareaEl) {
  const errorId = textareaEl.dataset.markdownEditorError;
  if (!errorId) {
    return null;
  }

  return document.getElementById(errorId);
}
