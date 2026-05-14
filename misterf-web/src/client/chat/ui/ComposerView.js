import { getModelTierLabel, normalizeModelTier } from '../utils/modelTier.js';

export class ComposerView {
  constructor({ inputEl, modelTierButtonEl, modelTierLabelEl, sendButtonEl }) {
    this.inputEl = inputEl;
    this.modelTierButtonEl = modelTierButtonEl;
    this.modelTierLabelEl = modelTierLabelEl;
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
    if (this.modelTierButtonEl) {
      this.modelTierButtonEl.disabled = !enabled || isAssistantBusy;
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
      this.inputEl?.focus({ preventScroll: true });
    });
  }

  getSelectedModelTier() {
    return normalizeModelTier(this.modelTierButtonEl?.dataset.modelTier || 'regular');
  }

  setSelectedModelTier(value) {
    const tier = normalizeModelTier(value);
    if (!this.modelTierButtonEl) {
      return;
    }

    this.modelTierButtonEl.dataset.modelTier = tier;
    if (this.modelTierLabelEl) {
      this.modelTierLabelEl.textContent = getModelTierLabel(tier);
      return;
    }

    this.modelTierButtonEl.textContent = getModelTierLabel(tier);
  }
}
