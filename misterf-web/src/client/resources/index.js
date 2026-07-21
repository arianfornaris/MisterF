import { t } from '../shared/i18n.js';
import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';
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

function initializeResourceFolderSharing() {
  const shareFieldEl = document.querySelector('[data-resource-folder-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-resource-folder-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-resource-folder-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-resource-share-modal]');

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
            title: 'Carpeta compartida',
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

/**
 * Starting a shared resource is a plain link navigation, but the server may
 * run an inference before it can answer (a roleplay generates its opening
 * turn). Show the pending modal on click so the learner never waits on a
 * blank page.
 */
function initializeSharedResourceStart() {
  const startLinkEl = document.querySelector('[data-shared-resource-start]');
  const pendingModalEl = document.querySelector('[data-shared-resource-pending-modal]');
  if (!(startLinkEl instanceof HTMLAnchorElement) || !pendingModalEl) {
    return;
  }

  startLinkEl.addEventListener('click', () => {
    startLinkEl.classList.add('disabled');
    startLinkEl.setAttribute('aria-disabled', 'true');
    if (window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
    }
  });
}

initializeResourceFolderEditing();
initializeResourceFolderSharing();
initializeSharedResourceStart();
initializeResourceMoveModal();
initializeListGroupDropdownStacking();
initializeStaticMarkdown();
