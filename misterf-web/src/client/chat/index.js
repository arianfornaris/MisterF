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
import { TutorPlanView } from './ui/TutorPlanView.js';
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
const tutorPlanPanelEl = document.querySelector('[data-tutor-plan-panel]');
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
const finalizeConversationModalEl = document.querySelector('#finalizeConversationModal');
const finalizeConversationFormEl = document.querySelector('[data-finalize-conversation-form]');
const finalizeCurrentConversationButtonEl = document.querySelector(
  '[data-finalize-current-conversation]',
);
const tutorReportPendingModalEl = document.querySelector('[data-tutor-report-pending-modal]');
const tutorReportPendingTitleEl = document.querySelector('[data-tutor-report-pending-title]');
const translatorModalEl = document.querySelector('#translatorModal');
const translatorFormEl = document.querySelector('#translatorForm');
const translatorInputEl = document.querySelector('#translatorInput');
const translatorResultEl = document.querySelector('#translatorResult');
const translatorSubmitEl = document.querySelector('[data-translator-submit]');
const translatorOpenButtonEls = document.querySelectorAll('[data-open-translator]');
const translatorCopyButtonEls = document.querySelectorAll('[data-translator-copy]');
const creditModalEl = document.querySelector('#creditModal');
const creditBuyLinkEl = document.querySelector('[data-credit-buy-link]');
const creditMessageEl = document.querySelector('[data-credit-message]');
const isInitiallyAuthenticated = document.body.dataset.authenticated === 'true';
const chatMode = 'tutor';
const socketAuthToken = document.body.dataset.socketAuthToken || '';
const guestInitialGreeting = document.body.dataset.guestInitialGreeting || '';
const defaultModelTier = normalizeModelTier(document.body.dataset.activeProfileModelTier || 'regular');
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
const tutorPlanView = new TutorPlanView({
  panelEl: tutorPlanPanelEl,
});
const conversationListView = new ConversationListView({
  buildConversationPath,
  confirmDeleteButtonEl: confirmDeleteConversationButtonEl,
  deleteModalEl: deleteConversationModalEl,
  deleteTitleEl: deleteConversationTitleEl,
  onDelete: ({ conversationId }) => {
    socket?.emit('conversation:delete', { conversationId });
  },
  onFinalize: ({ conversationId }) => {
    openFinalizeConversationModal(conversationId);
  },
  onRename: ({ conversationId, title }) => {
    socket?.emit('conversation:rename', { conversationId, title });
  },
  panelEl: conversationPanelEl,
});
const composerView = new ComposerView({
  composerEl: formEl,
  inputEl,
  initialModelTier: defaultModelTier,
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
initializeTutorReportPendingForms();
initializeCreditExhaustedQueryModal();

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
    setCanFinalizeConversation,
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
    getDefaultModelTier: () => defaultModelTier,
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
    tutorPlanView,
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

finalizeCurrentConversationButtonEl?.addEventListener('click', () => {
  if (!conversationId || isAssistantBusy) {
    return;
  }

  openFinalizeConversationModal(conversationId);
});

practiceModuleStartButtonEl?.addEventListener('click', () => {
  runtime.startPracticeModuleConversation();
});

translatorController.bindUi();

formatConversationDates();

function disableComposerTextAssist() {
  if (inputEl) {
    disableTextAssist(inputEl);
  }
}

function buildConversationPath(nextConversationId) {
  const nextConversation =
    typeof nextConversationId === 'object' && nextConversationId !== null
      ? nextConversationId
      : { id: nextConversationId };

  return nextConversation.id
    ? `/c/${encodeURIComponent(nextConversation.id)}${nextConversation.closedAt ? '?tab=summary' : ''}`
    : '/';
}

function openFinalizeConversationModal(nextConversationId) {
  if (!nextConversationId || !finalizeConversationFormEl) {
    return;
  }

  finalizeConversationFormEl.setAttribute(
    'action',
    `/c/${encodeURIComponent(nextConversationId)}/finalize`,
  );

  if (finalizeConversationModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(finalizeConversationModalEl).show();
    return;
  }

  finalizeConversationFormEl.submit();
}

function initializeTutorReportPendingForms() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  finalizeConversationFormEl?.addEventListener('submit', () => {
    const submitButtonEl = finalizeConversationFormEl.querySelector('[data-finalize-conversation-submit]');
    if (submitButtonEl instanceof HTMLButtonElement) {
      submitButtonEl.disabled = true;
      submitButtonEl.textContent = submitButtonEl.dataset.loadingText || 'Generando resumen...';
    }

    showTutorReportPendingModal('Generando resumen...');
    if (finalizeConversationModalEl) {
      window.bootstrap.Modal.getOrCreateInstance(finalizeConversationModalEl).hide();
    }
  });

  for (const formEl of document.querySelectorAll('form[data-tutor-report-pending-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-tutor-report-pending-button]');
    formEl.addEventListener('submit', () => {
      const label = formEl.dataset.tutorReportPendingLabel || 'Procesando...';
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = label;
      }

      showTutorReportPendingModal(label);
    });
  }
}

function showTutorReportPendingModal(label) {
  if (tutorReportPendingTitleEl) {
    tutorReportPendingTitleEl.textContent = label || 'Procesando...';
  }

  if (tutorReportPendingModalEl && window.bootstrap?.Modal) {
    window.setTimeout(() => {
      window.bootstrap.Modal.getOrCreateInstance(tutorReportPendingModalEl).show();
    }, 120);
  }
}

function initializeCreditExhaustedQueryModal() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('credit') !== 'exhausted') {
    return;
  }

  showCreditExhaustedModal(params.get('creditMessage') || undefined);
}

function setCanFinalizeConversation(enabled) {
  if (!finalizeCurrentConversationButtonEl) {
    return;
  }

  finalizeCurrentConversationButtonEl.disabled = !enabled || isAssistantBusy;
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
  const buyPath = buildCreditsReturnPath();

  if (streamingBubble) {
    streamingBubble.closest('.message-row')?.remove();
    streamingBubble = null;
  }

  toolStatusRow?.remove();
  toolStatusRow = null;
  isAssistantBusy = false;
  isAssistantStopping = false;
  setComposerEnabled(!pendingPracticeModuleStart);
  appendCreditTutorMessage(buyPath);

  if (creditMessageEl) {
    creditMessageEl.textContent = displayMessage;
  }

  if (creditBuyLinkEl) {
    creditBuyLinkEl.href = buyPath;
  }

  if (creditModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(creditModalEl).show();
    return;
  }

  tutorMessageRenderer.appendMessage('error', displayMessage);
  scrollToBottom();
}

function appendCreditTutorMessage(buyPath) {
  const bubble = tutorMessageRenderer.appendMessage(
    'model',
    `Me quedé sin créditos para continuar esta práctica ahora mismo. Compra créditos y te traigo de vuelta aquí para seguir justo donde nos quedamos.\n\n[Comprar créditos](${buyPath})`,
  );
  const buyLink = Array.from(bubble.querySelectorAll('a')).find(
    (link) => link.getAttribute('href') === buyPath,
  );
  buyLink?.classList.add('btn', 'btn-primary', 'btn-sm', 'mt-2');
  bubble.closest('.message-row')?.setAttribute('data-credit-exhausted-message', 'true');
  scrollToBottom();
}

function buildCreditsReturnPath() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `/credits?returnTo=${encodeURIComponent(returnTo || '/')}`;
}

function putMessageBackInComposer(content, options = {}) {
  inputEl.value = content;
  resizeComposerInput();
  focusComposer();

  const isMobileDevice =
    window.matchMedia('(max-width: 991.98px)').matches &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

  const selectionText = options.preferredSelectionText?.trim() || '';
  if (!selectionText || isMobileDevice) {
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

function moveCaretToEnd(element) {
  if (!element) {
    return;
  }

  requestAnimationFrame(() => {
    const valueLength = element.value?.length ?? 0;
    element.focus({ preventScroll: true });
    element.setSelectionRange(valueLength, valueLength);
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
  setCanFinalizeConversation(Boolean(conversationId));
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
