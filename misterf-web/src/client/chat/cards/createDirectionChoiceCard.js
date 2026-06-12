export function createDirectionChoiceCard(block, deps = {}) {
  if (typeof block?.prompt !== 'string' || !Array.isArray(block.options)) {
    return null;
  }

  const options = block.options
    .filter((option) => option && typeof option.label === 'string')
    .map((option) => ({
      description:
        typeof option.description === 'string' ? option.description.trim() : '',
      label: option.label.trim(),
    }))
    .filter((option) => option.label);

  if (options.length < 2) {
    return null;
  }

  const section = document.createElement('section');
  section.className = 'direction-choice-card card border';

  const header = document.createElement('div');
  header.className = 'card-header bg-body-tertiary';

  const prompt = document.createElement('h3');
  prompt.className = 'h6 mb-0';
  prompt.textContent = block.prompt.trim();
  header.append(prompt);

  const list = document.createElement('div');
  list.className = 'list-group list-group-flush';

  options.forEach((option, index) => {
    const choiceLetter = getChoiceLetter(index);
    const button = document.createElement('button');
    button.className = 'list-group-item list-group-item-action d-flex align-items-start gap-3 py-3';
    button.type = 'button';
    button.dataset.choiceLabel = option.label;

    const badge = document.createElement('span');
    badge.className = 'badge text-bg-primary rounded-pill direction-choice-badge';
    badge.textContent = choiceLetter;

    const body = document.createElement('span');
    body.className = 'd-grid gap-1 text-start';

    const label = document.createElement('span');
    label.className = 'fw-semibold';
    label.textContent = option.label;
    body.append(label);

    if (option.description) {
      const description = document.createElement('span');
      description.className = 'small text-body-secondary';
      description.textContent = option.description;
      body.append(description);
    }

    button.append(badge, body);
    button.addEventListener('click', () => {
      if (typeof deps.sendDirectionChoiceMessage !== 'function') {
        return;
      }

      const sent = deps.sendDirectionChoiceMessage(buildChoiceMessage(choiceLetter, option.label));
      if (sent === false) {
        return;
      }

      for (const item of list.querySelectorAll('button')) {
        item.disabled = true;
      }
      button.classList.add('active');
      button.setAttribute('aria-current', 'true');
    });

    list.append(button);
  });

  section.append(header, list);
  return section;
}

function getChoiceLetter(index) {
  return String.fromCharCode(65 + index);
}

function buildChoiceMessage(choiceLetter, label) {
  return `Elijo la opción ${choiceLetter}: ${label}`;
}
