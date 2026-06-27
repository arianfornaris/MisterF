import { renderMarkdown } from '../chat/shared/markdown.js';
import { initializeListGroupDropdownStacking } from '../shared/listGroupDropdownStacking.js';

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

function initializeAutoOpenModal() {
  const modalEl = document.querySelector('[data-auto-open-modal]');
  if (!modalEl || !window.bootstrap?.Modal) {
    return;
  }

  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function initializeResourceGenerationPendingUi() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('form[action="/chatrooms/generate-draft"]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-resource-generate-submit]');
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-resource-pending-modal]');

    formEl.addEventListener('submit', () => {
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = 'Creando...';
      }

      if (parentModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(parentModalEl).hide();
      }

      if (pendingModalEl) {
        window.setTimeout(() => {
          window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
        }, 120);
      }
    });
  }
}

function initializePendingSubmitUi() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('form[data-pending-submit-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-pending-submit-button]');
    const pendingModalEl = document.querySelector('[data-pending-submit-modal]');

    formEl.addEventListener('submit', () => {
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = 'Creando...';
      }

      if (pendingModalEl) {
        window.setTimeout(() => {
          window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
        }, 120);
      }
    });
  }
}

export function initializeChatroomsPage() {
  initializeChatroomSharingUi();
  initializeChatroomReportUi();
  initializeAutoOpenModal();
  initializeResourceGenerationPendingUi();
  initializeListGroupDropdownStacking();
  initializePendingSubmitUi();

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

function initializeChatroomReportUi() {
  const root = document.querySelector('[data-report-root]');
  if (!root) {
    return;
  }

  const reportUrl = root.getAttribute('data-report-url') || '';
  const counterEl = root.querySelector('[data-report-slide-counter]');
  const titleEl = root.querySelector('[data-report-slide-title]');
  const descriptionEl = root.querySelector('[data-report-slide-description]');
  const partsRoot = root.querySelector('[data-report-sentence-parts]');
  const panel = root.querySelector('[data-report-explanation-panel]');
  const panelTitleEl = root.querySelector('[data-report-explanation-title]');
  const panelBodyEl = root.querySelector('[data-report-explanation-body]');
  const prevEl = root.querySelector('[data-report-prev]');
  const nextEl = root.querySelector('[data-report-next]');
  const paginationEl = root.querySelector('[data-report-pagination]');

  if (
    !reportUrl ||
    !counterEl ||
    !titleEl ||
    !descriptionEl ||
    !partsRoot ||
    !panel ||
    !panelTitleEl ||
    !panelBodyEl
  ) {
    return;
  }

  let currentIndex = readCurrentReportSlideIndex();

  function bindExplanationButtons() {
    for (const button of partsRoot.querySelectorAll('button[data-report-part-explanation]')) {
      button.addEventListener('click', () => {
        const status = button.getAttribute('data-report-part-status') || 'improve';
        const text = button.getAttribute('data-report-part-text') || '';
        const explanation =
          button.getAttribute('data-report-part-explanation') ||
          'Esta parte necesita un ajuste.';

        panelTitleEl.innerHTML = `${
          status === 'error' ? 'Error' : 'Puede mejorar'
        }: <span class="text-body-secondary">${escapeHtml(text)}</span>`;
        panelBodyEl.textContent = explanation;
        panel.hidden = false;

        for (const currentButton of partsRoot.querySelectorAll('button[data-report-part-explanation]')) {
          currentButton.classList.toggle('active', currentButton === button);
        }
      });
    }
  }

  function renderParts(parts) {
    partsRoot.innerHTML = '';

    for (const [index, part] of parts.entries()) {
      let node = null;
      if (part.status === 'correct') {
        node = document.createElement('span');
        node.className = 'sentence-part is-correct';
        node.textContent = part.text;
      } else {
        node = document.createElement('button');
        node.type = 'button';
        node.className = `sentence-part is-${part.status}`;
        node.textContent = part.text;
        node.setAttribute('data-report-part-text', part.text || '');
        node.setAttribute('data-report-part-status', part.status || 'improve');
        node.setAttribute(
          'data-report-part-explanation',
          part.explanation || 'Esta parte necesita un ajuste.',
        );
      }

      partsRoot.append(node);
      if (index < parts.length - 1) {
        partsRoot.append(document.createTextNode(' '));
      }
    }

    bindExplanationButtons();
  }

  function renderPanel(parts) {
    const firstIssue = Array.isArray(parts)
      ? parts.find((part) => part && part.status !== 'correct')
      : null;

    if (!firstIssue) {
      panel.hidden = true;
      panelTitleEl.textContent = '';
      panelBodyEl.textContent = '';
      return;
    }

    panelTitleEl.innerHTML = `${
      firstIssue.status === 'error' ? 'Error' : 'Puede mejorar'
    }: <span class="text-body-secondary">${escapeHtml(firstIssue.text || '')}</span>`;
    panelBodyEl.textContent = firstIssue.explanation || 'Esta parte necesita un ajuste.';
    panel.hidden = false;
  }

  function updateNav(slideCount) {
    if (prevEl) {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      prevEl.setAttribute('href', `${reportUrl}?slide=${prevIndex}`);
      prevEl.classList.toggle('disabled', currentIndex === 0);
      prevEl.setAttribute('aria-disabled', String(currentIndex === 0));
    }

    if (nextEl) {
      const nextIndex = currentIndex < slideCount - 1 ? currentIndex + 1 : slideCount - 1;
      nextEl.setAttribute('href', `${reportUrl}?slide=${nextIndex}`);
      nextEl.classList.toggle('disabled', currentIndex >= slideCount - 1);
      nextEl.setAttribute('aria-disabled', String(currentIndex >= slideCount - 1));
    }

    if (!paginationEl) {
      return;
    }

    for (const button of paginationEl.querySelectorAll('[data-report-jump]')) {
      const index = Number(button.getAttribute('data-report-jump'));
      const isActive = index === currentIndex;
      button.classList.toggle('btn-primary', isActive);
      button.classList.toggle('btn-outline-secondary', !isActive);
    }
  }

  async function loadSlide(nextIndex) {
    const response = await fetch(`${reportUrl}?slide=${nextIndex}`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      window.location.href = `${reportUrl}?slide=${nextIndex}`;
      return;
    }

    const payload = await response.json();
    if (!payload?.ok || !payload?.report?.slide) {
      window.location.href = `${reportUrl}?slide=${nextIndex}`;
      return;
    }

    const report = payload.report;
    const slide = report.slide;
    currentIndex = Number.isInteger(report.index) ? report.index : nextIndex;
    counterEl.textContent = `Slide ${currentIndex + 1} de ${report.slideCount}`;
    titleEl.textContent = slide.title || 'Análisis';
    descriptionEl.textContent = slide.evaluationDescription || '';
    renderParts(Array.isArray(slide.messageEvaluation?.parts) ? slide.messageEvaluation.parts : []);
    renderPanel(Array.isArray(slide.messageEvaluation?.parts) ? slide.messageEvaluation.parts : []);
    updateNav(report.slideCount || 1);
    window.history.replaceState({}, '', `${reportUrl}?slide=${currentIndex}`);
  }

  function handleNavClick(event, nextIndex) {
    event.preventDefault();
    if (nextIndex === currentIndex || nextIndex < 0) {
      return;
    }
    void loadSlide(nextIndex);
  }

  bindExplanationButtons();

  prevEl?.addEventListener('click', (event) => {
    if (currentIndex <= 0) {
      event.preventDefault();
      return;
    }
    handleNavClick(event, currentIndex - 1);
  });

  nextEl?.addEventListener('click', (event) => {
    const jump = Number(nextEl.getAttribute('href')?.match(/slide=(\d+)/)?.[1] || currentIndex);
    if (jump === currentIndex) {
      event.preventDefault();
      return;
    }
    handleNavClick(event, jump);
  });

  for (const button of root.querySelectorAll('[data-report-jump]')) {
    button.addEventListener('click', (event) => {
      const nextIndex = Number(button.getAttribute('data-report-jump'));
      if (!Number.isInteger(nextIndex)) {
        return;
      }
      handleNavClick(event, nextIndex);
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readCurrentReportSlideIndex() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get('slide'));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function initializeChatroomSharingUi() {
  const autoOpenModalEl =
    document.querySelector('#shareChatRoomLinkModal[data-auto-open-share-modal]') ||
    document.querySelector('#shareChatRoomProfileModal[data-auto-open-share-modal]');
  if (autoOpenModalEl && window.bootstrap?.Modal) {
    window.setTimeout(() => {
      window.bootstrap.Modal.getOrCreateInstance(autoOpenModalEl).show();
    }, 0);
  }

  const shareFieldEl = document.querySelector('[data-chatroom-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-chatroom-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-chatroom-link]');

  if (!shareFieldEl && !copyButtonEl && !nativeShareButtonEl) {
    return;
  }

  if (!(shareFieldEl instanceof HTMLInputElement)) {
    return;
  }

  copyButtonEl?.addEventListener('click', async () => {
    const shareUrl = shareFieldEl.value.trim();
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      copyButtonEl.blur();
    } catch {
      shareFieldEl.focus();
      shareFieldEl.select();
    }
  });

  nativeShareButtonEl?.addEventListener('click', async () => {
    const shareUrl = shareFieldEl.value.trim();
    if (!shareUrl) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Sala de chat compartida',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // Ignore cancelled share attempts.
    }
  });
}
