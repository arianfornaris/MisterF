import { t } from '../shared/i18n.js';
import { renderMarkdown } from '../chat/shared/markdown.js';
import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
import {
  getMarkdownEditorValue,
  initializeMarkdownEditors,
} from '../shared/markdownEditor.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
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
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('[data-resource-generate-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-resource-generate-submit]');
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-resource-pending-modal]');

    formEl.addEventListener('submit', () => {
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = submitButtonEl.dataset.loadingText || 'Procesando...';
      }

      if (parentModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(parentModalEl).hide();
      }

      if (pendingModalEl) {
        window.setTimeout(() => {
          window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
        }, 120);
      }
    });
  }
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

async function postPracticeGuideModification(endpoint, fields) {
  return fetch(endpoint, {
    body: new URLSearchParams(fields),
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'fetch',
    },
    method: 'POST',
  });
}

function initializePracticeGuideModification() {
  const formEl = document.querySelector('[data-practice-guide-authoring-form]');
  const modalEl = document.querySelector('[data-practice-guide-modify-modal]');
  const openButtonEl = document.querySelector('[data-practice-guide-modify-open]');
  if (
    !(formEl instanceof HTMLFormElement)
    || !(modalEl instanceof HTMLElement)
    || !(openButtonEl instanceof HTMLButtonElement)
    || !window.bootstrap?.Modal
  ) {
    return;
  }

  const requestEl = modalEl.querySelector('[data-practice-guide-modify-request]');
  const comparisonEl = modalEl.querySelector('[data-practice-guide-modify-comparison]');
  const generateButtonEl = modalEl.querySelector('[data-practice-guide-modify-generate]');
  const retryButtonEl = modalEl.querySelector('[data-practice-guide-modify-retry]');
  const applyButtonEl = modalEl.querySelector('[data-practice-guide-modify-apply]');
  const applyLabelEl = modalEl.querySelector('[data-practice-guide-modify-apply-label]');
  const applySpinnerEl = modalEl.querySelector('[data-practice-guide-modify-apply-spinner]');
  const applyIconEl = modalEl.querySelector('[data-practice-guide-modify-apply-icon]');
  const errorEl = modalEl.querySelector('[data-practice-guide-modify-error]');
  const errorMessageEl = modalEl.querySelector('[data-practice-guide-modify-error-message]');
  const creditLinkEl = modalEl.querySelector('[data-practice-guide-modify-credit-link]');
  const csrfEl = formEl.querySelector('input[name="_csrf"]');
  const previewEndpoint = modalEl.dataset.practiceGuideModifyEndpoint || '';
  const applyEndpoint = modalEl.dataset.practiceGuideModifyApplyEndpoint || '';
  const discardEndpoint = modalEl.dataset.practiceGuideModifyDiscardEndpoint || '';
  if (
    !(requestEl instanceof HTMLTextAreaElement)
    || !(comparisonEl instanceof HTMLElement)
    || !(generateButtonEl instanceof HTMLButtonElement)
    || !(retryButtonEl instanceof HTMLButtonElement)
    || !(applyButtonEl instanceof HTMLButtonElement)
    || !(applyLabelEl instanceof HTMLElement)
    || !(applySpinnerEl instanceof HTMLElement)
    || !(applyIconEl instanceof HTMLElement)
    || !(errorEl instanceof HTMLElement)
    || !(errorMessageEl instanceof HTMLElement)
    || !(creditLinkEl instanceof HTMLElement)
    || !(csrfEl instanceof HTMLInputElement)
    || !previewEndpoint
    || !applyEndpoint
    || !discardEndpoint
  ) {
    return;
  }

  const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
  const dismissButtons = Array.from(
    modalEl.querySelectorAll('[data-practice-guide-modify-dismiss]'),
  ).filter((element) => element instanceof HTMLButtonElement);
  const labels = {
    current: modalEl.dataset.currentLabel || '',
    fields: {
      description: modalEl.dataset.fieldDescription,
      title: modalEl.dataset.fieldTitle,
      tutorInstructions: modalEl.dataset.fieldTutorInstructions,
    },
    proposed: modalEl.dataset.proposedLabel || '',
  };
  let previewId = '';
  let applied = false;
  let isBusy = false;

  const show = (element, visible) => element?.classList.toggle('d-none', !visible);
  const setPhase = (phase) => {
    for (const element of modalEl.querySelectorAll('[data-practice-guide-modify-phase]')) {
      show(element, element.getAttribute('data-practice-guide-modify-phase') === phase);
    }
    const generating = phase === 'generating';
    show(generateButtonEl, phase === 'describe');
    show(retryButtonEl, phase === 'preview');
    show(applyButtonEl, phase === 'preview');
    for (const button of dismissButtons) {
      show(button, !generating);
    }
  };
  const showError = (message, creditExhausted = false) => {
    errorMessageEl.textContent = message || modalEl.dataset.genericError || '';
    errorEl.classList.remove('d-none');
    creditLinkEl.classList.toggle('d-none', !creditExhausted);
  };
  const hideError = () => {
    errorEl.classList.add('d-none');
    creditLinkEl.classList.add('d-none');
  };
  const discardPreview = () => {
    if (!previewId || applied) {
      return;
    }
    const discardedPreviewId = previewId;
    previewId = '';
    postPracticeGuideModification(discardEndpoint, {
      _csrf: csrfEl.value,
      previewId: discardedPreviewId,
    }).catch(() => {});
  };

  openButtonEl.addEventListener('click', () => {
    discardPreview();
    previewId = '';
    applied = false;
    requestEl.value = '';
    requestEl.setCustomValidity('');
    comparisonEl.replaceChildren();
    hideError();
    setPhase('describe');
    modal.show();
  });

  requestEl.addEventListener('input', () => requestEl.setCustomValidity(''));
  modalEl.addEventListener('shown.bs.modal', () => {
    if (!requestEl.closest('.d-none')) {
      requestEl.focus();
    }
  });
  modalEl.addEventListener('hidden.bs.modal', discardPreview);

  generateButtonEl.addEventListener('click', async () => {
    const requestedChange = requestEl.value.trim();
    if (isBusy) {
      return;
    }
    if (requestedChange.length < 3) {
      requestEl.setCustomValidity(modalEl.dataset.genericError || '');
      requestEl.reportValidity();
      return;
    }

    const currentDraft = buildCurrentPracticeGuideDraft(formEl);
    hideError();
    if (!currentDraft) {
      showError('');
      return;
    }

    discardPreview();
    isBusy = true;
    setPhase('generating');
    try {
      const response = await postPracticeGuideModification(previewEndpoint, {
        _csrf: csrfEl.value,
        currentDraft: JSON.stringify(currentDraft),
        requestedChange,
      });
      const payload = await response.json().catch(() => ({}));
      if (
        !response.ok
        || typeof payload.previewId !== 'string'
        || !renderPracticeGuideModificationChanges(comparisonEl, payload.changes, labels)
      ) {
        showError(payload.error, Boolean(payload.creditExhausted));
        setPhase('describe');
        return;
      }

      previewId = payload.previewId;
      setPhase('preview');
    } catch {
      showError('');
      setPhase('describe');
    } finally {
      isBusy = false;
    }
  });

  retryButtonEl.addEventListener('click', () => {
    discardPreview();
    comparisonEl.replaceChildren();
    hideError();
    setPhase('describe');
    requestEl.focus();
  });

  applyButtonEl.addEventListener('click', async () => {
    if (isBusy || !previewId) {
      return;
    }

    isBusy = true;
    hideError();
    applyButtonEl.disabled = true;
    applyLabelEl.textContent = modalEl.dataset.applyingLabel || '';
    applySpinnerEl.classList.remove('d-none');
    applyIconEl.classList.add('d-none');
    retryButtonEl.disabled = true;
    for (const button of dismissButtons) {
      button.disabled = true;
    }
    try {
      const response = await postPracticeGuideModification(applyEndpoint, {
        _csrf: csrfEl.value,
        previewId,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        if (response.status === 409) {
          previewId = '';
          comparisonEl.replaceChildren();
          setPhase('describe');
        }
        showError(payload.error);
        return;
      }

      applied = true;
      window.location.assign(payload.redirect || window.location.href);
    } catch {
      showError('');
    } finally {
      isBusy = false;
      applyButtonEl.disabled = false;
      applyLabelEl.textContent = modalEl.dataset.applyLabel || '';
      applySpinnerEl.classList.add('d-none');
      applyIconEl.classList.remove('d-none');
      retryButtonEl.disabled = false;
      for (const button of dismissButtons) {
        button.disabled = false;
      }
    }
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
