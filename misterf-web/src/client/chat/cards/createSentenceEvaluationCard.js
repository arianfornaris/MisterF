export function createSentenceEvaluationCard({
  createMessageActionButton,
  createSentencePartsElement,
  element,
  evaluation,
  findEvaluationTargetUserContent,
  findFirstIncorrectEvaluationPart,
  isValidSentenceEvaluation,
  putMessageBackInComposer,
}) {
  if (!element) {
    return null;
  }

  element.querySelector('.sentence-evaluation')?.remove();
  if (!isValidSentenceEvaluation(evaluation)) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'sentence-evaluation card';

  const header = document.createElement('div');
  header.className = 'sentence-evaluation-header card-header';

  const label = document.createElement('h3');
  label.className = 'sentence-evaluation-label';
  label.textContent = 'Evaluación';
  header.append(label);

  const body = document.createElement('div');
  body.className = 'sentence-evaluation-body card-body';

  const partsLabel = document.createElement('p');
  partsLabel.className = 'sentence-evaluation-parts-label';
  partsLabel.textContent = 'Tu último mensaje, por partes';

  body.append(partsLabel);
  body.append(createSentencePartsElement(evaluation.parts));

  const actions = document.createElement('div');
  actions.className = 'sentence-evaluation-actions';

  const editButton = createMessageActionButton({
    label: 'Editar mensaje',
    iconClass: 'bi-pencil',
  });
  editButton.classList.add('sentence-evaluation-action');
  editButton.addEventListener('click', () => {
    const userContent = findEvaluationTargetUserContent(element);
    if (!userContent) {
      return;
    }

    putMessageBackInComposer(userContent, {
      preferredSelectionText: findFirstIncorrectEvaluationPart(evaluation),
    });
  });

  actions.append(editButton);
  body.append(actions);

  wrapper.append(header, body);
  return wrapper;
}
