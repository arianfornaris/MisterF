function createIcon(className) {
  const iconEl = document.createElement('i');
  iconEl.className = `bi ${className}`;
  iconEl.setAttribute('aria-hidden', 'true');
  return iconEl;
}

function createTextButton(label, className) {
  const buttonEl = document.createElement('button');
  buttonEl.className = className;
  buttonEl.type = 'button';
  buttonEl.textContent = label;
  return buttonEl;
}

function sortFoldersByTitle(folders) {
  return [...folders].sort((left, right) =>
    left.title.localeCompare(right.title, 'es', { sensitivity: 'base' }),
  );
}

export function initializeResourceMoveModal(root = document) {
  const formEl = root.querySelector('[data-resource-move-form]');
  const folderInputEl = root.querySelector('[data-resource-move-folder-id]');
  const titleEl = root.querySelector('[data-resource-move-title]');
  const breadcrumbEl = root.querySelector('[data-resource-move-breadcrumb]');
  const destinationsEl = root.querySelector('[data-resource-move-destinations]');
  const emptyEl = root.querySelector('[data-resource-move-empty]');
  const selectionEl = root.querySelector('[data-resource-move-selection]');
  const selectionLabelEl = root.querySelector('[data-resource-move-selection-label]');
  const submitButtonEl = root.querySelector('[data-resource-move-submit]');
  const folders = Array.from(root.querySelectorAll('[data-resource-move-folder]'))
    .flatMap((folderEl) => {
      if (!(folderEl instanceof HTMLElement)) {
        return [];
      }

      const id = folderEl.dataset.folderId || '';
      const title = folderEl.dataset.folderTitle || '';
      if (!id || !title) {
        return [];
      }

      return [{
        id,
        parentFolderId: folderEl.dataset.parentFolderId || '',
        title,
      }];
    });

  if (
    !(formEl instanceof HTMLFormElement) ||
    !(folderInputEl instanceof HTMLInputElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(breadcrumbEl instanceof HTMLOListElement) ||
    !(destinationsEl instanceof HTMLElement) ||
    !(emptyEl instanceof HTMLElement) ||
    !(selectionEl instanceof HTMLElement) ||
    !(selectionLabelEl instanceof HTMLElement) ||
    !(submitButtonEl instanceof HTMLButtonElement)
  ) {
    return;
  }

  let activeResourceId = '';
  let activeResourceType = '';
  let activeCurrentFolderId = '';
  let viewedFolderId = '';

  function findFolder(folderId) {
    return folders.find((folder) => folder.id === folderId) || null;
  }

  function getChildFolders(parentFolderId) {
    return sortFoldersByTitle(
      folders.filter((folder) => folder.parentFolderId === parentFolderId),
    );
  }

  function getFolderPath(folderId) {
    const path = [];
    const seenFolderIds = new Set();
    let currentFolder = findFolder(folderId);

    while (currentFolder && !seenFolderIds.has(currentFolder.id)) {
      path.unshift(currentFolder);
      seenFolderIds.add(currentFolder.id);
      currentFolder = currentFolder.parentFolderId
        ? findFolder(currentFolder.parentFolderId)
        : null;
    }

    return path;
  }

  function getDescendantFolderIds(folderId) {
    const descendants = new Set();
    const pending = [folderId];

    while (pending.length > 0) {
      const currentFolderId = pending.pop();
      for (const childFolder of getChildFolders(currentFolderId || '')) {
        if (descendants.has(childFolder.id)) {
          continue;
        }

        descendants.add(childFolder.id);
        pending.push(childFolder.id);
      }
    }

    return descendants;
  }

  function isFolderMoveBlocked(folderId) {
    if (activeResourceType !== 'resource_folder') {
      return false;
    }

    return folderId === activeResourceId ||
      getDescendantFolderIds(activeResourceId).has(folderId);
  }

  function clearDestinationSelection() {
    formEl.removeAttribute('action');
    folderInputEl.value = '';
    selectionEl.hidden = true;
    selectionLabelEl.textContent = '';
    submitButtonEl.disabled = true;
  }

  function getViewedDestinationLabel() {
    const folder = viewedFolderId ? findFolder(viewedFolderId) : null;
    return folder ? folder.title : 'Recursos';
  }

  function isCurrentDestination() {
    if (!viewedFolderId) {
      return !activeCurrentFolderId;
    }

    return viewedFolderId === activeCurrentFolderId;
  }

  function applyViewedDestinationSelection() {
    clearDestinationSelection();

    if (!activeResourceId) {
      return;
    }

    selectionEl.hidden = false;
    selectionLabelEl.textContent = getViewedDestinationLabel();

    if (isCurrentDestination() || (viewedFolderId && isFolderMoveBlocked(viewedFolderId))) {
      return;
    }

    if (!viewedFolderId) {
      if (!activeCurrentFolderId) {
        return;
      }

      formEl.setAttribute(
        'action',
        `/resources/folders/${encodeURIComponent(activeCurrentFolderId)}/items/${encodeURIComponent(activeResourceId)}/remove`,
      );
      submitButtonEl.disabled = false;
      return;
    }

    if (!findFolder(viewedFolderId)) {
      return;
    }

    formEl.setAttribute('action', `/resources/${encodeURIComponent(activeResourceId)}/folder`);
    folderInputEl.value = viewedFolderId;
    submitButtonEl.disabled = false;
  }

  function renderBreadcrumb() {
    breadcrumbEl.replaceChildren();

    const rootItemEl = document.createElement('li');
    rootItemEl.className = viewedFolderId ? 'breadcrumb-item' : 'breadcrumb-item active';

    if (viewedFolderId) {
      const rootButtonEl = createTextButton('Recursos', 'btn btn-link p-0 align-baseline');
      rootButtonEl.addEventListener('click', () => {
        viewedFolderId = '';
        renderModalState();
      });
      rootItemEl.append(rootButtonEl);
    } else {
      rootItemEl.setAttribute('aria-current', 'page');
      rootItemEl.textContent = 'Recursos';
    }

    breadcrumbEl.append(rootItemEl);

    const folderPath = getFolderPath(viewedFolderId);
    folderPath.forEach((folder, index) => {
      const itemEl = document.createElement('li');
      const isCurrent = index === folderPath.length - 1;
      itemEl.className = isCurrent ? 'breadcrumb-item active' : 'breadcrumb-item';

      if (isCurrent) {
        itemEl.setAttribute('aria-current', 'page');
        itemEl.textContent = folder.title;
      } else {
        const buttonEl = createTextButton(folder.title, 'btn btn-link p-0 align-baseline');
        buttonEl.addEventListener('click', () => {
          viewedFolderId = folder.id;
          renderModalState();
        });
        itemEl.append(buttonEl);
      }

      breadcrumbEl.append(itemEl);
    });
  }

  function renderFolderDestination(folder) {
    const itemEl = document.createElement('button');
    itemEl.className = 'list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-3';
    itemEl.type = 'button';
    itemEl.dataset.resourceMoveOpenFolder = folder.id;
    itemEl.title = `Abrir ${folder.title}`;
    itemEl.setAttribute('aria-label', `Abrir ${folder.title}`);

    const labelEl = document.createElement('div');
    labelEl.className = 'min-w-0';
    const titleEl = document.createElement('div');
    titleEl.className = 'text-break';
    titleEl.append(createIcon('bi-folder me-2'), folder.title);
    labelEl.append(titleEl);

    const badgeEl = document.createElement('span');
    badgeEl.className = 'badge text-bg-light border flex-shrink-0';
    badgeEl.textContent = 'Carpeta';

    itemEl.append(labelEl, badgeEl);
    destinationsEl.append(itemEl);
  }

  function renderDestinations() {
    destinationsEl.replaceChildren();

    for (const folder of getChildFolders(viewedFolderId)) {
      renderFolderDestination(folder);
    }

    emptyEl.hidden = destinationsEl.children.length > 0;
  }

  function renderModalState() {
    renderBreadcrumb();
    renderDestinations();
    applyViewedDestinationSelection();
  }

  for (const buttonEl of root.querySelectorAll('[data-resource-move-open]')) {
    buttonEl.addEventListener('click', () => {
      if (!(buttonEl instanceof HTMLElement)) {
        return;
      }

      activeResourceId = buttonEl.dataset.resourceId || '';
      activeResourceType = buttonEl.dataset.resourceType || '';
      activeCurrentFolderId = buttonEl.dataset.currentFolderId || '';
      viewedFolderId = activeCurrentFolderId || '';
      titleEl.textContent = buttonEl.dataset.resourceTitle || 'este recurso';
      clearDestinationSelection();
      renderModalState();
    });
  }

  destinationsEl.addEventListener('click', (event) => {
    const targetEl = event.target instanceof Element
      ? event.target.closest('[data-resource-move-open-folder]')
      : null;
    if (!(targetEl instanceof HTMLElement)) {
      return;
    }

    const enteredFolderId = targetEl.dataset.resourceMoveOpenFolder || '';
    if (enteredFolderId) {
      viewedFolderId = enteredFolderId;
      renderModalState();
    }
  });

  formEl.addEventListener('submit', (event) => {
    if (!formEl.getAttribute('action') || submitButtonEl.disabled) {
      event.preventDefault();
    }
  });
}
