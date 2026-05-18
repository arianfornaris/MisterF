import { ChatState } from './app/ChatState.js';
import { createChatRuntime } from './app/ChatRuntime.js';
import { chatSocketEvents } from './constants/events.js';
import { createTranslatorController } from './features/translator.js';
import { ChatSocketClient } from './socket/ChatSocketClient.js';
import { registerChatSocketHandlers } from './socket/registerChatSocketHandlers.js';
import { disableTextAssist } from './utils/textAssist.js';
import { formatConversationDates } from './utils/dates.js';
import { normalizeModelTier } from './utils/modelTier.js';
import { consumeGuestDraft, getGuestDraft, preserveGuestDraft } from './utils/storage.js';
import { ComposerView } from './ui/ComposerView.js';
import { ConversationListView } from './ui/ConversationListView.js';
import { PracticeModuleView } from './ui/PracticeModuleView.js';
import { createTutorMessageRenderer } from './ui/TutorMessageRenderer.js';
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
const isInitiallyAuthenticated = document.body.dataset.authenticated === 'true';
const chatMode = 'tutor';
const socketAuthToken = document.body.dataset.socketAuthToken || '';
const guestInitialGreeting = document.body.dataset.guestInitialGreeting || '';
const initialConversationId =
  document.body.dataset.initialConversationId?.trim() || '';
const shouldInitializeSocket = isInitiallyAuthenticated;
const shouldAutoJoinSocketThread = true;
const chatState = new ChatState({ conversationId: initialConversationId });
const socketClient = new ChatSocketClient(
  shouldInitializeSocket ? io({ auth: { token: socketAuthToken } }) : null,
);
const socket = socketClient.raw;
const llmContextCircleRadius = llmContextCircleEl
  ? Number.parseFloat(llmContextCircleEl.getAttribute('r') || '0')
  : 0;
const llmContextCircleCircumference = 2 * Math.PI * llmContextCircleRadius;

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
const tutorMessageRenderer = createTutorMessageRenderer({
  getConversationId: () => conversationId,
  getSelectedModelTier,
  getSocket: () => socket,
  matchingExerciseStates,
  messagesEl,
  putMessageBackInComposer,
  scrollToBottom,
});
const runtime = createChatRuntime({
  chatSocketEvents,
  focusComposer,
  getConversationId: () => conversationId,
  getDisconnectNoticeTimerId: () => disconnectNoticeTimerId,
  getHasHandledInitialConversationReady: () => hasHandledInitialConversationReady,
  getIsAssistantBusy: () => isAssistantBusy,
  getIsAssistantStopping: () => isAssistantStopping,
  getIsGuestPromptPending: () => isGuestPromptPending,
  getPendingBootGuestDraft: () => pendingBootGuestDraft,
  getSelectedModelTier,
  getSocket: () => socket,
  getStreamingBubble: () => streamingBubble,
  getToolStatusRow: () => toolStatusRow,
  getUserInputDraftBeforeHistory: () => userInputDraftBeforeHistory,
  getUserInputHistory: () => userInputHistory,
  getUserInputHistoryIndex: () => userInputHistoryIndex,
  guestInitialGreeting,
  inputEl,
  isInitiallyAuthenticated,
  llmContextCircleCircumference,
  llmContextCircleEl,
  llmContextMeterEl,
  markTutorMessageArrived: (...args) => tutorMessageRenderer.markTutorMessageArrived(...args),
  messagesEl,
  practiceModuleView,
  preserveGuestDraft,
  renderer: tutorMessageRenderer,
  resizeComposerInput,
  scrollToBottom,
  setComposerEnabled,
  setConversationId: (value) => {
    conversationId = value;
  },
  setDisconnectNoticeTimerId: (value) => {
    disconnectNoticeTimerId = value;
  },
  setGuestPromptTimerId: (value) => {
    guestPromptTimerId = value;
  },
  setHasHandledInitialConversationReady: (value) => {
    hasHandledInitialConversationReady = value;
  },
  setIsAssistantStopping: (value) => {
    isAssistantStopping = value;
  },
  setIsGuestPromptPending: (value) => {
    isGuestPromptPending = value;
  },
  setPendingBootGuestDraft: (value) => {
    pendingBootGuestDraft = value;
  },
  setPendingPracticeModuleStart: (value) => {
    pendingPracticeModuleStart = value;
  },
  setStreamingBubble: (value) => {
    streamingBubble = value;
  },
  setToolStatusRow: (value) => {
    toolStatusRow = value;
  },
  setUserInputDraftBeforeHistory: (value) => {
    userInputDraftBeforeHistory = value;
  },
  setUserInputHistoryIndex: (value) => {
    userInputHistoryIndex = value;
  },
  showCreditExhaustedModal,
  syncSendButton,
  toolStatusEl,
});
const translatorController = createTranslatorController({
  copyTextToClipboard: (...args) => tutorMessageRenderer.copyTextToClipboard(...args),
  getPendingTranslatorSelection: () => pendingTranslatorSelection,
  getSocket: () => socket,
  setPendingTranslatorSelection: (value) => {
    pendingTranslatorSelection = value;
  },
  translatorCopyButtonEls,
  translatorFormEl,
  translatorInputEl,
  translatorModalEl,
  translatorOpenButtonEls,
  translatorResultEl,
  translatorSubmitEl,
});

disableComposerTextAssist();
tutorMessageRenderer.initializeStaticMarkdown();
runtime.initializeLlmContextMeter();

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

if (socket) {
  registerChatSocketHandlers({
    chatSocketEvents,
    conversationListView,
    focusComposer,
    getActiveUserMessageId: () => activeUserMessageId,
    getConversationId: () => conversationId,
    getIsAssistantBusy: () => isAssistantBusy,
    getPendingPracticeModuleStart: () => pendingPracticeModuleStart,
    getStreamingBubble: () => streamingBubble,
    messagesEl,
    pendingSentenceEvaluations,
    practiceModuleView,
    renderer: tutorMessageRenderer,
    runtime,
    scrollToBottom,
    setActiveUserMessageId: (value) => {
      activeUserMessageId = value;
    },
    setComposerEnabled,
    setConversationId: (value) => {
      conversationId = value;
    },
    setDisconnectNoticeTimerId: (value) => {
      disconnectNoticeTimerId = value;
    },
    setHasHandledInitialConversationReady: (value) => {
      hasHandledInitialConversationReady = value;
    },
    setIsAssistantBusy: (value) => {
      isAssistantBusy = value;
    },
    setIsAssistantStopping: (value) => {
      isAssistantStopping = value;
    },
    setPendingPracticeModuleStart: (value) => {
      pendingPracticeModuleStart = value;
    },
    setSelectedModelTier,
    setStreamingBubble: (value) => {
      streamingBubble = value;
    },
    setUserInputHistory: (value) => {
      userInputHistory = value;
    },
    shouldAutoJoinSocketThread,
    showCreditExhaustedModal,
    socketClient,
    translatorController,
  });
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isAssistantBusy) {
    runtime.stopAssistantResponse();
    return;
  }

  runtime.sendMessage();
});

inputEl.addEventListener('keydown', (event) => {
  if (runtime.handleUserInputHistoryKeydown(event)) {
    return;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    runtime.sendMessage();
  }
});

inputEl.addEventListener('input', () => {
  resizeComposerInput();
});

conversationListView.configureExistingItems();

newConversationButtonEl?.addEventListener('click', (event) => {
  event.preventDefault();
  runtime.startNewConversation();
});

practiceModuleStartButtonEl?.addEventListener('click', () => {
  runtime.startPracticeModuleConversation();
});

translatorController.bindUi();

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

function buildConversationPath(nextConversationId) {
  return nextConversationId
    ? `/c/${encodeURIComponent(nextConversationId)}`
    : '/';
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

  tutorMessageRenderer.appendMessage('error', displayMessage);
  scrollToBottom();
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

if (isInitiallyAuthenticated) {
  pendingBootGuestDraft = consumeGuestDraft();
  setComposerEnabled(true);
  focusComposer();
} else {
  runtime.showGuestGreeting();
}
