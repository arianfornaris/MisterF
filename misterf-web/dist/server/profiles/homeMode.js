export const defaultProfileHomeMode = 'learn';
export const profileHomeModes = ['learn', 'teach'];
export function isProfileHomeMode(value) {
    return value === 'learn' || value === 'teach';
}
export function normalizeProfileHomeMode(value) {
    return isProfileHomeMode(value) ? value : defaultProfileHomeMode;
}
//# sourceMappingURL=homeMode.js.map