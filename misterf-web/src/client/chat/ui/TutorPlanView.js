export class TutorPlanView {
  constructor({ panelEl }) {
    this.panelEl = panelEl;
  }

  render(plan) {
    if (!this.panelEl) {
      return;
    }

    const normalizedPlan = normalizeTutorPlan(plan);
    if (!normalizedPlan) {
      this.panelEl.classList.add('d-none');
      this.panelEl.replaceChildren();
      return;
    }

    this.panelEl.classList.remove('d-none');
    this.panelEl.replaceChildren(
      createHeader(normalizedPlan),
      createStepList(normalizedPlan.steps),
    );
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

function createHeader(plan) {
  const header = document.createElement('div');
  header.className = 'card-body tutor-plan-header';

  const kicker = document.createElement('p');
  kicker.className = 'text-body-secondary text-uppercase fw-semibold small mb-1';
  kicker.textContent = 'Plan de práctica';

  const title = document.createElement('h2');
  title.className = 'h6 mb-0';
  title.textContent = plan.title;

  header.append(kicker, title);

  if (plan.summary) {
    const summary = document.createElement('p');
    summary.className = 'small text-body-secondary mb-0 mt-1';
    summary.textContent = plan.summary;
    header.append(summary);
  }

  return header;
}

function createStepList(steps) {
  const list = document.createElement('ol');
  list.className = 'list-group list-group-flush tutor-plan-steps';

  for (const step of steps) {
    const item = document.createElement('li');
    item.className = getStepClassName(step.status);

    const icon = document.createElement('i');
    icon.className = getStepIconClassName(step.status);
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = step.label;

    item.append(icon, label);
    list.append(item);
  }

  return list;
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
