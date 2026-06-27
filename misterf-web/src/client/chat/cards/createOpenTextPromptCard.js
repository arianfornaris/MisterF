import { renderMarkdown } from '../shared/markdown.js';
import { disableTextAssist } from '../shared/textAssist.js';

const DEFAULT_SUBMIT_LABEL = 'Enviar respuesta';
const MAX_RESPONSE_LENGTH = 2400;
const MAX_SUBMIT_LABEL_LENGTH = 60;

export function createOpenTextPromptCard(block, context, deps) {
  const prompt = normalizeInlineText(block?.prompt);
  if (!prompt) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const section = document.createElement('section');
  section.className = 'open-text-prompt-card';
  section.dataset.exerciseKey = `${messageId}:${blockIndex}`;

  const label = document.createElement('p');
  label.className = 'open-text-prompt-label';
  label.textContent = 'Respuesta abierta';

  const promptEl = document.createElement('div');
  promptEl.className = 'open-text-prompt-prompt';
  promptEl.innerHTML = renderMarkdown(prompt);

  const textarea = document.createElement('textarea');
  textarea.className = 'form-control open-text-prompt-textarea';
  textarea.rows = 4;
  textarea.maxLength = MAX_RESPONSE_LENGTH;
  textarea.placeholder = normalizeInlineText(block.placeholder);
  disableTextAssist(textarea);

  const submitButton = document.createElement('button');
  submitButton.className = 'btn btn-primary open-text-prompt-submit';
  submitButton.type = 'button';
  submitButton.textContent = getSubmitLabel(block.submitLabel);

  const controls = document.createElement('div');
  controls.className = 'open-text-prompt-controls';
  controls.append(submitButton);

  const status = document.createElement('p');
  status.className = 'open-text-prompt-status';

  const state = {
    block: buildSubmissionBlock(block, prompt),
    response: '',
    statusText: '',
    statusTone: '',
    submitted: false,
  };

  textarea.addEventListener('input', () => {
    state.response = textarea.value;
    state.statusText = '';
    state.statusTone = '';
    autoResizeTextarea(textarea);
    renderOpenTextPromptState(section, state);
  });

  submitButton.addEventListener('click', () => {
    submitOpenTextPromptAnswer(section, state, deps);
  });

  section.append(label, promptEl, textarea, controls, status);
  autoResizeTextarea(textarea);
  renderOpenTextPromptState(section, state);
  return section;
}

function submitOpenTextPromptAnswer(section, state, deps) {
  const response = state.response.trim().slice(0, MAX_RESPONSE_LENGTH);
  if (!normalizeInlineText(response) || state.submitted) {
    state.statusText = 'Escribe tu respuesta antes de enviarla.';
    state.statusTone = 'error';
    renderOpenTextPromptState(section, state);
    return;
  }

  const sent = deps.sendMessageContent?.(response, {
    exerciseSubmission: {
      block: state.block,
      response,
      type: 'open_text_prompt',
    },
    rememberInput: false,
  });

  if (!sent) {
    state.statusText = 'No pude enviar la respuesta. Intenta de nuevo.';
    state.statusTone = 'error';
    renderOpenTextPromptState(section, state);
    return;
  }

  state.response = response;
  state.statusText = '';
  state.statusTone = '';
  state.submitted = true;
  renderOpenTextPromptState(section, state);
}

function renderOpenTextPromptState(section, state) {
  const textarea = section.querySelector('.open-text-prompt-textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    if (textarea.value !== state.response) {
      textarea.value = state.response;
      autoResizeTextarea(textarea);
    }
    textarea.disabled = state.submitted;
  }

  const submitButton = section.querySelector('.open-text-prompt-submit');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = state.submitted || !normalizeInlineText(state.response);
  }

  const status = section.querySelector('.open-text-prompt-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-error', 'is-success');
  if (state.submitted) {
    status.textContent = 'Enviado. Mr. F está respondiendo.';
    status.classList.add('is-success');
    return;
  }

  status.textContent = state.statusText || 'Escribe tu respuesta y envíala cuando estés listo.';
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
}

function buildSubmissionBlock(block, prompt) {
  return {
    type: 'open_text_prompt',
    prompt,
    ...optionalTextField('placeholder', block.placeholder, 240),
    ...optionalTextField('submitLabel', block.submitLabel, MAX_SUBMIT_LABEL_LENGTH),
    ...optionalTextField('rubric', block.rubric, 1600),
  };
}

function optionalTextField(field, value, maxLength) {
  const normalized = normalizeInlineText(value);
  return normalized && normalized.length <= maxLength ? { [field]: normalized } : {};
}

function getSubmitLabel(value) {
  const normalized = normalizeInlineText(value);
  return normalized && normalized.length <= MAX_SUBMIT_LABEL_LENGTH
    ? normalized
    : DEFAULT_SUBMIT_LABEL;
}

function normalizeInlineText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
