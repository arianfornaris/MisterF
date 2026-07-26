export type ProfileModelTier = 'advanced' | 'lite' | 'regular';

export const defaultProfileModelTier: ProfileModelTier = 'lite';

export function normalizeProfileModelTier(value: unknown): ProfileModelTier {
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

  return defaultProfileModelTier;
}
