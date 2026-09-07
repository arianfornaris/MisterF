import { t } from '../../shared/i18n.js';
import { renderMarkdown } from '../utils/formatting.js';
import {
  buildInitialQuizItemState,
  buildQuizResponsePayload,
  isQuizItemAnswered,
  renderQuizItemBody,
} from '../../shared/quizItemRenderer.js';

export function createQuizCard(block, context, deps) {
  if (!Array.isArray(block.items) || typeof block.prompt !== 'string') {
    return null;
  }

  const items = block.items.filter(
    (item) => item && typeof item === 'object' && typeof item.kind === 'string',
  );
  if (!items.length) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const section = document.createElement('section');
  section.className = 'quiz-card';
  section.dataset.exerciseKey = exerciseKey;

  const state = {
    aborted: Boolean(context.result?.abortedAt),
    block: {
      ...block,
      items,
    },
    blockIndex,
    currentIndex: 0,
    itemStates: items.map((item, itemIndex) =>
      buildInitialQuizItemState(item, itemIndex, exerciseKey, context.result?.responses?.[itemIndex]),
    ),
    messageId,
    reported: Boolean(context.result?.submittedAt || context.result?.abortedAt),
    submitted: Boolean(context.result?.submittedAt),
    submittedAt:
      typeof context.result?.submittedAt === 'string' ? context.result.submittedAt : '',
  };

  const header = document.createElement('div');
  header.className = 'quiz-header';

  const headerText = document.createElement('div');
  headerText.className = 'quiz-header-text';

  const label = document.createElement('p');
  label.className = 'quiz-label';
  label.textContent = block.title?.trim() || 'Quiz';

  const prompt = document.createElement('div');
  prompt.className = 'quiz-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || '');

  headerText.append(label, prompt);

  const closeButton = document.createElement('button');
  closeButton.className = 'btn-close quiz-close-button';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', t('clientMisc.closeQuiz'));
  closeButton.addEventListener('click', () => {
    if (state.submitted || state.aborted) {
      return;
    }

    const shouldAbort = window.confirm(
      t('card.quizAbortConfirm'),
    );
    if (!shouldAbort) {
      return;
    }

    state.aborted = true;
    reportQuizAborted(state, deps);
    renderQuizCard(section, state, deps);
  });

  header.append(headerText, closeButton);

  const itemCounter = document.createElement('p');
  itemCounter.className = 'quiz-item-counter';

  const itemPrompt = document.createElement('div');
  itemPrompt.className = 'quiz-item-prompt';

  const itemBody = document.createElement('div');
  itemBody.className = 'quiz-item-body';

  const nav = document.createElement('div');
  nav.className = 'quiz-nav';

  const previousButton = document.createElement('button');
  previousButton.className = 'btn btn-outline-primary btn-sm quiz-nav-button quiz-nav-previous';
  previousButton.type = 'button';
  previousButton.textContent = t('card.quizBack');
  previousButton.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderQuizCard(section, state, deps);
    }
  });

  // The forward button is the quiz's single primary action: it advances while
  // there are questions left and becomes the submit action on the last one, so
  // the learner never ends the quiz facing a disabled "Next".
  const forwardButton = document.createElement('button');
  forwardButton.className = 'btn btn-primary btn-sm quiz-nav-button quiz-nav-forward';
  forwardButton.type = 'button';
  forwardButton.addEventListener('click', () => {
    if (isOnLastQuizItem(state)) {
      submitQuizCard(section, state, deps);
      return;
    }

    state.currentIndex += 1;
    renderQuizCard(section, state, deps);
  });

  nav.append(previousButton, forwardButton);

  const footer = document.createElement('div');
  footer.className = 'quiz-footer';

  const status = document.createElement('p');
  status.className = 'quiz-status';

  footer.append(status);

  section.append(header, itemCounter, itemPrompt, itemBody, nav, footer);
  renderQuizCard(section, state, deps);
  return section;
}

function renderQuizCard(section, state, deps) {
  const itemCounter = section.querySelector('.quiz-item-counter');
  const itemPrompt = section.querySelector('.quiz-item-prompt');
  const itemBody = section.querySelector('.quiz-item-body');
  const previousButton = section.querySelector('.quiz-nav-previous');
  const forwardButton = section.querySelector('.quiz-nav-forward');
  const status = section.querySelector('.quiz-status');
  const closeButton = section.querySelector('.quiz-close-button');

  if (
    !(itemCounter instanceof HTMLParagraphElement) ||
    !(itemPrompt instanceof HTMLDivElement) ||
    !(itemBody instanceof HTMLDivElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(forwardButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLParagraphElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const item = state.block.items[state.currentIndex];
  const itemState = state.itemStates[state.currentIndex];
  itemCounter.textContent = t('clientMisc.questionOf', { current: state.currentIndex + 1, total: state.itemStates.length });
  itemPrompt.innerHTML = renderMarkdown(item.prompt || '');

  itemBody.replaceChildren();
  renderQuizItemBody(itemBody, item, itemState, state, {
    onChange: () => syncQuizCardStatus(section, state),
    rerender: () => renderQuizCard(section, state, deps),
  });

  previousButton.disabled = state.currentIndex === 0;
  forwardButton.textContent = isOnLastQuizItem(state)
    ? t('clientMisc.submitQuiz')
    : t('clientMisc.next');
  closeButton.disabled = state.submitted || state.aborted;
  syncQuizCardStatus(section, state);
}

function syncQuizCardStatus(section, state) {
  const forwardButton = section?.querySelector('.quiz-nav-forward');
  const status = section?.querySelector('.quiz-status');
  if (!(forwardButton instanceof HTMLButtonElement) || !(status instanceof HTMLParagraphElement)) {
    return;
  }

  forwardButton.disabled = isOnLastQuizItem(state)
    ? state.submitted || state.aborted || !isQuizReadyToSubmit(state)
    : false;
  status.classList.remove('is-success', 'is-error');

  if (state.aborted) {
    setQuizStatusContent(status, 'Quiz cancelado.');
    status.classList.add('is-error');
  } else if (section.dataset.quizEvaluationComplete === 'true') {
    setQuizStatusContent(status, 'Quiz evaluado.');
    status.classList.add('is-success');
  } else if (state.submitted) {
    setQuizStatusContent(status, t('card.quizSubmitted'), {
      pending: true,
    });
    status.classList.add('is-success');
  } else if (isQuizReadyToSubmit(state)) {
    setQuizStatusContent(status, t('clientMisc.quizReadySend'));
  } else {
    setQuizStatusContent(status, t('clientMisc.answerAllBeforeSend'));
  }
}

function setQuizStatusContent(status, text, options = {}) {
  status.replaceChildren();

  if (options.pending) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm quiz-status-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.append(spinner);
  }

  status.append(document.createTextNode(text));
}

export function markQuizCardEvaluationComplete(messageId, blockIndex) {
  const exerciseKey = `${Number(messageId) || 0}:${Number(blockIndex) || 0}`;
  const section = document.querySelector(
    `.quiz-card[data-exercise-key="${CSS.escape(exerciseKey)}"]`,
  );
  if (!(section instanceof HTMLElement)) {
    return;
  }

  section.dataset.quizEvaluationComplete = 'true';
  const status = section.querySelector('.quiz-status');
  if (status instanceof HTMLParagraphElement) {
    status.classList.remove('is-error');
    status.classList.add('is-success');
    setQuizStatusContent(status, 'Quiz evaluado.');
  }
}

function submitQuizCard(section, state, deps) {
  if (state.submitted || state.aborted || !isQuizReadyToSubmit(state)) {
    return;
  }

  state.submitted = true;
  state.submittedAt = new Date().toISOString();
  reportQuizCompleted(state, deps);
  renderQuizCard(section, state, deps);
}

function isOnLastQuizItem(state) {
  return state.currentIndex >= state.itemStates.length - 1;
}

function isQuizReadyToSubmit(state) {
  return state.itemStates.every((itemState, index) =>
    isQuizItemAnswered(state.block.items[index], itemState),
  );
}

function reportQuizCompleted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:quiz_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    responses: state.itemStates.map((itemState, index) =>
      buildQuizResponsePayload(state.block.items[index], itemState),
    ),
  });
}

function reportQuizAborted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:quiz_aborted', {
    blockIndex: state.blockIndex,
    conversationId,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    responses: state.itemStates.map((itemState, index) =>
      buildQuizResponsePayload(state.block.items[index], itemState),
    ),
  });
}
