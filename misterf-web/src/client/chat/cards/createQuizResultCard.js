import { renderMarkdown } from '../utils/formatting.js';
import { splitSentenceByBlanks } from '../shared/exerciseUtils.js';

export function createQuizResultCard(block) {
  if (!block || typeof block !== 'object' || !Array.isArray(block.items) || block.items.length === 0) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'quiz-result-card';

  const state = {
    currentIndex: 0,
    items: block.items,
  };

  const header = document.createElement('div');
  header.className = 'quiz-result-header';

  const label = document.createElement('p');
  label.className = 'quiz-result-label';
  label.textContent = 'Resumen del quiz';

  header.append(label);

  if (typeof block.title === 'string' && block.title.trim()) {
    const title = document.createElement('h3');
    title.className = 'quiz-result-title';
    title.textContent = block.title.replace(/\s+/g, ' ').trim();
    header.append(title);
  }

  if (typeof block.prompt === 'string' && block.prompt.trim()) {
    const prompt = document.createElement('div');
    prompt.className = 'quiz-result-prompt';
    prompt.innerHTML = renderMarkdown(block.prompt);
    header.append(prompt);
  }

  const progressRow = document.createElement('div');
  progressRow.className = 'quiz-result-progress-row';

  const counter = document.createElement('p');
  counter.className = 'quiz-result-counter';

  const markers = document.createElement('div');
  markers.className = 'quiz-result-markers';

  progressRow.append(counter, markers);

  const slideHost = document.createElement('div');
  slideHost.className = 'quiz-result-slide-host';

  const footer = document.createElement('div');
  footer.className = 'quiz-result-footer';

  const previousButton = document.createElement('button');
  previousButton.className = 'btn btn-outline-secondary btn-sm';
  previousButton.type = 'button';
  previousButton.innerHTML = '<i class="bi bi-arrow-left" aria-hidden="true"></i>';
  previousButton.setAttribute('aria-label', 'Pregunta anterior');
  previousButton.addEventListener('click', () => {
    if (state.currentIndex <= 0) {
      return;
    }

    state.currentIndex -= 1;
    renderQuizResultCard(section, state);
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'btn btn-outline-secondary btn-sm';
  nextButton.type = 'button';
  nextButton.innerHTML = '<i class="bi bi-arrow-right" aria-hidden="true"></i>';
  nextButton.setAttribute('aria-label', 'Pregunta siguiente');
  nextButton.addEventListener('click', () => {
    if (state.currentIndex >= state.items.length - 1) {
      return;
    }

    state.currentIndex += 1;
    renderQuizResultCard(section, state);
  });

  footer.append(previousButton, nextButton);
  section.append(header, progressRow, slideHost, footer);

  renderQuizResultCard(section, state);
  return section;
}

function renderQuizResultCard(section, state) {
  const counter = section.querySelector('.quiz-result-counter');
  const markers = section.querySelector('.quiz-result-markers');
  const slideHost = section.querySelector('.quiz-result-slide-host');
  const previousButton = section.querySelector('.quiz-result-footer button:first-child');
  const nextButton = section.querySelector('.quiz-result-footer button:last-child');

  if (
    !(counter instanceof HTMLParagraphElement) ||
    !(markers instanceof HTMLDivElement) ||
    !(slideHost instanceof HTMLDivElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  counter.textContent = `Pregunta ${state.currentIndex + 1} de ${state.items.length}`;
  previousButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex >= state.items.length - 1;

  markers.replaceChildren();
  state.items.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = `quiz-result-marker${index === state.currentIndex ? ' is-active' : ''}`;
    button.type = 'button';
    button.textContent = String(index + 1);
    button.setAttribute('aria-label', `Ir a la pregunta ${index + 1}`);
    button.addEventListener('click', () => {
      state.currentIndex = index;
      renderQuizResultCard(section, state);
    });
    markers.append(button);
  });

  cleanupInlinePopovers(slideHost);
  slideHost.replaceChildren();
  const currentItem = state.items[state.currentIndex];
  const slide = createQuizResultSlide(currentItem, state.currentIndex);
  if (slide) {
    slideHost.append(slide);
    initializeInlinePopovers(slideHost);
  }
}

function createQuizResultSlide(item, index) {
  if (!item || typeof item !== 'object' || typeof item.kind !== 'string') {
    return null;
  }

  const article = document.createElement('article');
  article.className = 'quiz-result-slide';

  const itemHeader = document.createElement('div');
  itemHeader.className = 'quiz-result-item-header';

  const number = document.createElement('span');
  number.className = 'quiz-result-item-number';
  number.textContent = `Pregunta ${index + 1}`;

  itemHeader.append(number);
  itemHeader.append(createEvaluationBadge(item.evaluation?.status));
  article.append(itemHeader);

  if (typeof item.prompt === 'string' && item.prompt.trim()) {
    const prompt = document.createElement('div');
    prompt.className = 'quiz-result-item-prompt';
    prompt.innerHTML = renderMarkdown(item.prompt);
    article.append(prompt);
  }

  const responseSection = renderQuizResultItemContent(item);
  if (responseSection) {
    article.append(responseSection);
  }

  article.append(createFeedbackCard(item.evaluation));
  return article;
}

function renderQuizResultItemContent(item) {
  switch (item.kind) {
    case 'quiz_fill_in_the_blank_input':
      return createQuizResultFillSentence(item, '___');
    case 'quiz_fill_in_the_blank_choice':
      return createQuizResultFillSentence(item, '{{blank}}');
    case 'quiz_multiple_choice':
      return createQuizResultMultipleChoice(item);
    case 'quiz_matching_pairs':
      return createQuizResultMatchingPairs(item);
    case 'quiz_unscramble_sentence':
      return createQuizResultUnscramble(item);
    case 'quiz_translate_to_english':
    case 'quiz_understand_in_spanish':
      return createQuizResultTranslationLike(item);
    case 'quiz_open_text':
      return createQuizResultOpenText(item);
    default:
      return null;
  }
}

function createQuizResultOpenText(item) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';
  wrap.append(createResponseLabel('Tu respuesta'));
  wrap.append(
    createQuizResultPartsReview(
      item.inlineReview?.parts,
      item.userResponse?.text || 'No respondió.',
    ),
  );
  return wrap;
}

function createQuizResultTranslationLike(item) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';

  const sentence = document.createElement('blockquote');
  sentence.className = 'quiz-result-source-sentence';
  sentence.textContent = typeof item.sentence === 'string'
    ? item.sentence.replace(/\s+/g, ' ').trim()
    : '';

  wrap.append(sentence);
  wrap.append(createResponseLabel('Tu respuesta'));
  wrap.append(
    createQuizResultPartsReview(
      item.inlineReview?.parts,
      item.userResponse?.text || 'No respondió.',
    ),
  );
  return wrap;
}

function createQuizResultFillSentence(item, placeholderToken) {
  if (typeof item.sentence !== 'string' || !item.sentence.includes(placeholderToken)) {
    return createQuizResultOpenText({
      ...item,
      userResponse: {
        text: Array.isArray(item.userResponse?.values)
          ? item.userResponse.values.join(', ')
          : 'No respondió.',
      },
    });
  }

  const segments = splitSentenceByBlanks(item.sentence, placeholderToken);
  if (!segments) {
    return null;
  }

  const sentence = document.createElement('p');
  sentence.className = 'quiz-result-fill-sentence';
  const values = Array.isArray(item.userResponse?.values) ? item.userResponse.values : [];
  const blankReviews = Array.isArray(item.inlineReview?.blanks) ? item.inlineReview.blanks : [];

  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index]) {
      const text = document.createElement('span');
      text.className = 'quiz-result-fill-text';
      text.textContent = segments[index];
      sentence.append(text);
    }

    if (index < segments.length - 1) {
      sentence.append(
        createFillBlankInlineNode(
          (values[index] || '').trim() || '_____',
          blankReviews[index],
        ),
      );
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';
  wrap.append(createResponseLabel('Tu respuesta'));
  wrap.append(sentence);
  return wrap;
}

function createQuizResultMultipleChoice(item) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';
  wrap.append(createResponseLabel('Tu selección'));

  const options = document.createElement('div');
  options.className = 'quiz-result-option-list';
  const selectedOptions = new Set(Array.isArray(item.userResponse?.selectedOptions) ? item.userResponse.selectedOptions : []);
  const reviewedOptions = Array.isArray(item.inlineReview?.options) && item.inlineReview.options.length > 0
    ? item.inlineReview.options
    : (Array.isArray(item.options) ? item.options : []).map((optionText) => ({
        text: optionText,
        selectedByUser: selectedOptions.has(optionText),
        status: selectedOptions.has(optionText) ? 'neutral' : 'neutral',
      }));

  for (const optionReview of reviewedOptions) {
    const row = createMultipleChoiceReviewNode(optionReview);
    options.append(row);
  }

  wrap.append(options);
  return wrap;
}

function createQuizResultMatchingPairs(item) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';
  wrap.append(createResponseLabel('Tus parejas'));

  const pairs = document.createElement('div');
  pairs.className = 'quiz-result-pairs';
  const userPairs = Array.isArray(item.userResponse?.pairs) ? item.userResponse.pairs : [];
  const reviewedPairs = Array.isArray(item.inlineReview?.pairs) && item.inlineReview.pairs.length > 0
    ? item.inlineReview.pairs
    : userPairs.map((pair) => ({
        ...pair,
        status: 'correct',
      }));

  if (!reviewedPairs.length) {
    pairs.append(createMutedAnswer('No respondió.'));
  } else {
    for (const pair of reviewedPairs) {
      const row = createMatchingPairReviewNode(pair);
      pairs.append(row);
    }
  }

  wrap.append(pairs);
  return wrap;
}

function createQuizResultUnscramble(item) {
  const wrap = document.createElement('div');
  wrap.className = 'quiz-result-answer-stack';
  wrap.append(createResponseLabel('Tu oración'));

  const sentence = document.createElement('div');
  sentence.className = 'quiz-result-unscramble-sentence';
  const finalSentence = typeof item.userResponse?.sentence === 'string'
    ? item.userResponse.sentence.replace(/\s+/g, ' ').trim()
    : '';
  wrap.append(
    createQuizResultPartsReview(
      item.inlineReview?.parts,
      finalSentence || 'No respondió.',
    ),
  );
  return wrap;
}

function createResponseLabel(text) {
  const label = document.createElement('p');
  label.className = 'quiz-result-response-label';
  label.textContent = text;
  return label;
}

function createAnswerTextBlock(text) {
  const answer = document.createElement('div');
  answer.className = 'quiz-result-answer-text';
  answer.textContent = String(text || '').trim() || 'No respondió.';
  return answer;
}

function createMutedAnswer(text) {
  const answer = document.createElement('p');
  answer.className = 'quiz-result-empty-answer';
  answer.textContent = text;
  return answer;
}

function createQuizResultPartsReview(partsInput, fallbackText) {
  const parts = Array.isArray(partsInput)
    ? partsInput.filter(
        (part) =>
          part &&
          typeof part === 'object' &&
          typeof part.text === 'string' &&
          (part.status === 'correct' || part.status === 'improve' || part.status === 'error'),
      )
    : [];

  if (!parts.length) {
    return createAnswerTextBlock(fallbackText);
  }

  const paragraph = document.createElement('p');
  paragraph.className = 'sentence-parts quiz-result-parts';

  parts.forEach((part, index) => {
    paragraph.append(
      createInlineStatusNode(part.text, part.status, part.explanation),
    );
    if (index < parts.length - 1) {
      paragraph.append(document.createTextNode(' '));
    }
  });

  return paragraph;
}

function createFillBlankInlineNode(text, review) {
  const normalizedStatus =
    review?.status === 'error' || review?.status === 'improve' || review?.status === 'correct'
      ? review.status
      : 'correct';

  const node = createInlineStatusNode(text, normalizedStatus, review?.explanation, 'quiz-result-fill-value');
  return node;
}

function createMultipleChoiceReviewNode(optionReview) {
  const hasExplanation = typeof optionReview.explanation === 'string' && optionReview.explanation.trim();
  const interactive = optionReview.status === 'error' || optionReview.status === 'missed' || Boolean(hasExplanation);
  const row = interactive ? document.createElement('button') : document.createElement('div');
  row.className = `quiz-result-option is-${optionReview.status}`;

  if (row instanceof HTMLButtonElement) {
    row.type = 'button';
    attachPopoverMetadata(
      row,
      optionReview.status === 'missed' ? 'Puede mejorar' : 'Error',
      optionReview.explanation || (optionReview.status === 'missed'
        ? 'Faltó tener en cuenta esta opción.'
        : 'Esta opción necesita revisión.'),
      optionReview.status === 'missed' ? 'improve' : 'error',
    );
  }

  const icon = document.createElement('i');
  icon.className = `bi ${resolveMultipleChoiceIcon(optionReview)}`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = optionReview.text;

  row.append(icon, text);
  return row;
}

function createMatchingPairReviewNode(pairReview) {
  const interactive = pairReview.status === 'error' || (typeof pairReview.explanation === 'string' && pairReview.explanation.trim());
  const row = interactive ? document.createElement('button') : document.createElement('div');
  row.className = `quiz-result-pair-row is-${pairReview.status}`;

  if (row instanceof HTMLButtonElement) {
    row.type = 'button';
    attachPopoverMetadata(
      row,
      'Error',
      pairReview.explanation || 'Esta pareja necesita revisión.',
      'error',
    );
  }

  const left = document.createElement('span');
  left.className = 'quiz-result-pair-side';
  left.textContent = pairReview.left;

  const arrow = document.createElement('span');
  arrow.className = 'quiz-result-pair-arrow';
  arrow.textContent = '→';

  const right = document.createElement('span');
  right.className = 'quiz-result-pair-side';
  right.textContent = pairReview.right;

  row.append(left, arrow, right);
  return row;
}

function createInlineStatusNode(text, status, explanation, extraClassName = '') {
  const interactive = (status === 'error' || status === 'improve') && typeof explanation === 'string' && explanation.trim();
  const node = interactive ? document.createElement('button') : document.createElement('span');
  node.className = ['sentence-part', `is-${status}`, extraClassName].filter(Boolean).join(' ');
  node.textContent = text;

  if (node instanceof HTMLButtonElement) {
    node.type = 'button';
    attachPopoverMetadata(
      node,
      status === 'error' ? 'Error' : 'Puede mejorar',
      explanation,
      status,
    );
  }

  return node;
}

function attachPopoverMetadata(node, title, content, status) {
  node.dataset.bsToggle = 'popover';
  node.dataset.bsTrigger = 'manual';
  node.dataset.bsPlacement = 'top';
  node.dataset.bsContainer = 'body';
  node.dataset.bsCustomClass = `sentence-popover sentence-popover-${status === 'error' ? 'error' : 'improve'}`;
  node.dataset.bsTitle = title;
  node.dataset.bsContent = content;
  node.setAttribute('aria-label', `${node.textContent || ''}: ${content}`);
}

function resolveMultipleChoiceIcon(optionReview) {
  if (optionReview.status === 'correct' && optionReview.selectedByUser) {
    return 'bi-check-circle-fill';
  }

  if (optionReview.status === 'error') {
    return 'bi-x-circle-fill';
  }

  if (optionReview.status === 'missed') {
    return 'bi-exclamation-circle-fill';
  }

  if (optionReview.selectedByUser) {
    return 'bi-dot';
  }

  return 'bi-circle';
}

function initializeInlinePopovers(root) {
  if (!window.bootstrap?.Popover || !(root instanceof Element)) {
    return;
  }

  const hideAllPopovers = (except = null) => {
    for (const node of document.querySelectorAll('[data-bs-toggle="popover"]')) {
      if (node === except) {
        continue;
      }

      window.bootstrap.Popover.getOrCreateInstance(node).hide();
    }
  };

  if (!document.body.dataset.quizResultPopoverDismissBound) {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const trigger = target instanceof Element
        ? target.closest('[data-bs-toggle="popover"]')
        : null;
      const insidePopover = target instanceof Element
        ? target.closest('.popover')
        : null;

      if (trigger || insidePopover) {
        return;
      }

      hideAllPopovers();
    });
    document.body.dataset.quizResultPopoverDismissBound = 'true';
  }

  for (const node of root.querySelectorAll('[data-bs-toggle="popover"]')) {
    const popover = window.bootstrap.Popover.getOrCreateInstance(node);
    if (node.dataset.quizResultPopoverBound === 'true') {
      continue;
    }

    node.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = Boolean(node.getAttribute('aria-describedby'));
      hideAllPopovers(isOpen ? null : node);
      if (isOpen) {
        popover.hide();
        return;
      }

      popover.show();
    });

    node.dataset.quizResultPopoverBound = 'true';
  }
}

function cleanupInlinePopovers(root) {
  if (!(root instanceof Element) || !window.bootstrap?.Popover) {
    return;
  }

  for (const node of root.querySelectorAll('[data-bs-toggle="popover"]')) {
    const instance = window.bootstrap.Popover.getInstance(node);
    const describedBy = node.getAttribute('aria-describedby');

    if (instance) {
      instance.dispose();
    }

    if (describedBy) {
      document.getElementById(describedBy)?.remove();
      node.removeAttribute('aria-describedby');
    }
  }
}

function createEvaluationBadge(status) {
  const badge = document.createElement('span');
  badge.className = `quiz-result-status-badge is-${normalizeEvaluationStatus(status)}`;
  badge.textContent = getEvaluationStatusLabel(status);
  return badge;
}

function createFeedbackCard(evaluation) {
  const section = document.createElement('section');
  section.className = `quiz-result-feedback is-${normalizeEvaluationStatus(evaluation?.status)}`;

  const title = document.createElement('p');
  title.className = 'quiz-result-feedback-title';
  title.textContent = 'Valoración de Mr. F';

  const body = document.createElement('p');
  body.className = 'quiz-result-feedback-body';
  body.textContent =
    typeof evaluation?.feedback === 'string' && evaluation.feedback.trim()
      ? evaluation.feedback.trim()
      : 'Sigamos practicando esta idea en el siguiente paso.';

  section.append(title, body);
  return section;
}

function normalizeEvaluationStatus(status) {
  if (status === 'correct' || status === 'incorrect' || status === 'partial') {
    return status;
  }

  return 'partial';
}

function getEvaluationStatusLabel(status) {
  switch (normalizeEvaluationStatus(status)) {
    case 'correct':
      return 'Certera';
    case 'incorrect':
      return 'No certera';
    default:
      return 'Parcial';
  }
}
