import { t } from '../../shared/i18n.js';
import { disableTextAssist } from '../shared/textAssist.js';

const DEFAULT_CORRECTION_PROMPT = t('card.correctionPromptDefault');
const DEFAULT_SUBMIT_LABEL = 'Corregir';
const MAX_RESPONSE_LENGTH = 2400;
const MAX_SUBMIT_LABEL_LENGTH = 60;

export function createSentenceEvaluationCard({
  context,
  createSentencePartsElement,
  element,
  evaluation,
  getEvaluationSourceText,
  isValidSentenceEvaluation,
  sendMessageContent,
}) {
  if (element) {
    element.querySelector('.sentence-evaluation')?.remove();
  }

  if (!isValidSentenceEvaluation(evaluation)) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'sentence-evaluation card';

  const header = document.createElement('div');
  header.className = 'sentence-evaluation-header card-header';

  const label = document.createElement('h3');
  label.className = 'sentence-evaluation-label';
  label.textContent = t('card.evaluationLabel');
  header.append(label);

  const body = document.createElement('div');
  body.className = 'sentence-evaluation-body card-body';

  const partsLabel = document.createElement('p');
  partsLabel.className = 'sentence-evaluation-parts-label';
  partsLabel.textContent = 'Texto analizado, por partes';

  body.append(partsLabel);
  body.append(createSentencePartsElement(evaluation.parts));

  if (evaluation.correction && typeof evaluation.correction === 'object') {
    body.append(
      buildCorrectionSection(evaluation, context, sendMessageContent, getEvaluationSourceText),
    );
  }

  wrapper.append(header, body);
  return wrapper;
}

function buildCorrectionSection(evaluation, context, sendMessageContent, getEvaluationSourceText) {
  const sourceText = getEvaluationSourceText(evaluation);
  const blockIndex = Number(context?.blockIndex) || 0;
  const messageId = Number(context?.messageId) || 0;

  const section = document.createElement('div');
  section.className = 'sentence-evaluation-correction';
  section.dataset.exerciseKey = `${messageId}:${blockIndex}`;

  const promptLabel = document.createElement('p');
  promptLabel.className = 'sentence-evaluation-correction-label';
  promptLabel.textContent =
    normalizeInlineText(evaluation.correction.prompt) || DEFAULT_CORRECTION_PROMPT;

  const textarea = document.createElement('textarea');
  textarea.className = 'form-control sentence-evaluation-correction-textarea';
  textarea.rows = 3;
  textarea.maxLength = MAX_RESPONSE_LENGTH;
  textarea.value = sourceText;
  disableTextAssist(textarea);

  const submitButton = document.createElement('button');
  submitButton.className = 'btn btn-primary sentence-evaluation-correction-submit';
  submitButton.type = 'button';
  submitButton.textContent = getSubmitLabel(evaluation.correction.submitLabel);

  const controls = document.createElement('div');
  controls.className = 'sentence-evaluation-correction-controls';
  controls.append(submitButton);

  const status = document.createElement('p');
  status.className = 'sentence-evaluation-correction-status';

  const state = {
    response: sourceText,
    sourceText,
    statusText: '',
    statusTone: '',
    submitted: false,
  };

  textarea.addEventListener('input', () => {
    state.response = textarea.value;
    state.statusText = '';
    state.statusTone = '';
    autoResizeTextarea(textarea);
    renderCorrectionState(section, state);
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submitCorrection(section, state, sendMessageContent);
    }
  });

  submitButton.addEventListener('click', () => {
    submitCorrection(section, state, sendMessageContent);
  });

  section.append(promptLabel, textarea, controls, status);
  autoResizeTextarea(textarea);
  renderCorrectionState(section, state);
  return section;
}

function submitCorrection(section, state, sendMessageContent) {
  const response = state.response.trim().slice(0, MAX_RESPONSE_LENGTH);
  if (!normalizeInlineText(response) || state.submitted) {
    state.statusText = t('card.rewriteEmptyError');
    state.statusTone = 'error';
    renderCorrectionState(section, state);
    return;
  }

  const sent = sendMessageContent?.(response, {
    exerciseSubmission: {
      block: {
        sourceText: state.sourceText,
        type: 'sentence_evaluation_correction',
      },
      response,
      type: 'sentence_evaluation_correction',
    },
    rememberInput: false,
  });

  if (!sent) {
    state.statusText = t('card.correctionSendError');
    state.statusTone = 'error';
    renderCorrectionState(section, state);
    return;
  }

  state.response = response;
  state.statusText = '';
  state.statusTone = '';
  state.submitted = true;
  renderCorrectionState(section, state);
}

function renderCorrectionState(section, state) {
  const textarea = section.querySelector('.sentence-evaluation-correction-textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    if (textarea.value !== state.response) {
      textarea.value = state.response;
      autoResizeTextarea(textarea);
    }
    textarea.disabled = state.submitted;
  }

  const submitButton = section.querySelector('.sentence-evaluation-correction-submit');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = state.submitted || !normalizeInlineText(state.response);
  }

  const status = section.querySelector('.sentence-evaluation-correction-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-error', 'is-success');
  if (state.submitted) {
    status.textContent = t('card.correctionSubmitted');
    status.classList.add('is-success');
    return;
  }

  status.textContent = state.statusText || t('card.correctionDefaultStatus');
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
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
