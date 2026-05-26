import { updateConversationModelTierForProfile, updateProfileModelTierForUser, } from '../db/repository.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
function normalizeModelTier(value) {
    if (value === 'max') {
        return 'max';
    }
    if (value === 'advanced') {
        return 'advanced';
    }
    return 'regular';
}
function ensureVerifiedSettingsUser(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return null;
    }
    return user;
}
export function renderSettingsPage(request, response) {
    const user = ensureVerifiedSettingsUser(request, response);
    if (!user) {
        return;
    }
    response.render('settings', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'settings',
            guestInitialGreeting: '',
            request,
            title: `Ajustes · ${appDocumentTitle}`,
            user,
        }),
    });
}
export function handleUpdateSettingsPage(request, response) {
    const user = ensureVerifiedSettingsUser(request, response);
    if (!user) {
        return;
    }
    const activeProfile = request.activeProfile;
    if (!activeProfile) {
        response.redirect('/profiles');
        return;
    }
    const nextModelTier = normalizeModelTier(request.body?.modelTier);
    updateProfileModelTierForUser(activeProfile.id, user.id, nextModelTier);
    updateConversationModelTierForProfile(user.id, activeProfile.id, nextModelTier);
    response.redirect('/settings');
}
//# sourceMappingURL=handlers.js.map