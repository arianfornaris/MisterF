import { t } from '../../shared/i18n.js';
import { disableTextAssist } from '../shared/textAssist.js';

const MAX_RESPONSE_LENGTH = 2400;

const VARIANTS = {
  translate_to_english_prompt: {
    className: 'is-translate_to_english_prompt',
    label: t('card.translateLabel'),
    placeholder: t('card.translatePlaceholder'),
    submitLabel: t('card.translateSubmit'),
    emptyStatus: t('card.translateEmptyStatus'),
    emptyError: t('card.translateEmptyError'),
  },
  understand_in_spanish_prompt: {
    className: 'is-understand_in_spanish_prompt',
    label: t('card.explainLabel'),
    placeholder: t('card.explainPlaceholder'),
    submitLabel: t('card.explainSubmit'),
    emptyStatus: t('card.explainEmptyStatus'),
    emptyError: t('card.explainEmptyError'),
  },
};

export function createTranslationPromptCard(block, context, deps) {
  const variant = VARIANTS[block?.type];
  const sentence = normalizeInlineText(block?.sentence);
  if (!variant || !sentence) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;

  const card = document.createElement('section');
  card.className = `translation-prompt-card ${variant.className}`;
  card.dataset.exerciseKey = `${messageId}:${blockIndex}`;

  const label = document.createElement('p');
  label.className = 'translation-prompt-label';
  label.textContent = variant.label;

  const sentenceEl = document.createElement('blockquote');
  sentenceEl.className = 'translation-prompt-sentence';
  sentenceEl.textContent = sentence;

  const textarea = document.createElement('textarea');
  textarea.className = 'form-control translation-prompt-textarea';
  textarea.rows = 3;
  textarea.maxLength = MAX_RESPONSE_LENGTH;
  textarea.placeholder = variant.placeholder;
  disableTextAssist(textarea);

  const submitButton = document.createElement('button');
  submitButton.className = 'btn btn-primary translation-prompt-submit';
  submitButton.type = 'button';
  submitButton.textContent = variant.submitLabel;

  const controls = document.createElement('div');
  controls.className = 'translation-prompt-controls';
  controls.append(submitButton);

  const status = document.createElement('p');
  status.className = 'translation-prompt-status';

  const state = {
    block: { type: block.type, sentence },
    variant,
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
    renderTranslationPromptState(card, state);
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submitTranslationPromptAnswer(card, state, deps);
    }
  });

  submitButton.addEventListener('click', () => {
    submitTranslationPromptAnswer(card, state, deps);
  });

  card.append(label, sentenceEl, textarea, controls, status);
  autoResizeTextarea(textarea);
  renderTranslationPromptState(card, state);
  return card;
}

function submitTranslationPromptAnswer(card, state, deps) {
  const response = state.response.trim().slice(0, MAX_RESPONSE_LENGTH);
  if (!normalizeInlineText(response) || state.submitted) {
    state.statusText = state.variant.emptyError;
    state.statusTone = 'error';
    renderTranslationPromptState(card, state);
    return;
  }

  const sent = deps.sendMessageContent?.(response, {
    exerciseSubmission: {
      block: state.block,
      response,
      type: state.block.type,
    },
    rememberInput: false,
  });

  if (!sent) {
    state.statusText = 'No pude enviar la respuesta. Intenta de nuevo.';
    state.statusTone = 'error';
    renderTranslationPromptState(card, state);
    return;
  }

  state.response = response;
  state.statusText = '';
  state.statusTone = '';
  state.submitted = true;
  renderTranslationPromptState(card, state);
}

function renderTranslationPromptState(card, state) {
  const textarea = card.querySelector('.translation-prompt-textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    if (textarea.value !== state.response) {
      textarea.value = state.response;
      autoResizeTextarea(textarea);
    }
    textarea.disabled = state.submitted;
  }

  const submitButton = card.querySelector('.translation-prompt-submit');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = state.submitted || !normalizeInlineText(state.response);
  }

  const status = card.querySelector('.translation-prompt-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-error', 'is-success');
  if (state.submitted) {
    status.textContent = t('card.translationSubmitted');
    status.classList.add('is-success');
    return;
  }

  status.textContent = state.statusText || state.variant.emptyStatus;
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
}

function normalizeInlineText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
