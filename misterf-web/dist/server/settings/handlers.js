import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
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
//# sourceMappingURL=handlers.js.map