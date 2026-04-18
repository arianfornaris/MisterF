const socket = io();

const storageKey = 'misterf.conversationId';
const messagesEl = document.querySelector('#messages');
const formEl = document.querySelector('#chatForm');
const inputEl = document.querySelector('#messageInput');
const resetButtonEl = document.querySelector('#resetButton');
const connectionStatusEl = document.querySelector('#connectionStatus');

let conversationId = localStorage.getItem(storageKey);
let streamingBubble = null;
let isAssistantBusy = false;

socket.on('connect', () => {
  setConnectionStatus('En linea', 'online');
  socket.emit('conversation:join', { conversationId });
});

socket.on('disconnect', () => {
  setConnectionStatus('Sin conexion', 'offline');
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

  streamingBubble.textContent += chunk;
  scrollToBottom();
});

socket.on('assistant:done', (message) => {
  if (streamingBubble) {
    streamingBubble.textContent = message.content;
    streamingBubble.classList.remove('typing-caret');
  } else {
    appendMessage('model', message.content);
  }

  streamingBubble = null;
  isAssistantBusy = false;
  setComposerEnabled(true);
  inputEl.focus();
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

resetButtonEl.addEventListener('click', () => {
  isAssistantBusy = false;
  setComposerEnabled(false);
  socket.emit('conversation:reset');
});

function sendMessage() {
  const content = inputEl.value.trim();
  if (!content || isAssistantBusy) {
    return;
  }

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setComposerEnabled(false);
  socket.emit('message:send', { conversationId, content });
}

function appendMessage(role, content, options = {}) {
  const row = document.createElement('div');
  row.className = `message-row is-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = content;

  if (options.streaming) {
    bubble.classList.add('typing-caret');
  }

  row.append(bubble);
  messagesEl.append(row);
  return bubble;
}

function setComposerEnabled(enabled) {
  inputEl.disabled = !enabled;
  formEl.querySelector('button[type="submit"]').disabled = !enabled;
}

function setConnectionStatus(text, state) {
  connectionStatusEl.textContent = text;
  connectionStatusEl.classList.toggle('is-online', state === 'online');
  connectionStatusEl.classList.toggle('is-offline', state === 'offline');
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
