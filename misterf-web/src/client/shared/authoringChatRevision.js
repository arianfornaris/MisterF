function buildPendingMessageKey() {
  return `authoring-chat-pending:${window.location.pathname}`;
}

/**
 * Stages a message so the authoring chat tab sends it automatically on the
 * next page load. Used by shortcuts (like "Agregar bloque") that live on
 * other tabs of the same authoring page.
 */
export function stageAuthoringChatMessage(message) {
  try {
    window.sessionStorage.setItem(buildPendingMessageKey(), message);
    return true;
  } catch {
    return false;
  }
}

function consumePendingAuthoringChatMessage() {
  try {
    const key = buildPendingMessageKey();
    const message = window.sessionStorage.getItem(key);
    if (message) {
      window.sessionStorage.removeItem(key);
    }

    return message || '';
  } catch {
    return '';
  }
}

/**
 * Turns an authoring "AI chat" composer into a conversational flow: the
 * teacher's message appears in the history, a blinking caret bubble waits for
 * the model, and the assistant reply replaces it — no blocking modal. The
 * form still works as a regular POST when JavaScript is unavailable.
 */
export function initializeAuthoringChatRevision(root = document) {
  const formEl = root.querySelector('[data-authoring-chat-form]');
  const historyEl = root.querySelector('[data-authoring-chat-history]');
  if (!(formEl instanceof HTMLFormElement) || !(historyEl instanceof HTMLElement)) {
    return;
  }

  const textareaEl = formEl.querySelector('textarea[name="message"]');
  const submitButtonEl = formEl.querySelector('[data-authoring-chat-submit]');
  if (!(textareaEl instanceof HTMLTextAreaElement)) {
    return;
  }

  let pending = false;

  const scrollToLatestMessage = () => {
    historyEl.scrollTop = historyEl.scrollHeight;
  };

  const appendMessage = (role, content) => {
    const row = document.createElement('article');
    row.className = `message-row ${role === 'user' ? 'is-user' : 'is-model'} quiz-chat-message-row`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble quiz-chat-message-bubble';

    const paragraph = document.createElement('p');
    paragraph.className = 'quiz-chat-message-content mb-0';
    paragraph.textContent = content;

    bubble.append(paragraph);
    row.append(bubble);
    historyEl.append(row);
    scrollToLatestMessage();
    return { bubble, paragraph };
  };

  const setPending = (isPending) => {
    pending = isPending;
    textareaEl.disabled = isPending;
    if (submitButtonEl instanceof HTMLButtonElement) {
      submitButtonEl.disabled = isPending;
    }
  };

  const appendCreditLink = (bubble) => {
    const returnTo = formEl.dataset.authoringChatCreditsReturnTo || window.location.pathname;
    const link = document.createElement('a');
    link.className = 'btn btn-primary btn-sm mt-2';
    link.href = `/credits?returnTo=${encodeURIComponent(returnTo)}`;
    link.textContent = 'Comprar créditos';
    bubble.append(link);
  };

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) {
      return;
    }

    const message = textareaEl.value.trim();
    if (!message) {
      textareaEl.focus();
      return;
    }

    const body = new URLSearchParams(new FormData(formEl));
    appendMessage('user', message);
    textareaEl.value = '';
    setPending(true);

    const { bubble, paragraph } = appendMessage('assistant', '');
    bubble.classList.add('typing-caret');

    try {
      const response = await fetch(formEl.action, {
        body,
        headers: { Accept: 'application/json' },
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      bubble.classList.remove('typing-caret');

      if (response.ok && payload && typeof payload.assistantMessage === 'string') {
        paragraph.textContent = payload.assistantMessage;
      } else {
        paragraph.textContent =
          payload && typeof payload.error === 'string'
            ? payload.error
            : 'No pude aplicar ese cambio ahora mismo. Inténtalo otra vez.';
        if (payload && payload.creditExhausted) {
          appendCreditLink(bubble);
        }
      }
    } catch {
      bubble.classList.remove('typing-caret');
      paragraph.textContent = 'No pude aplicar ese cambio ahora mismo. Revisa tu conexión e inténtalo otra vez.';
    } finally {
      setPending(false);
      scrollToLatestMessage();
      textareaEl.focus();
    }
  });

  // Match the main Mister F chat composer: Enter sends the message,
  // Shift+Enter inserts a line break.
  textareaEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  const pendingMessage = consumePendingAuthoringChatMessage();
  if (pendingMessage) {
    textareaEl.value = pendingMessage;
    formEl.requestSubmit();
  }
}
