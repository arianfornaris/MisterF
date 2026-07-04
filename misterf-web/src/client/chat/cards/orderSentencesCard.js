import { t } from '../../shared/i18n.js';
import { renderMarkdown } from '../shared/markdown.js';
import {
  arraysEqual,
  createExerciseConfirmButton,
  flashExerciseError,
  seededShuffle,
} from '../shared/exerciseUtils.js';

export function createOrderSentencesCard(block, context, deps) {
  if (!Array.isArray(block.sentences)) {
    return null;
  }

  const sentences = block.sentences
    .filter((sentence) => typeof sentence === 'string')
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 2) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const section = document.createElement('section');
  section.className = 'order-sentences-card';
  section.dataset.exerciseKey = exerciseKey;

  const label = document.createElement('p');
  label.className = 'order-sentences-label';
  label.textContent = 'Ordena las oraciones';

  const prompt = document.createElement('div');
  prompt.className = 'order-sentences-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || '');

  const assembled = document.createElement('div');
  assembled.className = 'order-sentences-assembled';

  const bank = document.createElement('div');
  bank.className = 'order-sentences-bank';

  const state = {
    availableSentences: createInitialSentenceBank(sentences, `${exerciseKey}:order-sentences`),
    blockIndex,
    completed: Boolean(context.result?.completedAt),
    correctSentences: sentences,
    incorrectOrders: Array.isArray(context.result?.incorrectOrders)
      ? context.result.incorrectOrders
      : [],
    messageId,
    reported: Boolean(context.result?.completedAt),
    selectedSentences: Array.isArray(context.result?.orderedSentences)
      ? context.result.orderedSentences
      : [],
    statusText: '',
    statusTone: '',
    totalAttempts: Number(context.result?.totalAttempts) || 0,
  };

  if (state.completed && state.selectedSentences.length === 0) {
    state.selectedSentences = [...state.correctSentences];
    state.availableSentences = [];
  } else if (state.selectedSentences.length > 0) {
    const remaining = [...sentences];
    for (const selected of state.selectedSentences) {
      const index = remaining.indexOf(selected);
      if (index >= 0) {
        remaining.splice(index, 1);
      }
    }
    state.availableSentences = seededShuffle(remaining, `${exerciseKey}:order-sentences:remaining`);
  }

  assembled.addEventListener('click', (event) => {
    const button = event.target.closest('.order-sentences-item');
    if (!(button instanceof HTMLButtonElement) || state.completed) {
      return;
    }

    const sentenceIndex = Number(button.dataset.sentenceIndex);
    if (!Number.isInteger(sentenceIndex) || sentenceIndex < 0) {
      return;
    }

    const [sentence] = state.selectedSentences.splice(sentenceIndex, 1);
    if (sentence) {
      state.availableSentences.push(sentence);
    }
    renderOrderSentencesState(section, state);
  });

  bank.addEventListener('click', (event) => {
    const button = event.target.closest('.order-sentences-item');
    if (!(button instanceof HTMLButtonElement) || state.completed) {
      return;
    }

    const sentenceIndex = Number(button.dataset.sentenceIndex);
    if (!Number.isInteger(sentenceIndex) || sentenceIndex < 0) {
      return;
    }

    const [sentence] = state.availableSentences.splice(sentenceIndex, 1);
    if (sentence) {
      state.selectedSentences.push(sentence);
    }
    renderOrderSentencesState(section, state);
  });

  const confirmButton = createExerciseConfirmButton(() => {
    handleOrderSentencesSubmit(section, state, deps);
  });

  const controls = document.createElement('div');
  controls.className = 'exercise-controls';
  controls.append(confirmButton);

  const status = document.createElement('p');
  status.className = 'exercise-status';

  section.append(label);
  if (block.prompt) {
    section.append(prompt);
  }
  section.append(assembled, bank, controls, status);
  renderOrderSentencesState(section, state);
  return section;
}

function renderOrderSentencesState(section, state) {
  const assembled = section.querySelector('.order-sentences-assembled');
  const bank = section.querySelector('.order-sentences-bank');
  if (!(assembled instanceof HTMLDivElement) || !(bank instanceof HTMLDivElement)) {
    return;
  }

  assembled.replaceChildren();
  bank.replaceChildren();

  if (state.selectedSentences.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'order-sentences-placeholder';
    empty.textContent = t('card.orderDropzone');
    assembled.append(empty);
  } else {
    state.selectedSentences.forEach((sentence, index) => {
      assembled.append(
        createOrderSentenceButton(sentence, index, true, state.completed),
      );
    });
  }

  state.availableSentences.forEach((sentence, index) => {
    bank.append(createOrderSentenceButton(sentence, index, false, state.completed));
  });

  const confirmButton = section.querySelector('.exercise-confirm-button');
  if (confirmButton instanceof HTMLButtonElement) {
    confirmButton.disabled =
      state.completed || state.availableSentences.length > 0 || state.selectedSentences.length === 0;
    confirmButton.classList.toggle('is-success', state.completed);
  }

  const status = section.querySelector('.exercise-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-error', 'is-success');
  if (state.completed) {
    status.textContent = 'Completado. Buen trabajo.';
    status.classList.add('is-success');
    return;
  }

  status.textContent =
    state.statusText || 'Toca las oraciones en el orden correcto y confirma.';
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
}

function createOrderSentenceButton(sentence, index, isSelected, disabled) {
  const button = document.createElement('button');
  button.className = `order-sentences-item${isSelected ? ' is-selected' : ''}`;
  button.type = 'button';
  button.dataset.sentenceIndex = String(index);
  button.disabled = disabled;

  if (isSelected) {
    const position = document.createElement('span');
    position.className = 'order-sentences-position';
    position.textContent = String(index + 1);
    button.append(position);
  }

  const text = document.createElement('span');
  text.className = 'order-sentences-text';
  text.textContent = sentence;
  button.append(text);
  return button;
}

function createInitialSentenceBank(sentences, seedText) {
  const shuffled = seededShuffle(sentences, seedText);
  if (!arraysEqual(shuffled, sentences)) {
    return shuffled;
  }

  const swapIndex = shuffled.findIndex((sentence) => sentence !== shuffled[0]);
  if (swapIndex <= 0) {
    return shuffled;
  }

  [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
  return shuffled;
}

function handleOrderSentencesSubmit(section, state, deps) {
  if (
    state.completed ||
    state.availableSentences.length > 0 ||
    state.selectedSentences.length === 0
  ) {
    return;
  }

  state.totalAttempts += 1;
  if (arraysEqual(state.selectedSentences, state.correctSentences)) {
    state.completed = true;
    state.statusText = '';
    state.statusTone = '';
    renderOrderSentencesState(section, state);
    reportOrderSentencesCompleted(state, deps);
    return;
  }

  const attemptedOrder = [...state.selectedSentences];
  const alreadyRecorded = state.incorrectOrders.some((order) =>
    arraysEqual(order, attemptedOrder),
  );
  if (!alreadyRecorded) {
    state.incorrectOrders.push(attemptedOrder);
  }
  state.statusText = t('card.orderNotYet');
  state.statusTone = 'error';
  flashExerciseError(section);
  renderOrderSentencesState(section, state);
}

function reportOrderSentencesCompleted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (
    !socket ||
    state.reported ||
    !conversationId ||
    !state.messageId ||
    state.selectedSentences.length === 0
  ) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:order_sentences_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    incorrectOrders: state.incorrectOrders,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    orderedSentences: state.selectedSentences,
    totalAttempts: state.totalAttempts,
  });
}
