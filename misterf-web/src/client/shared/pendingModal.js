/**
 * Shows the "this is running" modal when a form that triggers inference is
 * submitted.
 *
 * The timing matters more than it looks. A form submit starts a navigation,
 * and from that moment the browser is free to stop painting the outgoing
 * document — Safari in particular effectively freezes it. Anything scheduled
 * on a timer after the submit may therefore never reach the screen, which is
 * exactly the failure this replaces: every caller used to defer the modal by
 * 120ms, so the user could click "create" and watch nothing happen for the
 * twenty seconds the model took.
 *
 * So the modal is shown synchronously inside the submit handler, and its fade
 * is removed first: a CSS transition needs an animation frame that a
 * navigating document may never get, while a class toggle paints with the work
 * already in flight.
 *
 * The one case that cannot be synchronous is a form living inside another
 * modal. Bootstrap will not overlap two modals, and its hide animation runs
 * ~300ms — longer than the 120ms the old code waited, which is why that path
 * could leave the user with no dialog at all. Waiting for `hidden.bs.modal` is
 * the only correct trigger.
 */
export function initializePendingModalForms(options) {
  const {
    formSelector,
    pendingModalSelector,
    skipSelector = '',
    submitSelector,
  } = options;

  if (!window.bootstrap?.Modal) {
    return;
  }

  const pendingModalEl = document.querySelector(pendingModalSelector);

  for (const formEl of document.querySelectorAll(formSelector)) {
    if (!(formEl instanceof HTMLFormElement)) {
      continue;
    }

    if (skipSelector && formEl.matches(skipSelector)) {
      continue;
    }

    const submitButtonEl = submitSelector ? formEl.querySelector(submitSelector) : null;
    const parentModalEl = formEl.closest('.modal');

    formEl.addEventListener('submit', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (submitButtonEl instanceof HTMLButtonElement) {
        submitButtonEl.disabled = true;
        const loadingText = submitButtonEl.dataset.loadingText;
        if (loadingText) {
          submitButtonEl.textContent = loadingText;
        }
      }

      if (!pendingModalEl) {
        return;
      }

      if (parentModalEl) {
        parentModalEl.addEventListener(
          'hidden.bs.modal',
          () => showPendingModal(pendingModalEl),
          { once: true },
        );
        window.bootstrap.Modal.getOrCreateInstance(parentModalEl).hide();
        return;
      }

      showPendingModal(pendingModalEl);
    });
  }
}

function showPendingModal(pendingModalEl) {
  pendingModalEl.classList.remove('fade');
  window.bootstrap.Modal.getOrCreateInstance(pendingModalEl).show();
}
