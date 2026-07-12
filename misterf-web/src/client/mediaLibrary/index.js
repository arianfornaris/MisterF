import { initializeAuthoringChatRevision } from '../shared/authoringChatRevision.js';
import { initializeAuthoringChatScroll } from '../shared/authoringChatScroll.js';

function readJsonScript(element, fallback) {
  try {
    return JSON.parse(element?.textContent || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function initializeAudioPlayer(root) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const audio = root.querySelector('[data-scene-media-audio-element]');
  const previous = root.querySelector('[data-scene-media-audio-previous]');
  const next = root.querySelector('[data-scene-media-audio-next]');
  const speaker = root.querySelector('[data-scene-media-audio-speaker]');
  const position = root.querySelector('[data-scene-media-audio-position]');
  if (!(audio instanceof HTMLAudioElement)) {
    return null;
  }

  let clips = readJsonScript(
    root.querySelector('[data-scene-media-audio-clips]'),
    [],
  );
  let currentIndex = 0;

  const render = () => {
    const clip = clips[currentIndex];
    root.classList.toggle('d-none', !clip);
    if (!clip) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (speaker) speaker.textContent = '';
      if (position) position.textContent = '';
      return;
    }
    if (audio.getAttribute('src') !== clip.src) {
      audio.src = clip.src;
      audio.load();
    }
    if (speaker) speaker.textContent = clip.speaker || '';
    if (position) position.textContent = `${currentIndex + 1} / ${clips.length}`;
    if (previous instanceof HTMLButtonElement) {
      previous.disabled = currentIndex === 0;
    }
    if (next instanceof HTMLButtonElement) {
      next.disabled = currentIndex >= clips.length - 1;
    }
    const progressLabel = (root.dataset.progressLabel || '')
      .replace('{{current}}', String(currentIndex + 1))
      .replace('{{total}}', String(clips.length));
    audio.setAttribute('aria-label', progressLabel || audio.getAttribute('aria-label') || '');
  };

  const select = (index, autoplay = false) => {
    if (index < 0 || index >= clips.length) {
      return;
    }
    currentIndex = index;
    render();
    if (autoplay) {
      void audio.play().catch(() => {});
    }
  };

  previous?.addEventListener('click', () => select(currentIndex - 1, true));
  next?.addEventListener('click', () => select(currentIndex + 1, true));
  audio.addEventListener('ended', () => {
    if (currentIndex < clips.length - 1) {
      select(currentIndex + 1, true);
    }
  });

  render();
  return {
    play() {
      if (clips.length === 0) return;
      void audio.play().catch(() => {});
    },
    setClips(nextClips) {
      audio.pause();
      clips = Array.isArray(nextClips) ? nextClips : [];
      currentIndex = 0;
      render();
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
    },
  };
}

function initializeAudioPlayers() {
  for (const root of document.querySelectorAll('[data-scene-media-audio-player]')) {
    if (root.closest('[data-scene-media-preview-modal]')) {
      continue;
    }
    initializeAudioPlayer(root);
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
  const player = initializeAudioPlayer(
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
      player?.setClips(item.audio?.clips || []);
      renderPreviewScript(scriptSection, scriptContent, item.script);
      modal.show();
      player?.play();
    });
  }

  modalElement.addEventListener('hidden.bs.modal', () => player?.stop());
}

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
initializeAudioPlayers();
initializePreviewModal();
initializeAuthoringChatScroll();
initializeAuthoringChatRevision();
