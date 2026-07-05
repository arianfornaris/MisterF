import { t } from '../../shared/i18n.js';

const STORAGE_KEY = 'misterf_translator_lang';

export function createTranslatorController(deps) {
  const languages = Array.isArray(window.__TRANSLATOR_LANGUAGES__)
    ? window.__TRANSLATOR_LANGUAGES__
    : [];

  function getStoredLanguageCode() {
    let stored = '';
    try {
      stored = window.localStorage?.getItem(STORAGE_KEY) || '';
    } catch {
      stored = '';
    }
    if (languages.some((language) => language.code === stored)) {
      return stored;
    }
    return languages[0]?.code || 'es';
  }

  let currentLanguageCode = getStoredLanguageCode();

  function currentLanguage() {
    return (
      languages.find((language) => language.code === currentLanguageCode) ||
      languages[0] || {
        code: currentLanguageCode,
        endonym: currentLanguageCode.toUpperCase(),
      }
    );
  }

  function applyLanguage(code) {
    currentLanguageCode = code;
    try {
      window.localStorage?.setItem(STORAGE_KEY, code);
    } catch {
      // Ignore storage failures (private mode, disabled storage).
    }

    const upper = code.toUpperCase();
    if (deps.translatorToEnLabelEl) {
      deps.translatorToEnLabelEl.textContent = `${upper} → EN`;
    }
    if (deps.translatorFromEnLabelEl) {
      deps.translatorFromEnLabelEl.textContent = `EN → ${upper}`;
    }
    if (deps.translatorLanguageMenuEl) {
      for (const item of deps.translatorLanguageMenuEl.querySelectorAll(
        '[data-translator-language]',
      )) {
        item.classList.toggle('active', item.dataset.translatorLanguage === code);
      }
    }
  }

  function renderLanguageMenu() {
    if (!deps.translatorLanguageMenuEl) {
      return;
    }
    deps.translatorLanguageMenuEl.replaceChildren();
    for (const language of languages) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dropdown-item';
      button.dataset.translatorLanguage = language.code;
      button.textContent = language.endonym;
      button.addEventListener('click', () => {
        applyLanguage(language.code);
      });
      item.appendChild(button);
      deps.translatorLanguageMenuEl.appendChild(item);
    }
  }

  function translateSelectedAppText() {
    const selectedText = deps.getPendingTranslatorSelection() || getSelectedAppText();
    deps.setPendingTranslatorSelection('');
    if (!selectedText) {
      return;
    }

    const autoModeInput = deps.translatorFormEl?.querySelector(
      'input[name="translatorMode"][value="auto"]',
    );
    if (autoModeInput) {
      autoModeInput.checked = true;
    }

    deps.translatorInputEl.value = selectedText;
    deps.translatorResultEl.textContent = '';
    window.setTimeout(() => {
      translateFromModal();
    }, 0);
  }

  function getSelectedAppText() {
    const selectedControlText = getSelectedTextFromControl(document.activeElement);
    if (selectedControlText) {
      return selectedControlText;
    }

    const selection = window.getSelection?.();
    const selectedText = selection?.toString().trim() || '';
    if (!selectedText || !selection?.rangeCount) {
      return '';
    }

    const range = selection.getRangeAt(0);
    const selectionContainer = range.commonAncestorContainer;
    const selectionElement =
      selectionContainer.nodeType === Node.ELEMENT_NODE
        ? selectionContainer
        : selectionContainer.parentElement;

    const appShell = document.querySelector('.app-shell');
    return appShell?.contains(selectionElement) ? selectedText : '';
  }

  function getSelectedTextFromControl(element) {
    if (
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLInputElement)
    ) {
      return '';
    }

    const selectionStart = element.selectionStart ?? 0;
    const selectionEnd = element.selectionEnd ?? 0;
    if (selectionEnd <= selectionStart) {
      return '';
    }

    return element.value.slice(selectionStart, selectionEnd).trim();
  }

  function translateFromModal() {
    const text = deps.translatorInputEl?.value.trim() || '';
    if (!text || !deps.getSocket()) {
      return;
    }

    const direction =
      deps.translatorFormEl?.querySelector('input[name="translatorMode"]:checked')?.value ||
      'auto';

    setTranslatorBusy(true);
    deps.translatorResultEl.textContent = '';
    deps.getSocket().emit('translator:translate', {
      direction,
      languageCode: currentLanguage().code,
      text,
    });
  }

  function setTranslatorBusy(isBusy) {
    if (deps.translatorSubmitEl) {
      deps.translatorSubmitEl.disabled = isBusy;
      deps.translatorSubmitEl.textContent = isBusy ? t('translator.translating') : t('translator.submit');
    }
  }

  async function copyTranslatorText(button) {
    const source = button.dataset.translatorCopy;
    const content =
      source === 'result'
        ? deps.translatorResultEl?.textContent?.trim() || ''
        : deps.translatorInputEl?.value.trim() || '';
    const copied = await deps.copyTextToClipboard(content);

    button.classList.toggle('is-copied', copied);
    button.title = copied ? t('clientMisc.copied') : t('clientMisc.copyFailed');

    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.title = source === 'result' ? t('translator.copyTranslation') : t('translator.copyText');
    }, 1200);
  }

  function bindUi() {
    renderLanguageMenu();
    applyLanguage(currentLanguageCode);

    for (const button of deps.translatorOpenButtonEls) {
      button.addEventListener('pointerdown', () => {
        deps.setPendingTranslatorSelection(getSelectedAppText());
      });

      button.addEventListener('click', () => {
        translateSelectedAppText();
        button.blur();
      });
    }

    deps.translatorFormEl?.addEventListener('submit', (event) => {
      event.preventDefault();
      translateFromModal();
    });

    deps.translatorModalEl?.addEventListener('shown.bs.modal', () => {
      deps.translatorInputEl?.focus();
    });

    deps.translatorInputEl?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        translateFromModal();
      }
    });

    for (const button of deps.translatorCopyButtonEls) {
      button.addEventListener('click', () => {
        copyTranslatorText(button);
      });
    }
  }

  function handleResult({ translation }) {
    setTranslatorBusy(false);
    deps.translatorResultEl.textContent = translation?.translatedText || '';
  }

  function handleError({ message }) {
    setTranslatorBusy(false);
    deps.translatorResultEl.textContent =
      message || t('translator.error');
  }

  return {
    bindUi,
    handleError,
    handleResult,
    setTranslatorBusy,
  };
}
