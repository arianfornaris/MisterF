export function normalizeModelTier(value) {
  if (value === 'max') {
    return 'max';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  return 'regular';
}

export function getModelTierLabel(value) {
  const tier = normalizeModelTier(value);
  if (tier === 'max') {
    return 'Max';
  }

  if (tier === 'advanced') {
    return 'Avanzado';
  }

  return 'Regular';
}
