const storageKey = 'misterf.conversationId';
const messagesEl = document.querySelector('#messages');
const chatPaneEl = document.querySelector('#chatPane');
const practiceContentEl = document.querySelector('#practiceContent');
const progressContentEl = document.querySelector('#progressContent');
const formEl = document.querySelector('#chatForm');
const inputEl = document.querySelector('#messageInput');
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
const isInitiallyAuthenticated = document.body.dataset.authenticated === 'true';
const socketAuthToken = document.body.dataset.socketAuthToken || '';
const authMessage = document.body.dataset.authMessage || '';
const socket = isInitiallyAuthenticated
  ? io({ auth: { token: socketAuthToken } })
  : null;

let conversationId = localStorage.getItem(storageKey);
let streamingBubble = null;
let isAssistantBusy = false;
let pendingDeleteConversationId = null;
let activeUserMessageId = null;
const pendingSentenceEvaluations = new Map();
let practiceChallenges = [];

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
    storeConversationId(conversationId);
    upsertConversationItem(payload.conversation);
    markActiveConversation(conversationId);
    messagesEl.replaceChildren();
    streamingBubble = null;
    pendingSentenceEvaluations.clear();
    practiceChallenges = payload.practice ?? [];

    let queuedSentenceEvaluation = null;
    for (const message of payload.messages ?? []) {
      if (message.role === 'user') {
        queuedSentenceEvaluation = message.metadata?.sentenceEvaluation ?? null;
        appendStoredMessage(message);
        continue;
      }

      appendStoredMessage(message, {
        sentenceEvaluation: queuedSentenceEvaluation,
      });
      queuedSentenceEvaluation = null;
    }
    renderPractice(practiceChallenges);
    rebuildChallengeCards();
    renderProgress(payload.progress?.markdown || '');

    setComposerEnabled(!isAssistantBusy);
    focusComposer();
    scrollToBottom();
  });

  socket.on('conversation:promoted', (payload) => {
    conversationId = payload.conversationId;
    storeConversationId(conversationId);
    upsertConversationItem(payload.conversation);
    markActiveConversation(conversationId);
  });

  socket.on('progress:updated', (payload) => {
    if (payload.conversationId === conversationId) {
      renderProgress(payload.progress?.markdown || '');
    }
  });

  socket.on('practice:updated', (payload) => {
    console.log('[Mr. F practice event received]', {
      activeConversationId: conversationId,
      challengeCount: payload.challenges?.length ?? 0,
      eventConversationId: payload.conversationId,
      isCurrentConversation: isCurrentConversationPayload(payload),
    });

    if (!isCurrentConversationPayload(payload)) {
      console.log('[Mr. F practice update skipped]', {
        reason: 'conversation_id_mismatch',
        activeConversationId: conversationId,
        eventConversationId: payload.conversationId,
      });
      return;
    }

    practiceChallenges = payload.challenges ?? [];
    renderPractice(practiceChallenges);
    rebuildChallengeCards();
  });

  socket.on('sentence_challenge:completed', (payload) => {
    console.log('[Mr. F confetti event received]', {
      activeConversationId: conversationId,
      challengeConversationId: payload.challenge?.conversationId,
      eventConversationId: payload.conversationId,
      isCurrentConversation: isCurrentConversationPayload(payload),
      payload,
    });

    if (!isCurrentConversationPayload(payload)) {
      console.log('[Mr. F confetti skipped]', {
        reason: 'conversation_id_mismatch',
        activeConversationId: conversationId,
        challengeConversationId: payload.challenge?.conversationId,
        eventConversationId: payload.conversationId,
      });
      return;
    }

    launchConfetti(payload);
  });

  socket.on('conversation:renamed', (payload) => {
    updateConversationItem(payload.conversation);
    markActiveConversation(conversationId);
  });

  socket.on('conversation:deleted', (payload) => {
    removeConversationItem(payload.conversationId);

    if (payload.conversationId === conversationId || payload.wasActive) {
      conversationId = null;
      storeConversationId(null);
      messagesEl.replaceChildren();
      practiceChallenges = [];
      renderPractice(practiceChallenges);
      renderProgress('');
      streamingBubble = null;
    }
  });

  socket.on('conversation:error', ({ message }) => {
    appendEphemeralError(message || 'No pude actualizar la conversación.');
  });

  socket.on('message:created', (message) => {
    appendStoredMessage(message);
    if (message.role === 'user') {
      activeUserMessageId = message.id;
      rebuildChallengeCards();
    }
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
    const sentenceEvaluation = activeUserMessageId
      ? pendingSentenceEvaluations.get(activeUserMessageId)
      : null;

    if (streamingBubble) {
      setMessageContent(streamingBubble, message.content);
      streamingBubble.classList.remove('typing-caret');
      const streamingRow = streamingBubble.closest('.message-row');
      streamingRow?.setAttribute('data-message-id', message.id);
      attachMessageMetadata(streamingRow, message.metadata);
      renderSentenceEvaluation(streamingBubble, sentenceEvaluation);
      initializeSentencePopovers(streamingBubble);
    } else {
      appendStoredMessage(message, { sentenceEvaluation });
    }

    if (activeUserMessageId) {
      pendingSentenceEvaluations.delete(activeUserMessageId);
    }
    activeUserMessageId = null;
    streamingBubble = null;
    rebuildChallengeCards();
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
  resizeComposerInput();
});

for (const item of document.querySelectorAll('[data-conversation-id]')) {
  configureConversationItem(item);
}

newConversationButtonEl?.addEventListener('click', () => {
  startNewConversation();
});

confirmDeleteConversationButtonEl?.addEventListener('click', () => {
  confirmDeleteConversation();
});

document.querySelector('#progress-tab')?.addEventListener('shown.bs.tab', () => {
  formEl.hidden = true;
});

document.querySelector('#practice-tab')?.addEventListener('shown.bs.tab', () => {
  formEl.hidden = true;
});

document.querySelector('#chat-tab')?.addEventListener('shown.bs.tab', () => {
  formEl.hidden = false;
  focusComposer();
});

formatConversationDates();

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

function storeConversationId(nextConversationId) {
  if (nextConversationId) {
    localStorage.setItem(storageKey, nextConversationId);
    return;
  }

  localStorage.removeItem(storageKey);
}

function isCurrentConversationPayload(payload) {
  const payloadConversationId =
    payload?.conversationId || payload?.challenge?.conversationId || '';
  return Boolean(conversationId && payloadConversationId === conversationId);
}

function startNewConversation() {
  if (!socket || isAssistantBusy) {
    return;
  }

  conversationId = null;
  localStorage.removeItem(storageKey);
  markActiveConversation('');
  hideConversationPanel();
  setComposerEnabled(false);
  socket.emit('conversation:reset');
}

function openConversation(nextConversationId) {
  if (!nextConversationId || !socket || isAssistantBusy) {
    return;
  }

  conversationId = nextConversationId;
  localStorage.setItem(storageKey, conversationId);
  markActiveConversation(conversationId);
  hideConversationPanel();
  setComposerEnabled(false);
  socket.emit('conversation:join', { conversationId });
}

function hideConversationPanel() {
  if (!conversationPanelEl || !window.bootstrap?.Offcanvas) {
    return;
  }

  const panel =
    window.bootstrap.Offcanvas.getInstance(conversationPanelEl) ||
    window.bootstrap.Offcanvas.getOrCreateInstance(conversationPanelEl);
  panel.hide();
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
  item.querySelector('[data-open-conversation]')?.addEventListener('click', () => {
    openConversation(item.dataset.conversationId || '');
  });

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

  let list = conversationPanelEl.querySelector('.conversation-list');
  if (!list) {
    const emptyState = conversationPanelEl.querySelector('.conversation-empty');
    emptyState?.remove();
    list = document.createElement('div');
    list.className = 'conversation-list';
    conversationPanelEl.querySelector('.offcanvas-body')?.append(list);
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

  item.querySelector('.conversation-title').textContent =
    conversation.title || 'Nueva conversación';

  const date = item.querySelector('.conversation-date');
  date.dateTime = conversation.updatedAt || '';
  date.textContent = formatConversationDate(conversation.updatedAt || '');
  date.title = conversation.updatedAt || '';
  list.prepend(item);
}

function updateConversationItem(conversation) {
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
}

function createConversationItem(conversation) {
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.dataset.conversationId = conversation.id;

  const openButton = document.createElement('button');
  openButton.className = 'conversation-open-button';
  openButton.type = 'button';
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
  button.innerHTML = `
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8"></circle>
      <circle cx="12" cy="12" r="1.8"></circle>
      <circle cx="19" cy="12" r="1.8"></circle>
    </svg>
  `;

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
    path: 'm5 12 4 4L19 6',
    type: 'submit',
  });

  const cancelButton = createRenameActionButton({
    label: 'Cancelar',
    path: 'M6 6l12 12M18 6 6 18',
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

function createRenameActionButton({ label, path, type }) {
  const button = document.createElement('button');
  button.className = 'conversation-rename-action';
  button.type = type;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="${path}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
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
  pendingDeleteConversationId = item.dataset.conversationId || null;
  if (!pendingDeleteConversationId) {
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
  if (!pendingDeleteConversationId || !socket) {
    return;
  }

  socket.emit('conversation:delete', {
    conversationId: pendingDeleteConversationId,
  });
  pendingDeleteConversationId = null;

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
    const emptyState = document.createElement('p');
    emptyState.className = 'conversation-empty';
    emptyState.textContent = 'Todavía no hay conversaciones.';
    conversationPanelEl?.querySelector('.offcanvas-body')?.append(emptyState);
  }
}

function formatConversationDates() {
  for (const date of document.querySelectorAll('.conversation-date')) {
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
  practiceChallenges = [];
  renderPractice(practiceChallenges);
  renderProgress('');
  streamingBubble = null;
  appendMessage(
    'model',
    message ||
      'Para practicar con Mr. F necesitas autenticarte. [Inicia sesión](/login) o [crea una cuenta](/signup).',
  );
  setComposerEnabled(false);
  scrollToBottom();
}

function renderProgress(markdown) {
  if (!progressContentEl) {
    return;
  }

  if (!markdown.trim()) {
    progressContentEl.classList.add('is-empty');
    progressContentEl.innerHTML = renderMarkdown(
      'El progreso aparecerá aquí cuando avancemos un poco en la práctica.',
    );
    return;
  }

  progressContentEl.classList.remove('is-empty');
  progressContentEl.innerHTML = renderMarkdown(markdown);
}

function renderPractice(challenges) {
  if (!practiceContentEl) {
    return;
  }

  practiceContentEl.replaceChildren();
  if (!challenges.length) {
    const empty = document.createElement('div');
    empty.className = 'alert alert-light practice-empty';
    empty.textContent =
      'Los intentos aparecerán aquí cuando empieces a traducir oraciones.';
    practiceContentEl.append(empty);
    return;
  }

  for (const challenge of challenges) {
    practiceContentEl.append(renderPracticeChallenge(challenge));
  }
}

function renderPracticeChallenge(challenge) {
  const card = document.createElement('article');
  card.className = 'card practice-card';

  const body = document.createElement('div');
  body.className = 'card-body practice-card-body';

  const source = document.createElement('p');
  source.className = 'practice-source';
  source.textContent = challenge.sourceSentence;
  body.append(source);

  if (challenge.attempts?.length) {
    const list = document.createElement('ul');
    list.className = 'practice-attempt-list';
    for (const attempt of challenge.attempts) {
      list.append(renderPracticeAttempt(attempt));
    }
    body.append(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'practice-attempt-empty';
    empty.textContent = 'Todavía no hay intentos para esta oración.';
    body.append(empty);
  }

  card.append(body);
  return card;
}

function renderPracticeAttempt(attempt) {
  const item = document.createElement('li');
  item.className = 'practice-attempt';

  const parts = document.createElement('p');
  parts.className = 'sentence-parts practice-sentence-parts';
  const evaluationParts = attempt.evaluation?.parts?.length
    ? attempt.evaluation.parts
    : [{ status: 'correct', text: attempt.attemptText }];

  for (const [partIndex, part] of evaluationParts.entries()) {
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
    if (partIndex < evaluationParts.length - 1) {
      parts.append(document.createTextNode(' '));
    }
  }

  item.append(parts);
  initializeSentencePopovers(item);
  return item;
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
  attachMessageMetadata(row, options.metadata);

  const bubble = document.createElement('div');
  bubble.className = getMessageBubbleClassName(role);
  setMessageContent(bubble, content);

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
  label.textContent = 'Tu intento, por partes';

  const parts = document.createElement('p');
  parts.className = 'sentence-parts';

  for (const [index, part] of evaluation.parts.entries()) {
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
    if (index < evaluation.parts.length - 1) {
      parts.append(document.createTextNode(' '));
    }
  }

  header.append(label);

  const body = document.createElement('div');
  body.className = 'sentence-evaluation-body card-body';
  body.append(parts);

  wrapper.append(header, body);
  element.append(wrapper);
}

function attachMessageMetadata(row, metadata) {
  if (!row) {
    return;
  }

  if (!metadata?.blocks) {
    delete row.dataset.messageBlocks;
    return;
  }

  row.dataset.messageBlocks = JSON.stringify(metadata.blocks);
}

function rebuildChallengeCards() {
  unwrapChallengeCards();

  const rows = Array.from(messagesEl.querySelectorAll(':scope > .message-row'));
  let currentBody = null;

  for (const row of rows) {
    if (rowStartsChallenge(row)) {
      const card = createChatChallengeCard(row);
      messagesEl.insertBefore(card, row);
      currentBody = card.querySelector('.chat-challenge-card-body');
    }

    if (currentBody) {
      currentBody.append(row);
    }
  }

  initializeSentencePopovers(messagesEl);
}

function unwrapChallengeCards() {
  for (const card of Array.from(messagesEl.querySelectorAll(':scope > .chat-challenge-card'))) {
    const rows = Array.from(card.querySelectorAll(':scope .message-row'));
    for (const row of rows) {
      messagesEl.insertBefore(row, card);
    }
    card.remove();
  }
}

function createChatChallengeCard(startRow) {
  const card = document.createElement('article');
  card.className = 'card chat-challenge-card';
  const sourceSentence = getChallengeStartedBlock(startRow)?.sourceSentence;
  if (sourceSentence) {
    card.dataset.challengeSource = sourceSentence;
  }

  const body = document.createElement('div');
  body.className = 'card-body chat-challenge-card-body';
  card.append(body);
  return card;
}

function rowStartsChallenge(row) {
  return Boolean(getChallengeStartedBlock(row));
}

function getChallengeStartedBlock(row) {
  const blocks = parseMessageBlocks(row);
  return blocks.find((block) => block?.type === 'challenge_started') || null;
}

function parseMessageBlocks(row) {
  if (!row?.dataset.messageBlocks) {
    return [];
  }

  try {
    const blocks = JSON.parse(row.dataset.messageBlocks);
    return Array.isArray(blocks) ? blocks : [];
  } catch {
    return [];
  }
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
    evaluation.parts.some((part) => normalizePartStatus(part.status) !== 'correct')
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
    path: 'M4 20h4.5L19.7 8.8a2.1 2.1 0 0 0 0-3l-1.5-1.5a2.1 2.1 0 0 0-3 0L4 15.5V20Z M13.8 5.7l4.5 4.5',
  });
  editButton.addEventListener('click', () => {
    putMessageBackInComposer(element.dataset.rawContent || '');
  });

  const copyButton = createMessageActionButton({
    label: 'Copiar texto',
    path: 'M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2 M6 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
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

function createMessageActionButton({ label, path }) {
  const button = document.createElement('button');
  button.className = 'message-action-button';
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="${path}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
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
  const scrollTarget = chatPaneEl || messagesEl;
  scrollTarget.scrollTop = scrollTarget.scrollHeight;
}

function launchConfetti(payload = {}) {
  const existingLayer = document.querySelector('.confetti-layer');
  existingLayer?.remove();

  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');

  const colors = [
    '#eb6864',
    '#22c55e',
    '#facc15',
    '#38bdf8',
    '#a855f7',
    '#f97316',
    '#14b8a6',
  ];
  const count = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 20
    : 120;

  console.log('[Mr. F confetti launched]', {
    automatic: Boolean(payload.automatic),
    challengeId: payload.challenge?.id ?? null,
    count,
    score: payload.score ?? null,
  });

  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
    piece.style.setProperty('--confetti-delay', `${Math.random() * 0.22}s`);
    piece.style.setProperty(
      '--confetti-duration',
      `${0.95 + Math.random() * 0.45}s`,
    );
    piece.style.setProperty(
      '--confetti-drift',
      `${Math.round((Math.random() - 0.5) * 360)}px`,
    );
    piece.style.setProperty(
      '--confetti-rotate',
      `${Math.round(Math.random() * 360)}deg`,
    );
    piece.style.setProperty(
      '--confetti-scale',
      `${0.72 + Math.random() * 0.72}`,
    );
    layer.append(piece);
  }

  document.body.append(layer);
  setTimeout(() => {
    layer.remove();
  }, 1800);
}

if (isInitiallyAuthenticated) {
  setComposerEnabled(true);
  focusComposer();
} else {
  showAuthRequiredMessage(authMessage || undefined);
}
