import { initializeModificationModal } from '../shared/modificationModal.js';
import { initializeAttachmentPicker } from '../shared/attachmentPicker.js';
import { t } from '../shared/i18n.js';
import { renderMarkdown } from '../chat/shared/markdown.js';
import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
import {
  getMarkdownEditorValue,
  initializeMarkdownEditors,
} from '../shared/markdownEditor.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
import { initializePendingModalForms } from '../shared/pendingModal.js';
import { initializeStaticMarkdown } from '../shared/staticMarkdown.js';

function fallbackCopyText(content) {
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyTextToClipboard(content) {
  if (!content) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    return fallbackCopyText(content);
  }

  return fallbackCopyText(content);
}

function initializePracticeGuideSharingUi() {
  const shareFieldEl = document.querySelector('[data-practiceGuide-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-practiceGuide-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-practiceGuide-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-share-modal]');

  if (copyButtonEl && shareFieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(shareFieldEl.value);
      copyButtonEl.textContent = copied ? t('clientMisc.copied') : t('clientMisc.copyFailed');
      window.setTimeout(() => {
        copyButtonEl.innerHTML = `<i class="bi bi-copy me-1" aria-hidden="true"></i>${t('clientMisc.copy')}`;
      }, 1200);
    });
  }

  if (nativeShareButtonEl) {
    if (typeof navigator.share !== 'function') {
      nativeShareButtonEl.classList.add('d-none');
    } else if (shareFieldEl instanceof HTMLInputElement) {
      nativeShareButtonEl.addEventListener('click', async () => {
        if (!shareFieldEl.value) {
          return;
        }

        try {
          await navigator.share({
            title: t('clientMisc.pgSharedTitle'),
            url: shareFieldEl.value,
          });
        } catch {
          // Ignore cancelled share attempts.
        }
      });
    }
  }

  if (autoOpenModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(autoOpenModalEl).show();
  }
}

function initializeAutoOpenModal() {
  const modalEl = document.querySelector('[data-auto-open-modal]');
  if (!modalEl || !window.bootstrap?.Modal) {
    return;
  }

  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function initializeResourceGenerationPendingUi() {
  initializePendingModalForms({
    formSelector: '[data-resource-generate-form]',
    pendingModalSelector: '[data-resource-pending-modal]',
    submitSelector: '[data-resource-generate-submit]',
  });
}

function getPracticeGuideFormControl(formEl, name) {
  const control = formEl.elements.namedItem(name);
  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
    ? control
    : null;
}

function buildCurrentPracticeGuideDraft(formEl) {
  const titleEl = getPracticeGuideFormControl(formEl, 'title');
  const descriptionEl = getPracticeGuideFormControl(formEl, 'description');
  const tutorInstructionsEl = getPracticeGuideFormControl(formEl, 'tutorInstructions');
  if (
    !(titleEl instanceof HTMLInputElement)
    || !(descriptionEl instanceof HTMLTextAreaElement)
    || !(tutorInstructionsEl instanceof HTMLTextAreaElement)
  ) {
    return null;
  }

  return {
    description: getMarkdownEditorValue(descriptionEl),
    title: titleEl.value,
    tutorInstructions: getMarkdownEditorValue(tutorInstructionsEl),
  };
}

function renderPracticeGuideModificationValue(container, field, value) {
  container.replaceChildren();
  if (field === 'description' || field === 'tutorInstructions') {
    container.classList.add('resource-markdown');
    container.innerHTML = renderMarkdown(value);
    return;
  }

  container.textContent = value || '—';
}

function renderPracticeGuideModificationChanges(container, changes, labels) {
  container.replaceChildren();
  if (!Array.isArray(changes)) {
    return false;
  }

  let renderedCount = 0;
  for (const change of changes) {
    if (
      !change
      || typeof change.field !== 'string'
      || typeof change.before !== 'string'
      || typeof change.after !== 'string'
      || !labels.fields[change.field]
    ) {
      continue;
    }

    const card = document.createElement('article');
    card.className = 'card mb-3';
    const header = document.createElement('div');
    header.className = 'card-header fw-semibold py-2';
    header.textContent = labels.fields[change.field];
    const body = document.createElement('div');
    body.className = 'card-body';
    const row = document.createElement('div');
    row.className = 'row g-3';

    for (const version of ['before', 'after']) {
      const column = document.createElement('div');
      column.className = 'col-12 col-md-6 d-flex flex-column';
      const heading = document.createElement('p');
      heading.className = version === 'before'
        ? 'small text-body-secondary mb-1'
        : 'small fw-semibold text-primary mb-1';
      heading.textContent = version === 'before' ? labels.current : labels.proposed;
      const value = document.createElement('div');
      value.className = version === 'before'
        ? 'border rounded p-3 flex-grow-1 bg-body-tertiary'
        : 'border border-primary rounded p-3 flex-grow-1';
      renderPracticeGuideModificationValue(value, change.field, change[version]);
      column.append(heading, value);
      row.append(column);
    }

    body.append(row);
    card.append(header, body);
    container.append(card);
    renderedCount += 1;
  }

  return renderedCount > 0;
}


function initializePracticeGuideModification() {
  const formEl = document.querySelector('[data-practice-guide-authoring-form]');
  const modalEl = document.querySelector('[data-modify-modal]');
  if (!(formEl instanceof HTMLFormElement) || !(modalEl instanceof HTMLElement)) {
    return;
  }

  // Only the guide-specific pieces stay here: reading the current draft off the
  // authoring form, and rendering a diff whose fields are Markdown rather than
  // plain strings. The shared controller owns the rest of the cycle.
  const labels = {
    current: modalEl.dataset.currentLabel || '',
    fields: {
      description: modalEl.dataset.fieldDescription,
      title: modalEl.dataset.fieldTitle,
      tutorInstructions: modalEl.dataset.fieldTutorInstructions,
    },
    proposed: modalEl.dataset.proposedLabel || '',
  };

  initializeModificationModal({
    buildCurrentDraft: () => buildCurrentPracticeGuideDraft(formEl),
    modalEl,
    renderChanges: (container, changes) =>
      renderPracticeGuideModificationChanges(container, changes, labels),
    triggers: document.querySelectorAll('[data-modify-open]'),
  });
}


initializePracticeGuideSharingUi();
initializeAutoOpenModal();
initializeResourceGenerationPendingUi();
initializePracticeGuideModification();
initializeResourceMoveModal();
initializeListGroupDropdownStacking();
initializeMarkdownEditors();
initializeStaticMarkdown();
initializeAttachmentPicker();
