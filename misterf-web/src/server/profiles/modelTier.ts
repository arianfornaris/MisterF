export type ProfileModelTier = 'advanced' | 'max' | 'regular';

export function normalizeProfileModelTier(value: unknown): ProfileModelTier {
  if (value === 'max') {
    return 'max';
  }

  if (value === 'advanced') {
    return 'advanced';
  }

  return 'regular';
}
