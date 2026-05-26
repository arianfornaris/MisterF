import { normalizeModelTier } from '../utils/modelTier.js';

export class ComposerView {
  constructor({ composerEl, inputEl, initialModelTier, sendButtonEl }) {
    this.composerEl = composerEl;
    this.inputEl = inputEl;
    this.selectedModelTier = normalizeModelTier(initialModelTier || 'regular');
    this.sendButtonEl = sendButtonEl;
  }

  resize() {
    if (!this.inputEl) {
      return;
    }

    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${this.inputEl.scrollHeight}px`;
  }

  enable(enabled, isAssistantBusy = false, isAssistantStopping = false) {
    if (this.inputEl) {
      this.inputEl.disabled = !enabled;
    }
    this.syncSendButton(isAssistantBusy, isAssistantStopping);
  }

  syncSendButton(isAssistantBusy, isAssistantStopping) {
    if (!this.sendButtonEl || !this.inputEl) {
      return;
    }

    const isStopMode = isAssistantBusy;
    this.sendButtonEl.disabled = isStopMode ? isAssistantStopping : this.inputEl.disabled;
    this.sendButtonEl.title = isStopMode ? 'Detener' : 'Enviar';
    this.sendButtonEl.setAttribute('aria-label', isStopMode ? 'Detener' : 'Enviar');
    this.sendButtonEl.dataset.mode = isStopMode ? 'stop' : 'send';
    this.sendButtonEl.innerHTML = isStopMode
      ? '<i class="bi bi-stop-fill" aria-hidden="true"></i>'
      : '<i class="bi bi-send" aria-hidden="true"></i>';
  }

  focus() {
    if (this.inputEl?.disabled) {
      return;
    }

    requestAnimationFrame(() => {
      this.composerEl?.scrollIntoView({
        block: 'end',
        inline: 'nearest',
      });
      this.inputEl?.focus({ preventScroll: true });
    });
  }

  getSelectedModelTier() {
    return this.selectedModelTier;
  }

  setSelectedModelTier(value) {
    this.selectedModelTier = normalizeModelTier(value);
  }
}
