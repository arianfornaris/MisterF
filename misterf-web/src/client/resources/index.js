import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
import { initializeStaticMarkdown } from '../shared/staticMarkdown.js';

function initializeResourceFolderEditing() {
  const formEl = document.querySelector('[data-resource-folder-edit-form]');
  const titleInputEl = document.querySelector('[data-resource-folder-edit-title]');
  const descriptionInputEl = document.querySelector('[data-resource-folder-edit-description]');

  if (
    !(formEl instanceof HTMLFormElement) ||
    !(titleInputEl instanceof HTMLInputElement) ||
    !(descriptionInputEl instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  for (const buttonEl of document.querySelectorAll('[data-resource-folder-edit]')) {
    buttonEl.addEventListener('click', () => {
      if (!(buttonEl instanceof HTMLElement)) {
        return;
      }

      const folderId = buttonEl.dataset.resourceFolderId || '';
      formEl.action = `/resources/folders/${encodeURIComponent(folderId)}`;
      titleInputEl.value = buttonEl.dataset.resourceFolderTitle || '';
      descriptionInputEl.value = buttonEl.dataset.resourceFolderDescription || '';
    });
  }
}

function initializeResourceMoveModal() {
  const formEl = document.querySelector('[data-resource-move-form]');
  const folderInputEl = document.querySelector('[data-resource-move-folder-id]');
  const titleEl = document.querySelector('[data-resource-move-title]');
  const selectionEl = document.querySelector('[data-resource-move-selection]');
  const selectionLabelEl = document.querySelector('[data-resource-move-selection-label]');
  const submitButtonEl = document.querySelector('[data-resource-move-submit]');
  const destinationButtonEls = Array.from(document.querySelectorAll('[data-resource-move-destination]'));

  if (
    !(formEl instanceof HTMLFormElement) ||
    !(folderInputEl instanceof HTMLInputElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(selectionEl instanceof HTMLElement) ||
    !(selectionLabelEl instanceof HTMLElement) ||
    !(submitButtonEl instanceof HTMLButtonElement)
  ) {
    return;
  }

  let activeResourceId = '';
  let activeCurrentFolderId = '';

  function resetDestinationSelection() {
    formEl.removeAttribute('action');
    folderInputEl.value = '';
    selectionEl.hidden = true;
    selectionLabelEl.textContent = '';
    submitButtonEl.disabled = true;

    for (const destinationButtonEl of destinationButtonEls) {
      destinationButtonEl.classList.remove('active');
      destinationButtonEl.removeAttribute('aria-current');
    }
  }

  for (const buttonEl of document.querySelectorAll('[data-resource-move-open]')) {
    buttonEl.addEventListener('click', () => {
      if (!(buttonEl instanceof HTMLElement)) {
        return;
      }

      activeResourceId = buttonEl.dataset.resourceId || '';
      activeCurrentFolderId = buttonEl.dataset.currentFolderId || '';
      titleEl.textContent = buttonEl.dataset.resourceTitle || 'este recurso';
      resetDestinationSelection();
    });
  }

  for (const destinationButtonEl of destinationButtonEls) {
    destinationButtonEl.addEventListener('click', () => {
      if (!(destinationButtonEl instanceof HTMLElement) || !activeResourceId) {
        return;
      }

      resetDestinationSelection();
      destinationButtonEl.classList.add('active');
      destinationButtonEl.setAttribute('aria-current', 'true');
      selectionEl.hidden = false;
      selectionLabelEl.textContent = destinationButtonEl.dataset.resourceMoveLabel || '';
      submitButtonEl.disabled = false;

      if (destinationButtonEl.dataset.resourceMoveRoot === 'true') {
        if (!activeCurrentFolderId) {
          submitButtonEl.disabled = true;
          return;
        }

        formEl.setAttribute(
          'action',
          `/resources/folders/${encodeURIComponent(activeCurrentFolderId)}/items/${encodeURIComponent(activeResourceId)}/remove`,
        );
        return;
      }

      const folderId = destinationButtonEl.dataset.folderId || '';
      if (!folderId) {
        submitButtonEl.disabled = true;
        return;
      }

      formEl.setAttribute('action', `/resources/${encodeURIComponent(activeResourceId)}/folder`);
      folderInputEl.value = folderId;
    });
  }

  formEl.addEventListener('submit', (event) => {
    if (!formEl.getAttribute('action') || submitButtonEl.disabled) {
      event.preventDefault();
    }
  });
}

initializeResourceFolderEditing();
initializeResourceMoveModal();
initializeListGroupDropdownStacking();
initializeStaticMarkdown();
