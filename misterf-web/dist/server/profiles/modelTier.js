export function normalizeProfileModelTier(value) {
    if (value === 'max') {
        return 'max';
    }
    if (value === 'advanced') {
        return 'advanced';
    }
    return 'regular';
}
//# sourceMappingURL=modelTier.js.map