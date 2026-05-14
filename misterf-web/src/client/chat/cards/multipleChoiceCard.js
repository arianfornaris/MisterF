import { renderMarkdown } from '../shared/markdown.js';
import {
  arraysEqual,
  createExerciseConfirmButton,
  flashExerciseError,
  seededShuffle,
} from '../shared/exerciseUtils.js';

export function createMultipleChoiceCard(block, context, deps) {
  if (
    !Array.isArray(block.options) ||
    typeof block.question !== 'string' ||
    (block.selectionMode !== 'single' && block.selectionMode !== 'multiple')
  ) {
    return null;
  }

  const options = block.options
    .filter(
      (option) =>
        option &&
        typeof option.text === 'string' &&
        typeof option.isCorrect === 'boolean',
    )
    .map((option) => ({
      isCorrect: option.isCorrect,
      text: option.text.trim(),
    }))
    .filter((option) => option.text);
  if (options.length < 2 || !options.some((option) => option.isCorrect)) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const section = document.createElement('section');
  section.className = 'multiple-choice-card';
  section.dataset.exerciseKey = exerciseKey;

  const label = document.createElement('p');
  label.className = 'multiple-choice-label';
  label.textContent = 'Selecciona la respuesta';

  const prompt = document.createElement('div');
  prompt.className = 'multiple-choice-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || '');

  const question = document.createElement('div');
  question.className = 'multiple-choice-question';
  question.innerHTML = renderMarkdown(block.question || '');

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'multiple-choice-options';

  const state = {
    completed: Boolean(context.result?.completedAt),
    correctOptions: new Set(
      options.filter((option) => option.isCorrect).map((option) => option.text),
    ),
    incorrectSelections: Array.isArray(context.result?.incorrectSelections)
      ? context.result.incorrectSelections
      : [],
    messageId,
    selectedOptions: new Set(
      Array.isArray(context.result?.selectedOptions) ? context.result.selectedOptions : [],
    ),
    selectionMode: block.selectionMode,
    blockIndex,
    reported: Boolean(context.result?.completedAt),
    statusText: '',
    statusTone: '',
    totalAttempts: Number(context.result?.totalAttempts) || 0,
  };

  seededShuffle(options, `${exerciseKey}:multiple-choice`).forEach((option) => {
    const button = document.createElement('button');
    button.className = 'multiple-choice-option';
    button.type = 'button';
    button.dataset.optionText = option.text;
    button.textContent = option.text;
    optionsWrap.append(button);
  });

  optionsWrap.addEventListener('click', (event) => {
    const button = event.target.closest('.multiple-choice-option');
    if (!(button instanceof HTMLButtonElement) || state.completed) {
      return;
    }

    const optionText = button.dataset.optionText || '';
    if (!optionText) {
      return;
    }

    if (state.selectionMode === 'single') {
      if (state.selectedOptions.has(optionText)) {
        state.selectedOptions.clear();
      } else {
        state.selectedOptions.clear();
        state.selectedOptions.add(optionText);
      }
    } else if (state.selectedOptions.has(optionText)) {
      state.selectedOptions.delete(optionText);
    } else {
      state.selectedOptions.add(optionText);
    }
    renderMultipleChoiceState(section, state);
  });

  const confirmButton = createExerciseConfirmButton(() => {
    handleMultipleChoiceSubmit(section, state, deps);
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
  section.append(question, optionsWrap, controls, status);
  renderMultipleChoiceState(section, state);
  return section;
}

function renderMultipleChoiceState(section, state) {
  for (const button of section.querySelectorAll('.multiple-choice-option')) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const optionText = button.dataset.optionText || '';
    const isSelected = state.selectedOptions.has(optionText);
    button.classList.toggle('is-selected', isSelected);
    button.disabled = state.completed;
  }

  const confirmButton = section.querySelector('.exercise-confirm-button');
  if (confirmButton instanceof HTMLButtonElement) {
    confirmButton.disabled = state.completed || state.selectedOptions.size === 0;
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
    state.statusText ||
    (state.selectionMode === 'single'
      ? 'Marca solo una opción y confirma cuando estés seguro.'
      : 'Selecciona una o varias opciones y confirma cuando estés seguro.');
  if (state.statusTone === 'error') {
    status.classList.add('is-error');
  }
}

function handleMultipleChoiceSubmit(section, state, deps) {
  if (state.completed || state.selectedOptions.size === 0) {
    return;
  }

  state.totalAttempts += 1;
  const selected = Array.from(state.selectedOptions).sort();
  const correct = Array.from(state.correctOptions).sort();
  if (arraysEqual(selected, correct)) {
    state.completed = true;
    state.statusText = '';
    state.statusTone = '';
    renderMultipleChoiceState(section, state);
    reportMultipleChoiceCompleted(state, deps);
    return;
  }

  const key = selected.join(' || ');
  if (
    !state.incorrectSelections.some(
      (selection) => Array.isArray(selection) && selection.slice().sort().join(' || ') === key,
    )
  ) {
    state.incorrectSelections.push(selected);
  }
  state.statusText = 'Todavía no. Revísalo y vuelve a intentarlo.';
  state.statusTone = 'error';
  flashExerciseError(section);
  renderMultipleChoiceState(section, state);
}

function reportMultipleChoiceCompleted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:multiple_choice_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    incorrectSelections: state.incorrectSelections,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    selectedOptions: Array.from(state.selectedOptions),
    totalAttempts: state.totalAttempts,
  });
}
