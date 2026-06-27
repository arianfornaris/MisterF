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

const iconClassMap = {
  bold: 'bi bi-type-bold',
  'heading-2': 'bi bi-type-h2',
  italic: 'bi bi-type-italic',
  link: 'bi bi-link-45deg',
  'ordered-list': 'bi bi-list-ol',
  preview: 'bi bi-eye',
  quote: 'bi bi-quote',
  'unordered-list': 'bi bi-list-ul',
};

const toolbarLabels = {
  bold: 'Negrita',
  'heading-2': 'Encabezado',
  italic: 'Cursiva',
  link: 'Enlace',
  'ordered-list': 'Lista numerada',
  preview: 'Vista previa',
  quote: 'Cita',
  'unordered-list': 'Lista',
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
    iconClassMap,
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
  for (const [name, label] of Object.entries(toolbarLabels)) {
    const buttonEl = editor.toolbarElements?.[name];
    if (!(buttonEl instanceof HTMLElement)) {
      continue;
    }

    buttonEl.title = label;
    buttonEl.setAttribute('aria-label', label);
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
    errorEl.hidden = false;
  }
}

function clearEditorError(textareaEl, editor) {
  editor.codemirror.getWrapperElement().classList.remove('is-invalid');

  const errorEl = getEditorErrorElement(textareaEl);
  if (errorEl) {
    errorEl.hidden = true;
  }
}

function getEditorErrorElement(textareaEl) {
  const errorId = textareaEl.dataset.markdownEditorError;
  if (!errorId) {
    return null;
  }

  return document.getElementById(errorId);
}
