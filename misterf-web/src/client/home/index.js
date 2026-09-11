import { preserveHomeDraft } from '../chat/utils/storage.js';
import { initializeAttachmentPicker } from '../shared/attachmentPicker.js';

/*
 * The learning home's "Ask Mr. F" box (Roadmap V3 §1.16). It is not a second
 * composer: it carries the text and any accepted attachments to `/chat` and
 * the chat's own composer takes it from there, so there is one send path, one
 * credit gate and one place that talks to the tutor.
 *
 * Attachments use the same picker and wizard as the chat composer
 * (`prompt-attachments`): processing and approval happen here, and the chat
 * claims the staged ids when the learner sends.
 *
 * The textarea has no `name`, so without this script the form still works — it
 * opens `/chat` — and the text can never leak into the query string.
 */
const formEl = document.querySelector('[data-home-ask-form]');
const inputEl = document.querySelector('[data-home-ask-input]');
const attachmentPicker = formEl ? initializeAttachmentPicker(formEl) : null;

function openChatWithDraft() {
  const text = inputEl.value.trim();
  const attachments = attachmentPicker?.getAttachedSummaries() ?? [];
  if (text || attachments.length > 0) {
    preserveHomeDraft({ attachments, text });
  }

  window.location.assign(formEl.getAttribute('action') || '/chat');
}

if (formEl && inputEl) {
  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    openChatWithDraft();
  });

  // Same keys as the chat composer: Enter sends, Shift+Enter breaks the line.
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      openChatWithDraft();
    }
  });
}
