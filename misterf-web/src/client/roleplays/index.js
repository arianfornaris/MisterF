import { initializeModificationModal } from '../shared/modificationModal.js';
import { initializeAttachmentPickers } from '../shared/attachmentPicker.js';

const attachmentPickers = initializeAttachmentPickers();
import { t } from '../shared/i18n.js';
import { renderMarkdown } from '../chat/shared/markdown.js';
import { initializeCreateResourceFromContext } from '../shared/createResourceFromContext.js';
import {
  getMarkdownEditorValue,
  initializeMarkdownEditors,
} from '../shared/markdownEditor.js';
import { initializeResourceMoveModal } from '../shared/resourceMoveModal.js';
import { initializePendingModalForms } from '../shared/pendingModal.js';
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
      copyButtonEl.textContent = copied ? t('clientMisc.copied') : t('clientMisc.copyFailed');
      window.setTimeout(() => {
        copyButtonEl.innerHTML = `<i class="bi bi-copy me-1" aria-hidden="true"></i>${t('clientMisc.copy')}`;
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
  initializePendingModalForms({
    formSelector: '[data-roleplay-pending-form]',
    pendingModalSelector: '[data-roleplay-pending-modal]',
    skipSelector: '[data-roleplay-turn-form]',
    submitSelector: '[data-roleplay-pending-submit]',
  });
}

function findAvatarInput(target) {
  for (const inputEl of document.querySelectorAll('[data-roleplay-avatar-input]')) {
    if (inputEl instanceof HTMLInputElement && inputEl.dataset.roleplayAvatarInput === target) {
      return inputEl;
    }
  }

  return null;
}

function findAvatarPreview(target) {
  for (const previewEl of document.querySelectorAll('[data-roleplay-avatar-preview]')) {
    if (previewEl instanceof HTMLElement && previewEl.dataset.roleplayAvatarPreview === target) {
      return previewEl;
    }
  }

  return null;
}

function renderAvatarPreview(previewEl, input) {
  previewEl.replaceChildren();

  if (input.avatarSrc) {
    const imageEl = document.createElement('img');
    imageEl.src = input.avatarSrc;
    imageEl.alt = '';
    previewEl.append(imageEl);
    return;
  }

  const iconEl = document.createElement('i');
  iconEl.className = `bi ${input.fallbackIcon}`;
  previewEl.append(iconEl);
}

function initializeRoleplayAvatarSelector() {
  const modalEl = document.querySelector('[data-roleplay-avatar-selector-modal]');
  if (!(modalEl instanceof HTMLElement) || !window.bootstrap?.Modal) {
    return;
  }

  let activeTarget = '';
  const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);

  const updateSelectedAvatarOption = () => {
    const activeInputEl = findAvatarInput(activeTarget);
    const selectedAvatarId = activeInputEl?.value || '';
    for (const optionEl of modalEl.querySelectorAll('[data-roleplay-avatar-option]')) {
      if (!(optionEl instanceof HTMLElement)) {
        continue;
      }

      const isSelected = (optionEl.dataset.avatarId || '') === selectedAvatarId;
      optionEl.classList.toggle('is-selected', isSelected);
      optionEl.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
  };

  for (const openButtonEl of document.querySelectorAll('[data-roleplay-avatar-open]')) {
    if (!(openButtonEl instanceof HTMLButtonElement)) {
      continue;
    }

    openButtonEl.addEventListener('click', () => {
      activeTarget = openButtonEl.dataset.roleplayAvatarTarget || '';
      if (!activeTarget) {
        return;
      }

      updateSelectedAvatarOption();
      modal.show();
    });
  }

  for (const optionEl of modalEl.querySelectorAll('[data-roleplay-avatar-option]')) {
    if (!(optionEl instanceof HTMLButtonElement)) {
      continue;
    }

    optionEl.addEventListener('click', () => {
      const activeInputEl = findAvatarInput(activeTarget);
      const activePreviewEl = findAvatarPreview(activeTarget);
      if (!activeInputEl || !activePreviewEl) {
        return;
      }

      const avatarId = optionEl.dataset.avatarId || '';
      activeInputEl.value = avatarId;
      renderAvatarPreview(activePreviewEl, {
        avatarSrc: optionEl.dataset.avatarSrc || '',
        fallbackIcon: activeTarget === 'ai' ? 'bi-person-video3' : 'bi-person',
      });
      updateSelectedAvatarOption();
      modal.hide();
    });
  }
}

function getRoleplayFormControl(formEl, name) {
  const control = formEl.elements.namedItem(name);
  return control instanceof HTMLInputElement
    || control instanceof HTMLSelectElement
    || control instanceof HTMLTextAreaElement
    ? control
    : null;
}

function buildCurrentRoleplayDraft(formEl) {
  const titleEl = getRoleplayFormControl(formEl, 'title');
  const descriptionEl = getRoleplayFormControl(formEl, 'description');
  const levelEl = getRoleplayFormControl(formEl, 'level');
  if (
    !(titleEl instanceof HTMLInputElement)
    || !(descriptionEl instanceof HTMLTextAreaElement)
    || !(levelEl instanceof HTMLSelectElement)
  ) {
    return null;
  }

  const buildCharacter = (id, prefix) => {
    const nameEl = getRoleplayFormControl(formEl, `${prefix}CharacterName`);
    const descriptionFieldEl = getRoleplayFormControl(formEl, `${prefix}CharacterDescription`);
    const avatarEl = getRoleplayFormControl(formEl, `${prefix}CharacterAvatarId`);
    if (
      !(nameEl instanceof HTMLInputElement)
      || !(descriptionFieldEl instanceof HTMLTextAreaElement)
      || !(avatarEl instanceof HTMLInputElement)
    ) {
      return null;
    }

    return {
      ...(avatarEl.value ? { avatarId: avatarEl.value } : {}),
      description: descriptionFieldEl.value,
      id,
      name: nameEl.value,
    };
  };

  const learnerCharacter = buildCharacter('learner', 'learner');
  const aiCharacter = buildCharacter('ai', 'ai');
  if (!learnerCharacter || !aiCharacter) {
    return null;
  }

  return {
    characters: [learnerCharacter, aiCharacter],
    description: getMarkdownEditorValue(descriptionEl),
    level: levelEl.value,
    title: titleEl.value,
  };
}

function findRoleplayAvatarDetails(avatarId) {
  for (const optionEl of document.querySelectorAll('[data-roleplay-avatar-option]')) {
    if (optionEl instanceof HTMLElement && (optionEl.dataset.avatarId || '') === avatarId) {
      return {
        name: optionEl.dataset.avatarName || '',
        src: optionEl.dataset.avatarSrc || '',
      };
    }
  }

  return { name: '', src: '' };
}

function renderRoleplayModificationValue(container, field, value, labels) {
  container.replaceChildren();
  if (field === 'description') {
    container.classList.add('resource-markdown');
    container.innerHTML = renderMarkdown(value);
    return;
  }

  if (field.endsWith('.avatarId')) {
    const avatar = findRoleplayAvatarDetails(value);
    const wrap = document.createElement('div');
    wrap.className = 'd-flex align-items-center gap-2';
    const preview = document.createElement('div');
    preview.className = 'roleplay-character-avatar-preview flex-shrink-0';
    preview.setAttribute('aria-hidden', 'true');
    renderAvatarPreview(preview, {
      avatarSrc: avatar.src,
      fallbackIcon: field.startsWith('ai.') ? 'bi-person-video3' : 'bi-person',
    });
    const name = document.createElement('span');
    name.textContent = avatar.name || labels.noAvatar;
    wrap.append(preview, name);
    container.append(wrap);
    return;
  }

  container.textContent = value || '—';
}

function renderRoleplayModificationChanges(container, changes, labels) {
  container.replaceChildren();
  if (!Array.isArray(changes)) {
    return false;
  }

  let renderedCount = 0;
  for (const change of changes) {
    if (
      !change
      || typeof change.field !== 'string'
      || typeof change.before !== 'string'
      || typeof change.after !== 'string'
      || !labels.fields[change.field]
    ) {
      continue;
    }

    const card = document.createElement('article');
    card.className = 'card mb-3';
    const header = document.createElement('div');
    header.className = 'card-header fw-semibold py-2';
    header.textContent = labels.fields[change.field];
    const body = document.createElement('div');
    body.className = 'card-body';
    const row = document.createElement('div');
    row.className = 'row g-3';

    for (const version of ['before', 'after']) {
      const column = document.createElement('div');
      column.className = 'col-12 col-md-6 d-flex flex-column';
      const heading = document.createElement('p');
      heading.className = version === 'before'
        ? 'small text-body-secondary mb-1'
        : 'small fw-semibold text-primary mb-1';
      heading.textContent = version === 'before' ? labels.current : labels.proposed;
      const value = document.createElement('div');
      value.className = version === 'before'
        ? 'border rounded p-3 flex-grow-1 bg-body-tertiary'
        : 'border border-primary rounded p-3 flex-grow-1';
      renderRoleplayModificationValue(value, change.field, change[version], labels);
      column.append(heading, value);
      row.append(column);
    }

    body.append(row);
    card.append(header, body);
    container.append(card);
    renderedCount += 1;
  }

  return renderedCount > 0;
}


function initializeRoleplayModification() {
  const formEl = document.querySelector('[data-roleplay-authoring-form]');
  const modalEl = document.querySelector('[data-modify-modal]');
  if (!(formEl instanceof HTMLFormElement) || !(modalEl instanceof HTMLElement)) {
    return;
  }

  const attachments = attachmentPickers.get('roleplayModifyAttachmentWizard');

  // Only the roleplay-specific pieces stay here: how to read the current draft
  // off the authoring form, and how to render a diff that has to show avatars
  // rather than plain strings. Phases, credit errors, and stale-preview
  // recovery come from the shared controller.
  const labels = {
    current: modalEl.dataset.currentLabel || '',
    fields: {
      'ai.avatarId': modalEl.dataset.fieldAiAvatarid,
      'ai.description': modalEl.dataset.fieldAiDescription,
      'ai.name': modalEl.dataset.fieldAiName,
      description: modalEl.dataset.fieldDescription,
      'learner.avatarId': modalEl.dataset.fieldLearnerAvatarid,
      'learner.description': modalEl.dataset.fieldLearnerDescription,
      'learner.name': modalEl.dataset.fieldLearnerName,
      level: modalEl.dataset.fieldLevel,
      title: modalEl.dataset.fieldTitle,
    },
    noAvatar: modalEl.dataset.noAvatarLabel || '',
    proposed: modalEl.dataset.proposedLabel || '',
  };

  initializeModificationModal({
    extraFields: () => ({
      attachmentIds: (attachments?.getIds() ?? []).join(','),
    }),
    buildCurrentDraft: () => buildCurrentRoleplayDraft(formEl),
    modalEl,
    renderChanges: (container, changes) =>
      renderRoleplayModificationChanges(container, changes, labels),
    triggers: document.querySelectorAll('[data-modify-open]'),
  });

  modalEl.addEventListener('hidden.bs.modal', () => attachments?.clear());
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
      showRoleplayTurnError(errorEl, t('clientMisc.writeBeforeContinue'));
      return;
    }

    const formData = new URLSearchParams(new FormData(formEl));
    formData.set('text', text);

    hideRoleplayTurnError(errorEl);
    formEl.dataset.roleplaySubmitting = 'true';
    textareaEl.value = '';
    resizeTextarea();

    const learnerName = transcriptEl.dataset.learnerName || t('clientMisc.roleplayYou');
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

      textareaEl.focus();
    } catch {
      loadingTurnEl.remove();
      showRoleplayTurnError(errorEl, t('clientMisc.roleplayTurnSendError'));
    } finally {
      setRoleplayTurnFormPending({
        pending: false,
        submitButtonEl,
        textareaEl,
      });

      formEl.dataset.roleplaySubmitting = 'false';
    }
  });
}

function getRoleplayTurnFallbackError(response) {
  if (response.status === 403) {
    return t('clientMisc.roleplayTurnSessionExpired');
  }

  return t('clientMisc.cannotGenerateResponse');
}

function appendRoleplayTurn(transcriptEl, input) {
  const articleEl = document.createElement('article');
  articleEl.className = `roleplay-turn is-${input.speaker === 'learner' ? 'learner' : 'ai'} is-entering`;

  const avatarEl = document.createElement('div');
  avatarEl.className = 'roleplay-turn-avatar';
  avatarEl.setAttribute('aria-hidden', 'true');
  renderAvatarPreview(avatarEl, {
    avatarSrc: input.speaker === 'learner'
      ? transcriptEl.dataset.learnerAvatarSrc || ''
      : transcriptEl.dataset.aiAvatarSrc || '',
    fallbackIcon: input.speaker === 'learner' ? 'bi-person' : 'bi-person-video3',
  });

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
  indicatorEl.setAttribute('aria-label', t('clientMisc.roleplayAiThinking', { name: aiName }));

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
    ? `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${t('clientMisc.waitingResponse')}`
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
    buyLink.textContent = t('clientMisc.buyCredits');
    errorEl.append(buyLink);
  }
  errorEl.classList.remove('d-none');
}

function hideRoleplayTurnError(errorEl) {
  if (errorEl instanceof HTMLElement) {
    errorEl.classList.add('d-none');
  }
}

function scrollRoleplayTranscriptToBottom(transcriptEl) {
  requestAnimationFrame(() => {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  });
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
initializeRoleplayAvatarSelector();
initializeMarkdownEditors();
initializeRoleplayModification();
initializeStaticMarkdown();
initializeRoleplayTranscriptScroll();
initializeRoleplayTurnComposer();
initializeRoleplayEvaluationPopovers();
initializeCreateResourceFromContext();
initializeResourceMoveModal();

