import { renderMarkdown } from '../utils/formatting.js';
import { disableTextAssist } from '../utils/textAssist.js';
import {
  seededShuffle,
  splitSentenceByBlanks,
} from '../shared/exerciseUtils.js';

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
    block,
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
  closeButton.className = 'quiz-close-button';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Cerrar quiz');
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    if (state.submitted || state.aborted) {
      return;
    }

    const shouldAbort = window.confirm(
      'Si cierras este quiz, perderás esta evaluación pendiente. ¿Quieres abortarlo?',
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
  previousButton.className = 'quiz-nav-button';
  previousButton.type = 'button';
  previousButton.textContent = 'Atras';
  previousButton.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderQuizCard(section, state, deps);
    }
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'quiz-nav-button';
  nextButton.type = 'button';
  nextButton.textContent = 'Siguiente';
  nextButton.addEventListener('click', () => {
    if (state.currentIndex < state.itemStates.length - 1) {
      state.currentIndex += 1;
      renderQuizCard(section, state, deps);
    }
  });

  nav.append(previousButton, nextButton);

  const footer = document.createElement('div');
  footer.className = 'quiz-footer';

  const status = document.createElement('p');
  status.className = 'quiz-status';

  const evaluateButton = document.createElement('button');
  evaluateButton.className = 'quiz-evaluate-button';
  evaluateButton.type = 'button';
  evaluateButton.textContent = 'Evaluar';
  evaluateButton.addEventListener('click', () => {
    if (state.submitted || state.aborted || !isQuizReadyToSubmit(state)) {
      return;
    }

    state.submitted = true;
    state.submittedAt = new Date().toISOString();
    reportQuizCompleted(state, deps);
    renderQuizCard(section, state, deps);
  });

  footer.append(status, evaluateButton);

  section.append(header, itemCounter, itemPrompt, itemBody, nav, footer);
  renderQuizCard(section, state, deps);
  return section;
}

function buildInitialQuizItemState(item, itemIndex, exerciseKey, persistedResponse) {
  if (
    item.kind === 'quiz_open_text' ||
    item.kind === 'quiz_translate_to_english' ||
    item.kind === 'quiz_understand_in_spanish'
  ) {
    return {
      kind: item.kind,
      text:
        typeof persistedResponse?.text === 'string' ? persistedResponse.text : '',
    };
  }

  if (
    item.kind === 'quiz_fill_in_the_blank_input' ||
    item.kind === 'quiz_fill_in_the_blank_choice'
  ) {
    const blankCount = Array.isArray(item.blanks) ? item.blanks.length : 0;
    const values = Array.isArray(persistedResponse?.values)
      ? persistedResponse.values.slice(0, blankCount).map((value) => String(value || ''))
      : [];
    while (values.length < blankCount) {
      values.push('');
    }

    return {
      kind: item.kind,
      values,
    };
  }

  if (item.kind === 'quiz_multiple_choice') {
    return {
      kind: item.kind,
      selectedOptions: new Set(
        Array.isArray(persistedResponse?.selectedOptions)
          ? persistedResponse.selectedOptions.map((value) => String(value || ''))
          : [],
      ),
    };
  }

  if (item.kind === 'quiz_matching_pairs') {
    const pairs = Array.isArray(persistedResponse?.pairs)
      ? persistedResponse.pairs
          .filter(
            (pair) =>
              pair &&
              typeof pair.left === 'string' &&
              typeof pair.right === 'string',
          )
          .map((pair) => ({
            left: pair.left,
            right: pair.right,
          }))
      : [];

    return {
      kind: item.kind,
      pairs,
      selectedLeft: '',
      selectedRight: '',
      shuffledRightItems: seededShuffle(
        Array.isArray(item.rightItems) ? item.rightItems : [],
        `${exerciseKey}:quiz-matching:${itemIndex}`,
      ),
    };
  }

  if (item.kind === 'quiz_unscramble_sentence') {
    const selectedTokens = Array.isArray(persistedResponse?.selectedTokens)
      ? persistedResponse.selectedTokens.map((value) => String(value || ''))
      : [];
    const tokens = Array.isArray(item.tokens) ? item.tokens : [];

    if (selectedTokens.length > 0) {
      const remainingTokens = [...tokens];
      for (const token of selectedTokens) {
        const index = remainingTokens.indexOf(token);
        if (index >= 0) {
          remainingTokens.splice(index, 1);
        }
      }

      return {
        availableTokens: seededShuffle(
          remainingTokens,
          `${exerciseKey}:quiz-unscramble:${itemIndex}:remaining`,
        ),
        kind: item.kind,
        selectedTokens,
      };
    }

    return {
      availableTokens: seededShuffle(
        tokens,
        `${exerciseKey}:quiz-unscramble:${itemIndex}`,
      ),
      kind: item.kind,
      selectedTokens: [],
    };
  }

  return { kind: item.kind };
}

function renderQuizCard(section, state, deps) {
  const itemCounter = section.querySelector('.quiz-item-counter');
  const itemPrompt = section.querySelector('.quiz-item-prompt');
  const itemBody = section.querySelector('.quiz-item-body');
  const previousButton = section.querySelector('.quiz-nav-button:first-child');
  const nextButton = section.querySelector('.quiz-nav-button:last-child');
  const evaluateButton = section.querySelector('.quiz-evaluate-button');
  const status = section.querySelector('.quiz-status');
  const closeButton = section.querySelector('.quiz-close-button');

  if (
    !(itemCounter instanceof HTMLParagraphElement) ||
    !(itemPrompt instanceof HTMLDivElement) ||
    !(itemBody instanceof HTMLDivElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement) ||
    !(evaluateButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLParagraphElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const item = state.block.items[state.currentIndex];
  const itemState = state.itemStates[state.currentIndex];
  itemCounter.textContent = `Pregunta ${state.currentIndex + 1} de ${state.itemStates.length}`;
  itemPrompt.innerHTML = renderMarkdown(item.prompt || '');

  itemBody.replaceChildren();
  renderQuizItemBody(itemBody, item, itemState, state, deps);

  previousButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex >= state.itemStates.length - 1;
  closeButton.disabled = state.submitted || state.aborted;
  syncQuizCardStatus(section, state);
}

function syncQuizCardStatus(section, state) {
  const evaluateButton = section?.querySelector('.quiz-evaluate-button');
  const status = section?.querySelector('.quiz-status');
  if (!(evaluateButton instanceof HTMLButtonElement) || !(status instanceof HTMLParagraphElement)) {
    return;
  }

  evaluateButton.disabled = state.submitted || state.aborted || !isQuizReadyToSubmit(state);
  status.classList.remove('is-success', 'is-error');

  if (state.aborted) {
    setQuizStatusContent(status, 'Quiz cancelado.');
    status.classList.add('is-error');
  } else if (section.dataset.quizEvaluationComplete === 'true') {
    setQuizStatusContent(status, 'Quiz evaluado.');
    status.classList.add('is-success');
  } else if (state.submitted) {
    setQuizStatusContent(status, 'Quiz enviado. Mister F lo está evaluando.', {
      pending: true,
    });
    status.classList.add('is-success');
  } else if (isQuizReadyToSubmit(state)) {
    setQuizStatusContent(status, 'Todo listo. Puedes evaluar el quiz cuando quieras.');
  } else {
    setQuizStatusContent(status, 'Responde todas las preguntas antes de evaluar.');
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

function renderQuizItemBody(container, item, itemState, state, deps) {
  if (
    item.kind === 'quiz_open_text' ||
    item.kind === 'quiz_translate_to_english' ||
    item.kind === 'quiz_understand_in_spanish'
  ) {
    if (item.kind !== 'quiz_open_text') {
      const sentence = document.createElement('blockquote');
      sentence.className = 'quiz-item-sentence';
      sentence.textContent = String(item.sentence || '').replace(/\s+/g, ' ').trim();
      container.append(sentence);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'quiz-open-textarea form-control';
    textarea.rows = 4;
    textarea.placeholder =
      typeof item.placeholder === 'string' ? item.placeholder : '';
    textarea.value = typeof itemState.text === 'string' ? itemState.text : '';
    textarea.disabled = state.submitted || state.aborted;
    disableTextAssist(textarea);
    textarea.addEventListener('input', () => {
      itemState.text = textarea.value;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      syncQuizCardStatus(container.closest('.quiz-card'), state);
    });
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    container.append(textarea);
    return;
  }

  if (
    item.kind === 'quiz_fill_in_the_blank_input' ||
    item.kind === 'quiz_fill_in_the_blank_choice'
  ) {
    const sentence = document.createElement('div');
    sentence.className = 'fill-in-the-blank-sentence quiz-fill-sentence';
    const placeholderToken =
      item.kind === 'quiz_fill_in_the_blank_choice' ? '{{blank}}' : '___';
    const segments = splitSentenceByBlanks(item.sentence, placeholderToken);
    if (!segments) {
      return;
    }

    segments.forEach((segment, segmentIndex) => {
      if (segment) {
        const text = document.createElement('span');
        text.className = 'fill-in-the-blank-text';
        text.textContent = segment;
        sentence.append(text);
      }

      if (segmentIndex >= item.blanks.length) {
        return;
      }

      const wrap = document.createElement('span');
      wrap.className = 'fill-in-the-blank-blank-wrap';

      if (item.kind === 'quiz_fill_in_the_blank_choice') {
        const select = document.createElement('select');
        select.className = 'fill-in-the-blank-select';
        select.disabled = state.submitted || state.aborted;

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '';
        select.append(emptyOption);

        item.blanks[segmentIndex].choices.forEach((choice) => {
          const option = document.createElement('option');
          option.value = choice;
          option.textContent = choice;
          if (itemState.values[segmentIndex] === choice) {
            option.selected = true;
          }
          select.append(option);
        });

        select.value = itemState.values[segmentIndex] || '';
        select.addEventListener('change', () => {
          itemState.values[segmentIndex] = select.value;
          syncQuizCardStatus(container.closest('.quiz-card'), state);
        });
        wrap.append(select);
      } else {
        const input = document.createElement('input');
        input.className = 'fill-in-the-blank-input';
        input.type = 'text';
        input.value = itemState.values[segmentIndex] || '';
        input.disabled = state.submitted || state.aborted;
        disableTextAssist(input);
        input.addEventListener('input', () => {
          itemState.values[segmentIndex] = input.value;
          syncQuizBlankWidth(input);
          syncQuizCardStatus(container.closest('.quiz-card'), state);
        });
        syncQuizBlankWidth(input);
        wrap.append(input);
      }

      sentence.append(wrap);
    });

    container.append(sentence);
    return;
  }

  if (item.kind === 'quiz_multiple_choice') {
    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'multiple-choice-options quiz-multiple-choice-options';

    item.options.forEach((optionText) => {
      const button = document.createElement('button');
      button.className = 'multiple-choice-option';
      button.type = 'button';
      button.textContent = optionText;
      button.disabled = state.submitted || state.aborted;
      button.classList.toggle('is-selected', itemState.selectedOptions.has(optionText));
      button.addEventListener('click', () => {
        if (state.submitted || state.aborted) {
          return;
        }

        if (item.selectionMode === 'single') {
          if (itemState.selectedOptions.has(optionText)) {
            itemState.selectedOptions.clear();
          } else {
            itemState.selectedOptions.clear();
            itemState.selectedOptions.add(optionText);
          }
        } else if (itemState.selectedOptions.has(optionText)) {
          itemState.selectedOptions.delete(optionText);
        } else {
          itemState.selectedOptions.add(optionText);
        }

        renderQuizCard(container.closest('.quiz-card'), state, deps);
      });
      optionsWrap.append(button);
    });

    const helper = document.createElement('p');
    helper.className = 'quiz-item-helper';
    helper.textContent =
      item.selectionMode === 'single'
        ? 'Marca solo una opción.'
        : 'Selecciona una o varias opciones.';

    container.append(optionsWrap, helper);
    return;
  }

  if (item.kind === 'quiz_matching_pairs') {
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

    const pairedLeft = new Set(itemState.pairs.map((pair) => pair.left));
    const pairedRight = new Set(itemState.pairs.map((pair) => pair.right));

    const commitPair = (leftText, rightText) => {
      if (!leftText || !rightText) {
        return;
      }

      itemState.pairs.push({
        left: leftText,
        right: rightText,
      });
      itemState.selectedLeft = '';
      itemState.selectedRight = '';
      renderQuizCard(container.closest('.quiz-card'), state, deps);
    };

    item.leftItems
      .filter((leftText) => !pairedLeft.has(leftText))
      .forEach((leftText) => {
        const button = document.createElement('button');
        button.className = 'matching-pairs-item';
        button.type = 'button';
        button.textContent = leftText;
        button.disabled = state.submitted || state.aborted;
        button.classList.toggle('is-selected', itemState.selectedLeft === leftText);
        button.addEventListener('click', () => {
          if (state.submitted || state.aborted) {
            return;
          }

          if (itemState.selectedRight) {
            commitPair(leftText, itemState.selectedRight);
            return;
          }

          itemState.selectedLeft =
            itemState.selectedLeft === leftText ? '' : leftText;
          renderQuizCard(container.closest('.quiz-card'), state, deps);
        });
        leftList.append(button);
      });

    itemState.shuffledRightItems
      .filter((rightText) => !pairedRight.has(rightText))
      .forEach((rightText) => {
        const button = document.createElement('button');
        button.className = 'matching-pairs-item';
        button.type = 'button';
        button.textContent = rightText;
        button.disabled = state.submitted || state.aborted;
        button.classList.toggle('is-selected', itemState.selectedRight === rightText);
        button.addEventListener('click', () => {
          if (state.submitted || state.aborted) {
            return;
          }

          if (itemState.selectedLeft) {
            commitPair(itemState.selectedLeft, rightText);
            return;
          }

          itemState.selectedRight =
            itemState.selectedRight === rightText ? '' : rightText;
          renderQuizCard(container.closest('.quiz-card'), state, deps);
        });
        rightList.append(button);
      });

    leftColumn.append(leftTitle, leftList);
    rightColumn.append(rightTitle, rightList);
    columns.append(leftColumn, rightColumn);

    const pairList = document.createElement('div');
    pairList.className = 'quiz-pair-list';
    if (itemState.pairs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'quiz-item-helper';
      empty.textContent =
        'Selecciona un elemento de una columna y luego uno de la otra para crear el par.';
      pairList.append(empty);
    } else {
      itemState.pairs.forEach((pair, pairIndex) => {
        const row = document.createElement('div');
        row.className =
          'quiz-pair-row d-flex align-items-center justify-content-between gap-2 border rounded px-3 py-2 bg-body-tertiary';

        const text = document.createElement('div');
        text.className = 'quiz-pair-row-text d-flex align-items-center flex-wrap gap-2';

        const leftChip = document.createElement('span');
        leftChip.className = 'badge text-bg-light border rounded-pill';
        leftChip.textContent = pair.left;

        const arrow = document.createElement('i');
        arrow.className = 'bi bi-arrow-left-right text-body-secondary';
        arrow.setAttribute('aria-hidden', 'true');

        const rightChip = document.createElement('span');
        rightChip.className = 'badge text-bg-light border rounded-pill';
        rightChip.textContent = pair.right;

        text.append(leftChip, arrow, rightChip);

        const remove = document.createElement('button');
        remove.className = 'quiz-pair-remove btn btn-sm btn-outline-secondary';
        remove.type = 'button';
        remove.textContent = 'Quitar';
        remove.disabled = state.submitted || state.aborted;
        remove.addEventListener('click', () => {
          itemState.pairs.splice(pairIndex, 1);
          renderQuizCard(container.closest('.quiz-card'), state, deps);
        });

        row.append(text, remove);
        pairList.append(row);
      });
    }

    container.append(columns, pairList);
    return;
  }

  if (item.kind === 'quiz_unscramble_sentence') {
    const assembled = document.createElement('div');
    assembled.className = 'unscramble-sentence-assembled';
    const bank = document.createElement('div');
    bank.className = 'unscramble-sentence-bank';

    if (itemState.selectedTokens.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'unscramble-placeholder';
      empty.textContent = 'Arma la oración aquí';
      assembled.append(empty);
    } else {
      itemState.selectedTokens.forEach((token, index) => {
        assembled.append(
          createQuizUnscrambleTokenButton(token, index, true, state, itemState, deps),
        );
      });
    }

    itemState.availableTokens.forEach((token, index) => {
      bank.append(
        createQuizUnscrambleTokenButton(token, index, false, state, itemState, deps),
      );
    });

    container.append(assembled, bank);
  }
}

function createQuizUnscrambleTokenButton(token, index, isSelected, state, itemState, deps) {
  const button = document.createElement('button');
  button.className = `unscramble-token${isSelected ? ' is-selected' : ''}`;
  button.type = 'button';
  button.textContent = token;
  button.disabled = state.submitted || state.aborted;
  button.addEventListener('click', () => {
    if (state.submitted || state.aborted) {
      return;
    }

    if (isSelected) {
      itemState.selectedTokens.splice(index, 1);
      itemState.availableTokens.push(token);
    } else {
      itemState.availableTokens.splice(index, 1);
      itemState.selectedTokens.push(token);
    }

    renderQuizCard(button.closest('.quiz-card'), state, deps);
  });
  return button;
}

function isQuizReadyToSubmit(state) {
  return state.itemStates.every((itemState, index) =>
    isQuizItemAnswered(state.block.items[index], itemState),
  );
}

function isQuizItemAnswered(item, itemState) {
  if (
    item.kind === 'quiz_open_text' ||
    item.kind === 'quiz_translate_to_english' ||
    item.kind === 'quiz_understand_in_spanish'
  ) {
    return typeof itemState.text === 'string' && itemState.text.trim().length > 0;
  }

  if (
    item.kind === 'quiz_fill_in_the_blank_input' ||
    item.kind === 'quiz_fill_in_the_blank_choice'
  ) {
    return Array.isArray(itemState.values) && itemState.values.every((value) => value.trim());
  }

  if (item.kind === 'quiz_multiple_choice') {
    return itemState.selectedOptions instanceof Set && itemState.selectedOptions.size > 0;
  }

  if (item.kind === 'quiz_matching_pairs') {
    return Array.isArray(itemState.pairs) && itemState.pairs.length === item.leftItems.length;
  }

  if (item.kind === 'quiz_unscramble_sentence') {
    return (
      Array.isArray(itemState.selectedTokens) &&
      itemState.selectedTokens.length === item.tokens.length
    );
  }

  return false;
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

function buildQuizResponsePayload(item, itemState) {
  if (
    item.kind === 'quiz_open_text' ||
    item.kind === 'quiz_translate_to_english' ||
    item.kind === 'quiz_understand_in_spanish'
  ) {
    return {
      text: itemState.text || '',
    };
  }

  if (
    item.kind === 'quiz_fill_in_the_blank_input' ||
    item.kind === 'quiz_fill_in_the_blank_choice'
  ) {
    return {
      values: Array.isArray(itemState.values) ? itemState.values : [],
    };
  }

  if (item.kind === 'quiz_multiple_choice') {
    return {
      selectedOptions:
        itemState.selectedOptions instanceof Set
          ? Array.from(itemState.selectedOptions)
          : [],
    };
  }

  if (item.kind === 'quiz_matching_pairs') {
    return {
      pairs: Array.isArray(itemState.pairs) ? itemState.pairs : [],
    };
  }

  if (item.kind === 'quiz_unscramble_sentence') {
    return {
      selectedTokens: Array.isArray(itemState.selectedTokens)
        ? itemState.selectedTokens
        : [],
    };
  }

  return {};
}

function syncQuizBlankWidth(input) {
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const trimmed = input.value.trim();
  const length = Math.max(4, Math.min(18, trimmed.length || 6));
  input.style.width = `${length}ch`;
}
