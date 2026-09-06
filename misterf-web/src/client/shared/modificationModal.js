/**
 * Shared "Modify with AI" proposal-and-approval modal controller.
 *
 * Drives the describe -> generating -> preview -> apply/retry/discard cycle used
 * by resource authoring flows (quiz metadata, quiz blocks, and later roleplays
 * and practice guides). The caller supplies the resource-specific pieces: how to
 * read the current draft from the form, which endpoints to hit, and how to
 * render the change comparison. Everything else — phases, credit errors,
 * stale-preview recovery — is shared.
 *
 * One modal element can be driven by several triggers (for example one modal
 * reused by every block card). Per-open configuration is resolved by
 * `resolveContext(trigger)`; when omitted, a static context is read from the
 * modal dataset plus the top-level `buildCurrentDraft`/`renderChanges`.
 *
 * Markup contract (generic `data-modify-*` attributes):
 * - `[data-modify-modal]` root, with dataset (used by the static context):
 *   modifyEndpoint, modifyApplyEndpoint, modifyDiscardEndpoint, genericError,
 *   applyLabel, applyingLabel, and optional currentField (POST field name for
 *   the serialized draft; default `currentDraft`).
 * - `[data-modify-phase="describe|generating|preview"]` phase containers.
 * - `[data-modify-request]` request textarea, `[data-modify-comparison]` output.
 * - `[data-modify-generate]`, `[data-modify-retry]`, `[data-modify-apply]` with
 *   `[data-modify-apply-label|-spinner|-icon]`.
 * - `[data-modify-error]` / `[data-modify-error-message]` / `[data-modify-credit-link]`.
 * - `[data-modify-dismiss]` cancel/close buttons.
 *
 * Per-open context (from resolveContext) may provide: previewEndpoint,
 * applyEndpoint, discardEndpoint, currentField, buildCurrentDraft(),
 * extraFields(), renderChanges(container, changes), and onOpen() for DOM setup.
 */

async function postModification(endpoint, fields) {
  return fetch(endpoint, {
    body: new URLSearchParams(fields),
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'fetch',
    },
    method: 'POST',
  });
}

function asElementList(value) {
  if (!value) {
    return [];
  }
  if (value instanceof HTMLElement) {
    return [value];
  }
  return Array.from(value).filter((element) => element instanceof HTMLElement);
}

export function initializeModificationModal(config) {
  const { modalEl } = config || {};
  const triggers = asElementList(config?.triggers ?? config?.openButtonEl);
  if (!(modalEl instanceof HTMLElement) || triggers.length === 0 || !window.bootstrap?.Modal) {
    return;
  }

  const requestEl = modalEl.querySelector('[data-modify-request]');
  const comparisonEl = modalEl.querySelector('[data-modify-comparison]');
  const generateButtonEl = modalEl.querySelector('[data-modify-generate]');
  const retryButtonEl = modalEl.querySelector('[data-modify-retry]');
  const applyButtonEl = modalEl.querySelector('[data-modify-apply]');
  const applyLabelEl = modalEl.querySelector('[data-modify-apply-label]');
  const applySpinnerEl = modalEl.querySelector('[data-modify-apply-spinner]');
  const applyIconEl = modalEl.querySelector('[data-modify-apply-icon]');
  const errorEl = modalEl.querySelector('[data-modify-error]');
  const errorMessageEl = modalEl.querySelector('[data-modify-error-message]');
  const creditLinkEl = modalEl.querySelector('[data-modify-credit-link]');
  const csrfEl = modalEl.querySelector('input[name="_csrf"]')
    || document.querySelector('input[name="_csrf"]');
  if (
    !(requestEl instanceof HTMLTextAreaElement)
    || !(comparisonEl instanceof HTMLElement)
    || !(generateButtonEl instanceof HTMLButtonElement)
    || !(retryButtonEl instanceof HTMLButtonElement)
    || !(applyButtonEl instanceof HTMLButtonElement)
    || !(applyLabelEl instanceof HTMLElement)
    || !(applySpinnerEl instanceof HTMLElement)
    || !(applyIconEl instanceof HTMLElement)
    || !(errorEl instanceof HTMLElement)
    || !(errorMessageEl instanceof HTMLElement)
    || !(creditLinkEl instanceof HTMLElement)
    || !(csrfEl instanceof HTMLInputElement)
  ) {
    return;
  }

  const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
  const dismissButtons = Array.from(
    modalEl.querySelectorAll('[data-modify-dismiss]'),
  ).filter((element) => element instanceof HTMLButtonElement);
  let previewId = '';
  let applied = false;
  let isBusy = false;
  let active = null;

  const contextFor = (trigger) => {
    if (typeof config.resolveContext === 'function') {
      return config.resolveContext(trigger) || null;
    }
    return {
      applyEndpoint: modalEl.dataset.modifyApplyEndpoint || '',
      buildCurrentDraft: config.buildCurrentDraft,
      currentField: modalEl.dataset.currentField || 'currentDraft',
      discardEndpoint: modalEl.dataset.modifyDiscardEndpoint || '',
      previewEndpoint: modalEl.dataset.modifyEndpoint || '',
      renderChanges: config.renderChanges,
    };
  };

  const show = (element, visible) => element?.classList.toggle('d-none', !visible);
  const setPhase = (phase) => {
    for (const element of modalEl.querySelectorAll('[data-modify-phase]')) {
      show(element, element.getAttribute('data-modify-phase') === phase);
    }
    const generating = phase === 'generating';
    show(generateButtonEl, phase === 'describe');
    show(retryButtonEl, phase === 'preview');
    show(applyButtonEl, phase === 'preview');
    for (const button of dismissButtons) {
      show(button, !generating);
    }
  };
  const showError = (message, creditExhausted = false) => {
    errorMessageEl.textContent = message || modalEl.dataset.genericError || '';
    errorEl.classList.remove('d-none');
    creditLinkEl.classList.toggle('d-none', !creditExhausted);
  };
  const hideError = () => {
    errorEl.classList.add('d-none');
    creditLinkEl.classList.add('d-none');
  };
  const discardPreview = () => {
    if (!previewId || applied || !active?.discardEndpoint) {
      previewId = '';
      return;
    }
    const discardedPreviewId = previewId;
    previewId = '';
    postModification(active.discardEndpoint, {
      _csrf: csrfEl.value,
      previewId: discardedPreviewId,
    }).catch(() => {});
  };

  const openForTrigger = (trigger) => {
    discardPreview();
    active = contextFor(trigger);
    if (!active || !active.previewEndpoint || !active.applyEndpoint || !active.discardEndpoint) {
      active = null;
      return;
    }
    previewId = '';
    applied = false;
    requestEl.value = '';
    requestEl.setCustomValidity('');
    comparisonEl.replaceChildren();
    hideError();
    if (typeof active.onOpen === 'function') {
      active.onOpen(trigger);
    }
    setPhase('describe');
    modal.show();
  };

  for (const trigger of triggers) {
    trigger.addEventListener('click', () => openForTrigger(trigger));
  }

  requestEl.addEventListener('input', () => requestEl.setCustomValidity(''));
  modalEl.addEventListener('shown.bs.modal', () => {
    if (!requestEl.closest('.d-none')) {
      requestEl.focus();
    }
  });
  modalEl.addEventListener('hidden.bs.modal', discardPreview);

  generateButtonEl.addEventListener('click', async () => {
    const requestedChange = requestEl.value.trim();
    if (isBusy || !active) {
      return;
    }
    if (requestedChange.length < 3) {
      requestEl.setCustomValidity(modalEl.dataset.genericError || '');
      requestEl.reportValidity();
      return;
    }

    const currentDraft = active.buildCurrentDraft ? active.buildCurrentDraft() : null;
    hideError();
    if (!currentDraft) {
      showError('');
      return;
    }

    discardPreview();
    isBusy = true;
    setPhase('generating');
    try {
      const extraFields = typeof active.extraFields === 'function' ? active.extraFields() : {};
      const response = await postModification(active.previewEndpoint, {
        _csrf: csrfEl.value,
        [active.currentField || 'currentDraft']: JSON.stringify(currentDraft),
        requestedChange,
        ...extraFields,
      });
      const payload = await response.json().catch(() => ({}));
      if (
        !response.ok
        || typeof payload.previewId !== 'string'
        || !active.renderChanges(comparisonEl, payload.changes)
      ) {
        showError(payload.error, Boolean(payload.creditExhausted));
        setPhase('describe');
        return;
      }

      previewId = payload.previewId;
      setPhase('preview');
    } catch {
      showError('');
      setPhase('describe');
    } finally {
      isBusy = false;
    }
  });

  retryButtonEl.addEventListener('click', () => {
    discardPreview();
    comparisonEl.replaceChildren();
    hideError();
    setPhase('describe');
    requestEl.focus();
  });

  applyButtonEl.addEventListener('click', async () => {
    if (isBusy || !previewId || !active?.applyEndpoint) {
      return;
    }

    isBusy = true;
    hideError();
    applyButtonEl.disabled = true;
    applyLabelEl.textContent = modalEl.dataset.applyingLabel || '';
    applySpinnerEl.classList.remove('d-none');
    applyIconEl.classList.add('d-none');
    retryButtonEl.disabled = true;
    for (const button of dismissButtons) {
      button.disabled = true;
    }
    try {
      const response = await postModification(active.applyEndpoint, {
        _csrf: csrfEl.value,
        previewId,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        if (response.status === 409) {
          previewId = '';
          comparisonEl.replaceChildren();
          setPhase('describe');
        }
        showError(payload.error);
        return;
      }

      applied = true;
      window.location.assign(payload.redirect || window.location.href);
    } catch {
      showError('');
    } finally {
      // `window.location.assign` does not block, so on success the browser is
      // still loading the next page when this runs. Restoring the idle state
      // here would drop the spinner and re-enable the buttons under a modal
      // that is on its way out, which reads as an operation that silently
      // stopped — the same confusion the wait-state rule exists to prevent.
      // Leave the busy state up and let the navigation replace the page.
      if (!applied) {
        isBusy = false;
        applyButtonEl.disabled = false;
        applyLabelEl.textContent = modalEl.dataset.applyLabel || '';
        applySpinnerEl.classList.add('d-none');
        applyIconEl.classList.remove('d-none');
        retryButtonEl.disabled = false;
        for (const button of dismissButtons) {
          button.disabled = false;
        }
      }
    }
  });
}

/**
 * Renders a before/after comparison for flat string-field changes. `labels`
 * maps field name -> display label; changes with an unknown field are skipped.
 * Returns true if at least one card was rendered.
 */
export function renderStringFieldChanges(container, changes, labels) {
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
      value.style.whiteSpace = 'pre-wrap';
      value.textContent = change[version] || '—';
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
