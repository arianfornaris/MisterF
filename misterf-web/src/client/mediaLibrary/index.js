import { initializeAuthoringChatRevision } from '../shared/authoringChatRevision.js';
import { initializeAuthoringChatScroll } from '../shared/authoringChatScroll.js';
import { createSceneAudioPlayer } from './sceneAudioPlayer.js';

function readJsonScript(element, fallback) {
  try {
    return JSON.parse(element?.textContent || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function initializeAudioPlayers() {
  for (const root of document.querySelectorAll('[data-scene-media-audio-player]')) {
    if (root.closest('[data-scene-media-preview-modal]')) {
      continue;
    }
    createSceneAudioPlayer(root);
  }
}

function renderPreviewScript(section, content, script) {
  if (!(section instanceof HTMLElement) || !(content instanceof HTMLElement)) {
    return;
  }
  content.replaceChildren();
  section.classList.toggle('d-none', !script);
  if (!script) return;

  if (script.scriptType === 'dialogue') {
    const list = document.createElement('div');
    list.className = 'list-group list-group-flush';
    for (const turn of script.turns) {
      const item = document.createElement('div');
      item.className = 'list-group-item px-0';
      const name = document.createElement('p');
      name.className = 'fw-semibold mb-1';
      name.textContent = turn.speaker;
      const text = document.createElement('p');
      text.className = 'mb-0';
      text.textContent = turn.text;
      item.append(name, text);
      list.append(item);
    }
    content.append(list);
    return;
  }

  const text = document.createElement('p');
  text.className = 'mb-0 scene-media-script-text';
  text.textContent = script.text;
  content.append(text);
}

function initializePreviewModal() {
  const modalElement = document.querySelector('[data-scene-media-preview-modal]');
  const dataElement = document.querySelector('[data-scene-media-preview-json]');
  if (!(modalElement instanceof HTMLElement) || !window.bootstrap?.Modal) {
    return;
  }
  const items = readJsonScript(dataElement, []);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  const title = modalElement.querySelector('[data-scene-media-preview-title]');
  const image = modalElement.querySelector('[data-scene-media-preview-image]');
  const scriptSection = modalElement.querySelector('[data-scene-media-preview-script-section]');
  const scriptContent = modalElement.querySelector('[data-scene-media-preview-script]');
  const player = createSceneAudioPlayer(
    modalElement.querySelector('[data-scene-media-audio-player]'),
  );

  for (const button of document.querySelectorAll('[data-scene-media-play]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = itemsById.get(button.getAttribute('data-media-id'));
      if (!item) return;
      if (title) title.textContent = item.title;
      if (image instanceof HTMLImageElement) {
        image.classList.toggle('d-none', !item.image?.src);
        image.src = item.image?.src || '';
        image.alt = item.image?.alt || '';
      }
      player?.setData(
        (item.audio?.clips || []).map((clip) => ({
          src: clip.src,
          speaker: clip.speaker || '',
          text: null,
        })),
      );
      renderPreviewScript(scriptSection, scriptContent, item.script);
      modal.show();
      player?.play();
    });
  }

  modalElement.addEventListener('hidden.bs.modal', () => player?.stop());
}

function getPendingModalUi(modalElement) {
  return {
    bar: modalElement.querySelector('[data-scene-media-pending-bar]'),
    creditLink: modalElement.querySelector('[data-scene-media-pending-credit-link]'),
    error: modalElement.querySelector('[data-scene-media-pending-error]'),
    errorMessage: modalElement.querySelector('[data-scene-media-pending-error-message]'),
    genericError: modalElement.dataset.genericError || '',
    loading: modalElement.querySelector('[data-scene-media-pending-loading]'),
    message: modalElement.querySelector('[data-scene-media-pending-message]'),
    progress: modalElement.querySelector('[data-scene-media-pending-progress]'),
  };
}

function updatePendingProgress(ui, percent, message) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (ui.bar instanceof HTMLElement) {
    ui.bar.style.width = `${clamped}%`;
  }
  if (ui.progress instanceof HTMLElement) {
    ui.progress.setAttribute('aria-valuenow', String(clamped));
  }
  if (typeof message === 'string' && message && ui.message instanceof HTMLElement) {
    ui.message.textContent = message;
  }
}

function showPendingError(ui, message, creditExhausted) {
  ui.loading?.classList.add('d-none');
  ui.error?.classList.remove('d-none');
  if (ui.errorMessage instanceof HTMLElement) {
    ui.errorMessage.textContent = message || ui.genericError;
  }
  if (ui.creditLink instanceof HTMLElement) {
    ui.creditLink.classList.toggle('d-none', !creditExhausted);
    if (creditExhausted) {
      const returnTo = window.location.pathname + window.location.search;
      ui.creditLink.setAttribute('href', `/credits?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }
}

function resetPendingModal(ui) {
  ui.error?.classList.add('d-none');
  ui.loading?.classList.remove('d-none');
  ui.creditLink?.classList.add('d-none');
  updatePendingProgress(ui, 0, '');
}

async function streamGenerationProgress(form, ui) {
  // Send urlencoded (not multipart) so express.urlencoded and CSRF still parse
  // the body; disabled controls are re-enabled so their values are included.
  const body = new URLSearchParams();
  for (const element of form.querySelectorAll('[disabled]')) {
    element.disabled = false;
  }
  for (const [key, value] of new FormData(form)) {
    if (typeof value === 'string') {
      body.append(key, value);
    }
  }

  const response = await fetch(form.action, {
    body,
    credentials: 'same-origin',
    headers: { Accept: 'application/x-ndjson' },
    method: 'POST',
  });
  if (!response.ok || !response.body) {
    showPendingError(ui, ui.genericError, false);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'progress') {
        updatePendingProgress(ui, event.percent, event.message);
      } else if (event.type === 'done') {
        updatePendingProgress(ui, 100, event.message);
        window.location.assign(event.redirect);
        return;
      } else if (event.type === 'error') {
        showPendingError(ui, event.message, Boolean(event.creditExhausted));
        return;
      }
    }
    if (done) {
      break;
    }
  }
  // Stream ended without a terminal event: surface a generic failure.
  showPendingError(ui, ui.genericError, false);
}

function initializeGenerationForms() {
  const modalElement = document.querySelector('[data-scene-media-pending-modal]');
  const canStream =
    modalElement instanceof HTMLElement &&
    window.bootstrap?.Modal &&
    typeof window.fetch === 'function' &&
    typeof ReadableStream === 'function';

  for (const form of document.querySelectorAll('[data-scene-media-generate-form]')) {
    if (!(form instanceof HTMLFormElement)) {
      continue;
    }

    const submit = form.querySelector('[data-scene-media-generate-submit]');
    const originalLabel = submit instanceof HTMLButtonElement ? submit.textContent : '';
    const setSubmitting = (submitting) => {
      if (!(submit instanceof HTMLButtonElement)) return;
      submit.disabled = submitting;
      submit.textContent = submitting
        ? submit.dataset.loadingText || originalLabel
        : originalLabel;
    };

    if (!canStream) {
      // Progressive enhancement: keep the classic redirect flow (server renders
      // the result) and just show the pending spinner while it works.
      form.addEventListener('submit', () => {
        setSubmitting(true);
        if (modalElement instanceof HTMLElement && window.bootstrap?.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
        }
      });
      continue;
    }

    const ui = getPendingModalUi(modalElement);
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
    modalElement.addEventListener('hidden.bs.modal', () => {
      resetPendingModal(ui);
      setSubmitting(false);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      setSubmitting(true);
      resetPendingModal(ui);
      updatePendingProgress(ui, 3, ui.message?.textContent || '');
      modal.show();
      streamGenerationProgress(form, ui).catch(() => {
        showPendingError(ui, ui.genericError, false);
      });
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
initializeAudioPlayers();
initializePreviewModal();
initializeAuthoringChatScroll();
initializeAuthoringChatRevision();
