import { disableTextAssist } from '../chat/shared/textAssist.js';
import {
  formatTokenSentence,
  seededShuffle,
  splitSentenceByBlanks,
} from '../chat/shared/exerciseUtils.js';

export function buildInitialQuizItemState(item, itemIndex, exerciseKey, persistedResponse) {
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

export function renderQuizItemBody(container, item, itemState, state, options = {}) {
  const disabled = isQuizInteractionDisabled(state, options);
  const notifyChange = () => {
    if (typeof options.onChange === 'function') {
      options.onChange();
    }
  };
  const rerender = () => {
    if (typeof options.rerender === 'function') {
      options.rerender();
    } else {
      notifyChange();
    }
  };

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
    textarea.disabled = disabled;
    disableTextAssist(textarea);
    textarea.addEventListener('input', () => {
      itemState.text = textarea.value;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      notifyChange();
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
    if (!segments || !Array.isArray(item.blanks)) {
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
        select.disabled = disabled;

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '';
        select.append(emptyOption);

        const choices = Array.isArray(item.blanks[segmentIndex].choices)
          ? item.blanks[segmentIndex].choices
          : [];
        choices.forEach((choice) => {
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
          notifyChange();
        });
        wrap.append(select);
      } else {
        const input = document.createElement('input');
        input.className = 'fill-in-the-blank-input';
        input.type = 'text';
        input.value = itemState.values[segmentIndex] || '';
        input.disabled = disabled;
        disableTextAssist(input);
        input.addEventListener('input', () => {
          itemState.values[segmentIndex] = input.value;
          syncQuizBlankWidth(input);
          notifyChange();
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

    const optionsList = Array.isArray(item.options) ? item.options : [];
    optionsList.forEach((optionText) => {
      const button = document.createElement('button');
      button.className = 'multiple-choice-option';
      button.type = 'button';
      button.textContent = optionText;
      button.disabled = disabled;
      button.classList.toggle('is-selected', itemState.selectedOptions.has(optionText));
      button.addEventListener('click', () => {
        if (isQuizInteractionDisabled(state, options)) {
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

        rerender();
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
      rerender();
    };

    const leftItems = Array.isArray(item.leftItems) ? item.leftItems : [];
    leftItems
      .filter((leftText) => !pairedLeft.has(leftText))
      .forEach((leftText) => {
        const button = document.createElement('button');
        button.className = 'matching-pairs-item';
        button.type = 'button';
        button.textContent = leftText;
        button.disabled = disabled;
        button.classList.toggle('is-selected', itemState.selectedLeft === leftText);
        button.addEventListener('click', () => {
          if (isQuizInteractionDisabled(state, options)) {
            return;
          }

          if (itemState.selectedRight) {
            commitPair(leftText, itemState.selectedRight);
            return;
          }

          itemState.selectedLeft =
            itemState.selectedLeft === leftText ? '' : leftText;
          rerender();
        });
        leftList.append(button);
      });

    const rightItems = Array.isArray(itemState.shuffledRightItems)
      ? itemState.shuffledRightItems
      : [];
    rightItems
      .filter((rightText) => !pairedRight.has(rightText))
      .forEach((rightText) => {
        const button = document.createElement('button');
        button.className = 'matching-pairs-item';
        button.type = 'button';
        button.textContent = rightText;
        button.disabled = disabled;
        button.classList.toggle('is-selected', itemState.selectedRight === rightText);
        button.addEventListener('click', () => {
          if (isQuizInteractionDisabled(state, options)) {
            return;
          }

          if (itemState.selectedLeft) {
            commitPair(itemState.selectedLeft, rightText);
            return;
          }

          itemState.selectedRight =
            itemState.selectedRight === rightText ? '' : rightText;
          rerender();
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
        remove.disabled = disabled;
        remove.addEventListener('click', () => {
          itemState.pairs.splice(pairIndex, 1);
          rerender();
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
          createQuizUnscrambleTokenButton(token, index, true, state, itemState, options),
        );
      });
    }

    itemState.availableTokens.forEach((token, index) => {
      bank.append(
        createQuizUnscrambleTokenButton(token, index, false, state, itemState, options),
      );
    });

    container.append(assembled, bank);
  }
}

export function isQuizItemAnswered(item, itemState) {
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

export function buildQuizResponsePayload(item, itemState) {
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
      sentence: formatTokenSentence(itemState.selectedTokens),
      selectedTokens: Array.isArray(itemState.selectedTokens)
        ? itemState.selectedTokens
        : [],
    };
  }

  return {};
}

function createQuizUnscrambleTokenButton(token, index, isSelected, state, itemState, options) {
  const button = document.createElement('button');
  button.className = `unscramble-token${isSelected ? ' is-selected' : ''}`;
  button.type = 'button';
  button.textContent = token;
  button.disabled = isQuizInteractionDisabled(state, options);
  button.addEventListener('click', () => {
    if (isQuizInteractionDisabled(state, options)) {
      return;
    }

    if (isSelected) {
      itemState.selectedTokens.splice(index, 1);
      itemState.availableTokens.push(token);
    } else {
      itemState.availableTokens.splice(index, 1);
      itemState.selectedTokens.push(token);
    }

    if (typeof options.rerender === 'function') {
      options.rerender();
    } else if (typeof options.onChange === 'function') {
      options.onChange();
    }
  });
  return button;
}

function isQuizInteractionDisabled(state, options) {
  return Boolean(options.readOnly || state?.readOnly || state?.submitted || state?.aborted);
}

function syncQuizBlankWidth(input) {
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const trimmed = input.value.trim();
  const length = Math.max(4, Math.min(18, trimmed.length || 6));
  input.style.width = `${length}ch`;
}
