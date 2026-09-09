/**
 * How a profile uses the product, which decides how the signed-in home is
 * composed (Roadmap V3 §1.14).
 *
 * This is presentation, never permission. Both modes reach every feature: the
 * mode only chooses which surface `/` opens with, so someone who teaches can
 * see the product as a learner — and back — without creating a second profile.
 * Nothing in the authorization path may ever read this value.
 *
 * `learn` is the default because it is what every profile did before the
 * setting existed.
 */
export type ProfileHomeMode = 'learn' | 'teach';

export const defaultProfileHomeMode: ProfileHomeMode = 'learn';

export const profileHomeModes: readonly ProfileHomeMode[] = ['learn', 'teach'];

export function isProfileHomeMode(value: unknown): value is ProfileHomeMode {
  return value === 'learn' || value === 'teach';
}

export function normalizeProfileHomeMode(value: unknown): ProfileHomeMode {
  return isProfileHomeMode(value) ? value : defaultProfileHomeMode;
}
