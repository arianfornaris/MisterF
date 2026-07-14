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

function fillScriptContent(content, script) {
  if (!(content instanceof HTMLElement)) {
    return;
  }
  content.replaceChildren();
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

function fillMetadataContent(content, metadata, labels) {
  if (!(content instanceof HTMLElement)) {
    return;
  }
  content.replaceChildren();
  if (!metadata) return;
  const rows = [
    [labels.title, metadata.title],
    [labels.setting, metadata.setting],
    [labels.visualSummary, (metadata.visualSummary || []).join(' · ')],
    [labels.tags, (metadata.tags || []).join(', ')],
    [labels.skills, (metadata.skills || []).join(', ')],
    [labels.useCases, (metadata.useCases || []).join(', ')],
  ];
  const list = document.createElement('dl');
  list.className = 'mb-0 small';
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.className = 'text-body-secondary fw-normal';
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.className = 'mb-2';
    detail.textContent = value || '—';
    list.append(term, detail);
  }
  content.append(list);
}

function renderPreviewScript(section, content, script) {
  if (!(section instanceof HTMLElement) || !(content instanceof HTMLElement)) {
    return;
  }
  section.classList.toggle('d-none', !script);
  fillScriptContent(content, script);
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
async function postUrlEncoded(url, fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  return fetch(url, {
    body,
    credentials: 'same-origin',
    headers: { Accept: 'application/x-ndjson' },
    method: 'POST',
  });
}

async function consumeNdjson(response, onEvent) {
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
      if (line) {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          event = null;
        }
        if (event) onEvent(event);
      }
    }
    if (done) break;
  }
}

function initializeChangeModal() {
  const modalElement = document.querySelector('[data-scene-media-change-modal]');
  if (!(modalElement instanceof HTMLElement) || !window.bootstrap?.Modal) {
    return;
  }
  const data = modalElement.dataset;
  const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);

  const el = (selector) => modalElement.querySelector(selector);
  const ui = {
    afterImage: el('[data-scene-media-change-after-image]'),
    afterMetadata: el('[data-scene-media-change-after-metadata]'),
    afterScript: el('[data-scene-media-change-after-script]'),
    applyButton: el('[data-scene-media-change-apply]'),
    audioNote: el('[data-scene-media-change-audio-note]'),
    bar: el('[data-scene-media-change-bar]'),
    beforeImage: el('[data-scene-media-change-before-image]'),
    beforeMetadata: el('[data-scene-media-change-before-metadata]'),
    beforeScript: el('[data-scene-media-change-before-script]'),
    cancelButton: el('[data-scene-media-change-cancel]'),
    closeButton: el('[data-scene-media-change-close]'),
    currentContent: el('[data-scene-media-change-current-content]'),
    currentImage: el('[data-scene-media-change-current-image]'),
    currentWrap: el('[data-scene-media-change-current-wrap]'),
    error: el('[data-scene-media-change-error]'),
    generateButton: el('[data-scene-media-change-generate]'),
    imageCompare: el('[data-scene-media-change-image-compare]'),
    metadataCompare: el('[data-scene-media-change-metadata-compare]'),
    metadataNote: el('[data-scene-media-change-metadata-note]'),
    progress: el('[data-scene-media-change-progress]'),
    progressMessage: el('[data-scene-media-change-progress-message]'),
    prompt: el('[data-scene-media-change-prompt]'),
    promptLabel: el('[data-scene-media-change-prompt-label]'),
    resultLabel: el('[data-scene-media-change-result-label]'),
    resultLabelMetadata: el('[data-scene-media-change-result-label-metadata]'),
    resultLabelScript: el('[data-scene-media-change-result-label-script]'),
    retryButton: el('[data-scene-media-change-retry]'),
    scriptCompare: el('[data-scene-media-change-script-compare]'),
    title: el('[data-scene-media-change-title]'),
  };
  const liveScript = readJsonScript(el('[data-scene-media-change-current-script]'), null);
  const liveMetadata = readJsonScript(el('[data-scene-media-change-current-metadata]'), null);
  const fieldLabels = {
    setting: data.fieldSetting,
    skills: data.fieldSkills,
    tags: data.fieldTags,
    title: data.fieldTitle,
    useCases: data.fieldUsecases,
    visualSummary: data.fieldVisualsummary,
  };

  const state = {
    applied: false,
    currentImageSrc: '',
    currentScript: null,
    layer: 'image',
    previewId: null,
  };

  const show = (element, visible) => element?.classList.toggle('d-none', !visible);
  const setPhase = (phase) => {
    for (const node of modalElement.querySelectorAll('[data-scene-media-change-phase]')) {
      show(node, node.getAttribute('data-scene-media-change-phase') === phase);
    }
    const generating = phase === 'generating';
    const preview = phase === 'preview';
    show(ui.closeButton, !generating);
    show(ui.cancelButton, !generating);
    show(ui.generateButton, phase === 'describe');
    show(ui.retryButton, preview);
    show(ui.applyButton, preview);
  };
  const setProgress = (percent, message) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    if (ui.bar) ui.bar.style.width = `${clamped}%`;
    ui.progress?.setAttribute('aria-valuenow', String(clamped));
    if (message && ui.progressMessage) ui.progressMessage.textContent = message;
  };
  const showError = (message) => {
    if (ui.error) {
      ui.error.textContent = message || data.genericError;
      show(ui.error, true);
    }
  };

  const discardPending = () => {
    if (!state.previewId || state.applied) return;
    state.previewId = null;
    postUrlEncoded(data.discardEndpoint, { _csrf: data.csrf }).catch(() => {});
  };

  // Shows the current image/script as reference while the author writes the
  // change. Reflects the latest base (live media first, then the last preview)
  // so it stays in sync with what the next generation refines.
  const renderCurrentReference = () => {
    if (state.layer === 'image') {
      if (ui.currentImage instanceof HTMLImageElement) {
        ui.currentImage.src = state.currentImageSrc || '';
        ui.currentImage.alt = data.currentImageAlt || '';
      }
      show(ui.currentImage, Boolean(state.currentImageSrc));
      show(ui.currentContent, false);
      show(ui.currentWrap, Boolean(state.currentImageSrc));
    } else if (state.layer === 'script') {
      fillScriptContent(ui.currentContent, state.currentScript);
      show(ui.currentImage, false);
      show(ui.currentContent, Boolean(state.currentScript));
      show(ui.currentWrap, Boolean(state.currentScript));
    } else {
      // Metadata: no inline reference; the before/after shows the comparison.
      show(ui.currentWrap, false);
    }
  };

  const openFor = (layer) => {
    state.layer = layer;
    state.previewId = null;
    state.applied = false;
    state.currentImageSrc = data.currentImageSrc || '';
    state.currentScript = liveScript;
    const titles = { image: data.titleImage, metadata: data.titleMetadata, script: data.titleScript };
    const labels = { image: data.labelImage, metadata: data.labelMetadata, script: data.labelScript };
    const placeholders = {
      image: data.placeholderImage,
      metadata: data.placeholderMetadata,
      script: data.placeholderScript,
    };
    ui.title.textContent = titles[layer] || '';
    ui.promptLabel.textContent = labels[layer] || '';
    ui.prompt.value = '';
    ui.prompt.setAttribute('placeholder', placeholders[layer] || '');
    show(ui.audioNote, layer === 'script');
    show(ui.metadataNote, layer === 'metadata');
    renderCurrentReference();
    show(ui.error, false);
    setPhase('describe');
    modal.show();
    window.setTimeout(() => ui.prompt.focus(), 200);
  };

  const handleDone = (event) => {
    state.previewId = event.previewId;
    show(ui.imageCompare, false);
    show(ui.scriptCompare, false);
    show(ui.metadataCompare, false);
    if (state.layer === 'image') {
      if (ui.beforeImage instanceof HTMLImageElement) {
        ui.beforeImage.src = state.currentImageSrc;
      }
      if (ui.afterImage instanceof HTMLImageElement) {
        ui.afterImage.src = event.imageSrc;
        ui.afterImage.alt = event.imageAlt || '';
      }
      state.currentImageSrc = event.imageSrc;
      if (ui.resultLabel) ui.resultLabel.textContent = data.resultImage;
      show(ui.imageCompare, true);
    } else if (state.layer === 'script') {
      if (ui.resultLabelScript) ui.resultLabelScript.textContent = data.resultScript;
      fillScriptContent(ui.beforeScript, state.currentScript);
      fillScriptContent(ui.afterScript, event.script);
      state.currentScript = event.script;
      show(ui.scriptCompare, true);
    } else {
      if (ui.resultLabelMetadata) ui.resultLabelMetadata.textContent = data.resultMetadata;
      fillMetadataContent(ui.beforeMetadata, liveMetadata, fieldLabels);
      fillMetadataContent(ui.afterMetadata, event.metadata, fieldLabels);
      show(ui.metadataCompare, true);
    }
    setPhase('preview');
  };

  const endpoints = {
    image: () => data.imageEndpoint,
    metadata: () => data.metadataEndpoint,
    script: () => data.scriptEndpoint,
  };

  const generate = async () => {
    const prompt = ui.prompt.value.trim();
    // Metadata guidance is optional (empty = resync); the others need a prompt.
    if (!prompt && state.layer !== 'metadata') {
      ui.prompt.focus();
      return;
    }
    show(ui.error, false);
    setPhase('generating');
    setProgress(3, '');
    const endpoint = endpoints[state.layer]();
    try {
      const response = await postUrlEncoded(endpoint, { _csrf: data.csrf, prompt });
      if (!response.ok || !response.body) {
        showError(data.genericError);
        setPhase('describe');
        return;
      }
      let terminal = false;
      await consumeNdjson(response, (event) => {
        if (event.type === 'progress') {
          setProgress(event.percent, event.message);
        } else if (event.type === 'done') {
          terminal = true;
          handleDone(event);
        } else if (event.type === 'error') {
          terminal = true;
          showError(event.message);
          setPhase('describe');
        }
      });
      if (!terminal) {
        showError(data.genericError);
        setPhase('describe');
      }
    } catch {
      showError(data.genericError);
      setPhase('describe');
    }
  };

  // Image previews are already generated; applying is a quick swap.
  const applyImage = async () => {
    if (ui.applyButton instanceof HTMLButtonElement) {
      ui.applyButton.disabled = true;
      ui.applyButton.textContent = data.applyingLabel;
    }
    try {
      const response = await postUrlEncoded(data.applyEndpoint, {
        _csrf: data.csrf,
        previewId: state.previewId,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) {
        state.applied = true;
        window.location.assign(payload.redirect || window.location.href);
        return;
      }
      showError(payload.error || data.genericError);
      setPhase('describe');
    } catch {
      showError(data.genericError);
      setPhase('describe');
    } finally {
      if (ui.applyButton instanceof HTMLButtonElement) {
        ui.applyButton.disabled = false;
        ui.applyButton.textContent = data.applyLabel;
      }
    }
  };

  // Approving a script generates its audio, so this streams progress before the
  // change is committed and the page reloads.
  const applyScript = async () => {
    show(ui.error, false);
    setPhase('generating');
    setProgress(3, '');
    try {
      const response = await postUrlEncoded(data.scriptApplyEndpoint, {
        _csrf: data.csrf,
        previewId: state.previewId,
      });
      if (!response.ok || !response.body) {
        showError(data.genericError);
        setPhase('preview');
        return;
      }
      let terminal = false;
      await consumeNdjson(response, (event) => {
        if (event.type === 'progress') {
          setProgress(event.percent, event.message);
        } else if (event.type === 'done') {
          terminal = true;
          state.applied = true;
          window.location.assign(event.redirect || window.location.href);
        } else if (event.type === 'error') {
          terminal = true;
          showError(event.message);
          setPhase('preview');
        }
      });
      if (!terminal) {
        showError(data.genericError);
        setPhase('preview');
      }
    } catch {
      showError(data.genericError);
      setPhase('preview');
    }
  };

  const apply = () => {
    if (!state.previewId) return;
    // Script apply generates audio (streaming); image and metadata are quick.
    if (state.layer === 'script') {
      applyScript();
    } else {
      applyImage();
    }
  };

  for (const trigger of document.querySelectorAll('[data-scene-media-change-trigger]')) {
    trigger.addEventListener('click', () => openFor(trigger.getAttribute('data-layer') || 'image'));
  }
  ui.generateButton?.addEventListener('click', generate);
  ui.retryButton?.addEventListener('click', () => {
    show(ui.error, false);
    renderCurrentReference();
    setPhase('describe');
    ui.prompt.focus();
  });
  ui.applyButton?.addEventListener('click', apply);
  modalElement.addEventListener('hidden.bs.modal', discardPending);
}

initializeVariationControls();
initializeAudioPlayers();
initializePreviewModal();
initializeChangeModal();
initializeAuthoringChatScroll();
initializeAuthoringChatRevision();
