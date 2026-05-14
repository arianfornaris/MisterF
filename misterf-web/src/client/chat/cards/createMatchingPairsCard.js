import { renderMarkdown } from '../utils/formatting.js';
import { seededShuffle } from '../shared/exerciseUtils.js';

export function createMatchingPairsCard(block, context, deps) {
  if (!Array.isArray(block.pairs)) {
    return null;
  }

  const normalizedPairs = block.pairs
    .filter(
      (pair) =>
        pair &&
        typeof pair.left === 'string' &&
        typeof pair.right === 'string',
    )
    .map((pair, index) => ({
      left: pair.left.trim(),
      leftId: `left-${index}`,
      right: pair.right.trim(),
      rightId: `right-${index}`,
    }))
    .filter((pair) => pair.left && pair.right);

  if (normalizedPairs.length < 2) {
    return null;
  }

  const blockIndex = Number(context.blockIndex) || 0;
  const messageId = Number(context.messageId) || 0;
  const exerciseKey = `${messageId}:${blockIndex}`;
  const leftItems = normalizedPairs.map((pair) => ({
    id: pair.leftId,
    text: pair.left,
  }));
  const rightItems = seededShuffle(
    normalizedPairs.map((pair) => ({
      id: pair.rightId,
      text: pair.right,
    })),
    exerciseKey,
  );
  const section = document.createElement('section');
  section.className = 'matching-pairs-card';
  section.dataset.exerciseKey = exerciseKey;

  const label = document.createElement('p');
  label.className = 'matching-pairs-label';
  label.textContent = 'Empareja';

  const prompt = document.createElement('div');
  prompt.className = 'matching-pairs-prompt';
  prompt.innerHTML = renderMarkdown(block.prompt || 'Selecciona los pares correctos.');

  const columns = document.createElement('div');
  columns.className = 'matching-pairs-columns';

  const leftColumn = document.createElement('div');
  leftColumn.className = 'matching-pairs-column';
  const leftTitle = document.createElement('p');
  leftTitle.className = 'matching-pairs-column-title';
  leftTitle.textContent = 'Columna A';
  const leftList = document.createElement('div');
  leftList.className = 'matching-pairs-list';

  const rightColumn = document.createElement('div');
  rightColumn.className = 'matching-pairs-column';
  const rightTitle = document.createElement('p');
  rightTitle.className = 'matching-pairs-column-title';
  rightTitle.textContent = 'Columna B';
  const rightList = document.createElement('div');
  rightList.className = 'matching-pairs-list';

  const state = {
    blockIndex,
    correctPairsByLeftId: new Map(
      normalizedPairs.map((pair) => [pair.leftId, pair.rightId]),
    ),
    completed: Boolean(context.matchingResult?.completedAt),
    exerciseKey,
    incorrectAttempts: [],
    lockedPairsByLeftId: new Map(),
    messageId,
    prompt: block.prompt || '',
    reported: Boolean(context.matchingResult?.completedAt),
    textByItemId: new Map(
      [
        ...normalizedPairs.map((pair) => [pair.leftId, pair.left]),
        ...normalizedPairs.map((pair) => [pair.rightId, pair.right]),
      ],
    ),
    selectedLeftId: null,
    selectedRightId: null,
    totalAttempts: Number(context.matchingResult?.totalAttempts) || 0,
  };

  const persistedAttempts = Array.isArray(context.matchingResult?.incorrectAttempts)
    ? context.matchingResult.incorrectAttempts
    : [];
  for (const attempt of persistedAttempts) {
    if (
      attempt &&
      typeof attempt.left === 'string' &&
      typeof attempt.right === 'string'
    ) {
      state.incorrectAttempts.push({
        left: attempt.left.trim(),
        right: attempt.right.trim(),
      });
    }
  }

  if (state.completed) {
    for (const pair of normalizedPairs) {
      state.lockedPairsByLeftId.set(pair.leftId, pair.rightId);
    }
  }

  for (const item of leftItems) {
    const button = document.createElement('button');
    button.className = 'matching-pairs-item';
    button.type = 'button';
    button.dataset.side = 'left';
    button.dataset.itemId = item.id;
    button.textContent = item.text;
    leftList.append(button);
  }

  for (const item of rightItems) {
    const button = document.createElement('button');
    button.className = 'matching-pairs-item';
    button.type = 'button';
    button.dataset.side = 'right';
    button.dataset.itemId = item.id;
    button.textContent = item.text;
    rightList.append(button);
  }

  const status = document.createElement('p');
  status.className = 'matching-pairs-status';
  const summary = document.createElement('div');
  summary.className = 'matching-pairs-summary d-none';

  leftColumn.append(leftTitle, leftList);
  rightColumn.append(rightTitle, rightList);
  columns.append(leftColumn, rightColumn);
  section.append(label, prompt, columns, summary, status);

  section.addEventListener('click', (event) => {
    const button = event.target.closest('.matching-pairs-item');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    handleMatchingPairsSelection(section, state, button, deps);
  });

  deps.matchingExerciseStates?.set(exerciseKey, state);
  renderMatchingPairsState(section, state);
  return section;
}

function handleMatchingPairsSelection(section, state, button, deps) {
  if (state.completed) {
    return;
  }

  const side = button.dataset.side;
  const itemId = button.dataset.itemId || '';
  if (!itemId || !side) {
    return;
  }

  if (side === 'left' && state.lockedPairsByLeftId.has(itemId)) {
    return;
  }

  if (side === 'right' && Array.from(state.lockedPairsByLeftId.values()).includes(itemId)) {
    return;
  }

  if (side === 'left') {
    state.selectedLeftId = state.selectedLeftId === itemId ? null : itemId;
  } else {
    state.selectedRightId = state.selectedRightId === itemId ? null : itemId;
  }

  renderMatchingPairsState(section, state);

  if (!state.selectedLeftId || !state.selectedRightId) {
    return;
  }

  state.totalAttempts += 1;
  const expectedRightId = state.correctPairsByLeftId.get(state.selectedLeftId);
  if (expectedRightId && expectedRightId === state.selectedRightId) {
    state.lockedPairsByLeftId.set(state.selectedLeftId, state.selectedRightId);
    state.selectedLeftId = null;
    state.selectedRightId = null;

    if (state.lockedPairsByLeftId.size === state.correctPairsByLeftId.size) {
      state.completed = true;
      renderMatchingPairsState(section, state);
      reportMatchingPairsCompleted(state, deps);
      return;
    }

    renderMatchingPairsState(section, state);
    return;
  }

  const attemptKey = `${state.selectedLeftId}::${state.selectedRightId}`;
  if (
    !state.incorrectAttempts.some(
      (item) =>
        `${findMatchingIdByText(state, item.left, 'left')}::${findMatchingIdByText(state, item.right, 'right')}` ===
        attemptKey,
    )
  ) {
    state.incorrectAttempts.push({
      left: state.textByItemId.get(state.selectedLeftId) || state.selectedLeftId,
      right: state.textByItemId.get(state.selectedRightId) || state.selectedRightId,
    });
  }

  flashMatchingPairError(section, state.selectedLeftId, state.selectedRightId);
  state.selectedLeftId = null;
  state.selectedRightId = null;
  renderMatchingPairsState(section, state);
}

function renderMatchingPairsState(section, state) {
  const lockedRightIds = new Set(state.lockedPairsByLeftId.values());
  const textByItemId = state.textByItemId;
  for (const button of section.querySelectorAll('.matching-pairs-item')) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const side = button.dataset.side;
    const itemId = button.dataset.itemId || '';
    const isSelected =
      (side === 'left' && state.selectedLeftId === itemId) ||
      (side === 'right' && state.selectedRightId === itemId);
    const isLocked =
      (side === 'left' && state.lockedPairsByLeftId.has(itemId)) ||
      (side === 'right' && lockedRightIds.has(itemId));

    button.classList.toggle('is-selected', isSelected);
    button.classList.toggle('is-locked', isLocked);

    if (isLocked) {
      button.disabled = true;
      if (!button.hidden && !button.dataset.removalScheduled) {
        button.dataset.removalScheduled = 'true';
        button.classList.add('is-removing');
        window.setTimeout(() => {
          button.hidden = true;
          button.setAttribute('aria-hidden', 'true');
          button.classList.remove('is-removing');
          delete button.dataset.removalScheduled;
        }, 720);
      }
    } else {
      button.hidden = false;
      button.setAttribute('aria-hidden', 'false');
      button.classList.remove('is-removing');
      delete button.dataset.removalScheduled;
      button.disabled = state.completed;
    }
  }

  const status = section.querySelector('.matching-pairs-status');
  const summary = section.querySelector('.matching-pairs-summary');
  if (!status) {
    return;
  }

  if (state.completed) {
    if (summary instanceof HTMLDivElement) {
      summary.replaceChildren();
      const list = document.createElement('div');
      list.className = 'matching-pairs-summary-list';

      for (const [leftId, rightId] of state.correctPairsByLeftId.entries()) {
        const row = document.createElement('p');
        row.className = 'matching-pairs-summary-row';
        row.textContent = `${textByItemId.get(leftId) || leftId} → ${textByItemId.get(rightId) || rightId}`;
        list.append(row);
      }

      summary.append(list);
      summary.classList.remove('d-none');
    }
    status.textContent = 'Completado. Buen trabajo.';
    status.classList.add('is-success');
    return;
  }

  if (summary instanceof HTMLDivElement) {
    summary.classList.add('d-none');
    summary.replaceChildren();
  }
  status.classList.remove('is-success');
  status.textContent =
    state.lockedPairsByLeftId.size > 0
      ? `Pares correctos: ${state.lockedPairsByLeftId.size}/${state.correctPairsByLeftId.size}`
      : 'Selecciona un elemento de cada columna para formar un par.';
}

function flashMatchingPairError(section, leftId, rightId) {
  const leftButton = section.querySelector(
    `.matching-pairs-item[data-side="left"][data-item-id="${CSS.escape(leftId)}"]`,
  );
  const rightButton = section.querySelector(
    `.matching-pairs-item[data-side="right"][data-item-id="${CSS.escape(rightId)}"]`,
  );

  for (const button of [leftButton, rightButton]) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    button.classList.add('is-error');
    window.setTimeout(() => {
      button.classList.remove('is-error');
    }, 620);
  }
}

function reportMatchingPairsCompleted(state, deps) {
  const socket = deps.getSocket();
  const conversationId = deps.getConversationId();
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:matching_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    incorrectAttempts: state.incorrectAttempts,
    messageId: state.messageId,
    modelTier: deps.getSelectedModelTier(),
    totalAttempts: state.totalAttempts,
  });
}

function findMatchingIdByText(state, text, side) {
  for (const [itemId, itemText] of state.textByItemId.entries()) {
    if (itemText !== text) {
      continue;
    }

    if (side === 'left' && itemId.startsWith('left-')) {
      return itemId;
    }

    if (side === 'right' && itemId.startsWith('right-')) {
      return itemId;
    }
  }

  return '';
}
