export function normalizeModelTier(value) {
  if (value === 'lite') {
    return 'lite';
  }

  if (value === 'max') {
    return 'max';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  return 'regular';
}
