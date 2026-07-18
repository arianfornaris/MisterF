import { t } from '../shared/i18n.js';
import { createQuizResultCard } from '../chat/cards/createQuizResultCard.js';
import { renderMarkdown } from '../chat/utils/formatting.js';
import { initializeCreateResourceFromContext } from '../shared/createResourceFromContext.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
import { initializeStaticMarkdown } from '../shared/staticMarkdown.js';
import {
  initializeModificationModal,
  renderStringFieldChanges,
} from '../shared/modificationModal.js';
import {
  buildInitialQuizItemState,
  buildQuizResponsePayload,
  isQuizItemAnswered,
  renderQuizItemBody,
} from '../shared/quizItemRenderer.js';

function fallbackCopyText(content) {
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyTextToClipboard(content) {
  if (!content) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    return fallbackCopyText(content);
  }

  return fallbackCopyText(content);
}

function initializeQuizSharingUi() {
  const shareFieldEl = document.querySelector('[data-quiz-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-quiz-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-quiz-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-quiz-share-modal]');

  if (copyButtonEl && shareFieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(shareFieldEl.value);
      copyButtonEl.textContent = copied ? t('clientMisc.copied') : t('clientMisc.copyFailed');
      window.setTimeout(() => {
        copyButtonEl.innerHTML = `<i class="bi bi-copy me-1" aria-hidden="true"></i>${t('clientMisc.copy')}`;
      }, 1200);
    });
  }

  if (nativeShareButtonEl) {
    if (typeof navigator.share !== 'function') {
      nativeShareButtonEl.classList.add('d-none');
    } else if (shareFieldEl instanceof HTMLInputElement) {
      nativeShareButtonEl.addEventListener('click', async () => {
        if (!shareFieldEl.value) {
          return;
        }

        try {
          await navigator.share({
            title: 'Quiz compartido',
            url: shareFieldEl.value,
          });
        } catch {
          // Ignore cancelled share attempts.
        }
      });
    }
  }

  if (autoOpenModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(autoOpenModalEl).show();
  }
}

function initializeQuizPendingUi() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('[data-quiz-generate-form], [data-quiz-submit-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector(
      '[data-quiz-generate-submit], [data-quiz-submit-button]',
    );
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-quiz-pending-modal]');

    formEl.addEventListener('submit', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
      }

      if (parentModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(parentModalEl).hide();
      }

      if (pendingModalEl) {
        window.setTimeout(() => {
          window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
        }, 120);
      }
    });
  }
}

/**
 * "Agregar bloque" is a shortcut into the AI chat: compose the message from
 * the selected block kind plus the teacher's prompt, stage it, and jump to
 * the chat tab where it is sent through the normal conversational flow. If
 * anything is missing the form falls back to its regular POST.
 */
function initializeQuizAddBlock() {
  const modalEl = document.querySelector('[data-quiz-add-block-modal]');
  const openButtonEl = document.querySelector('[data-quiz-add-block-open]');
  if (!(modalEl instanceof HTMLElement) || !(openButtonEl instanceof HTMLElement)) {
    return;
  }

  const kindSelectEl = modalEl.querySelector('[data-quiz-add-block-kind]');
  const levelInputEl = modalEl.querySelector('[data-quiz-add-block-level]');
  const sectionSelectEl = modalEl.querySelector('[data-quiz-add-block-section]');
  const positionSelectEl = modalEl.querySelector('[data-quiz-add-block-position]');
  const kindLabels = {};
  if (kindSelectEl instanceof HTMLSelectElement) {
    for (const option of kindSelectEl.options) {
      kindLabels[option.value] = option.textContent || option.value;
    }
  }
  const labels = {
    current: modalEl.dataset.currentLabel || '',
    kinds: kindLabels,
    proposed: modalEl.dataset.proposedLabel || '',
  };

  initializeModificationModal({
    modalEl,
    resolveContext: () => ({
      applyEndpoint: modalEl.dataset.modifyApplyEndpoint || '',
      buildCurrentDraft: () => ({}),
      currentField: 'unused',
      discardEndpoint: modalEl.dataset.modifyDiscardEndpoint || '',
      extraFields: () => ({
        kind: kindSelectEl instanceof HTMLSelectElement ? kindSelectEl.value : '',
        level: levelInputEl instanceof HTMLInputElement ? levelInputEl.value : '',
        position:
          positionSelectEl instanceof HTMLSelectElement ? positionSelectEl.value : 'end',
        sectionId:
          sectionSelectEl instanceof HTMLSelectElement ? sectionSelectEl.value : '',
      }),
      previewEndpoint: modalEl.dataset.modifyEndpoint || '',
      renderChanges: (container, proposedItem) => {
        container.replaceChildren();
        if (!proposedItem || typeof proposedItem !== 'object') {
          return false;
        }
        const heading = document.createElement('p');
        heading.className = 'small fw-semibold text-primary mb-1';
        heading.textContent = labels.proposed;
        const card = renderQuizBlockPreviewCard(proposedItem, labels.kinds);
        card.classList.add('border-primary');
        container.append(heading, card);
        return true;
      },
    }),
    triggers: openButtonEl,
  });
}

function getQuizMetadataControl(formEl, name) {
  const control = formEl.elements.namedItem(name);
  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
    ? control
    : null;
}

function buildCurrentQuizMetadata(formEl) {
  const fields = {
    description: 'description',
    evaluationInstructions: 'evaluationInstructions',
    instructions: 'instructions',
    level: 'level',
    targetTopic: 'targetTopic',
    title: 'title',
  };
  const metadata = {};
  for (const [key, name] of Object.entries(fields)) {
    const control = getQuizMetadataControl(formEl, name);
    if (!control) {
      return null;
    }

    metadata[key] = control.value;
  }

  if (!metadata.title.trim()) {
    return null;
  }

  return metadata;
}

function initializeQuizMetadataModification() {
  const modalEl = document.querySelector('[data-quiz-modify-modal]');
  const openButtonEl = document.querySelector('[data-quiz-modify-open]');
  const formEl = document.querySelector('[data-quiz-general-form]');
  if (!(modalEl instanceof HTMLElement)) {
    return;
  }

  const labels = {
    current: modalEl.dataset.currentLabel || '',
    fields: {
      description: modalEl.dataset.fieldDescription,
      evaluationInstructions: modalEl.dataset.fieldEvaluationInstructions,
      instructions: modalEl.dataset.fieldInstructions,
      level: modalEl.dataset.fieldLevel,
      targetTopic: modalEl.dataset.fieldTargetTopic,
      title: modalEl.dataset.fieldTitle,
    },
    proposed: modalEl.dataset.proposedLabel || '',
  };

  if (!(formEl instanceof HTMLFormElement) || !(openButtonEl instanceof HTMLElement)) {
    return;
  }

  initializeModificationModal({
    buildCurrentDraft: () => buildCurrentQuizMetadata(formEl),
    modalEl,
    renderChanges: (container, changes) =>
      renderStringFieldChanges(container, changes, labels),
    triggers: openButtonEl,
  });
}

function describeQuizItemAnswerKey(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  if (item.kind === 'quiz_multiple_choice' && Array.isArray(item.correctOptions)) {
    return item.correctOptions.join(' | ');
  }
  if (
    (item.kind === 'quiz_fill_in_the_blank_input'
      || item.kind === 'quiz_fill_in_the_blank_choice')
    && Array.isArray(item.blanks)
  ) {
    return item.blanks
      .map((blank, index) =>
        `#${index + 1}: ${(blank?.acceptableAnswers || []).join(' | ')}`)
      .join('   ');
  }
  if (item.kind === 'quiz_matching_pairs' && Array.isArray(item.correctPairs)) {
    return item.correctPairs.map((pair) => `${pair?.left} → ${pair?.right}`).join('   ');
  }
  if (item.kind === 'quiz_order_sentences' && Array.isArray(item.sentences)) {
    return item.sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('  ');
  }
  if (
    (item.kind === 'quiz_unscramble_sentence'
      || item.kind === 'quiz_translate_to_english'
      || item.kind === 'quiz_understand_in_spanish'
      || item.kind === 'quiz_open_text')
    && Array.isArray(item.acceptableAnswers)
  ) {
    return item.acceptableAnswers.join(' | ');
  }

  return '';
}

function collectQuizKindLabels() {
  const select = document.querySelector(
    '[data-quiz-add-block-kind], [data-quiz-block-modify-kind]',
  );
  const labels = {};
  if (select instanceof HTMLSelectElement) {
    for (const option of select.options) {
      labels[option.value] = option.textContent || option.value;
    }
  }
  return labels;
}

function renderQuizBlockPreviewCard(item, kindLabels) {
  const card = document.createElement('div');
  card.className = 'border rounded p-3 flex-grow-1';

  const kindBadge = document.createElement('span');
  kindBadge.className = 'badge text-bg-secondary mb-2';
  kindBadge.textContent = kindLabels[item?.kind] || item?.kind || '';
  card.append(kindBadge);

  const prompt = document.createElement('p');
  prompt.className = 'fw-semibold mb-2';
  prompt.textContent = typeof item?.prompt === 'string' ? item.prompt : '';
  card.append(prompt);

  const body = document.createElement('div');
  body.className = 'quiz-block-preview-body';
  try {
    const itemState = buildInitialQuizItemState(item, 0, 'quiz-block-preview', null);
    renderQuizItemBody(body, item, itemState, {}, { readOnly: true });
  } catch {
    body.textContent = '';
  }
  card.append(body);

  const answerKey = describeQuizItemAnswerKey(item);
  if (answerKey) {
    const key = document.createElement('p');
    key.className = 'small text-body-secondary mt-2 mb-0';
    key.style.whiteSpace = 'pre-wrap';
    key.textContent = answerKey;
    card.append(key);
  }

  return card;
}

function renderQuizBlockComparison(container, currentItem, proposedItem, labels) {
  container.replaceChildren();
  if (!proposedItem || typeof proposedItem !== 'object') {
    return false;
  }

  const row = document.createElement('div');
  row.className = 'row g-3';
  for (const [version, item] of [['before', currentItem], ['after', proposedItem]]) {
    const column = document.createElement('div');
    column.className = 'col-12 col-md-6 d-flex flex-column';
    const heading = document.createElement('p');
    heading.className = version === 'before'
      ? 'small text-body-secondary mb-1'
      : 'small fw-semibold text-primary mb-1';
    heading.textContent = version === 'before' ? labels.current : labels.proposed;
    const card = renderQuizBlockPreviewCard(item, labels.kinds);
    if (version === 'after') {
      card.classList.add('border-primary');
    }
    column.append(heading, card);
    row.append(column);
  }

  container.append(row);
  return true;
}

function renderQuizBlocksDiff(container, diff, labels) {
  container.replaceChildren();
  if (!diff || typeof diff !== 'object' || !Array.isArray(diff.blocks)) {
    return false;
  }

  const summary = diff.summary || {};
  const summaryParts = [
    [summary.added, labels.status.added],
    [summary.changed, labels.status.changed],
    [summary.moved, labels.status.moved],
    [summary.removed, labels.status.removed],
  ].filter(([count]) => Number(count) > 0);
  if (summaryParts.length > 0) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'fw-semibold mb-3';
    summaryEl.textContent = summaryParts
      .map(([count, label]) => `${label}: ${count}`)
      .join(' · ');
    container.append(summaryEl);
  }

  const sectionsChanged =
    (diff.sections?.added?.length || 0)
    + (diff.sections?.changed?.length || 0)
    + (diff.sections?.removed?.length || 0);
  if (sectionsChanged > 0) {
    const sectionsEl = document.createElement('p');
    sectionsEl.className = 'small text-body-secondary mb-3';
    sectionsEl.textContent = labels.sectionsChanged;
    container.append(sectionsEl);
  }

  const badgeClass = {
    added: 'text-bg-success',
    changed: 'text-bg-primary',
    moved: 'text-bg-info',
    unchanged: 'text-bg-light border',
  };

  const appendBlock = (block, status, muted) => {
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const badge = document.createElement('span');
    badge.className = `badge ${muted ? 'text-bg-secondary' : badgeClass[status] || 'text-bg-light border'} mb-1`;
    badge.textContent = labels.status[status] || status;
    const card = renderQuizBlockPreviewCard(block.item, labels.kinds);
    if (muted) {
      card.classList.add('opacity-50');
    } else if (status !== 'unchanged') {
      card.classList.add('border-primary');
    }
    wrap.append(badge, card);
    container.append(wrap);
  };

  for (const block of diff.blocks) {
    appendBlock(block, block.status, false);
  }
  for (const block of diff.removed || []) {
    appendBlock(block, 'removed', true);
  }

  return true;
}

function initializeQuizBlocksModification() {
  const modalEl = document.querySelector('[data-quiz-blocks-modify-modal]');
  const openButtonEl = document.querySelector('[data-quiz-blocks-modify-open]');
  if (!(modalEl instanceof HTMLElement) || !(openButtonEl instanceof HTMLElement)) {
    return;
  }

  const labels = {
    kinds: collectQuizKindLabels(),
    sectionsChanged: modalEl.dataset.sectionsChangedLabel || '',
    status: {
      added: modalEl.dataset.statusAdded || '',
      changed: modalEl.dataset.statusChanged || '',
      moved: modalEl.dataset.statusMoved || '',
      removed: modalEl.dataset.statusRemoved || '',
      unchanged: modalEl.dataset.statusUnchanged || '',
    },
  };

  initializeModificationModal({
    modalEl,
    resolveContext: () => ({
      applyEndpoint: modalEl.dataset.modifyApplyEndpoint || '',
      buildCurrentDraft: () => ({}),
      currentField: 'unused',
      discardEndpoint: modalEl.dataset.modifyDiscardEndpoint || '',
      previewEndpoint: modalEl.dataset.modifyEndpoint || '',
      renderChanges: (container, diff) => renderQuizBlocksDiff(container, diff, labels),
    }),
    triggers: openButtonEl,
  });
}

function initializeQuizBlockModification() {
  const modalEl = document.querySelector('[data-quiz-block-modify-modal]');
  const triggers = document.querySelectorAll('[data-quiz-block-modify]');
  if (!(modalEl instanceof HTMLElement) || triggers.length === 0) {
    return;
  }

  const kindSelectEl = modalEl.querySelector('[data-quiz-block-modify-kind]');
  const levelInputEl = modalEl.querySelector('[data-quiz-block-modify-level]');
  const kindLabels = {};
  if (kindSelectEl instanceof HTMLSelectElement) {
    for (const option of kindSelectEl.options) {
      kindLabels[option.value] = option.textContent || option.value;
    }
  }
  const labels = {
    current: modalEl.dataset.currentLabel || '',
    kinds: kindLabels,
    proposed: modalEl.dataset.proposedLabel || '',
  };

  initializeModificationModal({
    modalEl,
    resolveContext: (trigger) => {
      const blockId = trigger.dataset.blockId || '';
      const baseEndpoint = trigger.dataset.modifyEndpoint || '';
      const itemScriptEl = document.querySelector(
        `[data-quiz-block-item="${window.CSS?.escape ? CSS.escape(blockId) : blockId}"]`,
      );
      let currentItem = null;
      try {
        currentItem = itemScriptEl ? JSON.parse(itemScriptEl.textContent || 'null') : null;
      } catch {
        currentItem = null;
      }
      if (!blockId || !baseEndpoint || !currentItem) {
        return null;
      }

      return {
        applyEndpoint: `${baseEndpoint}/apply`,
        buildCurrentDraft: () => currentItem,
        currentField: 'currentItem',
        discardEndpoint: `${baseEndpoint}/discard`,
        extraFields: () => ({
          kind: kindSelectEl instanceof HTMLSelectElement ? kindSelectEl.value : currentItem.kind,
          level: levelInputEl instanceof HTMLInputElement ? levelInputEl.value : '',
        }),
        onOpen: () => {
          if (kindSelectEl instanceof HTMLSelectElement) {
            kindSelectEl.value = trigger.dataset.currentKind || currentItem.kind || '';
          }
          if (levelInputEl instanceof HTMLInputElement) {
            levelInputEl.value = trigger.dataset.level || '';
          }
        },
        previewEndpoint: baseEndpoint,
        renderChanges: (container, changes) =>
          renderQuizBlockComparison(container, currentItem, changes, labels),
      };
    },
    triggers,
  });
}

function initializeQuizQuizUi() {
  const hostEl = document.querySelector('[data-quiz-quiz-host]');
  const block = readJsonScript('[data-quiz-quiz-json]');
  if (!(hostEl instanceof HTMLElement) || !isQuizBlock(block)) {
    return;
  }

  const mode = hostEl.dataset.quizQuizMode === 'attempt' ? 'attempt' : 'preview';
  const formEl = mode === 'attempt'
    ? hostEl.closest('[data-quiz-quiz-form]')
    : null;
  const inputHostEl = formEl?.querySelector('[data-quiz-quiz-inputs]');
  const submitButtonEl = formEl?.querySelector('[data-quiz-submit-button]');
  const card = createQuizQuizCard(block, {
    formEl: formEl instanceof HTMLFormElement ? formEl : null,
    inputHostEl: inputHostEl instanceof HTMLElement ? inputHostEl : null,
    mode,
    submitButtonEl: submitButtonEl instanceof HTMLButtonElement ? submitButtonEl : null,
  });

  if (!card) {
    return;
  }

  hostEl.replaceChildren(card);
  hideFallback(document.querySelector('[data-quiz-quiz-fallback]'));
}

function initializeQuizResultUi() {
  const hostEl = document.querySelector('[data-quiz-result-host]');
  const block = readJsonScript('[data-quiz-result-json]');
  if (!(hostEl instanceof HTMLElement) || !block) {
    return;
  }

  const card = createQuizResultCard(block);
  if (!card) {
    return;
  }

  hostEl.replaceChildren(card);
  hideFallback(document.querySelector('[data-quiz-result-fallback]'));
}

function createQuizQuizCard(block, options) {
  const items = block.items.filter(
    (item) => item && typeof item === 'object' && typeof item.kind === 'string',
  );
  if (!items.length) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'quiz-card quiz-quiz-card';

  const exerciseKey = `quiz:${block.title || 'quiz'}:${items.length}`;
  const state = {
    block: {
      ...block,
      items,
    },
    currentIndex: 0,
    itemStates: items.map((item, itemIndex) =>
      buildInitialQuizItemState(item, itemIndex, exerciseKey, null),
    ),
    readOnly: options.mode !== 'attempt',
    submitted: false,
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
  header.append(headerText);

  const itemCounter = document.createElement('p');
  itemCounter.className = 'quiz-item-counter';

  const itemSection = document.createElement('div');
  itemSection.className = 'quiz-section-context';
  itemSection.hidden = true;

  const itemPrompt = document.createElement('div');
  itemPrompt.className = 'quiz-item-prompt';

  const itemBody = document.createElement('div');
  itemBody.className = 'quiz-item-body';

  const nav = document.createElement('div');
  nav.className = 'quiz-nav';

  const previousButton = document.createElement('button');
  previousButton.className = 'btn btn-primary btn-sm quiz-nav-button';
  previousButton.type = 'button';
  previousButton.textContent = t('card.quizBack');
  previousButton.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderQuizQuizCard(section, state, options);
    }
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'btn btn-primary btn-sm quiz-nav-button';
  nextButton.type = 'button';
  nextButton.textContent = t('clientMisc.next');
  nextButton.addEventListener('click', () => {
    if (state.currentIndex < state.itemStates.length - 1) {
      state.currentIndex += 1;
      renderQuizQuizCard(section, state, options);
    }
  });

  nav.append(previousButton, nextButton);

  const footer = document.createElement('div');
  footer.className = 'quiz-footer';
  footer.hidden = options.mode !== 'attempt';

  const status = document.createElement('p');
  status.className = 'quiz-status';
  footer.append(status);

  section.append(header, itemSection, itemCounter, itemPrompt, itemBody, nav, footer);

  if (options.formEl) {
    options.formEl.addEventListener('submit', (event) => {
      syncQuizQuizStatus(section, state, options);
      if (!isQuizQuizReady(state)) {
        event.preventDefault();
        status.scrollIntoView({ block: 'nearest' });
        return;
      }

      state.submitted = true;
      syncQuizQuizStatus(section, state, options);
    });
  }

  renderQuizQuizCard(section, state, options);
  return section;
}

function renderQuizQuizCard(section, state, options) {
  const itemCounter = section.querySelector('.quiz-item-counter');
  const itemSection = section.querySelector('.quiz-section-context');
  const itemPrompt = section.querySelector('.quiz-item-prompt');
  const itemBody = section.querySelector('.quiz-item-body');
  const previousButton = section.querySelector('.quiz-nav-button:first-child');
  const nextButton = section.querySelector('.quiz-nav-button:last-child');

  if (
    !(itemCounter instanceof HTMLParagraphElement) ||
    !(itemSection instanceof HTMLDivElement) ||
    !(itemPrompt instanceof HTMLDivElement) ||
    !(itemBody instanceof HTMLDivElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const item = state.block.items[state.currentIndex];
  const itemState = state.itemStates[state.currentIndex];
  itemCounter.textContent = t('clientMisc.questionOf', { current: state.currentIndex + 1, total: state.itemStates.length });
  renderQuizSectionContext(itemSection, item.section);
  itemPrompt.innerHTML = renderMarkdown(item.prompt || '');

  itemBody.replaceChildren();
  renderQuizItemBody(itemBody, item, itemState, state, {
    onChange: () => syncQuizQuizStatus(section, state, options),
    readOnly: state.readOnly,
    rerender: () => renderQuizQuizCard(section, state, options),
  });

  previousButton.disabled = state.currentIndex === 0;
  nextButton.disabled = state.currentIndex >= state.itemStates.length - 1;
  syncQuizQuizStatus(section, state, options);
}

function renderQuizSectionContext(container, section) {
  container.replaceChildren();
  const instructions = typeof section?.instructions === 'string' ? section.instructions : '';
  if (!instructions) {
    container.hidden = true;
    return;
  }

  const title = document.createElement('p');
  title.className = 'quiz-section-context-title';
  title.textContent = typeof section.title === 'string' && section.title ? section.title : t('card.section');

  const body = document.createElement('div');
  body.className = 'quiz-section-context-instructions';
  body.innerHTML = renderMarkdown(instructions);

  container.append(title, body);
  container.hidden = false;
}

function syncQuizQuizStatus(section, state, options) {
  syncQuizHiddenInputs(options.inputHostEl, state);

  if (options.mode !== 'attempt') {
    return;
  }

  const ready = isQuizQuizReady(state);
  if (options.submitButtonEl) {
    options.submitButtonEl.disabled = state.submitted || !ready;
  }

  const status = section.querySelector('.quiz-status');
  if (!(status instanceof HTMLParagraphElement)) {
    return;
  }

  status.classList.remove('is-success', 'is-error');
  if (state.submitted) {
    setStatusText(status, t('card.quizSubmitted'), {
      pending: true,
    });
    status.classList.add('is-success');
  } else if (ready) {
    setStatusText(status, t('clientMisc.quizReadySend'));
  } else {
    setStatusText(status, t('clientMisc.answerAllBeforeSend'));
  }
}

function setStatusText(status, text, options = {}) {
  status.replaceChildren();

  if (options.pending) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm quiz-status-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.append(spinner);
  }

  status.append(document.createTextNode(text));
}

function isQuizQuizReady(state) {
  return state.itemStates.every((itemState, index) =>
    isQuizItemAnswered(state.block.items[index], itemState),
  );
}

function syncQuizHiddenInputs(inputHostEl, state) {
  if (!(inputHostEl instanceof HTMLElement)) {
    return;
  }

  inputHostEl.replaceChildren();
  state.itemStates.forEach((itemState, index) => {
    const item = state.block.items[index];
    const payload = buildQuizResponsePayload(item, itemState);
    const fieldPrefix = `response_${index}`;

    if (
      item.kind === 'quiz_open_text' ||
      item.kind === 'quiz_translate_to_english' ||
      item.kind === 'quiz_understand_in_spanish'
    ) {
      appendHiddenInput(inputHostEl, `${fieldPrefix}_text`, payload.text || '');
      return;
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      const values = Array.isArray(payload.values) ? payload.values : [];
      const blanks = Array.isArray(item.blanks) ? item.blanks : [];
      blanks.forEach((_blank, blankIndex) => {
        appendHiddenInput(
          inputHostEl,
          `${fieldPrefix}_blank_${blankIndex}`,
          values[blankIndex] || '',
        );
      });
      return;
    }

    if (item.kind === 'quiz_multiple_choice') {
      const selectedOptions = Array.isArray(payload.selectedOptions)
        ? payload.selectedOptions
        : [];
      selectedOptions.forEach((option) => {
        appendHiddenInput(inputHostEl, `${fieldPrefix}_selectedOptions`, option);
      });
      return;
    }

    if (item.kind === 'quiz_matching_pairs') {
      const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
      const leftItems = Array.isArray(item.leftItems) ? item.leftItems : [];
      leftItems.forEach((left, pairIndex) => {
        const pair = pairs.find((candidate) => candidate.left === left);
        appendHiddenInput(inputHostEl, `${fieldPrefix}_pair_${pairIndex}`, pair?.right || '');
      });
      return;
    }

    if (item.kind === 'quiz_order_sentences') {
      const orderedSentences = Array.isArray(payload.orderedSentences)
        ? payload.orderedSentences
        : [];
      orderedSentences.forEach((sentence, positionIndex) => {
        appendHiddenInput(inputHostEl, `${fieldPrefix}_order_${positionIndex}`, sentence);
      });
      return;
    }

    appendHiddenInput(inputHostEl, `${fieldPrefix}_sentence`, payload.sentence || '');
  });
}

function appendHiddenInput(parent, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = String(value || '');
  parent.append(input);
}

function hideFallback(fallbackEl) {
  if (!(fallbackEl instanceof HTMLElement)) {
    return;
  }

  fallbackEl.hidden = true;
  for (const control of fallbackEl.querySelectorAll('input, select, textarea, button')) {
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLButtonElement
    ) {
      control.disabled = true;
    }
  }
}

function readJsonScript(selector) {
  const scriptEl = document.querySelector(selector);
  if (!(scriptEl instanceof HTMLScriptElement)) {
    return null;
  }

  try {
    return JSON.parse(scriptEl.textContent || 'null');
  } catch {
    return null;
  }
}

function isQuizBlock(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.prompt === 'string' &&
    Array.isArray(value.items)
  );
}

initializeQuizQuizUi();
initializeQuizResultUi();
initializeQuizSharingUi();
initializeQuizPendingUi();
initializeQuizAddBlock();
initializeQuizMetadataModification();
initializeQuizBlockModification();
initializeQuizBlocksModification();
initializeCreateResourceFromContext();
initializeResourceMoveModal();
initializeStaticMarkdown();
