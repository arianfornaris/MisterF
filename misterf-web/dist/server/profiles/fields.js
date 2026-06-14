export const profileNameMaxLength = 120;
export const profileDescriptionMaxLength = 500;
export const profileLearningContextMaxLength = 1500;
export function normalizeProfileText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}
export function profileNeedsOnboarding(profile) {
    return Boolean(profile && !profile.profileOnboardingCompletedAt);
}
export function normalizeProfileReturnTo(value) {
    if (typeof value !== 'string') {
        return '/';
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return '/';
    }
    if (trimmed.startsWith('/profiles/onboarding')) {
        return '/';
    }
    return trimmed;
}
export function buildProfileOnboardingPath(returnTo) {
    const normalizedReturnTo = normalizeProfileReturnTo(returnTo);
    return normalizedReturnTo === '/'
        ? '/profiles/onboarding'
        : `/profiles/onboarding?returnTo=${encodeURIComponent(normalizedReturnTo)}`;
}
//# sourceMappingURL=fields.js.map