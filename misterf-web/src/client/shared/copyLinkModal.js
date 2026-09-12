import { copyTextToClipboard } from './clipboard.js';
import { t } from './i18n.js';

/**
 * Wires the owner's "Compartir una copia" modal
 * (views/partials/resource-copy-link-modal.ejs): copy the link, hand it to the
 * native share sheet, and reopen the modal after creating or revoking the link.
 */
export function initializeCopyLinkModal() {
  const fieldEl = document.querySelector('[data-copy-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-link-copy]');
  const nativeShareButtonEl = document.querySelector('[data-copy-link-native-share]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-copy-link-modal]');

  if (copyButtonEl && fieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(fieldEl.value);
      copyButtonEl.textContent = copied ? t('clientMisc.copied') : t('clientMisc.copyFailed');
      window.setTimeout(() => {
        copyButtonEl.innerHTML = `<i class="bi bi-copy me-1" aria-hidden="true"></i>${t('clientMisc.copy')}`;
      }, 1200);
    });
  }

  if (nativeShareButtonEl instanceof HTMLElement) {
    if (typeof navigator.share !== 'function') {
      nativeShareButtonEl.classList.add('d-none');
    } else if (fieldEl instanceof HTMLInputElement) {
      nativeShareButtonEl.addEventListener('click', async () => {
        if (!fieldEl.value) {
          return;
        }

        try {
          await navigator.share({
            title: nativeShareButtonEl.dataset.shareTitle || '',
            url: fieldEl.value,
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
