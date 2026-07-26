export const DEFAULT_MODEL_TIER = 'lite';

export function normalizeModelTier(value) {
  if (value === 'lite') {
    return 'lite';
  }

  if (value === 'max') {
    return 'advanced';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  if (value === 'regular') {
    return 'regular';
  }

  return DEFAULT_MODEL_TIER;
}
