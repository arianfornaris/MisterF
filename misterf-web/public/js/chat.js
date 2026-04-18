const storageKey = 'misterf.conversationId';
const messagesEl = document.querySelector('#messages');
const formEl = document.querySelector('#chatForm');
const inputEl = document.querySelector('#messageInput');
const isInitiallyAuthenticated = document.body.dataset.authenticated === 'true';
const socketAuthToken = document.body.dataset.socketAuthToken || '';
const authMessage = document.body.dataset.authMessage || '';
const socket = isInitiallyAuthenticated
  ? io({ auth: { token: socketAuthToken } })
  : null;

let conversationId = localStorage.getItem(storageKey);
let streamingBubble = null;
let isAssistantBusy = false;

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

if (socket) {
  socket.on('connect', () => {
    socket.emit('conversation:join', { conversationId });
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

  socket.on('conversation:ready', (payload) => {
    conversationId = payload.conversationId;
    localStorage.setItem(storageKey, conversationId);
    messagesEl.replaceChildren();
    streamingBubble = null;

    for (const message of payload.messages ?? []) {
      appendMessage(message.role, message.content);
    }

    setComposerEnabled(!isAssistantBusy);
    focusComposer();
    scrollToBottom();
  });

  socket.on('message:created', (message) => {
    appendMessage(message.role, message.content);
    scrollToBottom();
  });

  socket.on('assistant:start', () => {
    isAssistantBusy = true;
    setComposerEnabled(false);
    streamingBubble = appendMessage('model', '', { streaming: true });
    scrollToBottom();
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
    if (streamingBubble) {
      setMessageContent(streamingBubble, message.content);
      streamingBubble.classList.remove('typing-caret');
    } else {
      appendMessage('model', message.content);
    }

    streamingBubble = null;
    isAssistantBusy = false;
    setComposerEnabled(true);
    focusComposer();
    scrollToBottom();
  });

  socket.on('assistant:error', ({ message }) => {
    if (streamingBubble) {
      streamingBubble.closest('.message-row')?.remove();
      streamingBubble = null;
    }

    appendMessage('error', message);
    isAssistantBusy = false;
    setComposerEnabled(true);
    scrollToBottom();
  });
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage();
});

inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${inputEl.scrollHeight}px`;
});

function sendMessage() {
  const content = inputEl.value.trim();
  if (!content || isAssistantBusy || !socket) {
    return;
  }

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setComposerEnabled(false);
  socket.emit('message:send', { conversationId, content });
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

function appendMessage(role, content, options = {}) {
  const row = document.createElement('div');
  row.className = `message-row is-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  setMessageContent(bubble, content);

  if (options.streaming) {
    bubble.classList.add('typing-caret');
  }

  row.append(bubble);
  messagesEl.append(row);
  return bubble;
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

function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    return escapeHtml(content).replaceAll('\n', '<br>');
  }

  const html = window.marked.parse(content || '');
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

function escapeHtml(value) {
  const wrapper = document.createElement('div');
  wrapper.textContent = value;
  return wrapper.innerHTML;
}

function setComposerEnabled(enabled) {
  inputEl.disabled = !enabled;
  formEl.querySelector('button[type="submit"]').disabled = !enabled;
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
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

if (isInitiallyAuthenticated) {
  setComposerEnabled(true);
  focusComposer();
} else {
  showAuthRequiredMessage(authMessage || undefined);
}
