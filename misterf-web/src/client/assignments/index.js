import { createQuizResultCard } from '../chat/cards/createQuizResultCard.js';
import { renderMarkdown } from '../chat/utils/formatting.js';
import { initializeAuthoringChatScroll } from '../shared/authoringChatScroll.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
import { initializeStaticMarkdown } from '../shared/staticMarkdown.js';
import {
  buildInitialQuizItemState,
  buildQuizResponsePayload,
  isQuizItemAnswered,
  renderQuizItemBody,
} from '../shared/quizItemRenderer.js';

function fallbackCopyText(content) {
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyTextToClipboard(content) {
  if (!content) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    return fallbackCopyText(content);
  }

  return fallbackCopyText(content);
}

function initializeAssignmentSharingUi() {
  const shareFieldEl = document.querySelector('[data-assignment-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-assignment-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-assignment-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-assignment-share-modal]');

  if (copyButtonEl && shareFieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(shareFieldEl.value);
      copyButtonEl.textContent = copied ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        copyButtonEl.innerHTML = '<i class="bi bi-copy me-1" aria-hidden="true"></i>Copiar';
      }, 1200);
    });
  }

  if (nativeShareButtonEl) {
    if (typeof navigator.share !== 'function') {
      nativeShareButtonEl.classList.add('d-none');
    } else if (shareFieldEl instanceof HTMLInputElement) {
      nativeShareButtonEl.addEventListener('click', async () => {
        if (!shareFieldEl.value) {
          return;
        }

        try {
          await navigator.share({
            title: 'Tarea compartida',
            url: shareFieldEl.value,
          });
        } catch {
          // Ignore cancelled share attempts.
        }
      });
    }
  }

  if (autoOpenModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(autoOpenModalEl).show();
  }
}

function initializeAssignmentPendingUi() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('[data-assignment-generate-form], [data-assignment-submit-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector(
      '[data-assignment-generate-submit], [data-assignment-submit-button]',
    );
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-assignment-pending-modal]');

    formEl.addEventListener('submit', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
      }

      if (parentModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(parentModalEl).hide();
      }

      if (pendingModalEl) {
        window.setTimeout(() => {
          window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
        }, 120);
      }
    });
  }
}

function initializeAssignmentQuizUi() {
  const hostEl = document.querySelector('[data-assignment-quiz-host]');
  const block = readJsonScript('[data-assignment-quiz-json]');
  if (!(hostEl instanceof HTMLElement) || !isQuizBlock(block)) {
    return;
  }

  const mode = hostEl.dataset.assignmentQuizMode === 'attempt' ? 'attempt' : 'preview';
  const formEl = mode === 'attempt'
    ? hostEl.closest('[data-assignment-quiz-form]')
    : null;
  const inputHostEl = formEl?.querySelector('[data-assignment-quiz-inputs]');
  const submitButtonEl = formEl?.querySelector('[data-assignment-submit-button]');
  const card = createAssignmentQuizCard(block, {
    formEl: formEl instanceof HTMLFormElement ? formEl : null,
    inputHostEl: inputHostEl instanceof HTMLElement ? inputHostEl : null,
    mode,
    submitButtonEl: submitButtonEl instanceof HTMLButtonElement ? submitButtonEl : null,
  });

  if (!card) {
    return;
  }

  hostEl.replaceChildren(card);
  hideFallback(document.querySelector('[data-assignment-quiz-fallback]'));
}

function initializeAssignmentResultUi() {
  const hostEl = document.querySelector('[data-assignment-result-host]');
  const block = readJsonScript('[data-assignment-result-json]');
  if (!(hostEl instanceof HTMLElement) || !block) {
    return;
  }

  const card = createQuizResultCard(block);
  if (!card) {
    return;
  }

  hostEl.replaceChildren(card);
  hideFallback(document.querySelector('[data-assignment-result-fallback]'));
}

function createAssignmentQuizCard(block, options) {
  const items = block.items.filter(
    (item) => item && typeof item === 'object' && typeof item.kind === 'string',
  );
  if (!items.length) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'quiz-card assignment-quiz-card';

  const exerciseKey = `assignment:${block.title || 'quiz'}:${items.length}`;
  const state = {
    block: {
      ...block,
      items,
    },
    currentIndex: 0,
    itemStates: items.map((item, itemIndex) =>
      buildInitialQuizItemState(item, itemIndex, exerciseKey, null),
    ),
    readOnly: options.mode !== 'attempt',
    submitted: false,
  };

  const header = document.createElement('div');
  header.className = 'quiz-header';

  const headerText = document.createElement('div');
  headerText.className = 'quiz-header-text';

  const label = document.createElement('p');
  label.className = 'quiz-label';
  label.textContent = block.title?.trim() || 'Tarea';

  const prompt = document.createElement('div');
  prompt.className = 'quiz-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || '');

  headerText.append(label, prompt);
  header.append(headerText);

  const itemCounter = document.createElement('p');
  itemCounter.className = 'quiz-item-counter';

  const itemPrompt = document.createElement('div');
  itemPrompt.className = 'quiz-item-prompt';

  const itemBody = document.createElement('div');
  itemBody.className = 'quiz-item-body';

  const nav = document.createElement('div');
  nav.className = 'quiz-nav';

  const previousButton = document.createElement('button');
  previousButton.className = 'btn btn-primary btn-sm quiz-nav-button';
  previousButton.type = 'button';
  previousButton.textContent = 'Atrás';
  previousButton.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderAssignmentQuizCard(section, state, options);
    }
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'btn btn-primary btn-sm quiz-nav-button';
  nextButton.type = 'button';
  nextButton.textContent = 'Siguiente';
  nextButton.addEventListener('click', () => {
    if (state.currentIndex < state.itemStates.length - 1) {
      state.currentIndex += 1;
      renderAssignmentQuizCard(section, state, options);
    }
  });

  nav.append(previousButton, nextButton);

  const footer = document.createElement('div');
  footer.className = 'quiz-footer';
  footer.hidden = options.mode !== 'attempt';

  const status = document.createElement('p');
  status.className = 'quiz-status';
  footer.append(status);

  section.append(header, itemCounter, itemPrompt, itemBody, nav, footer);

  if (options.formEl) {
    options.formEl.addEventListener('submit', (event) => {
      syncAssignmentQuizStatus(section, state, options);
      if (!isAssignmentQuizReady(state)) {
        event.preventDefault();
        status.scrollIntoView({ block: 'nearest' });
        return;
      }

      state.submitted = true;
      syncAssignmentQuizStatus(section, state, options);
    });
  }

  renderAssignmentQuizCard(section, state, options);
  return section;
}

function renderAssignmentQuizCard(section, state, options) {
  const itemCounter = section.querySelector('.quiz-item-counter');
  const itemPrompt = section.querySelector('.quiz-item-prompt');
  const itemBody = section.querySelector('.quiz-item-body');
  const previousButton = section.querySelector('.quiz-nav-button:first-child');
  const nextButton = section.querySelector('.quiz-nav-button:last-child');

  if (
    !(itemCounter instanceof HTMLParagraphElement) ||
    !(itemPrompt instanceof HTMLDivElement) ||
    !(itemBody instanceof HTMLDivElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const item = state.block.items[state.currentIndex];
  const itemState = state.itemStates[state.currentIndex];
  itemCounter.textContent = `Pregunta ${state.currentIndex + 1} de ${state.itemStates.length}`;
  itemPrompt.innerHTML = renderMarkdown(item.prompt || '');

  itemBody.replaceChildren();
  renderQuizItemBody(itemBody, item, itemState, state, {
    onChange: () => syncAssignmentQuizStatus(section, state, options),
    readOnly: state.readOnly,
    rerender: () => renderAssignmentQuizCard(section, state, options),
  });

  previousButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex >= state.itemStates.length - 1;
  syncAssignmentQuizStatus(section, state, options);
}

function syncAssignmentQuizStatus(section, state, options) {
  syncAssignmentHiddenInputs(options.inputHostEl, state);

  if (options.mode !== 'attempt') {
    return;
  }

  const ready = isAssignmentQuizReady(state);
  if (options.submitButtonEl) {
    options.submitButtonEl.disabled = state.submitted || !ready;
  }

  const status = section.querySelector('.quiz-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-success', 'is-error');
  if (state.submitted) {
    setStatusText(status, 'Tarea enviada. Mister F la está evaluando.', {
      pending: true,
    });
    status.classList.add('is-success');
  } else if (ready) {
    setStatusText(status, 'Todo listo. Puedes enviar la tarea.');
  } else {
    setStatusText(status, 'Responde todas las preguntas antes de enviar.');
  }
}

function setStatusText(status, text, options = {}) {
  status.replaceChildren();

  if (options.pending) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm quiz-status-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.append(spinner);
  }

  status.append(document.createTextNode(text));
}

function isAssignmentQuizReady(state) {
  return state.itemStates.every((itemState, index) =>
    isQuizItemAnswered(state.block.items[index], itemState),
  );
}

function syncAssignmentHiddenInputs(inputHostEl, state) {
  if (!(inputHostEl instanceof HTMLElement)) {
    return;
  }

  inputHostEl.replaceChildren();
  state.itemStates.forEach((itemState, index) => {
    const item = state.block.items[index];
    const payload = buildQuizResponsePayload(item, itemState);
    const fieldPrefix = `response_${index}`;

    if (
      item.kind === 'quiz_open_text' ||
      item.kind === 'quiz_translate_to_english' ||
      item.kind === 'quiz_understand_in_spanish'
    ) {
      appendHiddenInput(inputHostEl, `${fieldPrefix}_text`, payload.text || '');
      return;
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      const values = Array.isArray(payload.values) ? payload.values : [];
      const blanks = Array.isArray(item.blanks) ? item.blanks : [];
      blanks.forEach((_blank, blankIndex) => {
        appendHiddenInput(
          inputHostEl,
          `${fieldPrefix}_blank_${blankIndex}`,
          values[blankIndex] || '',
        );
      });
      return;
    }

    if (item.kind === 'quiz_multiple_choice') {
      const selectedOptions = Array.isArray(payload.selectedOptions)
        ? payload.selectedOptions
        : [];
      selectedOptions.forEach((option) => {
        appendHiddenInput(inputHostEl, `${fieldPrefix}_selectedOptions`, option);
      });
      return;
    }

    if (item.kind === 'quiz_matching_pairs') {
      const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
      const leftItems = Array.isArray(item.leftItems) ? item.leftItems : [];
      leftItems.forEach((left, pairIndex) => {
        const pair = pairs.find((candidate) => candidate.left === left);
        appendHiddenInput(inputHostEl, `${fieldPrefix}_pair_${pairIndex}`, pair?.right || '');
      });
      return;
    }

    appendHiddenInput(inputHostEl, `${fieldPrefix}_sentence`, payload.sentence || '');
  });
}

function appendHiddenInput(parent, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = String(value || '');
  parent.append(input);
}

function hideFallback(fallbackEl) {
  if (!(fallbackEl instanceof HTMLElement)) {
    return;
  }

  fallbackEl.hidden = true;
  for (const control of fallbackEl.querySelectorAll('input, select, textarea, button')) {
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLButtonElement
    ) {
      control.disabled = true;
    }
  }
}

function readJsonScript(selector) {
  const scriptEl = document.querySelector(selector);
  if (!(scriptEl instanceof HTMLScriptElement)) {
    return null;
  }

  try {
    return JSON.parse(scriptEl.textContent || 'null');
  } catch {
    return null;
  }
}

function isQuizBlock(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.prompt === 'string' &&
    Array.isArray(value.items)
  );
}

initializeAssignmentQuizUi();
initializeAssignmentResultUi();
initializeAssignmentSharingUi();
initializeAssignmentPendingUi();
initializeAuthoringChatScroll();
initializeResourceMoveModal();
initializeStaticMarkdown();
