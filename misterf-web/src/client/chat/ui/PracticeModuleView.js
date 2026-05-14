export class PracticeModuleView {
  constructor({
    panelEl,
    titleEl,
    descriptionEl,
    buttonEl,
    statusEl,
  }) {
    this.panelEl = panelEl;
    this.titleEl = titleEl;
    this.descriptionEl = descriptionEl;
    this.buttonEl = buttonEl;
    this.statusEl = statusEl;
  }

  render(practiceModule, options = {}) {
    if (
      !this.panelEl ||
      !this.titleEl ||
      !this.descriptionEl ||
      !this.buttonEl ||
      !this.statusEl
    ) {
      return;
    }

    const visible = Boolean(options.visible);
    const autoStarting = Boolean(options.autoStarting);

    if (!visible || !practiceModule) {
      this.panelEl.classList.add('d-none');
      this.titleEl.textContent = '';
      this.descriptionEl.textContent = '';
      this.statusEl.classList.add('d-none');
      this.buttonEl.classList.remove('d-none');
      return;
    }

    this.titleEl.textContent = autoStarting ? '' : practiceModule.title || 'Módulo de práctica';
    this.descriptionEl.textContent = autoStarting ? '' : practiceModule.description || '';
    this.statusEl.classList.toggle('d-none', !autoStarting);
    this.buttonEl.classList.toggle('d-none', autoStarting);
    this.panelEl.classList.remove('d-none');
  }
}
