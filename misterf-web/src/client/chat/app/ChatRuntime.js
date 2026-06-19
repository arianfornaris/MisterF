export function createChatRuntime(deps) {
  function sendMessage(options = {}) {
    const content = deps.inputEl.value.trim();
    if (!content || deps.getIsAssistantBusy() || deps.getIsGuestPromptPending()) {
      return false;
    }

    if (!deps.getSocket()) {
      if (options.exerciseSubmission) {
        return false;
      }

      rememberUserInput(content);
      deps.renderer.appendMessage('user', content);
      deps.preserveGuestDraft(content);
      deps.inputEl.value = '';
      deps.inputEl.style.height = 'auto';
      resetUserInputHistoryNavigation();
      showGuestAuthPromptWithDelay();
      return true;
    }

    if (options.rememberInput !== false) {
      rememberUserInput(content);
    }
    deps.inputEl.value = '';
    deps.inputEl.style.height = 'auto';
    resetUserInputHistoryNavigation();
    deps.setComposerEnabled(false);
    const payload = {
      content,
      conversationId: deps.getConversationId(),
      modelTier: deps.getSelectedModelTier(),
    };
    if (options.exerciseSubmission) {
      payload.exerciseSubmission = options.exerciseSubmission;
    }
    deps.getSocket().emit(deps.chatSocketEvents.send, payload);
    return true;
  }

  function sendMessageContent(content, options = {}) {
    const normalized = typeof content === 'string' ? content.trim() : '';
    if (!normalized || deps.getIsAssistantBusy() || deps.getIsGuestPromptPending()) {
      return false;
    }

    deps.inputEl.value = normalized;
    deps.resizeComposerInput();
    return sendMessage(options);
  }

  function stopAssistantResponse() {
    if (
      !deps.getSocket() ||
      !deps.getConversationId() ||
      !deps.getIsAssistantBusy() ||
      deps.getIsAssistantStopping()
    ) {
      return;
    }

    deps.setIsAssistantStopping(true);
    deps.syncSendButton();
    deps.getSocket().emit(deps.chatSocketEvents.cancel, {
      conversationId: deps.getConversationId(),
    });
  }

  function setToolStatus(text) {
    const nextText = typeof text === 'string' ? text.trim() : '';
    if (!nextText) {
      deps.getToolStatusRow()?.remove();
      deps.setToolStatusRow(null);
      if (deps.toolStatusEl) {
        deps.toolStatusEl.textContent = '';
        deps.toolStatusEl.classList.add('d-none');
      }
      return;
    }

    if (deps.toolStatusEl) {
      deps.toolStatusEl.textContent = '';
      deps.toolStatusEl.classList.add('d-none');
    }

    if (!deps.getToolStatusRow()) {
      const row = document.createElement('div');
      row.className = 'message-row is-tool-status';
      row.dataset.role = 'tool-status';

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble tool-status-bubble';

      const textNode = document.createElement('div');
      textNode.className = 'tool-status-text small text-body-secondary';

      bubble.append(textNode);
      row.append(bubble);
      const streamingRow = deps.getStreamingBubble()?.closest('.message-row');
      if (streamingRow?.parentElement === deps.messagesEl) {
        deps.messagesEl.insertBefore(row, streamingRow);
      } else {
        deps.messagesEl.append(row);
      }
      deps.setToolStatusRow(row);
    }

    const bubble = deps.getToolStatusRow()?.querySelector('.tool-status-bubble');
    if (bubble) {
      const textNode = bubble.querySelector('.tool-status-text');
      if (textNode) {
        textNode.textContent = nextText;
      }
    }
    deps.scrollToBottom();
  }

  function handleUserInputHistoryKeydown(event) {
    if (
      !deps.inputEl ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
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
    if (!deps.inputEl || !deps.getUserInputHistory().length) {
      return false;
    }

    const hasDraft = deps.inputEl.value.trim().length > 0;
    if (hasDraft && deps.getUserInputHistoryIndex() === -1) {
      return false;
    }

    const selectionStart = deps.inputEl.selectionStart ?? 0;
    const selectionEnd = deps.inputEl.selectionEnd ?? 0;
    if (selectionStart !== selectionEnd) {
      return false;
    }

    if (direction === 'up') {
      const textBeforeCaret = deps.inputEl.value.slice(0, selectionStart);
      return !textBeforeCaret.includes('\n');
    }

    const textAfterCaret = deps.inputEl.value.slice(selectionEnd);
    return !textAfterCaret.includes('\n');
  }

  function navigateUserInputHistory(step) {
    if (!deps.inputEl || !deps.getUserInputHistory().length) {
      return;
    }

    if (deps.getUserInputHistoryIndex() === -1) {
      deps.setUserInputDraftBeforeHistory(deps.inputEl.value);
      deps.setUserInputHistoryIndex(deps.getUserInputHistory().length);
    }

    const nextIndex = Math.max(
      0,
      Math.min(
        deps.getUserInputHistory().length,
        deps.getUserInputHistoryIndex() + step,
      ),
    );

    if (nextIndex === deps.getUserInputHistory().length) {
      deps.setUserInputHistoryIndex(-1);
      deps.inputEl.value = deps.getUserInputDraftBeforeHistory();
      deps.resizeComposerInput();
      moveCaretToEnd(deps.inputEl);
      return;
    }

    deps.setUserInputHistoryIndex(nextIndex);
    deps.inputEl.value = deps.getUserInputHistory()[deps.getUserInputHistoryIndex()] || '';
    deps.resizeComposerInput();
    moveCaretToEnd(deps.inputEl);
  }

  function resetUserInputHistoryNavigation() {
    deps.setUserInputHistoryIndex(-1);
    deps.setUserInputDraftBeforeHistory('');
  }

  function rememberUserInput(content) {
    const normalized = content.trim();
    if (!normalized) {
      return;
    }

    const history = deps.getUserInputHistory();
    const last = history[history.length - 1];
    if (last === normalized) {
      return;
    }

    history.push(normalized);
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
    return Boolean(
      deps.getConversationId() && payloadConversationId === deps.getConversationId(),
    );
  }

  function logLlmRequestTokens(usage) {
    if (!usage || window.MisterFDebug?.logLlmTokens !== true) {
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

  function updateLlmContextMeter(usage) {
    if (!deps.llmContextMeterEl || !deps.llmContextCircleEl) {
      return;
    }

    const rawPercent = Number(usage?.percentUsed);
    const hasPercent = Number.isFinite(rawPercent);
    const clampedPercent = hasPercent
      ? Math.min(100, Math.max(0, rawPercent))
      : 0;
    const progress = clampedPercent / 100;
    const dashOffset =
      deps.llmContextCircleCircumference * (1 - progress);

    deps.llmContextCircleEl.style.strokeDashoffset = `${dashOffset}`;
    deps.llmContextMeterEl.setAttribute(
      'aria-valuenow',
      hasPercent ? `${Math.round(clampedPercent)}` : '0',
    );
    deps.llmContextMeterEl.setAttribute(
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

    deps.llmContextMeterEl.dataset.contextLevel = level;
  }

  function initializeLlmContextMeter() {
    if (!deps.llmContextCircleEl || !deps.llmContextMeterEl) {
      return;
    }

    deps.llmContextCircleEl.style.strokeDasharray = `${deps.llmContextCircleCircumference}`;
    updateLlmContextMeter(null);
  }

  function startNewConversation() {
    if (deps.getIsAssistantBusy()) {
      return;
    }

    window.location.assign('/');
  }

  function startPracticeModuleConversation(options = {}) {
    if (!deps.getSocket() || deps.getIsAssistantBusy() || !deps.getConversationId()) {
      return;
    }

    deps.setPendingPracticeModuleStart(false);
    if (!options.preservePanel) {
      deps.practiceModuleView.render(null, { visible: false });
    }
    deps.setComposerEnabled(false);
    deps.getSocket().emit('practice-module:start', {
      conversationId: deps.getConversationId(),
      modelTier: deps.getSelectedModelTier(),
    });
  }

  function showAuthRequiredMessage(message) {
    deps.messagesEl.replaceChildren();
    deps.setStreamingBubble(null);
    deps.renderer.appendMessage(
      'model',
      message ||
        'Para practicar con Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
    );
    deps.setComposerEnabled(false);
    deps.scrollToBottom();
  }

  function showGuestGreeting() {
    deps.messagesEl.replaceChildren();
    deps.setStreamingBubble(null);
    deps.renderer.appendMessage(
      'model',
      deps.guestInitialGreeting ||
        '¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres practicar hoy.',
    );
    deps.setComposerEnabled(true);
    deps.focusComposer();
    deps.scrollToBottom();
  }

  function showGuestAuthPrompt() {
    const bubble = deps.renderer.appendMessage(
      'model',
      'Perfecto. Para guardar tu práctica y continuar esta conversación, [inicia sesión](/login) o [crea una cuenta](/signup). Cuando regreses, continuaré desde tu primer mensaje.',
    );
    deps.markTutorMessageArrived(bubble.closest('.message-row'));
    deps.setComposerEnabled(true);
    deps.resizeComposerInput();
    deps.focusComposer();
    deps.scrollToBottom();
  }

  function showGuestAuthPromptWithDelay() {
    deps.setIsGuestPromptPending(true);
    deps.setComposerEnabled(false);
    const typingBubble = deps.renderer.appendMessage('model', '', {
      streaming: true,
    });
    deps.scrollToBottom();

    const delayMs = 850 + Math.floor(Math.random() * 500);
    const timerId = window.setTimeout(() => {
      typingBubble.closest('.message-row')?.remove();
      showGuestAuthPrompt();
      deps.setIsGuestPromptPending(false);
      deps.setGuestPromptTimerId(0);
    }, delayMs);
    deps.setGuestPromptTimerId(timerId);
  }

  function clearPendingDisconnectNotice() {
    if (!deps.getDisconnectNoticeTimerId()) {
      return;
    }

    window.clearTimeout(deps.getDisconnectNoticeTimerId());
    deps.setDisconnectNoticeTimerId(0);
  }

  function flushPendingBootGuestDraft() {
    if (!deps.isInitiallyAuthenticated || !deps.getHasHandledInitialConversationReady()) {
      return;
    }

    const guestDraft = deps.getPendingBootGuestDraft().trim();
    if (!guestDraft || deps.getIsAssistantBusy()) {
      return;
    }

    deps.setPendingBootGuestDraft('');
    deps.inputEl.value = guestDraft;
    deps.resizeComposerInput();
    window.setTimeout(() => {
      sendMessage();
    }, 0);
  }

  return {
    buildConversationPath,
    buildCurrentChatPath,
    clearPendingDisconnectNotice,
    flushPendingBootGuestDraft,
    handleUserInputHistoryKeydown,
    initializeLlmContextMeter,
    isCurrentConversationPayload,
    logLlmRequestTokens,
    navigateUserInputHistory,
    rememberUserInput,
    resetUserInputHistoryNavigation,
    sendMessage,
    sendMessageContent,
    setToolStatus,
    showAuthRequiredMessage,
    showGuestAuthPromptWithDelay,
    showGuestGreeting,
    startNewConversation,
    startPracticeModuleConversation,
    stopAssistantResponse,
    updateLlmContextMeter,
  };
}
