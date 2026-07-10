import { initializeAuthoringChatRevision } from '../shared/authoringChatRevision.js';
import { initializeAuthoringChatScroll } from '../shared/authoringChatScroll.js';

function initializeGenerationForms() {
  for (const form of document.querySelectorAll('[data-scene-media-generate-form]')) {
    if (!(form instanceof HTMLFormElement)) {
      continue;
    }
    form.addEventListener('submit', () => {
      const submit = form.querySelector('[data-scene-media-generate-submit]');
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = submit.dataset.loadingText || submit.textContent;
      }
      const pendingModal = document.querySelector('[data-scene-media-pending-modal]');
      if (pendingModal && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(pendingModal).show();
      }
    });
  }
}

function initializeCreationMode() {
  const wrap = document.querySelector('[data-scene-media-script-type-wrap]');
  const sync = () => {
    const complete = document.querySelector(
      '[name="generationMode"][value="complete_scene"]',
    )?.checked;
    wrap?.classList.toggle('d-none', !complete);
  };
  for (const input of document.querySelectorAll('[data-scene-media-mode]')) {
    input.addEventListener('change', sync);
  }
  sync();
}

function initializeVariationControls() {
  const form = document.querySelector('[data-scene-media-variation-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const format = form.querySelector('[data-scene-media-variation-format]');
  const level = form.querySelector('[data-scene-media-variation-level]');
  const warning = form.querySelector('[data-scene-media-level-warning]');
  const scriptType = form.querySelector('[data-scene-media-variation-script-type-wrap]');
  const sourceLevel = form.dataset.sourceLevel || '';

  const sync = () => {
    const keepImage = form.querySelector(
      '[name="imageDecision"][value="keep_existing"]',
    )?.checked;
    const keepScript = form.querySelector(
      '[name="scriptAndAudioDecision"][value="keep_existing"]',
    )?.checked;
    const generateScript = form.querySelector(
      '[name="scriptAndAudioDecision"][value="generate_new"]',
    )?.checked;
    if (format instanceof HTMLSelectElement) {
      format.disabled = Boolean(keepImage);
    }
    warning?.classList.toggle(
      'd-none',
      !(keepScript && level instanceof HTMLSelectElement && level.value !== sourceLevel),
    );
    scriptType?.classList.toggle('d-none', !generateScript);
  };
  for (const input of form.querySelectorAll(
    '[data-scene-media-image-decision], [data-scene-media-script-audio-decision]',
  )) {
    input.addEventListener('change', sync);
  }
  level?.addEventListener('change', sync);
  form.addEventListener('submit', () => {
    if (format instanceof HTMLSelectElement) {
      format.disabled = false;
    }
  });
  sync();
}

initializeGenerationForms();
initializeCreationMode();
initializeVariationControls();
initializeAuthoringChatScroll();
initializeAuthoringChatRevision();
