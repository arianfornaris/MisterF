export class TutorPlanView {
  constructor({ onCloseRequest, panelEl }) {
    this.isMinimized = false;
    this.onCloseRequest = onCloseRequest;
    this.panelEl = panelEl;
    this.plan = null;
  }

  render(plan) {
    if (!this.panelEl) {
      return;
    }

    const normalizedPlan = normalizeTutorPlan(plan);
    if (!normalizedPlan) {
      this.isMinimized = false;
      this.plan = null;
      this.panelEl.classList.add('d-none');
      this.panelEl.replaceChildren();
      return;
    }

    this.plan = normalizedPlan;
    this.panelEl.classList.remove('d-none');

    if (this.isMinimized) {
      this.panelEl.replaceChildren(createMinimizedView(normalizedPlan, {
        onClose: () => this.requestClose(),
        onRestore: () => this.setMinimized(false),
      }));
      return;
    }

    this.panelEl.replaceChildren(
      createHeader(normalizedPlan, {
        onClose: () => this.requestClose(),
        onMinimize: () => this.setMinimized(true),
      }),
      createStepList(normalizedPlan.steps),
    );
  }

  requestClose() {
    if (!this.plan) {
      return;
    }

    this.onCloseRequest?.(this.plan);
  }

  setMinimized(isMinimized) {
    this.isMinimized = isMinimized;
    this.render(this.plan);
  }
}

function normalizeTutorPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return null;
  }

  const title = String(plan.title || '').replace(/\s+/g, ' ').trim();
  const summary = String(plan.summary || '').replace(/\s+/g, ' ').trim();
  const steps = Array.isArray(plan.steps)
    ? plan.steps
        .map((step) => ({
          id: String(step?.id || '').trim(),
          label: String(step?.label || '').replace(/\s+/g, ' ').trim(),
          status: normalizeStepStatus(step?.status),
        }))
        .filter((step) => step.id && step.label)
    : [];

  if (!title || steps.length === 0) {
    return null;
  }

  return {
    steps,
    summary,
    title,
  };
}

function normalizeStepStatus(status) {
  if (status === 'active' || status === 'done' || status === 'skipped') {
    return status;
  }

  return 'pending';
}

function createHeader(plan, actions) {
  const header = document.createElement('div');
  header.className = 'card-body tutor-plan-header d-flex align-items-start justify-content-between gap-3';

  const description = document.createElement('p');
  description.className = 'small text-body-secondary mb-0';
  description.textContent = plan.summary || plan.title;

  const actionGroup = createActionGroup([
    createIconButton({
      iconClass: 'bi bi-dash-lg',
      label: 'Minimizar plan',
      onClick: actions.onMinimize,
    }),
    createCloseButton(actions.onClose),
  ]);

  header.append(description, actionGroup);

  return header;
}

function createMinimizedView(plan, actions) {
  const body = document.createElement('div');
  body.className = 'card-body tutor-plan-header tutor-plan-minimized d-flex align-items-center justify-content-between gap-3';

  const currentStep = createStepItem(getCurrentStep(plan), 'div');
  currentStep.classList.add('tutor-plan-minimized-step', 'flex-grow-1');

  const actionGroup = createActionGroup([
    createIconButton({
      iconClass: 'bi bi-arrows-angle-expand',
      label: 'Expandir plan',
      onClick: actions.onRestore,
    }),
    createCloseButton(actions.onClose),
  ]);

  body.append(currentStep, actionGroup);
  return body;
}

function createActionGroup(buttons) {
  const actionGroup = document.createElement('div');
  actionGroup.className = 'tutor-plan-actions d-flex align-items-center gap-1 flex-shrink-0';
  actionGroup.append(...buttons);
  return actionGroup;
}

function createIconButton({ iconClass, label, onClick }) {
  const button = document.createElement('button');
  button.className = 'btn btn-link btn-sm link-secondary tutor-plan-action-button';
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;
  button.addEventListener('click', onClick);
  return button;
}

function createCloseButton(onClick) {
  return createIconButton({
    iconClass: 'bi bi-x-lg',
    label: 'Concluir plan',
    onClick,
  });
}

function getCurrentStep(plan) {
  const activeStep = plan.steps.find((step) => step.status === 'active');
  if (activeStep) {
    return activeStep;
  }

  const pendingStep = plan.steps.find((step) => step.status === 'pending');
  if (pendingStep) {
    return pendingStep;
  }

  return {
    id: 'completed-plan',
    label: 'Plan completo',
    status: 'done',
  };
}

function createStepList(steps) {
  const list = document.createElement('ol');
  list.className = 'list-group list-group-flush tutor-plan-steps';

  for (const step of steps) {
    list.append(createStepItem(step, 'li'));
  }

  return list;
}

function createStepItem(step, tagName) {
  const item = document.createElement(tagName);
  item.className = getStepClassName(step.status);

  const icon = document.createElement('i');
  icon.className = getStepIconClassName(step.status);
  icon.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = step.label;

  item.append(icon, label);
  return item;
}

function getStepClassName(status) {
  const classes = ['list-group-item', 'd-flex', 'align-items-center', 'gap-2', 'small'];

  if (status === 'active') {
    classes.push('tutor-plan-step-active', 'fw-semibold');
  } else if (status === 'done' || status === 'skipped') {
    classes.push('text-body-secondary');
  }

  return classes.join(' ');
}

function getStepIconClassName(status) {
  if (status === 'done') {
    return 'bi bi-check-circle-fill text-success';
  }

  if (status === 'active') {
    return 'bi bi-arrow-right-circle-fill text-primary';
  }

  if (status === 'skipped') {
    return 'bi bi-dash-circle text-body-secondary';
  }

  return 'bi bi-circle text-body-secondary';
}
