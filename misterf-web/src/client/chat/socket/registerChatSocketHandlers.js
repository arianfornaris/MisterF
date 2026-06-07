import { markQuizCardEvaluationComplete } from '../cards/createQuizCard.js';

export function registerChatSocketHandlers(deps) {
  const { socketClient } = deps;

  socketClient.on('connect', () => {
    if (deps.shouldAutoJoinSocketThread) {
      socketClient.emit(deps.chatSocketEvents.join, {
        conversationId: deps.getConversationId(),
      });
    }
  });

  socketClient.on('auth:required', ({ message }) => {
    deps.runtime.showAuthRequiredMessage(message);
  });

  socketClient.on('disconnect', (reason) => {
    deps.runtime.clearPendingDisconnectNotice();
    const timerId = window.setTimeout(() => {
      deps.renderer.appendEphemeralError(
        `Se perdió la conexión con el servidor. Intentando reconectar. (${reason})`,
      );
      deps.setDisconnectNoticeTimerId(0);
    }, 3000);
    deps.setDisconnectNoticeTimerId(timerId);
    deps.setComposerEnabled(false);
  });

  socketClient.on('connect_error', (error) => {
    if (error.message === 'authentication_required') {
      deps.runtime.showAuthRequiredMessage();
      return;
    }

    deps.renderer.appendEphemeralError(
      'No puedo conectar con el servidor en este momento. Revisa PM2 o vuelve a intentar en unos segundos.',
    );
    deps.setComposerEnabled(false);
  });

  socketClient.on(deps.chatSocketEvents.ready, (payload) => {
    deps.runtime.clearPendingDisconnectNotice();
    deps.setHasHandledInitialConversationReady(true);
    deps.setConversationId(payload.conversationId);
    deps.setSelectedModelTier(payload.conversation?.modelTier || deps.getDefaultModelTier());
    deps.setCanFinalizeConversation?.(Boolean(payload.conversation?.id && !payload.conversation?.closedAt));
    deps.conversationListView.upsert(payload.conversation);
    deps.conversationListView.markActive(deps.getConversationId());
    deps.messagesEl.replaceChildren();
    deps.setStreamingBubble(null);
    deps.pendingSentenceEvaluations.clear();
    deps.setActiveUserMessageId(null);
    deps.setUserInputHistory(
      (payload.messages ?? [])
        .filter((message) => message?.role === 'user' && typeof message.content === 'string')
        .map((message) => message.content)
        .filter((content) => content.trim().length > 0),
    );
    deps.runtime.resetUserInputHistoryNavigation();
    deps.runtime.updateLlmContextMeter(null);
    deps.runtime.setToolStatus('');
    deps.setPendingPracticeModuleStart(Boolean(payload.pendingPracticeModuleStart));
    const shouldAutoStartPracticeModule =
      deps.getPendingPracticeModuleStart() && Boolean(payload.practiceModule);
    deps.practiceModuleView.render(payload.practiceModule, {
      autoStarting: shouldAutoStartPracticeModule,
      visible: deps.getPendingPracticeModuleStart(),
    });

    let queuedSentenceEvaluation = null;
    for (const message of payload.messages ?? []) {
      if (message.role === 'user') {
        queuedSentenceEvaluation = message.metadata?.sentenceEvaluation ?? null;
        deps.renderer.appendStoredMessage(message);
        if (typeof message.id === 'number') {
          deps.setActiveUserMessageId(message.id);
        }
        continue;
      }

      deps.renderer.appendStoredMessage(message, {
        sentenceEvaluation: queuedSentenceEvaluation,
      });
      queuedSentenceEvaluation = null;
    }

    if (payload.assistantPending) {
      deps.setIsAssistantBusy(true);
      deps.setIsAssistantStopping(false);
      deps.setComposerEnabled(false);
      deps.setStreamingBubble(
        deps.renderer.appendMessage('model', '', { streaming: true }),
      );
    } else {
      deps.setIsAssistantBusy(false);
      deps.setIsAssistantStopping(false);
      deps.setComposerEnabled(!deps.getPendingPracticeModuleStart());
    }
    deps.focusComposer();
    deps.scrollToBottom();
    deps.runtime.flushPendingBootGuestDraft();

    if (shouldAutoStartPracticeModule) {
      window.setTimeout(() => {
        deps.runtime.startPracticeModuleConversation({ preservePanel: true });
      }, 0);
    }
  });

  socketClient.on(deps.chatSocketEvents.promoted, (payload) => {
    deps.setConversationId(payload.conversationId);
    deps.setCanFinalizeConversation?.(Boolean(payload.conversationId));
    window.history.replaceState(
      {},
      '',
      deps.runtime.buildCurrentChatPath(deps.getConversationId()),
    );
  });

  socketClient.on('conversation:renamed', (payload) => {
    deps.conversationListView.update(payload.conversation);
    deps.conversationListView.markActive(deps.getConversationId());
  });

  socketClient.on('conversation:updated', (payload) => {
    deps.conversationListView.update(payload.conversation, { moveToTop: true });
    deps.conversationListView.markActive(deps.getConversationId());
    if (payload.conversationId === deps.getConversationId()) {
      deps.setCanFinalizeConversation?.(Boolean(payload.conversation?.id && !payload.conversation?.closedAt));
    }
  });

  socketClient.on(deps.chatSocketEvents.deleted, (payload) => {
    deps.conversationListView.remove(payload.conversationId);

    if (payload.conversationId === deps.getConversationId() || payload.wasActive) {
      window.location.assign('/');
    }
  });

  socketClient.on(deps.chatSocketEvents.error, ({ message }) => {
    deps.renderer.appendEphemeralError(message || 'No pude actualizar la conversación.');
  });

  socketClient.on('translator:result', (payload) => {
    deps.translatorController.handleResult(payload);
  });

  socketClient.on('translator:error', (payload) => {
    deps.translatorController.handleError(payload);
  });

  socketClient.on('llm:request_tokens', (payload) => {
    if (!deps.runtime.isCurrentConversationPayload(payload)) {
      return;
    }

    deps.runtime.logLlmRequestTokens(payload.usage);
    deps.runtime.updateLlmContextMeter(payload.usage);
  });

  socketClient.on('llm:credit_exhausted', ({ message }) => {
    deps.showCreditExhaustedModal(message);
  });

  socketClient.on('message:created', (message) => {
    const quizResultSource = message?.metadata?.quizSource;
    if (
      message?.role === 'model' &&
      message?.metadata?.source === 'quiz_result' &&
      quizResultSource &&
      typeof quizResultSource === 'object'
    ) {
      markQuizCardEvaluationComplete(
        quizResultSource.messageId,
        quizResultSource.blockIndex,
      );
    }

    const bubble = deps.renderer.appendStoredMessage(message);
    if (message.role === 'user') {
      deps.setActiveUserMessageId(message.id);
    } else {
      deps.renderer.markTutorMessageArrived(bubble.closest('.message-row'));
    }
    deps.scrollToBottom();
  });

  socketClient.on('assistant:start', () => {
    deps.runtime.clearPendingDisconnectNotice();
    deps.setIsAssistantBusy(true);
    deps.setIsAssistantStopping(false);
    deps.setPendingPracticeModuleStart(false);
    deps.practiceModuleView.render(null, { visible: false });
    deps.runtime.setToolStatus('');
    deps.setComposerEnabled(false);
    deps.setStreamingBubble(
      deps.renderer.appendMessage('model', '', { streaming: true }),
    );
    deps.scrollToBottom();
  });

  socketClient.on('assistant:tool_status', ({ label }) => {
    deps.runtime.setToolStatus(typeof label === 'string' ? label : '');
  });

  socketClient.on('assistant:chunk', ({ chunk }) => {
    if (!deps.getStreamingBubble()) {
      deps.setStreamingBubble(
        deps.renderer.appendMessage('model', '', { streaming: true }),
      );
    }

    const rawContent = `${deps.getStreamingBubble().dataset.rawContent ?? ''}${chunk}`;
    deps.renderer.setMessageContent(deps.getStreamingBubble(), rawContent);
    deps.scrollToBottom();
  });

  socketClient.on('assistant:done', (message) => {
    if (!message) {
      deps.getStreamingBubble()?.remove();
      deps.setStreamingBubble(null);
      deps.runtime.setToolStatus('');
      deps.setIsAssistantBusy(false);
      deps.setIsAssistantStopping(false);
      deps.practiceModuleView.render(null, { visible: false });
      deps.setComposerEnabled(true);
      deps.focusComposer();
      deps.scrollToBottom();
      return;
    }

    const sentenceEvaluation = deps.getActiveUserMessageId()
      ? deps.pendingSentenceEvaluations.get(deps.getActiveUserMessageId())
      : null;

    if (deps.getStreamingBubble()) {
      deps.renderer.setModelBubbleContent(
        deps.getStreamingBubble(),
        message.content,
        message.metadata,
        { messageId: message.id },
      );
      deps.getStreamingBubble().classList.remove('typing-caret');
      const streamingRow = deps.getStreamingBubble().closest('.message-row');
      streamingRow?.setAttribute('data-message-id', message.id);
      deps.renderer.renderSentenceEvaluation(
        deps.getStreamingBubble(),
        sentenceEvaluation,
      );
      deps.renderer.initializeSentencePopovers(deps.getStreamingBubble());
      deps.renderer.markTutorMessageArrived(streamingRow);
    } else {
      const bubble = deps.renderer.appendStoredMessage(message, { sentenceEvaluation });
      deps.renderer.markTutorMessageArrived(bubble.closest('.message-row'));
    }

    if (deps.getActiveUserMessageId()) {
      deps.pendingSentenceEvaluations.delete(deps.getActiveUserMessageId());
    }
    deps.setActiveUserMessageId(null);
    deps.setStreamingBubble(null);
    deps.runtime.setToolStatus('');
    deps.setIsAssistantBusy(false);
    deps.setIsAssistantStopping(false);
    deps.practiceModuleView.render(null, { visible: false });
    deps.setComposerEnabled(true);
    deps.focusComposer();
    deps.scrollToBottom();
  });

  socketClient.on('assistant:stopped', () => {
    if (deps.getStreamingBubble()) {
      deps.getStreamingBubble().closest('.message-row')?.remove();
      deps.setStreamingBubble(null);
    }

    deps.runtime.setToolStatus('');
    deps.setIsAssistantBusy(false);
    deps.setIsAssistantStopping(false);
    deps.practiceModuleView.render(null, { visible: false });
    deps.setComposerEnabled(!deps.getPendingPracticeModuleStart());
    deps.focusComposer();
    deps.scrollToBottom();
  });

  socketClient.on('assistant:error', ({ message }) => {
    if (deps.getStreamingBubble()) {
      deps.getStreamingBubble().closest('.message-row')?.remove();
      deps.setStreamingBubble(null);
    }

    deps.runtime.setToolStatus('');
    deps.renderer.appendMessage('error', message);
    deps.setIsAssistantBusy(false);
    deps.setIsAssistantStopping(false);
    deps.setComposerEnabled(!deps.getPendingPracticeModuleStart());
    deps.scrollToBottom();
  });

  socketClient.on('message:evaluation_updated', ({ message }) => {
    if (!message?.id) {
      return;
    }

    deps.pendingSentenceEvaluations.set(
      message.id,
      message.metadata?.sentenceEvaluation,
    );

    if (!deps.getIsAssistantBusy()) {
      deps.renderer.renderSentenceEvaluationOnLastAssistant(
        message.metadata?.sentenceEvaluation,
      );
      deps.scrollToBottom();
    }
  });

  socketClient.on('message:updated', (message) => {
    if (!message?.id) {
      return;
    }

    deps.renderer.updateRenderedMessage(message);
  });
}
