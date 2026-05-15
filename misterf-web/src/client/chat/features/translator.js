export function createTranslatorController(deps) {
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

    const mode =
      deps.translatorFormEl?.querySelector('input[name="translatorMode"]:checked')?.value ||
      'auto';

    setTranslatorBusy(true);
    deps.translatorResultEl.textContent = '';
    deps.getSocket().emit('translator:translate', { mode, text });
  }

  function setTranslatorBusy(isBusy) {
    if (deps.translatorSubmitEl) {
      deps.translatorSubmitEl.disabled = isBusy;
      deps.translatorSubmitEl.textContent = isBusy ? 'Traduciendo...' : 'Traducir';
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
    button.title = copied ? 'Copiado' : 'No se pudo copiar';

    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.title = source === 'result' ? 'Copiar traducción' : 'Copiar texto';
    }, 1200);
  }

  function bindUi() {
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
      message || 'No pude traducir el texto en este momento.';
  }

  return {
    bindUi,
    handleError,
    handleResult,
    setTranslatorBusy,
  };
}
