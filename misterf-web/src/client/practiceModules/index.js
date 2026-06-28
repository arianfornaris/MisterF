import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
import { initializeMarkdownEditors } from '../shared/markdownEditor.js';
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

function initializePracticeModuleSharingUi() {
  const shareFieldEl = document.querySelector('[data-practiceModule-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-practiceModule-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-practiceModule-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-share-modal]');

  if (copyButtonEl && shareFieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(shareFieldEl.value);
      copyButtonEl.textContent = copied ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        copyButtonEl.innerHTML = '<i class="bi bi-copy me-1" aria-hidden="true"></i>Copiar';
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
            title: 'Guía de práctica compartida',
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

initializePracticeModuleSharingUi();
initializeAutoOpenModal();
initializeResourceGenerationPendingUi();
initializeResourceMoveModal();
initializeListGroupDropdownStacking();
initializeMarkdownEditors();
initializeStaticMarkdown();
