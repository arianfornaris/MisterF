import { ChatState } from './app/ChatState.js';
import { createFillInTheBlankCard } from './cards/createFillInTheBlankCard.js';
import { createMultipleChoiceCard } from './cards/multipleChoiceCard.js';
import { createMatchingPairsCard } from './cards/createMatchingPairsCard.js';
import { createQuizCard } from './cards/createQuizCard.js';
import { createSentenceEvaluationCard } from './cards/createSentenceEvaluationCard.js';
import { createUnscrambleSentenceCard } from './cards/unscrambleSentenceCard.js';
import { chatSocketEvents } from './constants/events.js';
import { ChatSocketClient } from './socket/ChatSocketClient.js';
import { renderMarkdown } from './utils/formatting.js';
import { disableTextAssist } from './utils/textAssist.js';
import { formatConversationDates } from './utils/dates.js';
import { normalizeModelTier } from './utils/modelTier.js';
import { consumeGuestDraft, getGuestDraft, preserveGuestDraft } from './utils/storage.js';
import { ComposerView } from './ui/ComposerView.js';
import { ConversationListView } from './ui/ConversationListView.js';
import { MessageRenderer } from './ui/MessageRenderer.js';
import { PracticeModuleView } from './ui/PracticeModuleView.js';
import {
  tokenizeSentence,
} from './shared/exerciseUtils.js';
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
const modelTierButtonEl = document.querySelector('[data-model-tier-button]');
const modelTierLabelEl = document.querySelector('[data-model-tier-label]');
const modelTierOptionEls = document.querySelectorAll('[data-model-tier-option]');
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
const chatState = new ChatState({ conversationId: initialConversationId });
const socketClient = new ChatSocketClient(
  shouldInitializeSocket ? io({ auth: { token: socketAuthToken } }) : null,
);
const socket = socketClient.raw;
const llmContextCircleRadius = llmContextCircleEl
  ? Number.parseFloat(llmContextCircleEl.getAttribute('r') || '0')
  : 0;
const llmContextCircleCircumference = 2 * Math.PI * llmContextCircleRadius;

disableComposerTextAssist();
initializeLlmContextMeter();
initializeStaticMarkdown();
initializePracticeModuleSharingUi();
initializePracticeModuleCollectionForms();
initializeCollectionModulePickers();

let conversationId = chatState.conversationId;
let streamingBubble = null;
let isAssistantBusy = false;
let pendingDeleteTarget = null;
let activeUserMessageId = null;
let pendingPracticeModuleStart = false;
let isAssistantStopping = false;
let isGuestPromptPending = false;
let guestPromptTimerId = 0;
let disconnectNoticeTimerId = 0;
const pendingSentenceEvaluations = chatState.pendingSentenceEvaluations;
let pendingTranslatorSelection = '';
let userInputHistory = [];
let userInputHistoryIndex = -1;
let userInputDraftBeforeHistory = '';
let pendingBootGuestDraft = '';
let hasHandledInitialConversationReady = false;
let toolStatusRow = null;
const matchingExerciseStates = chatState.matchingExerciseStates;
const practiceModuleView = new PracticeModuleView({
  buttonEl: practiceModuleStartButtonEl,
  descriptionEl: practiceModuleStartDescriptionEl,
  panelEl: practiceModuleStartPanelEl,
  statusEl: practiceModuleStartStatusEl,
  titleEl: practiceModuleStartTitleEl,
});
const conversationListView = new ConversationListView({
  buildConversationPath,
  confirmDeleteButtonEl: confirmDeleteConversationButtonEl,
  deleteModalEl: deleteConversationModalEl,
  deleteTitleEl: deleteConversationTitleEl,
  onDelete: ({ conversationId }) => {
    socket?.emit('conversation:delete', { conversationId });
  },
  onRename: ({ conversationId, title }) => {
    socket?.emit('conversation:rename', { conversationId, title });
  },
  panelEl: conversationPanelEl,
});
const composerView = new ComposerView({
  inputEl,
  modelTierButtonEl,
  modelTierLabelEl,
  sendButtonEl,
});
const messageRenderer = new MessageRenderer({
  appendMessage: (...args) => appendMessage(...args),
  appendStoredMessage: (...args) => appendStoredMessage(...args),
  renderSentenceEvaluationOnLastAssistant: (...args) =>
    renderSentenceEvaluationOnLastAssistant(...args),
  updateRenderedMessage: (...args) => updateRenderedMessage(...args),
});

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

if (socket) {
  socketClient.on('connect', () => {
    if (shouldAutoJoinSocketThread) {
      socketClient.emit(chatSocketEvents.join, { conversationId });
    }
  });

  socketClient.on('auth:required', ({ message }) => {
    showAuthRequiredMessage(message);
  });

  socketClient.on('disconnect', (reason) => {
    clearPendingDisconnectNotice();
    disconnectNoticeTimerId = window.setTimeout(() => {
      appendEphemeralError(
        `Se perdió la conexión con el servidor. Intentando reconectar. (${reason})`,
      );
      disconnectNoticeTimerId = 0;
    }, 3000);
    setComposerEnabled(false);
  });

  socketClient.on('connect_error', (error) => {
    if (error.message === 'authentication_required') {
      showAuthRequiredMessage();
      return;
    }

    appendEphemeralError(
      'No puedo conectar con el servidor en este momento. Revisa PM2 o vuelve a intentar en unos segundos.',
    );
    setComposerEnabled(false);
  });

  socketClient.on(chatSocketEvents.ready, (payload) => {
    clearPendingDisconnectNotice();
    hasHandledInitialConversationReady = true;
    conversationId = payload.conversationId;
    setSelectedModelTier(payload.conversation?.modelTier || 'regular');
    conversationListView.upsert(payload.conversation);
    conversationListView.markActive(conversationId);
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
    practiceModuleView.render(
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

  socketClient.on(chatSocketEvents.promoted, (payload) => {
    conversationId = payload.conversationId;
    window.location.replace(buildCurrentChatPath(conversationId));
  });

  socketClient.on('conversation:renamed', (payload) => {
    conversationListView.update(payload.conversation);
    conversationListView.markActive(conversationId);
  });

  socketClient.on('conversation:updated', (payload) => {
    conversationListView.update(payload.conversation, { moveToTop: true });
    conversationListView.markActive(conversationId);
  });

  socketClient.on(chatSocketEvents.deleted, (payload) => {
    conversationListView.remove(payload.conversationId);

    if (payload.conversationId === conversationId || payload.wasActive) {
      window.location.assign('/');
    }
  });

  socketClient.on(chatSocketEvents.error, ({ message }) => {
    appendEphemeralError(message || 'No pude actualizar la conversación.');
  });

  socketClient.on('translator:result', ({ translation }) => {
    setTranslatorBusy(false);
    translatorResultEl.textContent = translation?.translatedText || '';
  });

  socketClient.on('translator:error', ({ message }) => {
    setTranslatorBusy(false);
    translatorResultEl.textContent =
      message || 'No pude traducir el texto en este momento.';
  });

  socketClient.on('llm:request_tokens', (payload) => {
    if (!isCurrentConversationPayload(payload)) {
      return;
    }

    logLlmRequestTokens(payload.usage);
    updateLlmContextMeter(payload.usage);
  });

  socketClient.on('llm:credit_exhausted', ({ message }) => {
    showCreditExhaustedModal(message);
  });

  socketClient.on('message:created', (message) => {
    const bubble = messageRenderer.appendStoredMessage(message);
    if (message.role === 'user') {
      activeUserMessageId = message.id;
    } else {
      markTutorMessageArrived(bubble.closest('.message-row'));
    }
    scrollToBottom();
  });

  socketClient.on('assistant:start', () => {
    clearPendingDisconnectNotice();
    isAssistantBusy = true;
    isAssistantStopping = false;
    pendingPracticeModuleStart = false;
    practiceModuleView.render(null, { visible: false });
    setToolStatus('');
    setComposerEnabled(false);
    streamingBubble = messageRenderer.appendMessage('model', '', { streaming: true });
    scrollToBottom();
  });

  socketClient.on('assistant:tool_status', ({ label }) => {
    setToolStatus(typeof label === 'string' ? label : '');
  });

  socketClient.on('assistant:chunk', ({ chunk }) => {
    if (!streamingBubble) {
      streamingBubble = messageRenderer.appendMessage('model', '', { streaming: true });
    }

    const rawContent = `${streamingBubble.dataset.rawContent ?? ''}${chunk}`;
    setMessageContent(streamingBubble, rawContent);
    scrollToBottom();
  });

  socketClient.on('assistant:done', (message) => {
    if (!message) {
      streamingBubble?.remove();
      streamingBubble = null;
      setToolStatus('');
      isAssistantBusy = false;
      isAssistantStopping = false;
      practiceModuleView.render(null, { visible: false });
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
      const bubble = messageRenderer.appendStoredMessage(message, { sentenceEvaluation });
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
    practiceModuleView.render(null, { visible: false });
    setComposerEnabled(true);
    focusComposer();
    scrollToBottom();
  });

  socketClient.on('assistant:stopped', () => {
    if (streamingBubble) {
      streamingBubble.closest('.message-row')?.remove();
      streamingBubble = null;
    }

    setToolStatus('');
    isAssistantBusy = false;
    isAssistantStopping = false;
    practiceModuleView.render(null, { visible: false });
    setComposerEnabled(!pendingPracticeModuleStart);
    focusComposer();
    scrollToBottom();
  });

  socketClient.on('assistant:error', ({ message }) => {
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

  socketClient.on('message:evaluation_updated', ({ message }) => {
    if (!message?.id) {
      return;
    }

    pendingSentenceEvaluations.set(message.id, message.metadata?.sentenceEvaluation);

    if (!isAssistantBusy) {
      messageRenderer.renderSentenceEvaluationOnLastAssistant(
        message.metadata?.sentenceEvaluation,
      );
      scrollToBottom();
    }
  });

  socketClient.on('message:updated', (message) => {
    if (!message?.id) {
      return;
    }

    messageRenderer.updateRenderedMessage(message);
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

conversationListView.configureExistingItems();

newConversationButtonEl?.addEventListener('click', (event) => {
  event.preventDefault();
  startNewConversation();
});

practiceModuleStartButtonEl?.addEventListener('click', () => {
  startPracticeModuleConversation();
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

for (const button of modelTierOptionEls) {
  button.addEventListener('click', () => {
    const tier = button.dataset.modelTierOption || 'regular';
    setSelectedModelTier(tier);
    if (socket && conversationId) {
      socket.emit(chatSocketEvents.modelTier, {
        conversationId,
        modelTier: normalizeModelTier(tier),
      });
    }
  });
}

formatConversationDates();

function disableComposerTextAssist() {
  if (inputEl) {
    disableTextAssist(inputEl);
  }
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
  if (!content || isAssistantBusy || isGuestPromptPending) {
    return;
  }

  if (!socket) {
    rememberUserInput(content);
    appendMessage('user', content);
    preserveGuestDraft(content);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    resetUserInputHistoryNavigation();
    showGuestAuthPromptWithDelay();
    return;
  }

  rememberUserInput(content);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  resetUserInputHistoryNavigation();
  setComposerEnabled(false);
  socket.emit(chatSocketEvents.send, {
    content,
    conversationId,
    modelTier: getSelectedModelTier(),
  });
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

function initializePracticeModuleCollectionForms() {
  const formEls = document.querySelectorAll('[data-practice-module-add-to-collection-form]');
  if (!formEls.length) {
    return;
  }

  for (const formEl of formEls) {
    const selectEl = formEl.querySelector('[data-practice-module-collection-select]');
    if (!(selectEl instanceof HTMLSelectElement)) {
      continue;
    }

    const syncAction = () => {
      const selectedOption = selectEl.selectedOptions[0];
      const action = selectedOption?.dataset.action;
      if (action) {
        formEl.setAttribute('action', action);
      }
    };

    syncAction();
    selectEl.addEventListener('change', syncAction);
  }
}

function initializeCollectionModulePickers() {
  const pickerForms = document.querySelectorAll('[data-collection-module-picker]');
  if (!pickerForms.length) {
    return;
  }

  for (const formEl of pickerForms) {
    const filterEl = formEl.querySelector('[data-collection-module-filter]');
    const itemEls = Array.from(formEl.querySelectorAll('[data-collection-module-item]'));
    const emptyEl = formEl.querySelector('[data-collection-module-empty]');

    if (!(filterEl instanceof HTMLInputElement) || !itemEls.length) {
      continue;
    }

    const applyFilter = () => {
      const query = filterEl.value.trim().toLowerCase();
      let visibleCount = 0;

      for (const itemEl of itemEls) {
        const haystack = itemEl.getAttribute('data-search-text') || '';
        const isVisible = !query || haystack.includes(query);
        itemEl.classList.toggle('d-none', !isVisible);
        if (isVisible) {
          visibleCount += 1;
        }
      }

      if (emptyEl) {
        emptyEl.classList.toggle('d-none', visibleCount > 0);
      }
    };

    filterEl.addEventListener('input', applyFilter);
    applyFilter();
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
    practiceModuleView.render(null, { visible: false });
  }
  setComposerEnabled(false);
  socket.emit('practice-module:start', {
    conversationId,
    modelTier: getSelectedModelTier(),
  });
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

function showGuestAuthPrompt() {
  const bubble = appendMessage(
    'model',
    'Perfecto. Para guardar tu práctica y continuar esta conversación, [inicia sesión](/login) o [crea una cuenta](/signup). Cuando regreses, continuaré desde tu primer mensaje.',
  );
  markTutorMessageArrived(bubble.closest('.message-row'));
  setComposerEnabled(true);
  resizeComposerInput();
  focusComposer();
  scrollToBottom();
}

function showGuestAuthPromptWithDelay() {
  isGuestPromptPending = true;
  setComposerEnabled(false);
  const typingBubble = appendMessage('model', '', { streaming: true });
  scrollToBottom();

  const delayMs = 850 + Math.floor(Math.random() * 500);
  guestPromptTimerId = window.setTimeout(() => {
    typingBubble.closest('.message-row')?.remove();
    showGuestAuthPrompt();
    isGuestPromptPending = false;
    guestPromptTimerId = 0;
  }, delayMs);
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
      const card = createMatchingPairsCard(
        block,
        {
          blockIndex,
          matchingResult: getMatchingResultForBlock(metadata, blockIndex),
          messageId: options.messageId,
        },
        {
          getConversationId: () => conversationId,
          getSelectedModelTier,
          getSocket: () => socket,
          matchingExerciseStates,
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
          fillResult: getFillInTheBlankResultForBlock(metadata, blockIndex),
          messageId: options.messageId,
        },
        {
          getConversationId: () => conversationId,
          getSelectedModelTier,
          getSocket: () => socket,
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
          result: getExerciseResultForBlock(metadata, 'multipleChoiceResults', blockIndex),
        },
        {
          getConversationId: () => conversationId,
          getSelectedModelTier,
          getSocket: () => socket,
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
          result: getExerciseResultForBlock(metadata, 'unscrambleSentenceResults', blockIndex),
        },
        {
          getConversationId: () => conversationId,
          getSelectedModelTier,
          getSocket: () => socket,
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
          getConversationId: () => conversationId,
          getSelectedModelTier,
          getSocket: () => socket,
        },
      );
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
  const card = createSentenceEvaluationCard({
    createMessageActionButton,
    createSentencePartsElement,
    element,
    evaluation,
    findEvaluationTargetUserContent,
    findFirstIncorrectEvaluationPart,
    isValidSentenceEvaluation,
    putMessageBackInComposer,
  });
  if (card) {
    element.append(card);
  }
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

function putMessageBackInComposer(content, options = {}) {
  inputEl.value = content;
  resizeComposerInput();
  focusComposer();

  const selectionText = options.preferredSelectionText?.trim() || '';
  if (!selectionText) {
    moveCaretToEnd(inputEl);
    return;
  }

  const startIndex = content.indexOf(selectionText);
  if (startIndex < 0) {
    moveCaretToEnd(inputEl);
    return;
  }

  const endIndex = startIndex + selectionText.length;
  requestAnimationFrame(() => {
    inputEl.focus({ preventScroll: true });
    inputEl.setSelectionRange(startIndex, endIndex);
  });
}

function findEvaluationTargetUserContent(element) {
  const row = element.closest('.message-row.is-model');
  let current = row?.previousElementSibling ?? null;

  while (current) {
    if (
      current instanceof HTMLDivElement &&
      current.classList.contains('message-row') &&
      current.classList.contains('is-user')
    ) {
      const bubble = current.querySelector('.message-bubble');
      return bubble?.dataset.rawContent || '';
    }

    current = current.previousElementSibling;
  }

  return '';
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
  composerView.resize();
}

function setComposerEnabled(enabled) {
  composerView.enable(enabled, isAssistantBusy, isAssistantStopping);
}

function syncSendButton() {
  composerView.syncSendButton(isAssistantBusy, isAssistantStopping);
}

function focusComposer() {
  composerView.focus();
}

function scrollToBottom() {
  const scrollTarget = chatPaneEl || messagesEl;
  scrollTarget.scrollTop = scrollTarget.scrollHeight;
}

function getSelectedModelTier() {
  return composerView.getSelectedModelTier();
}

function setSelectedModelTier(value) {
  composerView.setSelectedModelTier(value);
}

function clearPendingDisconnectNotice() {
  if (!disconnectNoticeTimerId) {
    return;
  }

  window.clearTimeout(disconnectNoticeTimerId);
  disconnectNoticeTimerId = 0;
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
