/**
 * Reading attachments back out of stored message metadata.
 *
 * Digests are written into a free-form JSON column, so what comes back is
 * whatever was there — including rows written by an older shape. Validating on
 * the way out keeps the rest of the code able to assume a digest is a digest.
 */
export function readAttachmentDigests(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry) => {
        if (!entry || typeof entry !== 'object') {
            return false;
        }
        const candidate = entry;
        return (typeof candidate.displayName === 'string' &&
            typeof candidate.id === 'string' &&
            typeof candidate.text === 'string');
    });
}
//# sourceMappingURL=persistence.js.map