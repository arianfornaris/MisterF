import { renderMarkdown } from '../shared/markdown.js';
import {
  arraysEqual,
  createExerciseConfirmButton,
  flashExerciseError,
  formatTokenSentence,
  seededShuffle,
} from '../shared/exerciseUtils.js';

export function createUnscrambleSentenceCard(block, context, deps) {
  if (!Array.isArray(block.tokens)) {
    return null;
  }

  const tokens = block.tokens
    .filter((token) => typeof token === 'string')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const section = document.createElement('section');
  section.className = 'unscramble-sentence-card';
  section.dataset.exerciseKey = exerciseKey;

  const label = document.createElement('p');
  label.className = 'unscramble-sentence-label';
  label.textContent = 'Ordena la oración';

  const prompt = document.createElement('div');
  prompt.className = 'unscramble-sentence-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || '');

  const assembled = document.createElement('div');
  assembled.className = 'unscramble-sentence-assembled';

  const bank = document.createElement('div');
  bank.className = 'unscramble-sentence-bank';

  const state = {
    availableTokens: createInitialTokenBank(tokens, `${exerciseKey}:unscramble`),
    blockIndex,
    completed: Boolean(context.result?.completedAt),
    completedSentence:
      typeof context.result?.completedSentence === 'string'
        ? context.result.completedSentence
        : formatTokenSentence(tokens),
    correctTokens: tokens,
    incorrectSentences: Array.isArray(context.result?.incorrectSentences)
      ? context.result.incorrectSentences
      : [],
    messageId,
    reported: Boolean(context.result?.completedAt),
    selectedTokens: Array.isArray(context.result?.selectedTokens)
      ? context.result.selectedTokens
      : [],
    statusText: '',
    statusTone: '',
    totalAttempts: Number(context.result?.totalAttempts) || 0,
  };

  if (state.completed && state.selectedTokens.length === 0) {
    state.selectedTokens = [...state.correctTokens];
    state.availableTokens = [];
  } else if (state.selectedTokens.length > 0) {
    const remaining = [...tokens];
    for (const selected of state.selectedTokens) {
      const index = remaining.indexOf(selected);
      if (index >= 0) {
        remaining.splice(index, 1);
      }
    }
    state.availableTokens = seededShuffle(remaining, `${exerciseKey}:unscramble:remaining`);
  }

  assembled.addEventListener('click', (event) => {
    const button = event.target.closest('.unscramble-token');
    if (!(button instanceof HTMLButtonElement) || state.completed) {
      return;
    }

    const token = button.dataset.token || '';
    const tokenIndex = Number(button.dataset.tokenIndex);
    if (!token || !Number.isInteger(tokenIndex)) {
      return;
    }

    state.selectedTokens.splice(tokenIndex, 1);
    state.availableTokens.push(token);
    renderUnscrambleSentenceState(section, state);
  });

  bank.addEventListener('click', (event) => {
    const button = event.target.closest('.unscramble-token');
    if (!(button instanceof HTMLButtonElement) || state.completed) {
      return;
    }

    const token = button.dataset.token || '';
    const tokenIndex = Number(button.dataset.tokenIndex);
    if (!token || !Number.isInteger(tokenIndex)) {
      return;
    }

    state.availableTokens.splice(tokenIndex, 1);
    state.selectedTokens.push(token);
    renderUnscrambleSentenceState(section, state);
  });

  const confirmButton = createExerciseConfirmButton(() => {
    handleUnscrambleSentenceSubmit(section, state, deps);
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
  renderUnscrambleSentenceState(section, state);
  return section;
}

function renderUnscrambleSentenceState(section, state) {
  const assembled = section.querySelector('.unscramble-sentence-assembled');
  const bank = section.querySelector('.unscramble-sentence-bank');
  if (!(assembled instanceof HTMLDivElement) || !(bank instanceof HTMLDivElement)) {
    return;
  }

  assembled.replaceChildren();
  bank.replaceChildren();

  if (state.selectedTokens.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'unscramble-placeholder';
    empty.textContent = 'Arma la oración aquí';
    assembled.append(empty);
  } else {
    state.selectedTokens.forEach((token, index) => {
      assembled.append(createUnscrambleTokenButton(token, index, true, state.completed));
    });
  }

  state.availableTokens.forEach((token, index) => {
    bank.append(createUnscrambleTokenButton(token, index, false, state.completed));
  });

  const confirmButton = section.querySelector('.exercise-confirm-button');
  if (confirmButton instanceof HTMLButtonElement) {
    confirmButton.disabled = state.completed || state.selectedTokens.length === 0;
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

  status.textContent = state.statusText || 'Organiza las piezas y confirma cuando estés seguro.';
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
}

function createUnscrambleTokenButton(token, index, isSelected, disabled) {
  const button = document.createElement('button');
  button.className = `unscramble-token${isSelected ? ' is-selected' : ''}`;
  button.type = 'button';
  button.dataset.token = token;
  button.dataset.tokenIndex = String(index);
  button.textContent = token;
  button.disabled = disabled;
  return button;
}

function createInitialTokenBank(tokens, seedText) {
  const shuffled = seededShuffle(tokens, seedText);
  if (!arraysEqual(shuffled, tokens)) {
    return shuffled;
  }

  const swapIndex = shuffled.findIndex((token) => token !== shuffled[0]);
  if (swapIndex <= 0) {
    return shuffled;
  }

  [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
  return shuffled;
}

function handleUnscrambleSentenceSubmit(section, state, deps) {
  if (state.completed || state.selectedTokens.length === 0) {
    return;
  }

  state.totalAttempts += 1;
  const completedSentence = formatTokenSentence(state.selectedTokens);
  if (arraysEqual(state.selectedTokens, state.correctTokens)) {
    state.completed = true;
    state.completedSentence = completedSentence;
    state.statusText = '';
    state.statusTone = '';
    renderUnscrambleSentenceState(section, state);
    reportUnscrambleSentenceCompleted(state, deps);
    return;
  }

  if (!state.incorrectSentences.includes(completedSentence)) {
    state.incorrectSentences.push(completedSentence);
  }
  state.statusText = 'Todavía no. Reordénala y vuelve a intentarlo.';
  state.statusTone = 'error';
  flashExerciseError(section);
  renderUnscrambleSentenceState(section, state);
}

function reportUnscrambleSentenceCompleted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (
    !socket ||
    state.reported ||
    !conversationId ||
    !state.messageId ||
    !state.completedSentence
  ) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:unscramble_sentence_completed', {
    blockIndex: state.blockIndex,
    completedSentence: state.completedSentence,
    conversationId,
    incorrectSentences: state.incorrectSentences,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    selectedTokens: state.selectedTokens,
    totalAttempts: state.totalAttempts,
  });
}
