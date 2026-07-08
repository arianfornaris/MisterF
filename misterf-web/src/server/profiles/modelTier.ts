export type ProfileModelTier = 'advanced' | 'lite' | 'max' | 'regular';

export function normalizeProfileModelTier(value: unknown): ProfileModelTier {
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
