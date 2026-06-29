export class PracticeGuideView {
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

  render(practiceGuide, options = {}) {
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

    if (!visible || !practiceGuide) {
      this.panelEl.classList.add('d-none');
      this.titleEl.textContent = '';
      this.descriptionEl.textContent = '';
      this.statusEl.classList.add('d-none');
      this.buttonEl.classList.remove('d-none');
      return;
    }

    this.titleEl.textContent = autoStarting ? '' : practiceGuide.title || 'Guía de Práctica';
    this.descriptionEl.textContent = autoStarting ? '' : practiceGuide.description || '';
    this.statusEl.classList.toggle('d-none', !autoStarting);
    this.buttonEl.classList.toggle('d-none', autoStarting);
    this.panelEl.classList.remove('d-none');
  }
}
