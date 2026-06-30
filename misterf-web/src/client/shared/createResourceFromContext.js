const RESOURCE_TYPE_LABELS = {
  quiz: 'quiz',
  practice_guide: 'guía de práctica',
  roleplay: 'roleplay',
};

/**
 * Wires the reusable "Crear recurso" menu + modal (partials/create-resource-from-context.ejs).
 * Menu items set the resource type and open the modal; the form posts to the
 * server-rendered action with an optional instruction.
 */
export function initializeCreateResourceFromContext() {
  const modalEl = document.querySelector('#createResourceFromContextModal');
  const formEl = document.querySelector('[data-create-resource-from-context-form]');
  if (!modalEl || !formEl) {
    return;
  }

  const typeEl = formEl.querySelector('[data-create-resource-from-context-type]');
  const labelEl = modalEl.querySelector('[data-create-resource-from-context-label]');
  const buttonEls = document.querySelectorAll('[data-create-resource-from-context]');

  buttonEls.forEach((buttonEl) => {
    buttonEl.addEventListener('click', () => {
      const type = buttonEl.dataset.resourceType || '';
      if (!type) {
        return;
      }

      if (typeEl) {
        typeEl.value = type;
      }
      if (labelEl) {
        labelEl.textContent = RESOURCE_TYPE_LABELS[type] || 'recurso';
      }

      if (window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else {
        formEl.submit();
      }
    });
  });

  formEl.addEventListener('submit', () => {
    const submitEl = formEl.querySelector('[data-create-resource-from-context-submit]');
    if (submitEl instanceof HTMLButtonElement) {
      submitEl.disabled = true;
      submitEl.textContent = submitEl.dataset.loadingText || 'Creando recurso...';
    }
  });
}
