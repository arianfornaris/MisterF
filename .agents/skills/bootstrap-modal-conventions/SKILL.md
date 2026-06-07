---
name: bootstrap-modal-conventions
description: Use when creating, editing, or reviewing Bootstrap modals in the Mister F project, especially EJS views with `.modal`, `btn-close`, `data-bs-dismiss="modal"`, modal footers, confirmation dialogs, share dialogs, generator dialogs, or close/cancel actions.
---

# Bootstrap Modal Conventions

Use Bootstrap and Bootswatch `Flatly` modal patterns. Do not invent custom close
or confirmation treatments unless Bootstrap cannot express the interaction.

## Rules

- Every modal should have a header `btn-close` when the modal can be dismissed.
- Do not use `btn-link` or plain `<a>` elements for modal close/cancel actions.
- If a modal has a footer, close/cancel actions must be real `<button>` elements
  with `type="button"` and `data-bs-dismiss="modal"`.
- Informational modals with no competing action should use a primary close
  button, usually `btn btn-primary` with text like `Cerrar` or `Entendido`.
- Form, confirmation, destructive, or purchase modals should keep the main action
  visually dominant and use `btn btn-secondary` for `Cancelar` or `Cerrar`.
- Destructive actions should use `btn btn-danger`; keep `Cancelar` before the
  destructive action.
- Generator modals should include a visible `Cancelar` button beside `Crear`.
- Share/link modals should not rely only on the X; include a visible footer close
  button or a visible cancel button in the form action row.
- Pending/loading modals with `data-bs-backdrop="static"` and
  `data-bs-keyboard="false"` should not include a close button.
- Long-running modal form submits must show progress immediately by disabling
  the submit button, changing its label, and showing a pending/loading modal or
  an inline spinner.
- If submitting a modal form hides the original modal and waits on the server,
  show the pending modal after a short delay so the UI never appears frozen.

## Review Checklist

- No modal footer contains `btn-link` for `Cerrar` or `Cancelar`.
- No dismiss-only action is an `<a>` tag.
- The footer order is quiet dismiss action first, main action second.
- The button variants match Bootstrap semantics rather than custom colors.
- The modal still works for keyboard and screen-reader users through Bootstrap
  markup and `aria-labelledby`.
- Long-running submits cannot be double-submitted and provide visible progress.
