// Attach wizard: process → review → accept.
//
// Nothing reaches the conversation until the user has read the extracted text
// and accepted it. That is the whole point of the flow: the text shown in the
// review step is byte-for-byte what the model will receive, so approving it is
// a real decision rather than a formality.
//
// Two outcomes only — accept or cancel. There is no reprocess: a user who wants
// a different extraction cancels and attaches the document again. What they can
// do is correct the text in place before accepting, which is cheaper than
// re-shooting a photo and makes the approval a real edit rather than a rubber
// stamp.

import { t } from './i18n.js';

const iconBySourceType = {
  docx: 'bi-file-earmark-word',
  image: 'bi-file-earmark-image',
  pdf: 'bi-file-earmark-pdf',
  url: 'bi-globe2',
};

const processingLabelByExtension = {
  docx: 'attachments.processing.docx',
  jpeg: 'attachments.processing.image',
  jpg: 'attachments.processing.image',
  pdf: 'attachments.processing.pdf',
  png: 'attachments.processing.image',
  webp: 'attachments.processing.image',
};

function readCsrfToken(root) {
  const input = root.closest('form')?.querySelector('input[name="_csrf"]')
    || document.querySelector('input[name="_csrf"]');
  return input instanceof HTMLInputElement ? input.value : '';
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  const kilobytes = bytes / 1024;
  return kilobytes < 1024
    ? `${Math.round(kilobytes)} KB`
    : `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function initializeAttachmentPicker(root = document) {
  const picker = root.querySelector('[data-attachment-picker]');
  const wizard = root.querySelector('[data-attachment-wizard]');
  if (!picker || !wizard) {
    return null;
  }

  const idsInput = picker.querySelector('[data-attachment-ids]');
  const list = picker.querySelector('[data-attachment-list]');
  const fileInput = wizard.querySelector('[data-attachment-file-input]');
  const urlInput = wizard.querySelector('[data-attachment-url-input]');
  const processButton = wizard.querySelector('[data-attachment-process]');
  const acceptButton = wizard.querySelector('[data-attachment-accept]');
  const cancelButton = wizard.querySelector('[data-attachment-cancel]');
  const closeButton = wizard.querySelector('[data-attachment-wizard-close]');
  const errorBox = wizard.querySelector('[data-attachment-error]');
  const processingLabel = wizard.querySelector('[data-attachment-processing-label]');
  const reviewText = wizard.querySelector('[data-attachment-review-text]');
  const reviewKind = wizard.querySelector('[data-attachment-review-kind]');
  const reviewMeta = wizard.querySelector('[data-attachment-review-meta]');
  const reviewNotices = wizard.querySelector('[data-attachment-review-notices]');

  if (!idsInput || !list || !fileInput || !processButton || !acceptButton) {
    return null;
  }

  /** Attachments the user has already accepted, carried by the form. */
  const attached = [];
  /** The attachment awaiting a decision in the review step. */
  let pending = null;
  let mode = 'file';

  function phaseElement(name) {
    return wizard.querySelector(`[data-attachment-phase="${name}"]`);
  }

  function setPhase(name) {
    for (const phase of ['choose', 'processing', 'review', 'error']) {
      phaseElement(phase)?.classList.toggle('d-none', phase !== name);
    }

    processButton.classList.toggle('d-none', name !== 'choose');
    acceptButton.classList.toggle('d-none', name !== 'review');

    // During processing the only way out is Cancel: the close button and the
    // backdrop are inert so a stray click cannot abandon an inference the user
    // is already paying for without saying so.
    const processing = name === 'processing';
    closeButton?.classList.toggle('d-none', processing);
    if (cancelButton) {
      cancelButton.textContent = processing
        ? t('common.cancel')
        : t('common.cancel');
    }
  }

  function renderAttachedList() {
    idsInput.value = attached.map((item) => item.id).join(',');
    list.classList.toggle('d-none', attached.length === 0);
    list.replaceChildren();

    for (const item of attached) {
      const entry = document.createElement('li');
      entry.className = 'list-group-item d-flex align-items-start gap-2';

      const icon = document.createElement('i');
      icon.className = `bi ${iconBySourceType[item.sourceType] || 'bi-paperclip'} mt-1`;
      icon.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');
      body.className = 'flex-grow-1';

      const name = document.createElement('div');
      name.textContent = String(item.displayName || '');
      body.append(name);

      const meta = document.createElement('small');
      meta.className = 'text-body-secondary';
      meta.textContent = describeAttachment(item);
      body.append(meta);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-sm btn-outline-secondary';
      remove.setAttribute(
        'aria-label',
        t('attachments.removeLabel', { name: String(item.displayName || '') }),
      );
      remove.textContent = t('attachments.remove');
      remove.addEventListener('click', () => {
        void discard(String(item.id), true);
      });

      entry.append(icon, body, remove);
      list.append(entry);
    }
  }

  function describeAttachment(item) {
    const details = [];
    if (item.pageCount) {
      details.push(t('attachments.pageCount', { count: item.pageCount }));
    }
    details.push(
      t('attachments.characterCount', { count: (item.text || '').length }),
    );
    return details.join(' · ');
  }

  async function discard(id, removeFromList) {
    if (removeFromList) {
      const index = attached.findIndex((item) => item.id === id);
      if (index >= 0) {
        attached.splice(index, 1);
        renderAttachedList();
      }
    }

    // Best effort: a staged entry expires on its own, so a failed delete is not
    // worth interrupting the user over.
    await fetch(`/attachments/${encodeURIComponent(id)}`, {
      headers: { 'x-csrf-token': readCsrfToken(picker) },
      method: 'DELETE',
    }).catch(() => {});
  }

  function showError(message) {
    if (errorBox) {
      errorBox.textContent = message;
    }
    setPhase('error');
  }

  function renderReview(attachment) {
    pending = attachment;

    if (reviewText) {
      reviewText.value = attachment.text || '';
    }

    // "What the document says" and "what Mr. F saw" are different claims and
    // the user is agreeing to one of them specifically.
    if (reviewKind) {
      reviewKind.textContent = attachment.textIsDescription
        ? t('attachments.reviewKindDescription')
        : t('attachments.reviewKindVerbatim');
    }

    if (reviewMeta) {
      reviewMeta.textContent = [
        attachment.displayName,
        describeAttachment(attachment),
      ]
        .filter(Boolean)
        .join(' · ');
    }

    if (reviewNotices) {
      reviewNotices.replaceChildren();

      // Truncation has to be visible: a screen that claims to show what the
      // system understood while silently dropping the tail is lying.
      if (attachment.truncated) {
        reviewNotices.append(
          buildNotice('alert-warning', t('attachments.truncatedNotice')),
        );
      }
      for (const warning of attachment.warnings || []) {
        reviewNotices.append(buildNotice('alert-warning', String(warning)));
      }
    }

    setPhase('review');
  }

  function buildNotice(variant, text) {
    const notice = document.createElement('div');
    notice.className = `alert ${variant} py-2 px-3`;
    notice.setAttribute('role', 'alert');
    notice.textContent = text;
    return notice;
  }

  function processingLabelFor(fileName) {
    const extension = /\.([a-z0-9]+)$/i.exec(fileName || '')?.[1]?.toLowerCase();
    const key = processingLabelByExtension[extension];
    return key ? t(key) : t('attachments.processing.generic');
  }

  /** The prompt the user has already written, so extraction knows what matters. */
  function currentUserPrompt() {
    const field = picker.closest('form')?.querySelector('textarea[name="prompt"]')
      || document.querySelector('#messageInput');
    return field instanceof HTMLTextAreaElement ? field.value.trim() : '';
  }

  async function receive(response) {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      showError(
        payload?.error?.message
          || (payload?.error?.code === 'credit_exhausted'
            ? t('attachments.error.creditExhausted')
            : t('attachments.error.uploadFailed')),
      );
      return;
    }

    renderReview(payload.attachment);
  }

  async function process() {
    const prompt = currentUserPrompt();

    if (mode === 'url') {
      const value = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : '';
      if (!value) {
        return;
      }

      if (processingLabel) {
        processingLabel.textContent = t('attachments.processing.url');
      }
      setPhase('processing');

      try {
        await receive(
          await fetch('/attachments/process-url', {
            body: new URLSearchParams({ prompt, url: value }).toString(),
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'x-csrf-token': readCsrfToken(picker),
            },
            method: 'POST',
          }),
        );
      } catch {
        showError(t('attachments.error.uploadFailed'));
      }
      return;
    }

    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    if (processingLabel) {
      processingLabel.textContent = processingLabelFor(file.name);
    }
    setPhase('processing');

    try {
      await receive(
        await fetch('/attachments/process', {
          body: file,
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-attachment-filename': encodeURIComponent(file.name),
            'x-attachment-prompt': encodeURIComponent(prompt),
            'x-csrf-token': readCsrfToken(picker),
          },
          method: 'POST',
        }),
      );
    } catch {
      showError(t('attachments.error.uploadFailed'));
    }
  }

  async function accept() {
    if (!pending) {
      return;
    }

    // Whatever is in the box is what gets attached. The user may have corrected
    // a column read out of order or a misread word, and their version is the
    // one the model should see.
    const text = reviewText instanceof HTMLTextAreaElement ? reviewText.value : '';

    const response = await fetch(
      `/attachments/${encodeURIComponent(pending.id)}/approve`,
      {
        body: new URLSearchParams({ _csrf: readCsrfToken(picker), text }).toString(),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      },
    ).catch(() => null);

    const payload = await response?.json().catch(() => null);
    if (!response?.ok) {
      showError(payload?.error?.message || t('attachments.error.uploadFailed'));
      return;
    }

    attached.push(payload?.attachment ?? pending);
    pending = null;
    renderAttachedList();
    closeWizard();
  }

  function closeWizard() {
    const instance = window.bootstrap?.Modal.getInstance(wizard);
    instance?.hide();
  }

  function resetWizard() {
    // An attachment the user walked away from is discarded server-side rather
    // than left to expire, so the per-user staging slot frees immediately.
    if (pending) {
      void discard(String(pending.id), false);
      pending = null;
    }

    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = '';
    }
    if (urlInput instanceof HTMLInputElement) {
      urlInput.value = '';
    }
    setPhase('choose');
  }

  for (const trigger of picker.querySelectorAll('[data-attachment-open]')) {
    trigger.addEventListener('click', () => {
      mode = trigger.getAttribute('data-attachment-open') === 'url' ? 'url' : 'file';
      wizard
        .querySelector('[data-attachment-choose="file"]')
        ?.classList.toggle('d-none', mode !== 'file');
      wizard
        .querySelector('[data-attachment-choose="url"]')
        ?.classList.toggle('d-none', mode !== 'url');
      resetWizard();
    });
  }

  processButton.addEventListener('click', () => {
    void process();
  });
  acceptButton.addEventListener('click', () => {
    void accept();
  });
  cancelButton?.addEventListener('click', () => {
    resetWizard();
    closeWizard();
  });
  wizard.addEventListener('hidden.bs.modal', resetWizard);

  urlInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    // The wizard sits inside the generation form; Enter here must process the
    // URL, not submit the form with an unattached address.
    event.preventDefault();
    void process();
  });

  return {
    clear() {
      attached.length = 0;
      renderAttachedList();
    },
    getIds() {
      return attached.map((item) => String(item.id));
    },
  };
}
