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
import { PracticeGuideView } from './ui/PracticeGuideView.js';
import { TutorPlanView } from './ui/TutorPlanView.js';
import { createTutorMessageRenderer } from './ui/TutorMessageRenderer.js';
import {
  tokenizeSentence,
} from './shared/exerciseUtils.js';
const messagesEl = document.querySelector('#messages');
const chatPaneEl = document.querySelector('#chatPane');
const formEl = document.querySelector('#chatForm');
const inputEl = document.querySelector('#messageInput');
const practiceGuideStartPanelEl = document.querySelector('[data-practice-guide-start-panel]');
const practiceGuideStartTitleEl = document.querySelector('[data-practiceGuide-start-title]');
const practiceGuideStartDescriptionEl = document.querySelector(
  '[data-practiceGuide-start-description]',
);
const practiceGuideStartStatusEl = document.querySelector('[data-practice-guide-start-status]');
const practiceGuideStartButtonEl = document.querySelector('[data-practiceGuide-start-button]');
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
const closeTutorPlanModalEl = document.querySelector('#closeTutorPlanModal');
const confirmCloseTutorPlanButtonEl = document.querySelector('[data-confirm-close-tutor-plan]');
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
let pendingPracticeGuideStart = false;
let isAssistantStopping = false;
let isGuestPromptPending = false;
let guestPromptTimerId = 0;
let disconnectNoticeTimerId = 0;
let pendingTranslatorSelection = '';
let pendingTutorPlanClose = false;
let userInputHistory = [];
let userInputHistoryIndex = -1;
let userInputDraftBeforeHistory = '';
let pendingBootGuestDraft = '';
let hasHandledInitialConversationReady = false;
let toolStatusRow = null;
const matchingExerciseStates = chatState.matchingExerciseStates;
const practiceGuideView = new PracticeGuideView({
  buttonEl: practiceGuideStartButtonEl,
  descriptionEl: practiceGuideStartDescriptionEl,
  panelEl: practiceGuideStartPanelEl,
  statusEl: practiceGuideStartStatusEl,
  titleEl: practiceGuideStartTitleEl,
});
const tutorPlanView = new TutorPlanView({
  onCloseRequest: requestCloseTutorPlan,
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
let runtime;
const tutorMessageRenderer = createTutorMessageRenderer({
  getConversationId: () => conversationId,
  getSelectedModelTier,
  getSocket: () => socket,
  matchingExerciseStates,
  messagesEl,
  putMessageBackInComposer,
  scrollToBottom,
  sendMessageContent: (content, options) =>
    runtime?.sendMessageContent(content, options) ?? false,
});
runtime = createChatRuntime({
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
  practiceGuideView,
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
  setPendingPracticeGuideStart: (value) => {
    pendingPracticeGuideStart = value;
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

if (socket) {
  registerChatSocketHandlers({
    chatSocketEvents,
    conversationListView,
    focusComposer,
    getConversationId: () => conversationId,
    getPendingPracticeGuideStart: () => pendingPracticeGuideStart,
    getStreamingBubble: () => streamingBubble,
    messagesEl,
    practiceGuideView,
    renderer: tutorMessageRenderer,
    runtime,
    scrollToBottom,
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
    setPendingPracticeGuideStart: (value) => {
      pendingPracticeGuideStart = value;
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

confirmCloseTutorPlanButtonEl?.addEventListener('click', () => {
  if (!pendingTutorPlanClose) {
    return;
  }

  pendingTutorPlanClose = false;
  window.bootstrap?.Modal.getInstance(closeTutorPlanModalEl)?.hide();
  closeTutorPlan();
});

closeTutorPlanModalEl?.addEventListener('hidden.bs.modal', () => {
  pendingTutorPlanClose = false;
});

practiceGuideStartButtonEl?.addEventListener('click', () => {
  runtime.startPracticeGuideConversation();
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

function requestCloseTutorPlan(plan) {
  if (!conversationId || isAssistantBusy) {
    return;
  }

  if (isTutorPlanComplete(plan)) {
    closeTutorPlan();
    return;
  }

  pendingTutorPlanClose = true;
  if (closeTutorPlanModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(closeTutorPlanModalEl).show();
    return;
  }

  closeTutorPlan();
}

function closeTutorPlan() {
  if (!conversationId || !socket) {
    return;
  }

  socket.emit('tutor_plan:close', { conversationId });
}

function isTutorPlanComplete(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  return steps.length > 0 && steps.every((step) => (
    step?.status === 'done' || step?.status === 'skipped'
  ));
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


function renderPracticeGuideStartPanel(practiceGuide, options = {}) {
  if (
    !practiceGuideStartPanelEl ||
    !practiceGuideStartTitleEl ||
    !practiceGuideStartDescriptionEl ||
    !practiceGuideStartButtonEl ||
    !practiceGuideStartStatusEl
  ) {
    return;
  }

  const visible = Boolean(options.visible);
  const autoStarting = Boolean(options.autoStarting);

  if (!visible || !practiceGuide) {
    practiceGuideStartPanelEl.classList.add('d-none');
    practiceGuideStartTitleEl.textContent = '';
    practiceGuideStartDescriptionEl.textContent = '';
    practiceGuideStartStatusEl.classList.add('d-none');
    practiceGuideStartButtonEl.classList.remove('d-none');
    return;
  }

  practiceGuideStartTitleEl.textContent = autoStarting ? '' : practiceGuide.title || 'Guía de Práctica';
  practiceGuideStartDescriptionEl.textContent = autoStarting ? '' : practiceGuide.description || '';
  practiceGuideStartStatusEl.classList.toggle('d-none', !autoStarting);
  practiceGuideStartButtonEl.classList.toggle('d-none', autoStarting);
  practiceGuideStartPanelEl.classList.remove('d-none');
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
  setComposerEnabled(!pendingPracticeGuideStart);
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
