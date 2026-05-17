import { renderMarkdown } from '../chat/shared/markdown.js';

function scrollToBottom(container) {
  if (!container) {
    return;
  }

  container.scrollTop = container.scrollHeight;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resizeTextarea(textarea) {
  if (!textarea) {
    return;
  }

  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function createMessageRow(message) {
  const row = document.createElement('div');
  row.className = `chatroom-entry is-${message.senderType}`;
  if (typeof message.id === 'number') {
    row.dataset.messageId = String(message.id);
  }

  if (message.senderType === 'system') {
    const pill = document.createElement('div');
    pill.className = 'chatroom-system-pill';
    pill.textContent = message.content;
    row.append(pill);
    return row;
  }

  const label = document.createElement('div');
  label.className = 'chatroom-entry-label';
  label.textContent = message.senderType === 'user' ? 'Tú' : message.senderName;
  row.append(label);

  const bubble = document.createElement('div');
  bubble.className = `chatroom-bubble${
    message.senderType === 'user' ? ' chatroom-bubble-user' : ''
  }`;

  const text = document.createElement('div');
  text.className = 'chatroom-entry-text';
  text.textContent = message.content;
  bubble.append(text);

  if (message.senderType === 'user') {
    applyUserMessageEvaluation(row, bubble, message);
  }

  row.append(bubble);

  return row;
}

async function pollMessageEvaluation({ conversationPath, messageId, onResolved }) {
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(1000 + attempt * 250);

    try {
      const response = await fetch(
        `${conversationPath}/messages/${messageId}/evaluation`,
        {
          headers: {
            Accept: 'application/json',
          },
          credentials: 'same-origin',
        },
      );

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      if (!payload?.ok || !payload?.message) {
        return;
      }

      if (payload.pending) {
        continue;
      }

      onResolved(payload.message);
      return;
    } catch {
      return;
    }
  }
}

function applyUserMessageEvaluation(row, bubble, message) {
  if (!row || !bubble) {
    return;
  }

  bubble.querySelector('.chatroom-message-evaluation')?.remove();
  bubble.querySelector('.chatroom-message-evaluation-detail')?.remove();

  if (!message?.evaluationStatus) {
    return;
  }

  const evaluation = document.createElement('div');
  evaluation.className = 'chatroom-message-evaluation';

  if (message.evaluationStatus === 'ok') {
    const okIcon = document.createElement('span');
    okIcon.className = 'chatroom-message-evaluation-icon text-success';
    okIcon.title = 'Mensaje correcto';
    okIcon.setAttribute('aria-label', 'Mensaje correcto');
    okIcon.innerHTML = '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>';
    evaluation.append(okIcon);
    bubble.append(evaluation);
    return;
  }

  const warningButton = document.createElement('button');
  warningButton.className = 'chatroom-message-evaluation-icon chatroom-message-evaluation-button text-warning';
  warningButton.type = 'button';
  warningButton.title = 'Ver problema';
  warningButton.setAttribute('aria-expanded', 'false');
  warningButton.setAttribute('aria-label', 'Ver problema');
  warningButton.innerHTML = '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>';

  const detail = document.createElement('div');
  detail.className = 'chatroom-message-evaluation-detail d-none';
  detail.innerHTML = renderMarkdown(
    message.evaluationProblem || 'Hay un problema en este mensaje.',
  );

  warningButton.addEventListener('click', () => {
    const isHidden = detail.classList.contains('d-none');
    detail.classList.toggle('d-none', !isHidden);
    warningButton.setAttribute('aria-expanded', String(isHidden));
  });

  evaluation.append(warningButton);
  bubble.append(evaluation, detail);
}

function createTypingRow() {
  const row = document.createElement('div');
  row.className = 'chatroom-entry is-typing';

  const label = document.createElement('div');
  label.className = 'chatroom-entry-label';
  label.textContent = 'Sala';
  row.append(label);

  const bubble = document.createElement('div');
  bubble.className = 'chatroom-bubble chatroom-bubble-typing';

  const text = document.createElement('div');
  text.className = 'chatroom-entry-text chatroom-entry-typing';
  text.textContent = '...';
  bubble.append(text);
  row.append(bubble);

  return row;
}

function appendAnimatedMessage(container, viewport, message) {
  const row = createMessageRow(message);
  row.classList.add('is-entering');
  container.append(row);
  scrollToBottom(viewport);
  window.requestAnimationFrame(() => {
    row.classList.remove('is-entering');
  });
  return row;
}

function setStatus(statusEl, text = '') {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = text;
  statusEl.classList.toggle('d-none', !text);
}

async function postConversationAction(url, formData) {
  const response = await fetch(url, {
    body: new URLSearchParams(formData),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    method: 'POST',
    credentials: 'same-origin',
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    if (payload?.redirect) {
      window.location.href = payload.redirect;
      return null;
    }

    throw new Error(payload?.error || 'No pude continuar la conversación.');
  }

  return payload;
}

export function initializeChatroomsPage({ currentView }) {
  if (currentView !== 'chatrooms') {
    return;
  }

  const threadEl = document.querySelector('[data-chatroom-thread]');
  if (!threadEl) {
    return;
  }

  const messagesViewportEl = threadEl.querySelector('[data-chatroom-viewport]');
  const messagesEl = threadEl.querySelector('[data-chatroom-messages]');
  const initialMessagesEl = threadEl.querySelector('[data-chatroom-initial-messages]');
  const formEl = threadEl.querySelector('[data-chatroom-form]');
  const inputEl = threadEl.querySelector('[data-chatroom-input]');
  const sendButtonEl = threadEl.querySelector('[data-chatroom-send]');
  const statusEl = threadEl.querySelector('[data-chatroom-status]');
  if (!messagesViewportEl || !messagesEl || !formEl || !inputEl || !sendButtonEl) {
    return;
  }

  const csrfEl = formEl.querySelector('input[name="_csrf"]');
  const sendUrl = formEl.getAttribute('action') || '';
  const conversationPath = sendUrl.replace(/\/messages$/, '');
  let isPending = false;
  let typingRow = null;
  const initialMessages = initialMessagesEl
    ? JSON.parse(initialMessagesEl.textContent || '[]')
    : [];

  const setPendingState = (pending, statusText) => {
    isPending = pending;
    inputEl.disabled = pending;
    sendButtonEl.disabled = pending;
    if (typeof statusText === 'string') {
      setStatus(statusEl, statusText);
    }
  };

  const beginAssistantTurn = () => {
    typingRow = createTypingRow();
    messagesEl.append(typingRow);
    scrollToBottom(messagesViewportEl);
  };

  const endAssistantTurn = () => {
    typingRow?.remove();
    typingRow = null;
  };

  const replayInitialMessages = async () => {
    if (!Array.isArray(initialMessages) || initialMessages.length === 0) {
      return;
    }

    messagesEl.innerHTML = '';
    const shouldAnimate = initialMessages.length <= 8;
    for (let index = 0; index < initialMessages.length; index += 1) {
      const message = initialMessages[index];
      appendAnimatedMessage(messagesEl, messagesViewportEl, message);

      if (!shouldAnimate || index === initialMessages.length - 1) {
        continue;
      }

      if (message.senderType === 'system') {
        await sleep(randomInt(350, 700));
      } else {
        await sleep(randomInt(120, 240));
      }
    }
  };

  const appendAssistantMessages = async (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return;
    }

    endAssistantTurn();
    appendAnimatedMessage(messagesEl, messagesViewportEl, messages[0]);

    for (let index = 1; index < messages.length; index += 1) {
      beginAssistantTurn();
      await sleep(randomInt(1000, 3000));
      endAssistantTurn();
      appendAnimatedMessage(messagesEl, messagesViewportEl, messages[index]);
    }
  };

  const submitMessage = async () => {
    if (isPending) {
      return;
    }

    const content = inputEl.value.trim();
    if (!content) {
      return;
    }

    const formData = new FormData();
    formData.set('_csrf', csrfEl?.value || '');
    formData.set('content', content);

    const optimisticMessage = {
      content,
      evaluationProblem: null,
      evaluationStatus: null,
      senderName: 'Tú',
      senderType: 'user',
    };
    const optimisticRow = createMessageRow(optimisticMessage);
    messagesEl.append(optimisticRow);
    scrollToBottom(messagesViewportEl);
    inputEl.value = '';
    resizeTextarea(inputEl);
    beginAssistantTurn();
    setPendingState(true);

    try {
      const payload = await postConversationAction(sendUrl, formData);
      if (!payload) {
        return;
      }

      if (payload.userMessage?.id) {
        optimisticRow.dataset.messageId = String(payload.userMessage.id);
      }

      if (payload.userMessage?.evaluationStatus) {
        applyUserMessageEvaluation(optimisticRow, optimisticRow.querySelector('.chatroom-bubble'), payload.userMessage);
      } else if (payload.userMessage?.id) {
        void pollMessageEvaluation({
          conversationPath,
          messageId: payload.userMessage.id,
          onResolved: (resolvedMessage) => {
            applyUserMessageEvaluation(
              optimisticRow,
              optimisticRow.querySelector('.chatroom-bubble'),
              resolvedMessage,
            );
          },
        });
      }

      await appendAssistantMessages(payload.appendedMessages || []);
      scrollToBottom(messagesViewportEl);
      setStatus(statusEl, '');
      inputEl.focus({ preventScroll: true });
    } catch (error) {
      optimisticRow.remove();
      endAssistantTurn();
      setStatus(
        statusEl,
        error instanceof Error ? error.message : 'No pude enviar el mensaje.',
      );
    } finally {
      setPendingState(false);
    }
  };

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitMessage();
  });

  inputEl.addEventListener('input', () => {
    resizeTextarea(inputEl);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  });

  resizeTextarea(inputEl);
  void replayInitialMessages().then(() => {
    scrollToBottom(messagesViewportEl);
  });
}
