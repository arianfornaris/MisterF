import { normalizeSearchText } from '../pages/shell.js';
import { findUserSceneMediaForProfile, listUserSceneMediaForProfile, } from './userMediaRepository.js';
export const sceneMediaLevels = ['A1-A2', 'B1-B2', 'C1'];
export const sceneMediaFormats = [
    'four_panel_wordless_story',
    'single_panel_scene',
    'two_panel_contrast',
];
export function listSceneMediaItems(owner, filters = {}) {
    const normalizedQuery = normalizeSearchText(filters.query ?? '');
    const items = listUserSceneMediaForProfile({
        ownerProfileId: owner.profileId,
        ownerUserId: owner.userId,
    });
    return items.filter((item) => {
        if (filters.level && item.level !== filters.level) {
            return false;
        }
        if (filters.format && item.format !== filters.format) {
            return false;
        }
        if (!normalizedQuery) {
            return true;
        }
        return normalizeSearchText([
            item.title,
            item.setting,
            item.level,
            item.format,
            ...item.visualSummary,
        ].filter(Boolean).join(' ')).includes(normalizedQuery);
    });
}
export function findSceneMediaItemById(mediaId, owner) {
    return findUserSceneMediaForProfile({
        mediaId,
        ownerProfileId: owner.profileId,
        ownerUserId: owner.userId,
    });
}
export function normalizeSceneMediaLevel(value) {
    return typeof value === 'string' &&
        sceneMediaLevels.includes(value)
        ? value
        : undefined;
}
export function normalizeSceneMediaFormat(value) {
    return typeof value === 'string' &&
        sceneMediaFormats.includes(value)
        ? value
        : undefined;
}
//# sourceMappingURL=library.js.map