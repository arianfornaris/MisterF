import { findProfileForUser } from '../db/repository.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
function ensureVerifiedProfileUser(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return null;
    }
    return user;
}
export function renderProfilesListPage(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    response.render('profiles-list', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'profiles',
            guestInitialGreeting: '',
            request,
            title: `Perfiles · ${appDocumentTitle}`,
            user,
        }),
        profilePageMode: 'list',
    });
}
export function renderNewProfilePage(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    response.render('profiles-form', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'profiles',
            guestInitialGreeting: '',
            request,
            title: `Nuevo perfil · ${appDocumentTitle}`,
            user,
        }),
        profilePageMode: 'new',
        selectedProfile: null,
    });
}
export function renderEditProfilePage(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const requestedProfileIdRaw = request.params.profileId;
    const requestedProfileId = typeof requestedProfileIdRaw === 'string'
        ? requestedProfileIdRaw.trim()
        : '';
    const selectedProfile = findProfileForUser(requestedProfileId, user.id);
    if (!selectedProfile) {
        response.redirect('/profiles');
        return;
    }
    response.render('profiles-form', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'profiles',
            guestInitialGreeting: '',
            request,
            title: `Editar perfil · ${appDocumentTitle}`,
            user,
        }),
        profilePageMode: 'edit',
        selectedProfile,
    });
}
//# sourceMappingURL=handlers.js.map