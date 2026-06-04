import { renderMarkdown } from '../utils/formatting.js';
import { disableTextAssist } from '../utils/textAssist.js';
import {
  fillSentenceBlanks,
  normalizeExerciseAnswer,
  seededShuffle,
  splitSentenceByBlanks,
} from '../shared/exerciseUtils.js';

export function createFillInTheBlankCard(block, context, deps) {
  const placeholderToken =
    block.type === 'fill_in_the_blank_choice' ? '{{blank}}' : '___';
  if (
    typeof block.sentence !== 'string' ||
    !Array.isArray(block.blanks) ||
    !block.sentence.includes(placeholderToken)
  ) {
    return null;
  }

  const sentence = block.sentence.replace(/\s+/g, ' ').trim();
  const blanks = block.blanks
    .filter((blank) => blank && typeof blank === 'object')
    .map((blank) => ({
      answers: Array.isArray(blank.answers)
        ? blank.answers
            .filter((answer) => typeof answer === 'string')
            .map((answer) => answer.trim())
            .filter(Boolean)
        : [],
      choices:
        block.type === 'fill_in_the_blank_choice' && Array.isArray(blank.choices)
          ? blank.choices
              .filter((choice) => typeof choice === 'string')
              .map((choice) => choice.trim())
              .filter(Boolean)
          : [],
    }));
  if (!sentence || blanks.length === 0) {
    return null;
  }

  const segments = splitSentenceByBlanks(sentence, placeholderToken);
  if (!segments || segments.length !== blanks.length + 1) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const section = document.createElement('section');
  section.className = `fill-in-the-blank-card is-${block.type}`;
  section.dataset.exerciseKey = exerciseKey;

  const label = document.createElement('p');
  label.className = 'fill-in-the-blank-label';
  label.textContent =
    block.type === 'fill_in_the_blank_input'
      ? 'Completa el espacio'
      : 'Elige la opción correcta';

  const prompt = document.createElement('div');
  prompt.className = 'fill-in-the-blank-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || 'Completa la oración.');

  const sentenceRow = document.createElement('div');
  sentenceRow.className = 'fill-in-the-blank-sentence';
  const persistedValues = Array.isArray(context.fillResult?.values)
    ? context.fillResult.values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
    : [];

  const state = {
    blockIndex,
    blanks: blanks.map((blank) => ({
      answersNormalized: new Set(blank.answers.map(normalizeExerciseAnswer)),
      choices: blank.choices,
    })),
    completed: Boolean(context.fillResult?.completedAt),
    completedSentence:
      typeof context.fillResult?.completedSentence === 'string'
        ? context.fillResult.completedSentence
        : '',
    exerciseKey,
    incorrectSentences: Array.isArray(context.fillResult?.incorrectSentences)
      ? context.fillResult.incorrectSentences
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    messageId,
    prompt: block.prompt || '',
    reported: Boolean(context.fillResult?.completedAt),
    segments,
    sentence,
    statusTone: '',
    statusText: '',
    totalAttempts: Number(context.fillResult?.totalAttempts) || 0,
    type: block.type,
    placeholderToken,
    values:
      persistedValues.length === blanks.length
        ? persistedValues
        : new Array(blanks.length).fill(''),
  };

  for (let index = 0; index < blanks.length; index += 1) {
    const before = document.createElement('span');
    before.className = 'fill-in-the-blank-text';
    before.textContent = segments[index] || '';
    sentenceRow.append(before);

    const blankWrap = document.createElement('span');
    blankWrap.className = 'fill-in-the-blank-blank-wrap';

    if (block.type === 'fill_in_the_blank_input') {
      const input = document.createElement('input');
      input.className = 'fill-in-the-blank-input';
      input.type = 'text';
      input.dataset.blankIndex = String(index);
      input.style.setProperty(
        '--blank-input-width',
        `${getBlankInputWidthCh(blanks[index].answers)}ch`,
      );
      disableTextAssist(input);
      input.value = state.values[index] || '';
      input.addEventListener('input', () => {
        state.values[index] = input.value;
        state.statusText = '';
        state.statusTone = '';
        renderFillInTheBlankState(section, state);
      });
      blankWrap.append(input);
    } else {
      if (blanks[index].choices.length < 2) {
        return null;
      }

      const select = document.createElement('select');
      select.className = 'fill-in-the-blank-select';
      select.dataset.blankIndex = String(index);
      select.style.setProperty(
        '--blank-select-width',
        `${getChoiceSelectWidthCh(blanks[index].choices)}ch`,
      );

      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '';
      select.append(emptyOption);

      seededShuffle(blanks[index].choices, `${exerciseKey}:choices:${index}`).forEach(
        (choice) => {
          const option = document.createElement('option');
          option.value = choice;
          option.textContent = choice;
          select.append(option);
        },
      );

      select.value = state.values[index] || '';
      select.addEventListener('change', () => {
        state.values[index] = select.value;
        state.statusText = '';
        state.statusTone = '';
        renderFillInTheBlankState(section, state);
      });
      blankWrap.append(select);
    }

    sentenceRow.append(blankWrap);
  }

  const after = document.createElement('span');
  after.className = 'fill-in-the-blank-text';
  after.textContent = segments[segments.length - 1] || '';
  sentenceRow.append(after);

  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn-primary exercise-confirm-button';
  confirmButton.type = 'button';
  confirmButton.setAttribute('aria-label', 'Confirmar respuesta');
  confirmButton.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
  confirmButton.addEventListener('click', () => {
    handleFillInTheBlankSubmit(section, state, deps);
  });

  const controls = document.createElement('div');
  controls.className = 'fill-in-the-blank-controls';
  controls.append(confirmButton);

  const status = document.createElement('p');
  status.className = 'fill-in-the-blank-status';

  section.append(label, prompt, sentenceRow, controls, status);

  renderFillInTheBlankState(section, state);
  return section;
}

function renderFillInTheBlankState(section, state) {
  for (const input of section.querySelectorAll('.fill-in-the-blank-input')) {
    if (!(input instanceof HTMLInputElement)) {
      continue;
    }

    const blankIndex = Number(input.dataset.blankIndex) || 0;
    const nextValue = state.values[blankIndex] || '';
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
    input.disabled = state.completed;
  }

  for (const select of section.querySelectorAll('.fill-in-the-blank-select')) {
    if (!(select instanceof HTMLSelectElement)) {
      continue;
    }

    const blankIndex = Number(select.dataset.blankIndex) || 0;
    select.value = state.values[blankIndex] || '';
    select.disabled = state.completed;
  }

  const confirmButton = section.querySelector('.exercise-confirm-button');
  if (confirmButton instanceof HTMLButtonElement) {
    confirmButton.disabled =
      state.completed || state.values.some((value) => !value.trim());
    confirmButton.classList.toggle('is-success', state.completed);
  }

  const status = section.querySelector('.fill-in-the-blank-status');
  if (status) {
    status.classList.remove('is-error', 'is-success');
    if (state.completed) {
      status.textContent = 'Completado. Buen trabajo.';
      status.classList.add('is-success');
    } else if (state.statusText) {
      status.textContent = state.statusText;
      if (state.statusTone === 'error') {
        status.classList.add('is-error');
      }
    } else {
      status.textContent =
        state.type === 'fill_in_the_blank_choice'
          ? 'Elige una opción en cada espacio y confirma cuando estés seguro.'
          : 'Completa todos los espacios y confirma cuando estés seguro.';
    }
  }
}

function getChoiceSelectWidthCh(choices) {
  const longestChoiceLength = choices.reduce(
    (longest, choice) => Math.max(longest, choice.length),
    0,
  );
  return Math.max(8, Math.min(42, longestChoiceLength + 4));
}

function getBlankInputWidthCh(answers) {
  const longestAnswerLength = answers.reduce(
    (longest, answer) => Math.max(longest, answer.length),
    0,
  );
  return Math.max(8, Math.min(42, longestAnswerLength + 2));
}

function handleFillInTheBlankSubmit(section, state, deps) {
  if (state.completed) {
    return;
  }

  const values = state.values.map((value) => value.trim());
  if (values.some((value) => !value)) {
    return;
  }

  state.totalAttempts += 1;
  const completedSentence = fillSentenceBlanks(
    state.sentence,
    values,
    state.placeholderToken,
  );
  if (!completedSentence) {
    return;
  }

  const isCorrect = state.blanks.every((blank, index) =>
    blank.answersNormalized.has(normalizeExerciseAnswer(values[index] || '')),
  );
  if (isCorrect) {
    state.completed = true;
    state.completedSentence = completedSentence;
    state.statusText = '';
    state.statusTone = '';
    renderFillInTheBlankState(section, state);
    reportFillInTheBlankCompleted(state, deps);
    return;
  }

  if (!state.incorrectSentences.includes(completedSentence)) {
    state.incorrectSentences.push(completedSentence);
  }
  state.statusText = 'Todavía no. Revísalo y vuelve a intentarlo.';
  state.statusTone = 'error';
  flashFillInTheBlankError(section);
  renderFillInTheBlankState(section, state);
}

function reportFillInTheBlankCompleted(state, deps) {
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
  socket.emit('exercise:fill_in_the_blank_completed', {
    blockIndex: state.blockIndex,
    completedSentence: state.completedSentence,
    conversationId,
    incorrectSentences: state.incorrectSentences,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    totalAttempts: state.totalAttempts,
    values: state.values.map((value) => value.trim()),
  });
}

function flashFillInTheBlankError(section) {
  section.classList.add('is-error');
  window.setTimeout(() => {
    section.classList.remove('is-error');
  }, 620);
}
