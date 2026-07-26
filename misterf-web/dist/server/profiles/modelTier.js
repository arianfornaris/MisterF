export const defaultProfileModelTier = 'lite';
export function normalizeProfileModelTier(value) {
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
//# sourceMappingURL=modelTier.js.map