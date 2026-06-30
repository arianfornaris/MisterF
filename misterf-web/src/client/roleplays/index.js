import { initializeAuthoringChatScroll } from '../shared/authoringChatScroll.js';
import { renderMarkdown } from '../chat/shared/markdown.js';
import { initializeCreateResourceFromContext } from '../shared/createResourceFromContext.js';
import { initializeMarkdownEditors } from '../shared/markdownEditor.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
import { initializeStaticMarkdown } from '../shared/staticMarkdown.js';

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

function initializeRoleplaySharingUi() {
  const shareFieldEl = document.querySelector('[data-roleplay-share-link-field]');
  const copyButtonEl = document.querySelector('[data-copy-roleplay-share-link]');
  const nativeShareButtonEl = document.querySelector('[data-native-share-roleplay-link]');
  const autoOpenModalEl = document.querySelector('[data-auto-open-roleplay-share-modal]');

  if (copyButtonEl && shareFieldEl instanceof HTMLInputElement) {
    copyButtonEl.addEventListener('click', async () => {
      const copied = await copyTextToClipboard(shareFieldEl.value);
      copyButtonEl.textContent = copied ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        copyButtonEl.innerHTML = '<i class="bi bi-copy me-1" aria-hidden="true"></i>Copiar';
      }, 1200);
    });
  }

  if (nativeShareButtonEl) {
    if (typeof navigator.share !== 'function') {
      nativeShareButtonEl.classList.add('d-none');
    } else if (shareFieldEl instanceof HTMLInputElement) {
      nativeShareButtonEl.addEventListener('click', async () => {
        if (!shareFieldEl.value) {
          return;
        }

        try {
          await navigator.share({
            title: 'Roleplay compartido',
            url: shareFieldEl.value,
          });
        } catch {
          // Ignore cancelled native share attempts.
        }
      });
    }
  }

  if (autoOpenModalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(autoOpenModalEl).show();
  }
}

function initializeRoleplayPendingUi() {
  if (!window.bootstrap?.Modal) {
    return;
  }

  for (const formEl of document.querySelectorAll('[data-roleplay-pending-form]')) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    if (formEl.matches('[data-roleplay-turn-form]')) {
      continue;
    }

    const submitButtonEl = formEl.querySelector('[data-roleplay-pending-submit]');
    const parentModalEl = formEl.closest('.modal');
    const pendingModalEl = document.querySelector('[data-roleplay-pending-modal]');

    formEl.addEventListener('submit', () => {
      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        submitButtonEl.textContent = submitButtonEl.dataset.loadingText || 'Procesando...';
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

function initializeRoleplayTurnComposer() {
  const formEl = document.querySelector('[data-roleplay-turn-form]');
  const transcriptEl = document.querySelector('[data-roleplay-transcript]');
  if (!(formEl instanceof HTMLFormElement) || !(transcriptEl instanceof HTMLElement)) {
    return;
  }

  const textareaEl = formEl.querySelector('textarea[name="text"]');
  const submitButtonEl = formEl.querySelector('[data-roleplay-pending-submit]');
  const errorEl = document.querySelector('[data-roleplay-turn-error]');
  if (!(textareaEl instanceof HTMLTextAreaElement)) {
    return;
  }

  const resizeTextarea = () => {
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 120)}px`;
  };

  textareaEl.addEventListener('input', resizeTextarea);
  textareaEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    event.preventDefault();
    if (formEl.dataset.roleplaySubmitting === 'true') {
      return;
    }

    if (typeof formEl.requestSubmit === 'function') {
      formEl.requestSubmit();
    } else {
      formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
  resizeTextarea();

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (formEl.dataset.roleplaySubmitting === 'true') {
      return;
    }

    const text = textareaEl.value.trim();
    if (!text) {
      showRoleplayTurnError(errorEl, 'Escribe tu respuesta antes de continuar.');
      return;
    }

    const formData = new URLSearchParams(new FormData(formEl));
    formData.set('text', text);

    hideRoleplayTurnError(errorEl);
    formEl.dataset.roleplaySubmitting = 'true';
    textareaEl.value = '';
    resizeTextarea();

    const learnerName = transcriptEl.dataset.learnerName || 'Tú';
    const aiName = transcriptEl.dataset.aiName || 'IA';
    appendRoleplayTurn(transcriptEl, {
      speaker: 'learner',
      speakerName: learnerName,
      text,
    });
    const loadingTurnEl = appendRoleplayThinkingTurn(transcriptEl, aiName);
    setRoleplayTurnFormPending({
      pending: true,
      submitButtonEl,
      textareaEl,
    });

    let hasReachedTurnLimit = false;

    try {
      const response = await fetch(formEl.action, {
        body: formData,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-Requested-With': 'fetch',
        },
        method: formEl.method || 'post',
      });

      const payload = await response.json().catch(() => null);
      loadingTurnEl.remove();

      if (!payload || !response.ok || payload.ok === false) {
        showRoleplayTurnError(
          errorEl,
          payload?.error || getRoleplayTurnFallbackError(response),
          Boolean(payload?.creditExhausted),
        );
        return;
      }

      if (payload.aiTurn) {
        appendRoleplayTurn(transcriptEl, {
          speaker: 'ai',
          speakerName: aiName,
          text: payload.aiTurn.text || '',
        });
      }

      updateRoleplayTurnCounter(payload.learnerTurnCount);

      if (payload.hasReachedTurnLimit) {
        hasReachedTurnLimit = true;
        textareaEl.placeholder = 'Llegaste al límite de turnos. Puedes finalizar el Roleplay.';
        return;
      }

      textareaEl.focus();
    } catch {
      loadingTurnEl.remove();
      showRoleplayTurnError(errorEl, 'No pude enviar tu turno ahora mismo. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      setRoleplayTurnFormPending({
        pending: false,
        submitButtonEl,
        textareaEl,
      });

      if (hasReachedTurnLimit) {
        textareaEl.disabled = true;
        if (submitButtonEl instanceof HTMLButtonElement) {
          submitButtonEl.disabled = true;
        }
      }
      formEl.dataset.roleplaySubmitting = 'false';
    }
  });
}

function getRoleplayTurnFallbackError(response) {
  if (response.status === 403) {
    return 'No pude enviar tu turno porque la sesión expiró. Actualiza la página e inténtalo otra vez.';
  }

  return 'No pude generar la siguiente respuesta ahora mismo.';
}

function appendRoleplayTurn(transcriptEl, input) {
  const articleEl = document.createElement('article');
  articleEl.className = `roleplay-turn is-${input.speaker === 'learner' ? 'learner' : 'ai'} is-entering`;

  const avatarEl = document.createElement('div');
  avatarEl.className = 'roleplay-turn-avatar';
  avatarEl.setAttribute('aria-hidden', 'true');
  avatarEl.innerHTML = `<i class="bi ${input.speaker === 'learner' ? 'bi-person' : 'bi-person-video3'}"></i>`;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'roleplay-turn-body';

  const speakerEl = document.createElement('div');
  speakerEl.className = 'roleplay-turn-speaker';
  speakerEl.textContent = input.speakerName;

  const textEl = document.createElement('div');
  textEl.className = `${input.speaker === 'learner' ? 'roleplay-turn-text' : 'inline-character-text'} resource-markdown`;
  textEl.innerHTML = renderMarkdown(input.text || '');

  bodyEl.append(speakerEl, textEl);
  articleEl.append(avatarEl, bodyEl);
  transcriptEl.append(articleEl);
  scrollRoleplayTranscriptToBottom(transcriptEl);

  window.setTimeout(() => {
    articleEl.classList.remove('is-entering');
  }, 460);

  return articleEl;
}

function appendRoleplayThinkingTurn(transcriptEl, aiName) {
  const indicatorEl = document.createElement('div');
  indicatorEl.className = 'roleplay-response-caret is-entering';
  indicatorEl.setAttribute('role', 'status');
  indicatorEl.setAttribute('aria-label', `${aiName} está pensando su respuesta`);

  const caretEl = document.createElement('span');
  caretEl.className = 'roleplay-response-caret-mark';
  caretEl.setAttribute('aria-hidden', 'true');

  indicatorEl.append(caretEl);
  transcriptEl.append(indicatorEl);
  scrollRoleplayTranscriptToBottom(transcriptEl);
  return indicatorEl;
}

function setRoleplayTurnFormPending(input) {
  input.textareaEl.disabled = input.pending;
  if (!(input.submitButtonEl instanceof HTMLButtonElement)) {
    return;
  }

  if (!input.submitButtonEl.dataset.defaultHtml) {
    input.submitButtonEl.dataset.defaultHtml = input.submitButtonEl.innerHTML;
  }

  input.submitButtonEl.disabled = input.pending;
  input.submitButtonEl.innerHTML = input.pending
    ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Esperando respuesta'
    : input.submitButtonEl.dataset.defaultHtml;
}

function showRoleplayTurnError(errorEl, message, isCreditExhausted = false) {
  if (!(errorEl instanceof HTMLElement)) {
    return;
  }

  errorEl.replaceChildren(document.createTextNode(message));
  if (isCreditExhausted) {
    const buyLink = document.createElement('a');
    buyLink.className = 'btn btn-primary btn-sm ms-2';
    buyLink.href = `/credits?returnTo=${encodeURIComponent(window.location.pathname)}`;
    buyLink.textContent = 'Comprar créditos';
    errorEl.append(buyLink);
  }
  errorEl.classList.remove('d-none');
}

function hideRoleplayTurnError(errorEl) {
  if (errorEl instanceof HTMLElement) {
    errorEl.classList.add('d-none');
  }
}

function updateRoleplayTurnCounter(learnerTurnCount) {
  const counterEl = document.querySelector('[data-roleplay-turn-counter]');
  if (!(counterEl instanceof HTMLElement) || typeof learnerTurnCount !== 'number') {
    return;
  }

  const maxTurns = counterEl.dataset.maxTurns || '';
  counterEl.innerHTML = `<i class="bi bi-chat-left-text" aria-hidden="true"></i> ${learnerTurnCount}/${escapeHtml(maxTurns)} turnos`;
}

function scrollRoleplayTranscriptToBottom(transcriptEl) {
  requestAnimationFrame(() => {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  });
}

function escapeHtml(value) {
  const wrapper = document.createElement('div');
  wrapper.textContent = value || '';
  return wrapper.innerHTML;
}

function initializeRoleplayTranscriptScroll() {
  const transcriptEl = document.querySelector('[data-roleplay-transcript]');
  if (!(transcriptEl instanceof HTMLElement)) {
    return;
  }

  scrollRoleplayTranscriptToBottom(transcriptEl);
}

function initializeRoleplayEvaluationPopovers(root = document) {
  if (!window.bootstrap?.Popover) {
    return;
  }

  const hideAllPopovers = (except = null) => {
    for (const node of document.querySelectorAll('[data-roleplay-evaluation-popover]')) {
      if (node === except) {
        continue;
      }

      window.bootstrap.Popover.getOrCreateInstance(node).hide();
    }
  };

  if (!document.body.dataset.roleplayEvaluationPopoverDismissBound) {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest('[data-roleplay-evaluation-popover]') ||
        target.closest('.popover')
      ) {
        return;
      }

      hideAllPopovers();
    });
    document.body.dataset.roleplayEvaluationPopoverDismissBound = 'true';
  }

  for (const trigger of root.querySelectorAll('[data-roleplay-evaluation-popover]')) {
    if (!(trigger instanceof HTMLElement) || trigger.dataset.roleplayPopoverBound === 'true') {
      continue;
    }

    const popover = window.bootstrap.Popover.getOrCreateInstance(trigger);
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = trigger.getAttribute('aria-describedby');
      hideAllPopovers(isOpen ? null : trigger);

      if (isOpen) {
        popover.hide();
      } else {
        popover.show();
      }
    });
    trigger.dataset.roleplayPopoverBound = 'true';
  }
}

initializeRoleplaySharingUi();
initializeRoleplayPendingUi();
initializeStaticMarkdown();
initializeRoleplayTranscriptScroll();
initializeRoleplayTurnComposer();
initializeRoleplayEvaluationPopovers();
initializeAuthoringChatScroll();
initializeCreateResourceFromContext();
initializeResourceMoveModal();
initializeMarkdownEditors();
