// Renders attachments inside a transcript message, and opens what the system
// actually read from them.
//
// The text shown here is the same artifact the user approved when they attached
// the file, and the same one the model receives on every turn. Nothing richer
// is held back, so this view is complete rather than a summary of something
// else — which is the only reason it can honestly be labelled as what Mr. F
// read.

import { t } from './i18n.js';

const iconBySourceType = {
  docx: 'bi-file-earmark-word',
  image: 'bi-file-earmark-image',
  pdf: 'bi-file-earmark-pdf',
  url: 'bi-globe2',
};

function describeAttachment(attachment) {
  const details = [];
  if (attachment.pageCount) {
    details.push(t('attachments.pageCount', { count: attachment.pageCount }));
  }
  details.push(
    t('attachments.characterCount', { count: (attachment.text || '').length }),
  );
  return details.join(' · ');
}

let viewerModal = null;

function openViewer(attachment) {
  const modal = document.querySelector('[data-attachment-viewer]');
  if (!modal || !window.bootstrap) {
    return;
  }

  const set = (selector, value) => {
    const element = modal.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  };

  set('[data-attachment-viewer-name]', attachment.displayName || '');
  set('[data-attachment-viewer-meta]', describeAttachment(attachment));
  // An edited attachment is neither a verbatim read nor the extractor's own
  // output any more, and saying otherwise would misdescribe it.
  set(
    '[data-attachment-viewer-kind]',
    attachment.edited
      ? t('attachments.reviewKindEdited')
      : attachment.textIsDescription
        ? t('attachments.reviewKindDescription')
        : t('attachments.reviewKindVerbatim'),
  );
  set('[data-attachment-viewer-text]', attachment.text || '');

  const notices = modal.querySelector('[data-attachment-viewer-notices]');
  if (notices) {
    notices.replaceChildren();
    if (attachment.truncated) {
      const notice = document.createElement('div');
      notice.className = 'alert alert-warning py-2 px-3';
      notice.setAttribute('role', 'alert');
      notice.textContent = t('attachments.truncatedNotice');
      notices.append(notice);
    }
  }

  const source = modal.querySelector('[data-attachment-viewer-source]');
  if (source instanceof HTMLAnchorElement) {
    source.classList.toggle('d-none', !attachment.sourceUrl);
    if (attachment.sourceUrl) {
      source.href = attachment.sourceUrl;
      source.textContent = attachment.sourceUrl;
    }
  }

  viewerModal = viewerModal || new window.bootstrap.Modal(modal);
  viewerModal.show();
}

/**
 * Appends one chip per attachment to a message bubble. Returns the number
 * rendered so callers can skip layout work when there are none.
 */
export function renderMessageAttachments(bubble, metadata) {
  const attachments = Array.isArray(metadata?.attachments)
    ? metadata.attachments
    : [];
  if (attachments.length === 0) {
    return 0;
  }

  const row = document.createElement('div');
  row.className = 'message-attachments d-flex flex-wrap gap-2 mt-2';

  for (const attachment of attachments) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1';
    chip.setAttribute(
      'aria-label',
      t('attachments.viewLabel', { name: String(attachment.displayName || '') }),
    );

    const icon = document.createElement('i');
    icon.className = `bi ${iconBySourceType[attachment.sourceType] || 'bi-paperclip'}`;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = String(attachment.displayName || '');

    chip.append(icon, label);
    chip.addEventListener('click', () => openViewer(attachment));
    row.append(chip);
  }

  bubble.append(row);
  return attachments.length;
}
