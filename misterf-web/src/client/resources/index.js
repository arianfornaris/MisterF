import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
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

initializeResourceFolderEditing();
initializeResourceMoveModal();
initializeListGroupDropdownStacking();
initializeStaticMarkdown();
