import { formatConversationDate } from '../utils/dates.js';
import { disableTextAssist } from '../utils/textAssist.js';

export class ConversationListView {
  constructor({ panelEl, deleteModalEl, deleteTitleEl, confirmDeleteButtonEl, onRename, onDelete, onFinalize, buildConversationPath }) {
    this.panelEl = panelEl;
    this.deleteModalEl = deleteModalEl;
    this.deleteTitleEl = deleteTitleEl;
    this.confirmDeleteButtonEl = confirmDeleteButtonEl;
    this.onRename = onRename;
    this.onDelete = onDelete;
    this.onFinalize = onFinalize;
    this.buildConversationPath = buildConversationPath;
    this.pendingDeleteTarget = null;

    this.confirmDeleteButtonEl?.addEventListener('click', () => {
      this.confirmDelete();
    });
  }

  configureExistingItems(root = document) {
    for (const item of root.querySelectorAll('.conversation-item')) {
      this.configureItem(item);
    }
  }

  markActive(activeConversationId) {
    for (const item of document.querySelectorAll('[data-conversation-id]')) {
      item.classList.toggle(
        'is-active',
        item.dataset.conversationId === activeConversationId,
      );
    }
  }

  upsert(conversation) {
    if (!conversation?.id || !this.panelEl) {
      return;
    }

    const recentsContainer = this.panelEl.querySelector('.panel-recents');
    let list = this.panelEl.querySelector('.conversation-list');
    if (!list) {
      const emptyState = this.panelEl.querySelector('.conversation-empty');
      emptyState?.remove();
      list = document.createElement('div');
      list.className = 'conversation-list';
      recentsContainer?.append(list);
    } else {
      this.panelEl.querySelector('.conversation-empty')?.remove();
    }

    let item = list.querySelector(
      `[data-conversation-id="${CSS.escape(conversation.id)}"]`,
    );

    if (!item) {
      item = this.createItem(conversation);
      list.prepend(item);
      return;
    }

    const previousUpdatedAt =
      item.querySelector('.conversation-date')?.dateTime || '';
    const nextUpdatedAt = conversation.updatedAt || '';

    item.querySelector('.conversation-title').textContent =
      conversation.title || 'Nueva conversación';
    this.syncClosedState(item, conversation);

    const date = item.querySelector('.conversation-date');
    date.dateTime = nextUpdatedAt;
    date.textContent = formatConversationDate(nextUpdatedAt);
    date.title = nextUpdatedAt;

    if (nextUpdatedAt && nextUpdatedAt !== previousUpdatedAt) {
      list.prepend(item);
    }
  }

  update(conversation, options = {}) {
    if (!conversation?.id || !this.panelEl) {
      return;
    }

    const item = this.panelEl.querySelector(
      `[data-conversation-id="${CSS.escape(conversation.id)}"]`,
    );
    if (!item) {
      this.upsert(conversation);
      return;
    }

    item.querySelector('.conversation-title').textContent =
      conversation.title || 'Nueva conversación';
    this.syncClosedState(item, conversation);

    const date = item.querySelector('.conversation-date');
    date.dateTime = conversation.updatedAt || '';
    date.textContent = formatConversationDate(conversation.updatedAt || '');
    date.title = conversation.updatedAt || '';

    if (options.moveToTop) {
      item.parentElement?.prepend(item);
    }
  }

  remove(removedConversationId) {
    if (!removedConversationId) {
      return;
    }

    document
      .querySelector(`[data-conversation-id="${CSS.escape(removedConversationId)}"]`)
      ?.remove();

    if (!this.panelEl?.querySelector('[data-conversation-id]')) {
      const recentsContainer = this.panelEl?.querySelector('.panel-recents');
      const emptyState = document.createElement('p');
      emptyState.className = 'conversation-empty';
      emptyState.textContent = 'Todavía no hay conversaciones.';
      recentsContainer?.append(emptyState);
    }
  }

  configureItem(item) {
    item
      .querySelector('[data-rename-conversation]')
      ?.addEventListener('click', () => {
        this.startRenaming(item);
      });

    item
      .querySelector('[data-delete-conversation]')
      ?.addEventListener('click', () => {
        this.requestDelete(item);
      });

    item
      .querySelector('[data-finalize-conversation]')
      ?.addEventListener('click', () => {
        this.requestFinalize(item);
      });
  }

  createItem(conversation) {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.dataset.conversationId = conversation.id;
    item.dataset.itemKind = 'conversation';

    const openButton = document.createElement('a');
    openButton.className = 'panel-nav-link conversation-open-button';
    openButton.href = this.buildConversationPath(conversation);
    openButton.dataset.openConversation = '';

    const title = document.createElement('span');
    title.className = 'conversation-title';
    title.textContent = conversation.title || 'Nueva conversación';

    const date = document.createElement('time');
    date.className = 'conversation-date';
    date.dateTime = conversation.updatedAt || '';
    date.textContent = formatConversationDate(conversation.updatedAt || '');
    date.title = conversation.updatedAt || '';

    const icon = document.createElement('i');
    icon.className = `bi ${conversation.closedAt ? 'bi-check-circle' : 'bi-chat-dots'} conversation-open-icon`;
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'conversation-open-copy';
    copy.append(title, date);

    openButton.append(icon, copy);
    item.append(openButton, this.createActions(conversation));
    this.configureItem(item);
    return item;
  }

  syncClosedState(item, conversation) {
    const openButton = item.querySelector('[data-open-conversation]');
    if (openButton instanceof HTMLAnchorElement) {
      openButton.href = this.buildConversationPath(conversation);
    }

    const icon = item.querySelector('.conversation-open-icon');
    if (icon) {
      icon.classList.toggle('bi-chat-dots', !conversation?.closedAt);
      icon.classList.toggle('bi-check-circle', Boolean(conversation?.closedAt));
    }

    if (conversation?.closedAt) {
      item.querySelector('[data-finalize-conversation]')?.remove();
    }
  }

  createActions(conversation) {
    const wrapper = document.createElement('div');
    wrapper.className = 'conversation-actions dropdown';

    const button = document.createElement('button');
    button.className = 'conversation-actions-button';
    button.type = 'button';
    button.title = 'Opciones de conversación';
    button.setAttribute('aria-label', 'Opciones de conversación');
    button.setAttribute('aria-expanded', 'false');
    button.dataset.bsToggle = 'dropdown';
    button.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu dropdown-menu-end';

    const rename = document.createElement('button');
    rename.className = 'dropdown-item';
    rename.type = 'button';
    rename.dataset.renameConversation = '';
    rename.textContent = 'Renombrar';

    const finalize = document.createElement('button');
    finalize.className = 'dropdown-item';
    finalize.type = 'button';
    finalize.dataset.finalizeConversation = '';
    finalize.textContent = 'Finalizar y resumir';

    const remove = document.createElement('button');
    remove.className = 'dropdown-item text-danger';
    remove.type = 'button';
    remove.dataset.deleteConversation = '';
    remove.textContent = 'Eliminar';

    menu.append(rename);
    if (!conversation?.closedAt) {
      menu.append(finalize);
    }
    menu.append(remove);
    wrapper.append(button, menu);
    return wrapper;
  }

  startRenaming(item) {
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
    disableTextAssist(input);

    const saveButton = this.createRenameActionButton({
      label: 'Guardar nombre',
      iconClass: 'bi-check-lg',
      type: 'submit',
    });

    const cancelButton = this.createRenameActionButton({
      label: 'Cancelar',
      iconClass: 'bi-x-lg',
      type: 'button',
    });

    form.append(input, saveButton, cancelButton);
    item.append(form);
    item.classList.add('is-renaming');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.rename(item, input.value);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.cancelRenaming(item);
      }
    });

    cancelButton.addEventListener('click', () => {
      this.cancelRenaming(item);
    });

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  createRenameActionButton({ label, iconClass, type }) {
    const button = document.createElement('button');
    button.className = 'conversation-rename-action';
    button.type = type;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i>`;
    return button;
  }

  rename(item, title) {
    const nextTitle = title.replace(/\s+/g, ' ').trim();
    if (!nextTitle) {
      return;
    }

    this.onRename?.({
      conversationId: item.dataset.conversationId,
      title: nextTitle,
    });
    this.cancelRenaming(item);
  }

  cancelRenaming(item) {
    item.querySelector('.conversation-rename-form')?.remove();
    item.classList.remove('is-renaming');
  }

  requestDelete(item) {
    const id = item.dataset.conversationId || null;
    this.pendingDeleteTarget = id ? { id, kind: 'conversation' } : null;
    if (!this.pendingDeleteTarget) {
      return;
    }

    const title =
      item.querySelector('.conversation-title')?.textContent?.trim() ||
      'Nueva conversación';
    if (this.deleteTitleEl) {
      this.deleteTitleEl.textContent = title;
    }

    if (this.deleteModalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(this.deleteModalEl).show();
    }
  }

  requestFinalize(item) {
    const id = item.dataset.conversationId || '';
    if (!id) {
      return;
    }

    this.onFinalize?.({
      conversationId: id,
    });
  }

  confirmDelete() {
    if (!this.pendingDeleteTarget) {
      return;
    }

    this.onDelete?.({
      conversationId: this.pendingDeleteTarget.id,
    });
    this.pendingDeleteTarget = null;

    if (this.deleteModalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(this.deleteModalEl).hide();
    }
  }
}
