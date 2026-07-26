import { copyTextToClipboard } from '../shared/clipboard.js';
import { createTranslatorController } from './controller.js';

// The translator modal lives in the shared app shell, so it is available on
// every authenticated page (chat, resources, roleplays, quizzes, ...). This
// entry owns wiring it up everywhere. It runs before the page-specific bundle
// and no-ops on pages that do not render the shell.

const translatorModalEl = document.querySelector('#translatorModal');

if (translatorModalEl) {
  const socketAuthToken = document.body.dataset.socketAuthToken || '';
  // Translation runs over the same authenticated socket the chat uses. Guests
  // have no token, so they get the UI without a live connection (submitting is
  // a no-op), matching the chat page's guest behavior.
  const socket =
    socketAuthToken && typeof window.io === 'function'
      ? window.io({ auth: { token: socketAuthToken } })
      : null;

  let pendingTranslatorSelection = '';

  const translatorController = createTranslatorController({
    copyTextToClipboard,
    getPendingTranslatorSelection: () => pendingTranslatorSelection,
    getSocket: () => socket,
    setPendingTranslatorSelection: (value) => {
      pendingTranslatorSelection = value;
    },
    translatorCopyButtonEls: document.querySelectorAll('[data-translator-copy]'),
    translatorFormEl: document.querySelector('#translatorForm'),
    translatorFromEnLabelEl: document.querySelector('[data-translator-from-en-label]'),
    translatorInputEl: document.querySelector('#translatorInput'),
    translatorLanguageMenuEl: document.querySelector('[data-translator-language-menu]'),
    translatorModalEl,
    translatorOpenButtonEls: document.querySelectorAll('[data-open-translator]'),
    translatorResultEl: document.querySelector('#translatorResult'),
    translatorSubmitEl: document.querySelector('[data-translator-submit]'),
    translatorToEnLabelEl: document.querySelector('[data-translator-to-en-label]'),
  });

  translatorController.bindUi();

  socket?.on('translator:result', (payload) => {
    translatorController.handleResult(payload);
  });

  socket?.on('translator:error', (payload) => {
    translatorController.handleError(payload);
  });
}
