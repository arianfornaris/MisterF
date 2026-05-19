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
            title: 'Módulo de práctica compartido',
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

function initializePracticeModuleCollectionForms() {
  const formEls = document.querySelectorAll('[data-practice-module-add-to-collection-form]');

  for (const formEl of formEls) {
    const selectEl = formEl.querySelector('[data-practice-module-collection-select]');
    if (!(selectEl instanceof HTMLSelectElement)) {
      continue;
    }

    const syncAction = () => {
      const selectedOption = selectEl.selectedOptions[0];
      const action = selectedOption?.dataset.action;
      if (action) {
        formEl.setAttribute('action', action);
      }
    };

    syncAction();
    selectEl.addEventListener('change', syncAction);
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

  for (const formEl of document.querySelectorAll('form[action="/practice-modules/generate-draft"]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-resource-generate-submit]');
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-resource-pending-modal]');

    formEl.addEventListener('submit', () => {
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = 'Creando...';
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

function initializeCollectionModulePickers() {
  const pickerForms = document.querySelectorAll('[data-collection-module-picker]');

  for (const formEl of pickerForms) {
    const filterEl = formEl.querySelector('[data-collection-module-filter]');
    const itemEls = Array.from(formEl.querySelectorAll('[data-collection-module-item]'));
    const emptyEl = formEl.querySelector('[data-collection-module-empty]');

    if (!(filterEl instanceof HTMLInputElement) || itemEls.length === 0) {
      continue;
    }

    const applyFilter = () => {
      const query = filterEl.value.trim().toLowerCase();
      let visibleCount = 0;

      for (const itemEl of itemEls) {
        const haystack = itemEl.getAttribute('data-search-text') || '';
        const isVisible = !query || haystack.includes(query);
        itemEl.classList.toggle('d-none', !isVisible);
        if (isVisible) {
          visibleCount += 1;
        }
      }

      if (emptyEl) {
        emptyEl.classList.toggle('d-none', visibleCount > 0);
      }
    };

    filterEl.addEventListener('input', applyFilter);
    applyFilter();
  }
}

initializePracticeModuleSharingUi();
initializePracticeModuleCollectionForms();
initializeCollectionModulePickers();
initializeAutoOpenModal();
initializeResourceGenerationPendingUi();
