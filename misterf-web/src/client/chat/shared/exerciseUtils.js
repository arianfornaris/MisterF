export function createExerciseConfirmButton(onClick) {
  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn-primary exercise-confirm-button';
  confirmButton.type = 'button';
  confirmButton.setAttribute('aria-label', 'Confirmar respuesta');
  confirmButton.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
  confirmButton.addEventListener('click', onClick);
  return confirmButton;
}

export function flashExerciseError(section) {
  section.classList.add('is-error');
  window.setTimeout(() => {
    section.classList.remove('is-error');
  }, 620);
}

export function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

export function tokenizeSentence(sentence) {
  return typeof sentence === 'string'
    ? sentence.split(/\s+/).map((part) => part.trim()).filter(Boolean)
    : [];
}

export function splitSentenceByBlanks(sentence, placeholderToken = '___') {
  const segments =
    typeof sentence === 'string' ? sentence.split(placeholderToken) : [];
  return segments.length >= 2 ? segments : null;
}

export function fillSentenceBlanks(sentence, values, placeholderToken = '___') {
  if (typeof sentence !== 'string' || !sentence.includes(placeholderToken)) {
    return '';
  }

  let nextSentence = sentence;
  for (const value of values) {
    nextSentence = nextSentence.replace(placeholderToken, value.trim());
  }

  return nextSentence.replace(/\s+/g, ' ').trim();
}

export function normalizeTokenSpacing(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:%)\]}])/g, '$1')
    .replace(/([¿¡([{])\s+/g, '$1')
    .trim();
}

export function formatTokenSentence(tokens) {
  return normalizeTokenSpacing(Array.isArray(tokens) ? tokens.join(' ') : '');
}

export function normalizeExerciseAnswer(value) {
  return normalizeTokenSpacing(value).toLowerCase();
}

export function seededShuffle(items, seedText) {
  const array = [...items];
  let seed = hashString(seedText || 'seed');

  for (let index = array.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

export function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
