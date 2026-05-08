const guestDraftStorageKey = 'misterf.guestDraft';
const messagesEl = document.querySelector('#messages');
const chatPaneEl = document.querySelector('#chatPane');
const formEl = document.querySelector('#chatForm');
const inputEl = document.querySelector('#messageInput');
const practiceModuleStartPanelEl = document.querySelector('[data-practice-module-start-panel]');
const practiceModuleStartTitleEl = document.querySelector('[data-practiceModule-start-title]');
const practiceModuleStartDescriptionEl = document.querySelector(
  '[data-practiceModule-start-description]',
);
const practiceModuleStartStatusEl = document.querySelector('[data-practice-module-start-status]');
const practiceModuleStartButtonEl = document.querySelector('[data-practiceModule-start-button]');
const sendButtonEl = document.querySelector('[data-send-button]');
const toolStatusEl = document.querySelector('[data-tool-status]');
const llmContextMeterEl = document.querySelector('[data-llm-context-meter]');
const llmContextCircleEl = document.querySelector('[data-llm-context-circle]');
const conversationPanelEl = document.querySelector('#conversationPanel');
const newConversationButtonEl = document.querySelector('[data-new-conversation]');
const deleteConversationModalEl = document.querySelector(
  '#deleteConversationModal',
);
const deleteConversationTitleEl = document.querySelector(
  '[data-delete-conversation-title]',
);
const confirmDeleteConversationButtonEl = document.querySelector(
  '[data-confirm-delete-conversation]',
);
const translatorModalEl = document.querySelector('#translatorModal');
const translatorFormEl = document.querySelector('#translatorForm');
const translatorInputEl = document.querySelector('#translatorInput');
const translatorResultEl = document.querySelector('#translatorResult');
const translatorSubmitEl = document.querySelector('[data-translator-submit]');
const translatorOpenButtonEls = document.querySelectorAll('[data-open-translator]');
const translatorCopyButtonEls = document.querySelectorAll('[data-translator-copy]');
const creditModalEl = document.querySelector('#creditModal');
const creditMessageEl = document.querySelector('[data-credit-message]');
const sharePracticeModuleLinkModalEl = document.querySelector('#sharePracticeModuleLinkModal');
const practiceModuleShareLinkFieldEl = document.querySelector(
  '[data-practiceModule-share-link-field]',
);
const copyPracticeModuleShareLinkButtonEl = document.querySelector(
  '[data-copy-practiceModule-share-link]',
);
const nativeSharePracticeModuleLinkButtonEl = document.querySelector(
  '[data-native-share-practiceModule-link]',
);
const autoOpenSharedPracticeModuleModalEl = document.querySelector(
  '[data-auto-open-share-modal]',
);
const isInitiallyAuthenticated = document.body.dataset.authenticated === 'true';
const chatMode = 'tutor';
const currentView = document.body.dataset.currentView || 'chat';
const socketAuthToken = document.body.dataset.socketAuthToken || '';
const guestInitialGreeting = document.body.dataset.guestInitialGreeting || '';
const initialConversationId =
  document.body.dataset.initialConversationId?.trim() || '';
const shouldInitializeSocket = isInitiallyAuthenticated && currentView === 'chat';
const shouldAutoJoinSocketThread = currentView === 'chat';
const socket = shouldInitializeSocket
  ? io({ auth: { token: socketAuthToken } })
  : null;
const llmContextCircleRadius = llmContextCircleEl
  ? Number.parseFloat(llmContextCircleEl.getAttribute('r') || '0')
  : 0;
const llmContextCircleCircumference = 2 * Math.PI * llmContextCircleRadius;

disableComposerTextAssist();
initializeLlmContextMeter();
initializeStaticMarkdown();
initializePracticeModuleSharingUi();

let conversationId = initialConversationId;
let streamingBubble = null;
let isAssistantBusy = false;
let pendingDeleteTarget = null;
let activeUserMessageId = null;
let pendingPracticeModuleStart = false;
let isAssistantStopping = false;
const pendingSentenceEvaluations = new Map();
let pendingTranslatorSelection = '';
let userInputHistory = [];
let userInputHistoryIndex = -1;
let userInputDraftBeforeHistory = '';
let pendingBootGuestDraft = '';
let hasHandledInitialConversationReady = false;
let toolStatusRow = null;
const matchingExerciseStates = new Map();
const chatSocketEvents = {
  cancel: 'assistant:cancel',
  deleted: 'conversation:deleted',
  error: 'conversation:error',
  join: 'conversation:join',
  promoted: 'conversation:promoted',
  ready: 'conversation:ready',
  send: 'message:send',
};

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

if (socket) {
  socket.on('connect', () => {
    if (shouldAutoJoinSocketThread) {
      socket.emit(chatSocketEvents.join, { conversationId });
    }
  });

  socket.on('auth:required', ({ message }) => {
    showAuthRequiredMessage(message);
  });

  socket.on('disconnect', (reason) => {
    appendEphemeralError(
      `Se perdió la conexión con el servidor. Intentando reconectar. (${reason})`,
    );
    setComposerEnabled(false);
  });

  socket.on('connect_error', (error) => {
    if (error.message === 'authentication_required') {
      showAuthRequiredMessage();
      return;
    }

    appendEphemeralError(
      'No puedo conectar con el servidor en este momento. Revisa PM2 o vuelve a intentar en unos segundos.',
    );
    setComposerEnabled(false);
  });

  socket.on(chatSocketEvents.ready, (payload) => {
    hasHandledInitialConversationReady = true;
    conversationId = payload.conversationId;
    upsertConversationItem(payload.conversation);
    markActiveConversation(conversationId);
    messagesEl.replaceChildren();
    streamingBubble = null;
    pendingSentenceEvaluations.clear();
    activeUserMessageId = null;
    userInputHistory = (payload.messages ?? [])
      .filter((message) => message?.role === 'user' && typeof message.content === 'string')
      .map((message) => message.content)
      .filter((content) => content.trim().length > 0);
    resetUserInputHistoryNavigation();
    updateLlmContextMeter(null);
    setToolStatus('');
    pendingPracticeModuleStart = Boolean(payload.pendingPracticeModuleStart);
    const shouldAutoStartPracticeModule =
      pendingPracticeModuleStart && Boolean(payload.practiceModule);
    renderPracticeModuleStartPanel(
      payload.practiceModule,
      {
        autoStarting: shouldAutoStartPracticeModule,
        visible: pendingPracticeModuleStart,
      },
    );

    let queuedSentenceEvaluation = null;
    for (const message of payload.messages ?? []) {
      if (message.role === 'user') {
        queuedSentenceEvaluation = message.metadata?.sentenceEvaluation ?? null;
        appendStoredMessage(message);
        if (typeof message.id === 'number') {
          activeUserMessageId = message.id;
        }
        continue;
      }

      appendStoredMessage(message, {
        sentenceEvaluation: queuedSentenceEvaluation,
      });
      queuedSentenceEvaluation = null;
    }

    if (payload.assistantPending) {
      isAssistantBusy = true;
      isAssistantStopping = false;
      setComposerEnabled(false);
      streamingBubble = appendMessage('model', '', { streaming: true });
    } else {
      isAssistantBusy = false;
      isAssistantStopping = false;
      setComposerEnabled(!pendingPracticeModuleStart);
    }
    focusComposer();
    scrollToBottom();
    flushPendingBootGuestDraft();

    if (shouldAutoStartPracticeModule) {
      window.setTimeout(() => {
        startPracticeModuleConversation({ preservePanel: true });
      }, 0);
    }
  });

  socket.on(chatSocketEvents.promoted, (payload) => {
    conversationId = payload.conversationId;
    window.location.replace(buildCurrentChatPath(conversationId));
  });

  socket.on('conversation:renamed', (payload) => {
    updateConversationItem(payload.conversation);
    markActiveConversation(conversationId);
  });

  socket.on('conversation:updated', (payload) => {
    updateConversationItem(payload.conversation, { moveToTop: true });
    markActiveConversation(conversationId);
  });

  socket.on(chatSocketEvents.deleted, (payload) => {
    removeConversationItem(payload.conversationId);

    if (payload.conversationId === conversationId || payload.wasActive) {
      window.location.assign('/');
    }
  });

  socket.on(chatSocketEvents.error, ({ message }) => {
    appendEphemeralError(message || 'No pude actualizar la conversación.');
  });

  socket.on('translator:result', ({ translation }) => {
    setTranslatorBusy(false);
    translatorResultEl.textContent = translation?.translatedText || '';
  });

  socket.on('translator:error', ({ message }) => {
    setTranslatorBusy(false);
    translatorResultEl.textContent =
      message || 'No pude traducir el texto en este momento.';
  });

  socket.on('llm:request_tokens', (payload) => {
    if (!isCurrentConversationPayload(payload)) {
      return;
    }

    logLlmRequestTokens(payload.usage);
    updateLlmContextMeter(payload.usage);
  });

  socket.on('llm:credit_exhausted', ({ message }) => {
    showCreditExhaustedModal(message);
  });

  socket.on('message:created', (message) => {
    const bubble = appendStoredMessage(message);
    if (message.role === 'user') {
      activeUserMessageId = message.id;
    } else {
      markTutorMessageArrived(bubble.closest('.message-row'));
    }
    scrollToBottom();
  });

  socket.on('assistant:start', () => {
    isAssistantBusy = true;
    isAssistantStopping = false;
    pendingPracticeModuleStart = false;
    renderPracticeModuleStartPanel(null, { visible: false });
    setToolStatus('');
    setComposerEnabled(false);
    streamingBubble = appendMessage('model', '', { streaming: true });
    scrollToBottom();
  });

  socket.on('assistant:tool_status', ({ label }) => {
    setToolStatus(typeof label === 'string' ? label : '');
  });

  socket.on('assistant:chunk', ({ chunk }) => {
    if (!streamingBubble) {
      streamingBubble = appendMessage('model', '', { streaming: true });
    }

    const rawContent = `${streamingBubble.dataset.rawContent ?? ''}${chunk}`;
    setMessageContent(streamingBubble, rawContent);
    scrollToBottom();
  });

  socket.on('assistant:done', (message) => {
    if (!message) {
      streamingBubble?.remove();
      streamingBubble = null;
      setToolStatus('');
      isAssistantBusy = false;
      isAssistantStopping = false;
      renderPracticeModuleStartPanel(null, { visible: false });
      setComposerEnabled(true);
      focusComposer();
      scrollToBottom();
      return;
    }

    const sentenceEvaluation = activeUserMessageId
      ? pendingSentenceEvaluations.get(activeUserMessageId)
      : null;

    if (streamingBubble) {
      setModelBubbleContent(streamingBubble, message.content, message.metadata, {
        messageId: message.id,
      });
      streamingBubble.classList.remove('typing-caret');
      const streamingRow = streamingBubble.closest('.message-row');
      streamingRow?.setAttribute('data-message-id', message.id);
      attachMessageMetadata(streamingRow, message.metadata);
      renderSentenceEvaluation(streamingBubble, sentenceEvaluation);
      initializeSentencePopovers(streamingBubble);
      markTutorMessageArrived(streamingRow);
    } else {
      const bubble = appendStoredMessage(message, { sentenceEvaluation });
      markTutorMessageArrived(bubble.closest('.message-row'));
    }

    if (activeUserMessageId) {
      pendingSentenceEvaluations.delete(activeUserMessageId);
    }
    activeUserMessageId = null;
    streamingBubble = null;
    setToolStatus('');
    isAssistantBusy = false;
    isAssistantStopping = false;
    renderPracticeModuleStartPanel(null, { visible: false });
    setComposerEnabled(true);
    focusComposer();
    scrollToBottom();
  });

  socket.on('assistant:stopped', () => {
    if (streamingBubble) {
      streamingBubble.closest('.message-row')?.remove();
      streamingBubble = null;
    }

    setToolStatus('');
    isAssistantBusy = false;
    isAssistantStopping = false;
    renderPracticeModuleStartPanel(null, { visible: false });
    setComposerEnabled(!pendingPracticeModuleStart);
    focusComposer();
    scrollToBottom();
  });

  socket.on('assistant:error', ({ message }) => {
    if (streamingBubble) {
      streamingBubble.closest('.message-row')?.remove();
      streamingBubble = null;
    }

    setToolStatus('');
    appendMessage('error', message);
    isAssistantBusy = false;
    isAssistantStopping = false;
    setComposerEnabled(!pendingPracticeModuleStart);
    scrollToBottom();
  });

  socket.on('message:evaluation_updated', ({ message }) => {
    if (!message?.id) {
      return;
    }

    pendingSentenceEvaluations.set(message.id, message.metadata?.sentenceEvaluation);

    if (!isAssistantBusy) {
      renderSentenceEvaluationOnLastAssistant(message.metadata?.sentenceEvaluation);
      scrollToBottom();
    }
  });

  socket.on('message:updated', (message) => {
    if (!message?.id) {
      return;
    }

    updateRenderedMessage(message);
  });
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isAssistantBusy) {
    stopAssistantResponse();
    return;
  }

  sendMessage();
});

inputEl.addEventListener('keydown', (event) => {
  if (handleUserInputHistoryKeydown(event)) {
    return;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', () => {
  resizeComposerInput();
});

for (const item of document.querySelectorAll('.conversation-item')) {
  configureConversationItem(item);
}

newConversationButtonEl?.addEventListener('click', (event) => {
  event.preventDefault();
  startNewConversation();
});

practiceModuleStartButtonEl?.addEventListener('click', () => {
  startPracticeModuleConversation();
});

confirmDeleteConversationButtonEl?.addEventListener('click', () => {
  confirmDeleteConversation();
});

for (const button of translatorOpenButtonEls) {
  button.addEventListener('pointerdown', () => {
    pendingTranslatorSelection = getSelectedAppText();
  });

  button.addEventListener('click', () => {
    translateSelectedAppText();
    button.blur();
  });
}

translatorFormEl?.addEventListener('submit', (event) => {
  event.preventDefault();
  translateFromModal();
});

translatorModalEl?.addEventListener('shown.bs.modal', () => {
  translatorInputEl?.focus();
});

translatorInputEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    translateFromModal();
  }
});

for (const button of translatorCopyButtonEls) {
  button.addEventListener('click', () => {
    copyTranslatorText(button);
  });
}

formatConversationDates();

function disableComposerTextAssist() {
  inputEl?.setAttribute('autocomplete', 'off');
  inputEl?.setAttribute('autocorrect', 'off');
  inputEl?.setAttribute('autocapitalize', 'none');
  inputEl?.setAttribute('spellcheck', 'false');
}

function translateSelectedAppText() {
  const selectedText = pendingTranslatorSelection || getSelectedAppText();
  pendingTranslatorSelection = '';
  if (!selectedText) {
    return;
  }

  const autoModeInput = translatorFormEl?.querySelector(
    'input[name="translatorMode"][value="auto"]',
  );
  if (autoModeInput) {
    autoModeInput.checked = true;
  }

  translatorInputEl.value = selectedText;
  translatorResultEl.textContent = '';
  window.setTimeout(() => {
    translateFromModal();
  }, 0);
}

function getSelectedAppText() {
  const selectedControlText = getSelectedTextFromControl(document.activeElement);
  if (selectedControlText) {
    return selectedControlText;
  }

  const selection = window.getSelection?.();
  const selectedText = selection?.toString().trim() || '';
  if (!selectedText || !selection?.rangeCount) {
    return '';
  }

  const range = selection.getRangeAt(0);
  const selectionContainer = range.commonAncestorContainer;
  const selectionElement =
    selectionContainer.nodeType === Node.ELEMENT_NODE
      ? selectionContainer
      : selectionContainer.parentElement;

  const appShell = document.querySelector('.app-shell');
  return appShell?.contains(selectionElement) ? selectedText : '';
}

function getSelectedTextFromControl(element) {
  if (
    !(element instanceof HTMLTextAreaElement) &&
    !(element instanceof HTMLInputElement)
  ) {
    return '';
  }

  const selectionStart = element.selectionStart ?? 0;
  const selectionEnd = element.selectionEnd ?? 0;
  if (selectionEnd <= selectionStart) {
    return '';
  }

  return element.value.slice(selectionStart, selectionEnd).trim();
}

function translateFromModal() {
  const text = translatorInputEl?.value.trim() || '';
  if (!text || !socket) {
    return;
  }

  const mode =
    translatorFormEl?.querySelector('input[name="translatorMode"]:checked')?.value ||
    'auto';

  setTranslatorBusy(true);
  translatorResultEl.textContent = '';
  socket.emit('translator:translate', { mode, text });
}

function setTranslatorBusy(isBusy) {
  if (translatorSubmitEl) {
    translatorSubmitEl.disabled = isBusy;
    translatorSubmitEl.textContent = isBusy ? 'Traduciendo...' : 'Traducir';
  }
}

async function copyTranslatorText(button) {
  const source = button.dataset.translatorCopy;
  const content =
    source === 'result'
      ? translatorResultEl?.textContent?.trim() || ''
      : translatorInputEl?.value.trim() || '';
  const copied = await copyTextToClipboard(content);

  button.classList.toggle('is-copied', copied);
  button.title = copied ? 'Copiado' : 'No se pudo copiar';

  window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.title = source === 'result' ? 'Copiar traducción' : 'Copiar texto';
  }, 1200);
}

function sendMessage() {
  const content = inputEl.value.trim();
  if (!content || isAssistantBusy) {
    return;
  }

  if (!socket) {
    preserveGuestDraft(content);
    showGuestAuthPrompt();
    return;
  }

  rememberUserInput(content);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  resetUserInputHistoryNavigation();
  setComposerEnabled(false);
  socket.emit(chatSocketEvents.send, { conversationId, content });
}

function stopAssistantResponse() {
  if (!socket || !conversationId || !isAssistantBusy || isAssistantStopping) {
    return;
  }

  isAssistantStopping = true;
  syncSendButton();
  socket.emit(chatSocketEvents.cancel, { conversationId });
}

function setToolStatus(text) {
  const nextText = typeof text === 'string' ? text.trim() : '';
  if (!nextText) {
    toolStatusRow?.remove();
    toolStatusRow = null;
    if (toolStatusEl) {
      toolStatusEl.textContent = '';
      toolStatusEl.classList.add('d-none');
    }
    return;
  }

  if (toolStatusEl) {
    toolStatusEl.textContent = '';
    toolStatusEl.classList.add('d-none');
  }

  if (!toolStatusRow) {
    const row = document.createElement('div');
    row.className = 'message-row is-tool-status';
    row.dataset.role = 'tool-status';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble tool-status-bubble';

    const textNode = document.createElement('div');
    textNode.className = 'tool-status-text small text-body-secondary';

    bubble.append(textNode);
    row.append(bubble);
    const streamingRow = streamingBubble?.closest('.message-row');
    if (streamingRow?.parentElement === messagesEl) {
      messagesEl.insertBefore(row, streamingRow);
    } else {
      messagesEl.append(row);
    }
    toolStatusRow = row;
  }

  const bubble = toolStatusRow.querySelector('.tool-status-bubble');
  if (bubble) {
    const textNode = bubble.querySelector('.tool-status-text');
    if (textNode) {
      textNode.textContent = nextText;
    }
  }
  scrollToBottom();
}

function handleUserInputHistoryKeydown(event) {
  if (!inputEl || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  if (event.key === 'ArrowUp') {
    if (!shouldUseHistoryArrow('up')) {
      return false;
    }

    event.preventDefault();
    navigateUserInputHistory(-1);
    return true;
  }

  if (event.key === 'ArrowDown') {
    if (!shouldUseHistoryArrow('down')) {
      return false;
    }

    event.preventDefault();
    navigateUserInputHistory(1);
    return true;
  }

  return false;
}

function shouldUseHistoryArrow(direction) {
  if (!inputEl || !userInputHistory.length) {
    return false;
  }

  const hasDraft = inputEl.value.trim().length > 0;
  if (hasDraft && userInputHistoryIndex === -1) {
    return false;
  }

  const selectionStart = inputEl.selectionStart ?? 0;
  const selectionEnd = inputEl.selectionEnd ?? 0;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  if (direction === 'up') {
    const textBeforeCaret = inputEl.value.slice(0, selectionStart);
    return !textBeforeCaret.includes('\n');
  }

  const textAfterCaret = inputEl.value.slice(selectionEnd);
  return !textAfterCaret.includes('\n');
}

function navigateUserInputHistory(step) {
  if (!inputEl || !userInputHistory.length) {
    return;
  }

  if (userInputHistoryIndex === -1) {
    userInputDraftBeforeHistory = inputEl.value;
    userInputHistoryIndex = userInputHistory.length;
  }

  const nextIndex = Math.max(
    0,
    Math.min(userInputHistory.length, userInputHistoryIndex + step),
  );

  if (nextIndex === userInputHistory.length) {
    userInputHistoryIndex = -1;
    inputEl.value = userInputDraftBeforeHistory;
    resizeComposerInput();
    moveCaretToEnd(inputEl);
    return;
  }

  userInputHistoryIndex = nextIndex;
  inputEl.value = userInputHistory[userInputHistoryIndex] || '';
  resizeComposerInput();
  moveCaretToEnd(inputEl);
}

function resetUserInputHistoryNavigation() {
  userInputHistoryIndex = -1;
  userInputDraftBeforeHistory = '';
}

function rememberUserInput(content) {
  const normalized = content.trim();
  if (!normalized) {
    return;
  }

  const last = userInputHistory[userInputHistory.length - 1];
  if (last === normalized) {
    return;
  }

  userInputHistory.push(normalized);
}

function moveCaretToEnd(element) {
  const end = element.value.length;
  element.setSelectionRange(end, end);
}

function buildConversationPath(nextConversationId) {
  return nextConversationId
    ? `/c/${encodeURIComponent(nextConversationId)}`
    : '/';
}

function buildCurrentChatPath(nextConversationId) {
  return buildConversationPath(nextConversationId);
}

function isCurrentConversationPayload(payload) {
  const payloadConversationId = payload?.conversationId || '';
  return Boolean(conversationId && payloadConversationId === conversationId);
}

function logLlmRequestTokens(usage) {
  if (!usage) {
    return;
  }

  const label = usage.isEstimate
    ? '[Mr. F LLM tokens estimados]'
    : '[Mr. F LLM tokens]';

  console.log(label, {
    contextWindowTokens: usage.contextWindowTokens,
    inputTokens: usage.inputTokens,
    model: usage.model,
    percentUsed: `${usage.percentUsed}%`,
    provider: usage.provider,
    turn: usage.turn,
  });
}

function initializeLlmContextMeter() {
  if (!llmContextCircleEl || !llmContextMeterEl) {
    return;
  }

  llmContextCircleEl.style.strokeDasharray = `${llmContextCircleCircumference}`;
  updateLlmContextMeter(null);
}

function initializePracticeModuleSharingUi() {
  if (copyPracticeModuleShareLinkButtonEl) {
    copyPracticeModuleShareLinkButtonEl.addEventListener('click', async () => {
      if (!practiceModuleShareLinkFieldEl) {
        return;
      }

      const copied = await copyTextToClipboard(practiceModuleShareLinkFieldEl.value);
      copyPracticeModuleShareLinkButtonEl.textContent = copied ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        copyPracticeModuleShareLinkButtonEl.innerHTML =
          '<i class="bi bi-copy me-1" aria-hidden="true"></i>Copiar';
      }, 1200);
    });
  }

  if (nativeSharePracticeModuleLinkButtonEl) {
    if (typeof navigator.share !== 'function') {
      nativeSharePracticeModuleLinkButtonEl.classList.add('d-none');
    } else {
      nativeSharePracticeModuleLinkButtonEl.addEventListener('click', async () => {
        if (!practiceModuleShareLinkFieldEl?.value) {
          return;
        }

        try {
          await navigator.share({
            title: 'Módulo de práctica compartido',
            url: practiceModuleShareLinkFieldEl.value,
          });
        } catch {}
      });
    }
  }

  if (autoOpenSharedPracticeModuleModalEl && window.bootstrap?.Modal) {
    const modal = new window.bootstrap.Modal(autoOpenSharedPracticeModuleModalEl);
    modal.show();
  }
}


function updateLlmContextMeter(usage) {
  if (!llmContextMeterEl || !llmContextCircleEl) {
    return;
  }

  const rawPercent = Number(usage?.percentUsed);
  const hasPercent = Number.isFinite(rawPercent);
  const clampedPercent = hasPercent
    ? Math.min(100, Math.max(0, rawPercent))
    : 0;
  const progress = clampedPercent / 100;
  const dashOffset =
    llmContextCircleCircumference * (1 - progress);

  llmContextCircleEl.style.strokeDashoffset = `${dashOffset}`;
  llmContextMeterEl.setAttribute(
    'aria-valuenow',
    hasPercent ? `${Math.round(clampedPercent)}` : '0',
  );
  llmContextMeterEl.setAttribute(
    'aria-valuetext',
    hasPercent
      ? `${Math.round(clampedPercent)} por ciento del contexto usado`
      : '0 por ciento del contexto usado',
  );

  let level = 'normal';
  if (clampedPercent >= 85) {
    level = 'danger';
  } else if (clampedPercent >= 65) {
    level = 'warn';
  }

  llmContextMeterEl.dataset.contextLevel = level;
}

function renderPracticeModuleStartPanel(practiceModule, options = {}) {
  if (
    !practiceModuleStartPanelEl ||
    !practiceModuleStartTitleEl ||
    !practiceModuleStartDescriptionEl ||
    !practiceModuleStartButtonEl ||
    !practiceModuleStartStatusEl
  ) {
    return;
  }

  const visible = Boolean(options.visible);
  const autoStarting = Boolean(options.autoStarting);

  if (!visible || !practiceModule) {
    practiceModuleStartPanelEl.classList.add('d-none');
    practiceModuleStartTitleEl.textContent = '';
    practiceModuleStartDescriptionEl.textContent = '';
    practiceModuleStartStatusEl.classList.add('d-none');
    practiceModuleStartButtonEl.classList.remove('d-none');
    return;
  }

  practiceModuleStartTitleEl.textContent = autoStarting ? '' : practiceModule.title || 'Módulo de práctica';
  practiceModuleStartDescriptionEl.textContent = autoStarting ? '' : practiceModule.description || '';
  practiceModuleStartStatusEl.classList.toggle('d-none', !autoStarting);
  practiceModuleStartButtonEl.classList.toggle('d-none', autoStarting);
  practiceModuleStartPanelEl.classList.remove('d-none');
}

function startNewConversation() {
  if (isAssistantBusy) {
    return;
  }

  window.location.assign('/');
}

function startPracticeModuleConversation(options = {}) {
  if (!socket || isAssistantBusy || !conversationId) {
    return;
  }

  pendingPracticeModuleStart = false;
  if (!options.preservePanel) {
    renderPracticeModuleStartPanel(null, { visible: false });
  }
  setComposerEnabled(false);
  socket.emit('practice-module:start', { conversationId });
}

function markActiveConversation(activeConversationId) {
  for (const item of document.querySelectorAll('[data-conversation-id]')) {
    item.classList.toggle(
      'is-active',
      item.dataset.conversationId === activeConversationId,
    );
  }
}

function configureConversationItem(item) {
  item
    .querySelector('[data-rename-conversation]')
    ?.addEventListener('click', () => {
      startRenamingConversation(item);
    });

  item
    .querySelector('[data-delete-conversation]')
    ?.addEventListener('click', () => {
      requestDeleteConversation(item);
    });
}

function upsertConversationItem(conversation) {
  if (!conversation?.id || !conversationPanelEl) {
    return;
  }

  const recentsContainer = conversationPanelEl.querySelector('.panel-recents');
  let list = conversationPanelEl.querySelector('.conversation-list');
  if (!list) {
    const emptyState = conversationPanelEl.querySelector('.conversation-empty');
    emptyState?.remove();
    list = document.createElement('div');
    list.className = 'conversation-list';
    recentsContainer?.append(list);
  } else {
    conversationPanelEl.querySelector('.conversation-empty')?.remove();
  }

  let item = list.querySelector(
    `[data-conversation-id="${CSS.escape(conversation.id)}"]`,
  );

  if (!item) {
    item = createConversationItem(conversation);
    list.prepend(item);
    return;
  }

  const previousUpdatedAt =
    item.querySelector('.conversation-date')?.dateTime || '';
  const nextUpdatedAt = conversation.updatedAt || '';

  item.querySelector('.conversation-title').textContent =
    conversation.title || 'Nueva conversación';

  const date = item.querySelector('.conversation-date');
  date.dateTime = nextUpdatedAt;
  date.textContent = formatConversationDate(nextUpdatedAt);
  date.title = nextUpdatedAt;

  if (nextUpdatedAt && nextUpdatedAt !== previousUpdatedAt) {
    list.prepend(item);
  }
}

function updateConversationItem(conversation, options = {}) {
  if (!conversation?.id || !conversationPanelEl) {
    return;
  }

  const item = conversationPanelEl.querySelector(
    `[data-conversation-id="${CSS.escape(conversation.id)}"]`,
  );
  if (!item) {
    upsertConversationItem(conversation);
    return;
  }

  item.querySelector('.conversation-title').textContent =
    conversation.title || 'Nueva conversación';

  const date = item.querySelector('.conversation-date');
  date.dateTime = conversation.updatedAt || '';
  date.textContent = formatConversationDate(conversation.updatedAt || '');
  date.title = conversation.updatedAt || '';

  if (options.moveToTop) {
    item.parentElement?.prepend(item);
  }
}

function createConversationItem(conversation) {
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.dataset.conversationId = conversation.id;
  item.dataset.itemKind = 'conversation';

  const openButton = document.createElement('a');
  openButton.className = 'conversation-open-button';
  openButton.href = buildConversationPath(conversation.id);
  openButton.dataset.openConversation = '';

  const title = document.createElement('span');
  title.className = 'conversation-title';
  title.textContent = conversation.title || 'Nueva conversación';

  const date = document.createElement('time');
  date.className = 'conversation-date';
  date.dateTime = conversation.updatedAt || '';
  date.textContent = formatConversationDate(conversation.updatedAt || '');
  date.title = conversation.updatedAt || '';

  openButton.append(title, date);
  item.append(openButton, createConversationActions());
  configureConversationItem(item);
  return item;
}

function createConversationActions() {
  const wrapper = document.createElement('div');
  wrapper.className = 'conversation-actions dropdown';

  const button = document.createElement('button');
  button.className = 'btn btn-link conversation-actions-button';
  button.type = 'button';
  button.title = 'Opciones de conversación';
  button.setAttribute('aria-label', 'Opciones de conversación');
  button.setAttribute('aria-expanded', 'false');
  button.dataset.bsToggle = 'dropdown';
  button.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu dropdown-menu-end conversation-actions-menu';

  const rename = document.createElement('button');
  rename.className = 'dropdown-item';
  rename.type = 'button';
  rename.dataset.renameConversation = '';
  rename.textContent = 'Renombrar';

  const remove = document.createElement('button');
  remove.className = 'dropdown-item text-danger';
  remove.type = 'button';
  remove.dataset.deleteConversation = '';
  remove.textContent = 'Eliminar';

  menu.append(rename, remove);
  wrapper.append(button, menu);
  return wrapper;
}

function startRenamingConversation(item) {
  if (item.classList.contains('is-renaming')) {
    return;
  }

  const currentTitle =
    item.querySelector('.conversation-title')?.textContent?.trim() ||
    'Nueva conversación';
  const form = document.createElement('form');
  form.className = 'conversation-rename-form';

  const input = document.createElement('input');
  input.className = 'conversation-rename-input';
  input.type = 'text';
  input.maxLength = 90;
  input.required = true;
  input.value = currentTitle;
  input.setAttribute('aria-label', 'Nuevo título de la conversación');

  const saveButton = createRenameActionButton({
    label: 'Guardar nombre',
    iconClass: 'bi-check-lg',
    type: 'submit',
  });

  const cancelButton = createRenameActionButton({
    label: 'Cancelar',
    iconClass: 'bi-x-lg',
    type: 'button',
  });

  form.append(input, saveButton, cancelButton);
  item.append(form);
  item.classList.add('is-renaming');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    renameConversation(item, input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cancelRenamingConversation(item);
    }
  });

  cancelButton.addEventListener('click', () => {
    cancelRenamingConversation(item);
  });

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function createRenameActionButton({ label, iconClass, type }) {
  const button = document.createElement('button');
  button.className = 'conversation-rename-action';
  button.type = type;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i>`;
  return button;
}

function renameConversation(item, title) {
  const nextTitle = title.replace(/\s+/g, ' ').trim();
  if (!nextTitle || !socket) {
    return;
  }

  socket.emit('conversation:rename', {
    conversationId: item.dataset.conversationId,
    title: nextTitle,
  });
  cancelRenamingConversation(item);
}

function cancelRenamingConversation(item) {
  item.querySelector('.conversation-rename-form')?.remove();
  item.classList.remove('is-renaming');
}

function requestDeleteConversation(item) {
  const id = item.dataset.conversationId || null;

  pendingDeleteTarget = id ? { id, kind: 'conversation' } : null;
  if (!pendingDeleteTarget) {
    return;
  }

  const title =
    item.querySelector('.conversation-title')?.textContent?.trim() ||
    'Nueva conversación';
  if (deleteConversationTitleEl) {
    deleteConversationTitleEl.textContent = title;
  }

  if (deleteConversationModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(deleteConversationModalEl).show();
  }
}

function confirmDeleteConversation() {
  if (!pendingDeleteTarget || !socket) {
    return;
  }

  socket.emit('conversation:delete', {
    conversationId: pendingDeleteTarget.id,
  });
  pendingDeleteTarget = null;

  if (deleteConversationModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(deleteConversationModalEl).hide();
  }
}

function removeConversationItem(removedConversationId) {
  if (!removedConversationId) {
    return;
  }

  document
    .querySelector(`[data-conversation-id="${CSS.escape(removedConversationId)}"]`)
    ?.remove();

  if (!conversationPanelEl?.querySelector('[data-conversation-id]')) {
    const recentsContainer = conversationPanelEl?.querySelector('.panel-recents');
    const emptyState = document.createElement('p');
    emptyState.className = 'conversation-empty';
    emptyState.textContent = 'Todavía no hay conversaciones.';
    recentsContainer?.append(emptyState);
  }
}

function formatConversationDates() {
  for (const date of document.querySelectorAll('.conversation-date, .practice-module-chat-date')) {
    const rawValue = date.getAttribute('datetime') || date.textContent || '';
    date.textContent = formatConversationDate(rawValue.trim());
    date.title = rawValue.trim();
  }
}

function formatConversationDate(value) {
  const date = parseConversationDate(value);
  if (!date) {
    return value;
  }

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (dayDiff === 0) {
    return `Hoy, ${formatConversationTime(date)}`;
  }

  if (dayDiff === 1) {
    return `Ayer, ${formatConversationTime(date)}`;
  }

  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
    .format(date)
    .replace('.', '');
}

function formatConversationTime(date) {
  return new Intl.DateTimeFormat('es', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function parseConversationDate(value) {
  if (!value) {
    return null;
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function showAuthRequiredMessage(message) {
  messagesEl.replaceChildren();
  streamingBubble = null;
  appendMessage(
    'model',
    message ||
      'Para practicar con Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
  );
  setComposerEnabled(false);
  scrollToBottom();
}

function showCreditExhaustedModal(message) {
  const displayMessage =
    message ||
    'Tu crédito de práctica se agotó por ahora. Puedes recargar crédito o intentarlo de nuevo más tarde.';

  if (creditMessageEl) {
    creditMessageEl.textContent = displayMessage;
  }

  if (creditModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(creditModalEl).show();
    return;
  }

  appendMessage('error', displayMessage);
  scrollToBottom();
}

function showGuestGreeting() {
  messagesEl.replaceChildren();
  streamingBubble = null;
  appendMessage(
    'model',
    guestInitialGreeting ||
      '¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres practicar hoy.',
  );
  setComposerEnabled(true);
  focusComposer();
  scrollToBottom();
}

function preserveGuestDraft(content) {
  sessionStorage.setItem(guestDraftStorageKey, content);
}

function showGuestAuthPrompt() {
  appendMessage(
    'model',
    'Perfecto. Para guardar tu práctica y continuar esta conversación, [inicia sesión](/login) o [crea una cuenta](/signup). Cuando regreses, continuaré desde tu primer mensaje.',
  );
  setComposerEnabled(true);
  inputEl.value = getGuestDraft() || inputEl.value;
  resizeComposerInput();
  focusComposer();
  scrollToBottom();
}

function getGuestDraft() {
  return sessionStorage.getItem(guestDraftStorageKey) || '';
}

function consumeGuestDraft() {
  const draft = getGuestDraft();
  sessionStorage.removeItem(guestDraftStorageKey);
  return draft;
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
      node.dataset.bsTrigger = 'focus';
      node.dataset.bsPlacement = 'top';
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
        speaker.textContent = String(item.speaker || 'Speaker').replace(/\s+/g, ' ').trim();

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
      const card = createMatchingPairsCard(block, {
        blockIndex,
        matchingResult: getMatchingResultForBlock(metadata, blockIndex),
        messageId: options.messageId,
      });
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
      const card = createFillInTheBlankCard(block, {
        blockIndex,
        fillResult: getFillInTheBlankResultForBlock(metadata, blockIndex),
        messageId: options.messageId,
      });
      if (card) {
        stack.append(card);
        hasVisualContent = true;
      }
      return;
    }

    if (block.type === 'multiple_choice') {
      const card = createMultipleChoiceCard(block, {
        blockIndex,
        messageId: options.messageId,
        result: getExerciseResultForBlock(metadata, 'multipleChoiceResults', blockIndex),
      });
      if (card) {
        stack.append(card);
        hasVisualContent = true;
      }
      return;
    }

    if (block.type === 'unscramble_sentence') {
      const card = createUnscrambleSentenceCard(block, {
        blockIndex,
        messageId: options.messageId,
        result: getExerciseResultForBlock(metadata, 'unscrambleSentenceResults', blockIndex),
      });
      if (card) {
        stack.append(card);
        hasVisualContent = true;
      }
      return;
    }

    if (block.type === 'quiz') {
      const card = createQuizCard(block, {
        blockIndex,
        messageId: options.messageId,
        result: getExerciseResultForBlock(metadata, 'quizResults', blockIndex),
      });
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
      sentence.textContent = String(block.sentence || '').replace(/\s+/g, ' ').trim();

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

function appendStoredMessage(message, options = {}) {
  return appendMessage(message.role, message.content, {
    id: message.id,
    metadata: message.metadata,
    sentenceEvaluation: options.sentenceEvaluation,
  });
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

  if (role === 'model') {
    renderSentenceEvaluation(bubble, options.sentenceEvaluation);
  }

  if (options.streaming) {
    bubble.classList.add('typing-caret');
  }

  row.append(bubble);
  messagesEl.append(row);
  initializeSentencePopovers(row);
  return bubble;
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

function renderSentenceEvaluationOnLastAssistant(evaluation) {
  const modelRows = messagesEl.querySelectorAll('.message-row.is-model');
  const lastModelRow = modelRows[modelRows.length - 1];
  if (!lastModelRow) {
    return;
  }

  renderSentenceEvaluation(
    lastModelRow.querySelector('.message-bubble'),
    evaluation,
  );
  initializeSentencePopovers(lastModelRow);
}

function renderSentenceEvaluation(element, evaluation) {
  if (!element) {
    return;
  }

  element.querySelector('.sentence-evaluation')?.remove();
  if (!isValidSentenceEvaluation(evaluation)) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'sentence-evaluation card';

  const header = document.createElement('div');
  header.className = 'sentence-evaluation-header card-header';

  const label = document.createElement('h3');
  label.className = 'sentence-evaluation-label';
  label.textContent = 'Evaluación';
  header.append(label);

  const body = document.createElement('div');
  body.className = 'sentence-evaluation-body card-body';

  const partsLabel = document.createElement('p');
  partsLabel.className = 'sentence-evaluation-parts-label';
  partsLabel.textContent = 'Tu último mensaje, por partes';

  body.append(partsLabel);
  body.append(createSentencePartsElement(evaluation.parts));

  wrapper.append(header, body);
  element.append(wrapper);
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
  const row = messagesEl.querySelector(
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

function applyModelSpeakerMetadata(row, metadata) {
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

function initializeSentencePopovers(root = document) {
  if (!window.bootstrap?.Popover) {
    return;
  }

  for (const trigger of root.querySelectorAll('[data-bs-toggle="popover"]')) {
    window.bootstrap.Popover.getOrCreateInstance(trigger);
  }
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
    putMessageBackInComposer(element.dataset.rawContent || '');
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
  button.className = 'message-action-button';
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i>`;
  return button;
}

function putMessageBackInComposer(content) {
  inputEl.value = content;
  resizeComposerInput();
  focusComposer();
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

function appendEphemeralError(content) {
  const existing = messagesEl.querySelector('[data-ephemeral="connection"]');
  if (existing) {
    existing.remove();
  }

  const bubble = appendMessage('error', content);
  bubble.closest('.message-row')?.setAttribute('data-ephemeral', 'connection');
  scrollToBottom();
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

function renderModelMessageWithMetadata(element, content, metadata) {
  element.replaceChildren();

  const body = document.createElement('div');
  setMessageContent(body, content);
  element.append(body);
}

function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    return escapeHtml(content).replaceAll('\n', '<br>');
  }

  const html = window.marked.parse(content || '');
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

function initializeStaticMarkdown() {
  for (const element of document.querySelectorAll('[data-render-markdown]')) {
    setMessageContent(element, element.textContent || '');
  }
}

function createPracticeModuleLinkAction(block) {
  if (!block || typeof block !== 'object' || typeof block.label !== 'string') {
    return null;
  }

  if (typeof block.practiceModuleId !== 'string' || !block.practiceModuleId.trim()) {
    return null;
  }

  const link = document.createElement('a');
  link.className = 'tutor-message-action-link';
  link.href = `/practice-modules/${encodeURIComponent(block.practiceModuleId.trim())}`;
  link.textContent = block.label;
  return link;
}

function getMatchingResultForBlock(metadata, blockIndex) {
  return getExerciseResultForBlock(metadata, 'matchingExerciseResults', blockIndex);
}

function getFillInTheBlankResultForBlock(metadata, blockIndex) {
  return getExerciseResultForBlock(metadata, 'fillInTheBlankResults', blockIndex);
}

function getExerciseResultForBlock(metadata, key, blockIndex) {
  const results = metadata?.[key];
  if (!results || typeof results !== 'object') {
    return null;
  }

  return results[String(blockIndex)] ?? null;
}

function createQuizCard(block, context) {
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
    reportQuizAborted(state);
    renderQuizCard(section, state);
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
      renderQuizCard(section, state);
    }
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'quiz-nav-button';
  nextButton.type = 'button';
  nextButton.textContent = 'Siguiente';
  nextButton.addEventListener('click', () => {
    if (state.currentIndex < state.itemStates.length - 1) {
      state.currentIndex += 1;
      renderQuizCard(section, state);
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
    reportQuizCompleted(state);
    renderQuizCard(section, state);
  });

  footer.append(status, evaluateButton);

  section.append(header, itemCounter, itemPrompt, itemBody, nav, footer);
  renderQuizCard(section, state);
  return section;
}

function buildInitialQuizItemState(item, itemIndex, exerciseKey, persistedResponse) {
  if (
    item.kind === 'open_text' ||
    item.kind === 'translate_to_english' ||
    item.kind === 'understand_in_spanish'
  ) {
    return {
      kind: item.kind,
      text:
        typeof persistedResponse?.text === 'string' ? persistedResponse.text : '',
    };
  }

  if (
    item.kind === 'fill_in_the_blank_input' ||
    item.kind === 'fill_in_the_blank_choice'
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

  if (item.kind === 'multiple_choice') {
    return {
      kind: item.kind,
      selectedOptions: new Set(
        Array.isArray(persistedResponse?.selectedOptions)
          ? persistedResponse.selectedOptions.map((value) => String(value || ''))
          : [],
      ),
    };
  }

  if (item.kind === 'matching_pairs') {
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

  if (item.kind === 'unscramble_sentence') {
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

function renderQuizCard(section, state) {
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
  renderQuizItemBody(itemBody, item, itemState, state);

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
    status.textContent = 'Quiz cancelado.';
    status.classList.add('is-error');
  } else if (state.submitted) {
    status.textContent = 'Quiz enviado. Mister F lo está evaluando.';
    status.classList.add('is-success');
  } else if (isQuizReadyToSubmit(state)) {
    status.textContent = 'Todo listo. Puedes evaluar el quiz cuando quieras.';
  } else {
    status.textContent = 'Responde todas las preguntas antes de evaluar.';
  }
}

function renderQuizItemBody(container, item, itemState, state) {
  if (
    item.kind === 'open_text' ||
    item.kind === 'translate_to_english' ||
    item.kind === 'understand_in_spanish'
  ) {
    if (item.kind !== 'open_text') {
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
    item.kind === 'fill_in_the_blank_input' ||
    item.kind === 'fill_in_the_blank_choice'
  ) {
    const sentence = document.createElement('div');
    sentence.className = 'fill-in-the-blank-sentence quiz-fill-sentence';
    const placeholderToken =
      item.kind === 'fill_in_the_blank_choice' ? '{{blank}}' : '___';
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

      if (item.kind === 'fill_in_the_blank_choice') {
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

  if (item.kind === 'multiple_choice') {
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

        renderQuizCard(container.closest('.quiz-card'), state);
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

  if (item.kind === 'matching_pairs') {
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

    item.leftItems.forEach((leftText) => {
      const button = document.createElement('button');
      button.className = 'matching-pairs-item';
      button.type = 'button';
      button.textContent = leftText;
      button.disabled = state.submitted || state.aborted || pairedLeft.has(leftText);
      button.classList.toggle('is-selected', itemState.selectedLeft === leftText);
      button.addEventListener('click', () => {
        itemState.selectedLeft =
          itemState.selectedLeft === leftText ? '' : leftText;
        renderQuizCard(container.closest('.quiz-card'), state);
      });
      leftList.append(button);
    });

    itemState.shuffledRightItems.forEach((rightText) => {
      const button = document.createElement('button');
      button.className = 'matching-pairs-item';
      button.type = 'button';
      button.textContent = rightText;
      button.disabled = state.submitted || state.aborted || pairedRight.has(rightText);
      button.classList.toggle('is-selected', itemState.selectedRight === rightText);
      button.addEventListener('click', () => {
        itemState.selectedRight =
          itemState.selectedRight === rightText ? '' : rightText;
        renderQuizCard(container.closest('.quiz-card'), state);
      });
      rightList.append(button);
    });

    leftColumn.append(leftTitle, leftList);
    rightColumn.append(rightTitle, rightList);
    columns.append(leftColumn, rightColumn);

    const pairButton = document.createElement('button');
    pairButton.className = 'quiz-pair-button';
    pairButton.type = 'button';
    pairButton.textContent = 'Emparejar seleccion';
    pairButton.disabled =
      state.submitted ||
      state.aborted ||
      !itemState.selectedLeft ||
      !itemState.selectedRight;
    pairButton.addEventListener('click', () => {
      if (!itemState.selectedLeft || !itemState.selectedRight) {
        return;
      }

      itemState.pairs.push({
        left: itemState.selectedLeft,
        right: itemState.selectedRight,
      });
      itemState.selectedLeft = '';
      itemState.selectedRight = '';
      renderQuizCard(container.closest('.quiz-card'), state);
    });

    const pairList = document.createElement('div');
    pairList.className = 'quiz-pair-list';
    if (itemState.pairs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'quiz-item-helper';
      empty.textContent = 'Selecciona un elemento de cada columna para crear un par.';
      pairList.append(empty);
    } else {
      itemState.pairs.forEach((pair, pairIndex) => {
        const row = document.createElement('div');
        row.className = 'quiz-pair-row';

        const text = document.createElement('span');
        text.className = 'quiz-pair-row-text';
        text.textContent = `${pair.left} -> ${pair.right}`;

        const remove = document.createElement('button');
        remove.className = 'quiz-pair-remove';
        remove.type = 'button';
        remove.textContent = 'Quitar';
        remove.disabled = state.submitted || state.aborted;
        remove.addEventListener('click', () => {
          itemState.pairs.splice(pairIndex, 1);
          renderQuizCard(container.closest('.quiz-card'), state);
        });

        row.append(text, remove);
        pairList.append(row);
      });
    }

    container.append(columns, pairButton, pairList);
    return;
  }

  if (item.kind === 'unscramble_sentence') {
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
          createQuizUnscrambleTokenButton(token, index, true, state, itemState),
        );
      });
    }

    itemState.availableTokens.forEach((token, index) => {
      bank.append(createQuizUnscrambleTokenButton(token, index, false, state, itemState));
    });

    container.append(assembled, bank);
  }
}

function createQuizUnscrambleTokenButton(token, index, isSelected, state, itemState) {
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

    renderQuizCard(button.closest('.quiz-card'), state);
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
    item.kind === 'open_text' ||
    item.kind === 'translate_to_english' ||
    item.kind === 'understand_in_spanish'
  ) {
    return typeof itemState.text === 'string' && itemState.text.trim().length > 0;
  }

  if (
    item.kind === 'fill_in_the_blank_input' ||
    item.kind === 'fill_in_the_blank_choice'
  ) {
    return Array.isArray(itemState.values) && itemState.values.every((value) => value.trim());
  }

  if (item.kind === 'multiple_choice') {
    return itemState.selectedOptions instanceof Set && itemState.selectedOptions.size > 0;
  }

  if (item.kind === 'matching_pairs') {
    return Array.isArray(itemState.pairs) && itemState.pairs.length === item.leftItems.length;
  }

  if (item.kind === 'unscramble_sentence') {
    return (
      Array.isArray(itemState.selectedTokens) &&
      itemState.selectedTokens.length === item.tokens.length
    );
  }

  return false;
}

function reportQuizCompleted(state) {
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:quiz_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    messageId: state.messageId,
    responses: state.itemStates.map((itemState, index) =>
      buildQuizResponsePayload(state.block.items[index], itemState),
    ),
  });
}

function reportQuizAborted(state) {
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:quiz_aborted', {
    blockIndex: state.blockIndex,
    conversationId,
    messageId: state.messageId,
    responses: state.itemStates.map((itemState, index) =>
      buildQuizResponsePayload(state.block.items[index], itemState),
    ),
  });
}

function buildQuizResponsePayload(item, itemState) {
  if (
    item.kind === 'open_text' ||
    item.kind === 'translate_to_english' ||
    item.kind === 'understand_in_spanish'
  ) {
    return {
      text: itemState.text || '',
    };
  }

  if (
    item.kind === 'fill_in_the_blank_input' ||
    item.kind === 'fill_in_the_blank_choice'
  ) {
    return {
      values: Array.isArray(itemState.values) ? itemState.values : [],
    };
  }

  if (item.kind === 'multiple_choice') {
    return {
      selectedOptions:
        itemState.selectedOptions instanceof Set
          ? Array.from(itemState.selectedOptions)
          : [],
    };
  }

  if (item.kind === 'matching_pairs') {
    return {
      pairs: Array.isArray(itemState.pairs) ? itemState.pairs : [],
    };
  }

  if (item.kind === 'unscramble_sentence') {
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

function createMatchingPairsCard(block, context) {
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

  leftColumn.append(leftTitle, leftList);
  rightColumn.append(rightTitle, rightList);
  columns.append(leftColumn, rightColumn);
  section.append(label, prompt, columns, status);

  section.addEventListener('click', (event) => {
    const button = event.target.closest('.matching-pairs-item');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    handleMatchingPairsSelection(section, state, button);
  });

  matchingExerciseStates.set(exerciseKey, state);
  renderMatchingPairsState(section, state);
  return section;
}

function handleMatchingPairsSelection(section, state, button) {
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
      reportMatchingPairsCompleted(state);
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
    button.disabled = isLocked || state.completed;
  }

  const status = section.querySelector('.matching-pairs-status');
  if (!status) {
    return;
  }

  if (state.completed) {
    status.textContent = 'Completado. Buen trabajo.';
    status.classList.add('is-success');
    return;
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

function reportMatchingPairsCompleted(state) {
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:matching_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    incorrectAttempts: state.incorrectAttempts,
    messageId: state.messageId,
    totalAttempts: state.totalAttempts,
  });
}

function createFillInTheBlankCard(block, context) {
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
      input.autocomplete = 'off';
      input.autocorrect = 'off';
      input.autocapitalize = 'none';
      input.spellcheck = false;
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
  confirmButton.className = 'exercise-confirm-button';
  confirmButton.type = 'button';
  confirmButton.setAttribute('aria-label', 'Confirmar respuesta');
  confirmButton.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
  confirmButton.addEventListener('click', () => {
    handleFillInTheBlankSubmit(section, state);
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

function handleFillInTheBlankSubmit(section, state) {
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
    reportFillInTheBlankCompleted(state);
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

function reportFillInTheBlankCompleted(state) {
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

function splitSentenceByBlanks(sentence, placeholderToken = '___') {
  const segments =
    typeof sentence === 'string' ? sentence.split(placeholderToken) : [];
  return segments.length >= 2 ? segments : null;
}

function fillSentenceBlanks(sentence, values, placeholderToken = '___') {
  if (typeof sentence !== 'string' || !sentence.includes(placeholderToken)) {
    return '';
  }

  let nextSentence = sentence;
  for (const value of values) {
    nextSentence = nextSentence.replace(placeholderToken, value.trim());
  }

  return nextSentence.replace(/\s+/g, ' ').trim();
}

function normalizeExerciseAnswer(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function seededShuffle(items, seedText) {
  const array = [...items];
  let seed = hashString(seedText || 'seed');

  for (let index = array.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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

function createMultipleChoiceCard(block, context) {
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
    handleMultipleChoiceSubmit(section, state);
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

function handleMultipleChoiceSubmit(section, state) {
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
    reportMultipleChoiceCompleted(state);
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

function reportMultipleChoiceCompleted(state) {
  if (!socket || state.reported || !conversationId || !state.messageId) {
    return;
  }

  state.reported = true;
  socket.emit('exercise:multiple_choice_completed', {
    blockIndex: state.blockIndex,
    conversationId,
    incorrectSelections: state.incorrectSelections,
    messageId: state.messageId,
    selectedOptions: Array.from(state.selectedOptions),
    totalAttempts: state.totalAttempts,
  });
}

function createUnscrambleSentenceCard(block, context) {
  if (!Array.isArray(block.tokens) || !Array.isArray(block.answers)) {
    return null;
  }

  const tokens = block.tokens
    .filter((token) => typeof token === 'string')
    .map((token) => token.trim())
    .filter(Boolean);
  const answers = block.answers
    .filter((answer) => typeof answer === 'string')
    .map((answer) => answer.trim())
    .filter(Boolean);
  if (tokens.length < 2 || answers.length === 0) {
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
    answersNormalized: new Set(answers.map(normalizeExerciseAnswer)),
    availableTokens: seededShuffle(tokens, `${exerciseKey}:unscramble`),
    blockIndex,
    completed: Boolean(context.result?.completedAt),
    completedSentence:
      typeof context.result?.completedSentence === 'string'
        ? context.result.completedSentence
        : '',
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
    state.selectedTokens = tokenizeSentence(state.completedSentence);
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
    handleUnscrambleSentenceSubmit(section, state);
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

function handleUnscrambleSentenceSubmit(section, state) {
  if (state.completed || state.selectedTokens.length === 0) {
    return;
  }

  state.totalAttempts += 1;
  const completedSentence = state.selectedTokens.join(' ').replace(/\s+/g, ' ').trim();
  if (state.answersNormalized.has(normalizeExerciseAnswer(completedSentence))) {
    state.completed = true;
    state.completedSentence = completedSentence;
    state.statusText = '';
    state.statusTone = '';
    renderUnscrambleSentenceState(section, state);
    reportUnscrambleSentenceCompleted(state);
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

function reportUnscrambleSentenceCompleted(state) {
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
    selectedTokens: state.selectedTokens,
    totalAttempts: state.totalAttempts,
  });
}

function createExerciseConfirmButton(onClick) {
  const confirmButton = document.createElement('button');
  confirmButton.className = 'exercise-confirm-button';
  confirmButton.type = 'button';
  confirmButton.setAttribute('aria-label', 'Confirmar respuesta');
  confirmButton.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
  confirmButton.addEventListener('click', onClick);
  return confirmButton;
}

function flashExerciseError(section) {
  section.classList.add('is-error');
  window.setTimeout(() => {
    section.classList.remove('is-error');
  }, 620);
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function tokenizeSentence(sentence) {
  return typeof sentence === 'string'
    ? sentence.split(/\s+/).map((part) => part.trim()).filter(Boolean)
    : [];
}

function escapeHtml(value) {
  const wrapper = document.createElement('div');
  wrapper.textContent = value;
  return wrapper.innerHTML;
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

function resizeComposerInput() {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${inputEl.scrollHeight}px`;
}

function setComposerEnabled(enabled) {
  inputEl.disabled = !enabled;
  syncSendButton();
}

function syncSendButton() {
  if (!sendButtonEl) {
    return;
  }

  const isStopMode = isAssistantBusy;
  sendButtonEl.disabled = isStopMode ? isAssistantStopping : inputEl.disabled;
  sendButtonEl.title = isStopMode ? 'Detener' : 'Enviar';
  sendButtonEl.setAttribute('aria-label', isStopMode ? 'Detener' : 'Enviar');
  sendButtonEl.dataset.mode = isStopMode ? 'stop' : 'send';
  sendButtonEl.innerHTML = isStopMode
    ? '<i class="bi bi-stop-fill" aria-hidden="true"></i>'
    : '<i class="bi bi-send" aria-hidden="true"></i>';
}

function focusComposer() {
  if (inputEl.disabled) {
    return;
  }

  requestAnimationFrame(() => {
    inputEl.focus({ preventScroll: true });
  });
}

function scrollToBottom() {
  const scrollTarget = chatPaneEl || messagesEl;
  scrollTarget.scrollTop = scrollTarget.scrollHeight;
}

if (isInitiallyAuthenticated) {
  pendingBootGuestDraft = consumeGuestDraft();
  setComposerEnabled(true);
  focusComposer();
} else {
  showGuestGreeting();
}

function flushPendingBootGuestDraft() {
  if (!isInitiallyAuthenticated || !hasHandledInitialConversationReady) {
    return;
  }

  const guestDraft = pendingBootGuestDraft.trim();
  if (!guestDraft || isAssistantBusy) {
    return;
  }

  pendingBootGuestDraft = '';
  inputEl.value = guestDraft;
  resizeComposerInput();
  window.setTimeout(() => {
    sendMessage();
  }, 0);
}
