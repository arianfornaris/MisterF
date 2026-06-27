import { createFillInTheBlankCard } from '../cards/createFillInTheBlankCard.js';
import { createMatchingPairsCard } from '../cards/createMatchingPairsCard.js';
import { createMultipleChoiceCard } from '../cards/multipleChoiceCard.js';
import { createOpenTextPromptCard } from '../cards/createOpenTextPromptCard.js';
import { createQuizCard } from '../cards/createQuizCard.js';
import { createQuizResultCard } from '../cards/createQuizResultCard.js';
import { createSentenceEvaluationCard } from '../cards/createSentenceEvaluationCard.js';
import { createUnscrambleSentenceCard } from '../cards/unscrambleSentenceCard.js';
import { renderMarkdown } from '../utils/formatting.js';

export function createTutorMessageRenderer(deps) {
  function setModelBubbleContent(element, content, metadata, options = {}) {
    if (!element) {
      return;
    }

    element.dataset.rawContent = content;
    const blocks = Array.isArray(metadata?.blocks) ? metadata.blocks : [];
    if (!blocks.length) {
      renderModelMessageWithMetadata(element, content, metadata);
      return;
    }

    element.replaceChildren();
    const stack = document.createElement('div');
    stack.className = 'tutor-message-stack';

    let hasVisualContent = false;

    blocks.forEach((block, blockIndex) => {
      if (block.type === 'message') {
        const node = document.createElement('div');
        node.className = 'tutor-message-block';
        node.innerHTML = renderMarkdown(block.markdown || '');
        stack.append(node);
        hasVisualContent = true;
        return;
      }

      if (block.type === 'practice_module_link') {
        const actionLink = createPracticeModuleLinkAction(block);
        if (actionLink) {
          let actionRow = stack.querySelector('.tutor-message-actions');
          if (!actionRow) {
            actionRow = document.createElement('div');
            actionRow.className = 'tutor-message-actions';
            stack.append(actionRow);
          }

          actionRow.append(actionLink);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'dialogue_character_message') {
        const turn = document.createElement('div');
        turn.className = 'inline-character-turn';

        const speaker = document.createElement('div');
        speaker.className = 'inline-character-name';
        speaker.textContent = String(block.name || 'Character');

        const text = document.createElement('div');
        text.className = 'inline-character-text';
        text.innerHTML = renderMarkdown(block.markdown || '');

        turn.append(speaker, text);
        stack.append(turn);
        hasVisualContent = true;
        return;
      }

      if (block.type === 'dialogue_transcript') {
        const section = document.createElement('section');
        section.className = 'dialogue-transcript-card';

        const label = document.createElement('p');
        label.className = 'dialogue-transcript-label';
        label.textContent = 'Dialogo completo';

        const turns = document.createElement('div');
        turns.className = 'dialogue-transcript-turns';

        const items = Array.isArray(block.turns) ? block.turns : [];
        for (const item of items) {
          const turn = document.createElement('div');
          turn.className = 'dialogue-transcript-turn';

          const speaker = document.createElement('div');
          speaker.className = 'dialogue-transcript-speaker';
          speaker.textContent = String(item.speaker || 'Speaker')
            .replace(/\s+/g, ' ')
            .trim();

          const text = document.createElement('div');
          text.className = 'dialogue-transcript-text';
          text.innerHTML = renderMarkdown(item.markdown || '');

          turn.append(speaker, text);
          turns.append(turn);
        }

        section.append(label, turns);
        stack.append(section);
        hasVisualContent = true;
        return;
      }

      if (block.type === 'matching_pairs') {
        const card = createMatchingPairsCard(
          block,
          {
            blockIndex,
            matchingResult: getExerciseResultForBlock(
              metadata,
              'matchingExerciseResults',
              blockIndex,
            ),
            messageId: options.messageId,
          },
          {
            getConversationId: deps.getConversationId,
            getSelectedModelTier: deps.getSelectedModelTier,
            getSocket: deps.getSocket,
            matchingExerciseStates: deps.matchingExerciseStates,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (
        block.type === 'fill_in_the_blank_input' ||
        block.type === 'fill_in_the_blank_choice'
      ) {
        const card = createFillInTheBlankCard(
          block,
          {
            blockIndex,
            fillResult: getExerciseResultForBlock(
              metadata,
              'fillInTheBlankResults',
              blockIndex,
            ),
            messageId: options.messageId,
          },
          {
            getConversationId: deps.getConversationId,
            getSelectedModelTier: deps.getSelectedModelTier,
            getSocket: deps.getSocket,
            sendMessageContent: deps.sendMessageContent,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'open_text_prompt') {
        const card = createOpenTextPromptCard(
          block,
          {
            blockIndex,
            messageId: options.messageId,
          },
          {
            sendMessageContent: deps.sendMessageContent,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'multiple_choice') {
        const card = createMultipleChoiceCard(
          block,
          {
            blockIndex,
            messageId: options.messageId,
            result: getExerciseResultForBlock(
              metadata,
              'multipleChoiceResults',
              blockIndex,
            ),
          },
          {
            getConversationId: deps.getConversationId,
            getSelectedModelTier: deps.getSelectedModelTier,
            getSocket: deps.getSocket,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'unscramble_sentence') {
        const card = createUnscrambleSentenceCard(
          block,
          {
            blockIndex,
            messageId: options.messageId,
            result: getExerciseResultForBlock(
              metadata,
              'unscrambleSentenceResults',
              blockIndex,
            ),
          },
          {
            getConversationId: deps.getConversationId,
            getSelectedModelTier: deps.getSelectedModelTier,
            getSocket: deps.getSocket,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'quiz') {
        const card = createQuizCard(
          block,
          {
            blockIndex,
            messageId: options.messageId,
            result: getExerciseResultForBlock(metadata, 'quizResults', blockIndex),
          },
          {
            getConversationId: deps.getConversationId,
            getSelectedModelTier: deps.getSelectedModelTier,
            getSocket: deps.getSocket,
          },
        );
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'quiz_result') {
        const card = createQuizResultCard(block);
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (block.type === 'sentence_evaluation') {
        const card = createStandaloneSentenceEvaluationCard(block);
        if (card) {
          stack.append(card);
          hasVisualContent = true;
        }
        return;
      }

      if (
        block.type === 'translate_to_english_prompt' ||
        block.type === 'understand_in_spanish_prompt'
      ) {
        const card = document.createElement('section');
        card.className = `translation-prompt-card is-${block.type}`;

        const label = document.createElement('p');
        label.className = 'translation-prompt-label';
        label.textContent =
          block.type === 'translate_to_english_prompt'
            ? 'Traduce al ingles'
            : 'Explica en espanol';

        const sentence = document.createElement('blockquote');
        sentence.className = 'translation-prompt-sentence';
        sentence.textContent = String(block.sentence || '')
          .replace(/\s+/g, ' ')
          .trim();

        card.append(label, sentence);
        stack.append(card);
        hasVisualContent = true;
      }
    });

    if (!hasVisualContent) {
      renderModelMessageWithMetadata(element, content, metadata);
      return;
    }

    element.append(stack);
  }

  function appendStoredMessage(message) {
    if (isHiddenExerciseSubmissionMessage(message)) {
      return null;
    }

    return appendMessage(message.role, message.content, {
      id: message.id,
      metadata: message.metadata,
    });
  }

  function isHiddenExerciseSubmissionMessage(message) {
    return Boolean(
      message?.role === 'user' &&
      message.metadata &&
      typeof message.metadata === 'object' &&
      message.metadata.exerciseSubmission,
    );
  }

  function appendMessage(role, content, options = {}) {
    const row = document.createElement('div');
    row.className = `message-row is-${role}`;
    row.dataset.role = role;
    if (options.id) {
      row.dataset.messageId = String(options.id);
    }
    applyModelSpeakerMetadata(row, options.metadata);
    attachMessageMetadata(row, options.metadata);

    const bubble = document.createElement('div');
    bubble.className = getMessageBubbleClassName(role);
    if (role === 'model') {
      setModelBubbleContent(bubble, content, options.metadata, {
        messageId: options.id,
      });
      syncSpeakerLabel(bubble, options.metadata);
    } else {
      setMessageContent(bubble, content);
    }

    if (role === 'user') {
      appendUserMessageActions(bubble);
    }

    if (options.streaming) {
      bubble.classList.add('typing-caret');
    }

    row.append(bubble);
    deps.messagesEl.append(row);
    initializeSentencePopovers(row);
    return bubble;
  }

  function createStandaloneSentenceEvaluationCard(evaluation, element = null) {
    return createSentenceEvaluationCard({
      createMessageActionButton,
      createSentencePartsElement,
      element,
      evaluation,
      findFirstIncorrectEvaluationPart,
      getEvaluationSourceText,
      isValidSentenceEvaluation,
      putMessageBackInComposer,
    });
  }

  function attachMessageMetadata(row, metadata) {
    if (!row) {
      return;
    }

    applyModelSpeakerMetadata(row, metadata);
    const bubble = row.querySelector('.message-bubble');
    if (bubble && row.classList.contains('is-model')) {
      syncSpeakerLabel(bubble, metadata);
    }

    if (!metadata?.blocks) {
      delete row.dataset.messageBlocks;
      return;
    }

    row.dataset.messageBlocks = JSON.stringify(metadata.blocks);
  }

  function updateRenderedMessage(message) {
    const row = deps.messagesEl.querySelector(
      `[data-message-id="${CSS.escape(String(message.id))}"]`,
    );
    if (!row) {
      return;
    }

    attachMessageMetadata(row, message.metadata);
    if (message.role !== 'model') {
      return;
    }

    const bubble = row.querySelector('.message-bubble');
    if (!bubble) {
      return;
    }

    setModelBubbleContent(bubble, message.content, message.metadata, {
      messageId: message.id,
    });
    syncSpeakerLabel(bubble, message.metadata);
  }

  function initializeSentencePopovers(root = document) {
    if (!window.bootstrap?.Popover) {
      return;
    }

    const hideAllSentencePopovers = (except = null) => {
      for (const node of document.querySelectorAll('[data-bs-toggle="popover"]')) {
        if (node === except) {
          continue;
        }

        window.bootstrap.Popover.getOrCreateInstance(node).hide();
      }
    };

    if (!document.body.dataset.sentencePopoverDismissBound) {
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

        hideAllSentencePopovers();
      });

      document.body.dataset.sentencePopoverDismissBound = 'true';
    }

    for (const trigger of root.querySelectorAll('[data-bs-toggle="popover"]')) {
      const popover = window.bootstrap.Popover.getOrCreateInstance(trigger);

      if (trigger.dataset.sentencePopoverBound === 'true') {
        continue;
      }

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isOpen = trigger.getAttribute('aria-describedby');
        hideAllSentencePopovers(isOpen ? null : trigger);

        if (isOpen) {
          popover.hide();
          return;
        }

        popover.show();
      });

      trigger.dataset.sentencePopoverBound = 'true';
    }
  }

  function appendEphemeralError(content) {
    const existing = deps.messagesEl.querySelector('[data-ephemeral="connection"]');
    if (existing) {
      existing.remove();
    }

    const bubble = appendMessage('error', content);
    bubble.closest('.message-row')?.setAttribute('data-ephemeral', 'connection');
    deps.scrollToBottom();
  }

  function setMessageContent(element, content) {
    element.dataset.rawContent = content;
    element.innerHTML = renderMarkdown(content);

    for (const link of element.querySelectorAll('a')) {
      const url = new URL(link.getAttribute('href') || '', window.location.href);
      if (url.origin !== window.location.origin) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    }
  }

  function renderModelMessageWithMetadata(element, content) {
    element.replaceChildren();

    const body = document.createElement('div');
    setMessageContent(body, content);
    element.append(body);
  }

  function markTutorMessageArrived(row) {
    if (!row || !row.classList.contains('is-model')) {
      return;
    }

    row.classList.remove('tutor-message-enter');
    void row.offsetWidth;
    row.classList.add('tutor-message-enter');

    window.setTimeout(() => {
      row.classList.remove('tutor-message-enter');
    }, 1200);
  }

  function getMessageBubbleClassName(role) {
    if (role === 'user') {
      return 'message-bubble user-message-card';
    }

    if (role === 'error') {
      return 'message-bubble alert alert-warning error-message-alert';
    }

    return 'message-bubble';
  }

  function applyModelSpeakerMetadata(row) {
    if (!row || !row.classList.contains('is-model')) {
      return;
    }
  }

  function syncSpeakerLabel(bubble, metadata) {
    if (!bubble) {
      return;
    }

    bubble.querySelector('.message-speaker-label')?.remove();
    const speakerLabel = metadata?.speakerLabel || '';
    if (!speakerLabel) {
      return;
    }

    const label = document.createElement('div');
    label.className = 'message-speaker-label small text-body-secondary';
    label.textContent = speakerLabel;
    bubble.prepend(label);
  }

  function createSentencePartsElement(partsInput, extraClassName = '') {
    const parts = document.createElement('p');
    parts.className = ['sentence-parts', extraClassName].filter(Boolean).join(' ');
    const items = Array.isArray(partsInput) ? partsInput : [];

    for (const [index, part] of items.entries()) {
      const normalizedStatus = normalizePartStatus(part.status);
      const node =
        normalizedStatus === 'correct'
          ? document.createElement('span')
          : document.createElement('button');

      node.className = `sentence-part is-${normalizedStatus}`;
      node.textContent = part.text;

      if (node instanceof HTMLButtonElement) {
        node.type = 'button';
        node.dataset.bsToggle = 'popover';
        node.dataset.bsTrigger = 'manual';
        node.dataset.bsPlacement = 'top';
        node.dataset.bsContainer = 'body';
        node.dataset.bsCustomClass = `sentence-popover sentence-popover-${normalizedStatus}`;
        node.dataset.bsTitle =
          normalizedStatus === 'error' ? 'Error' : 'Puede mejorar';
        node.dataset.bsContent =
          part.explanation || 'Esta parte necesita un ajuste.';
        node.setAttribute(
          'aria-label',
          `${part.text}: ${part.explanation || 'Esta parte necesita un ajuste.'}`,
        );
      }

      parts.append(node);
      if (index < items.length - 1) {
        parts.append(document.createTextNode(' '));
      }
    }

    return parts;
  }

  function isValidSentenceEvaluation(evaluation) {
    return (
      evaluation &&
      typeof evaluation === 'object' &&
      Array.isArray(evaluation.parts) &&
      evaluation.parts.length > 0
    );
  }

  function normalizePartStatus(status) {
    if (status === 'error' || status === 'red') {
      return 'error';
    }

    if (status === 'improve' || status === 'yellow') {
      return 'improve';
    }

    return 'correct';
  }

  function appendUserMessageActions(element) {
    const actions = document.createElement('span');
    actions.className = 'message-actions';

    const editButton = createMessageActionButton({
      label: 'Editar texto',
      iconClass: 'bi-pencil',
    });
    editButton.addEventListener('click', () => {
      deps.putMessageBackInComposer(element.dataset.rawContent || '');
    });

    const copyButton = createMessageActionButton({
      label: 'Copiar texto',
      iconClass: 'bi-copy',
    });
    copyButton.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(element.dataset.rawContent || '');
      copyButton.classList.toggle('is-copied', copied);
      copyButton.title = copied ? 'Copiado' : 'No se pudo copiar';

      setTimeout(() => {
        copyButton.classList.remove('is-copied');
        copyButton.title = 'Copiar texto';
      }, 1200);
    });

    actions.append(editButton, copyButton);
    getMessageActionHost(element).append(actions);
  }

  function getMessageActionHost(element) {
    return (
      element.querySelector(
        ':scope > p:last-child, :scope > ul:last-child li:last-child, :scope > ol:last-child li:last-child, :scope > blockquote:last-child',
      ) || element
    );
  }

  function createMessageActionButton({ label, iconClass }) {
    const button = document.createElement('button');
    button.className = 'btn btn-link btn-sm text-secondary message-action-button';
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i>`;
    return button;
  }

  function putMessageBackInComposer(content, options = {}) {
    deps.putMessageBackInComposer(content, options);
  }

  function getEvaluationSourceText(evaluation) {
    if (typeof evaluation?.sourceText === 'string' && evaluation.sourceText.trim()) {
      return evaluation.sourceText.trim();
    }

    if (!isValidSentenceEvaluation(evaluation)) {
      return '';
    }

    return evaluation.parts
      .map((part) => (typeof part.text === 'string' ? part.text.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+([.,!?;:%)\]}])/g, '$1')
      .replace(/([¿¡([{])\s+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findFirstIncorrectEvaluationPart(evaluation) {
    if (!isValidSentenceEvaluation(evaluation)) {
      return '';
    }

    const errorPart = evaluation.parts.find(
      (part) => normalizePartStatus(part.status) === 'error' && typeof part.text === 'string',
    );
    if (errorPart?.text?.trim()) {
      return errorPart.text.trim();
    }

    const improvePart = evaluation.parts.find(
      (part) => normalizePartStatus(part.status) === 'improve' && typeof part.text === 'string',
    );
    return improvePart?.text?.trim() || '';
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

  function createPracticeModuleLinkAction(block) {
    if (!block || typeof block !== 'object' || typeof block.label !== 'string') {
      return null;
    }

    if (typeof block.practiceModuleId !== 'string' || !block.practiceModuleId.trim()) {
      return null;
    }

    const link = document.createElement('a');
    link.className = 'btn btn-outline-primary btn-sm rounded-pill tutor-message-action-link';
    link.href = `/practice-modules/${encodeURIComponent(block.practiceModuleId.trim())}`;
    link.textContent = block.label;
    return link;
  }

  function getExerciseResultForBlock(metadata, key, blockIndex) {
    const results = metadata?.[key];
    if (!results || typeof results !== 'object') {
      return null;
    }

    return results[String(blockIndex)] ?? null;
  }

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

  return {
    appendEphemeralError,
    appendMessage,
    appendStoredMessage,
    initializeSentencePopovers,
    markTutorMessageArrived,
    setMessageContent,
    setModelBubbleContent,
    updateRenderedMessage,
    copyTextToClipboard,
    initializeStaticMarkdown() {
      for (const element of document.querySelectorAll('[data-render-markdown]')) {
        setMessageContent(element, element.textContent || '');
      }
    },
  };
}
