import { createProfile, findProfileForUser, markProfileOnboardingCompleted, updateConversationModelTierForProfile, updateProfile, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
import { normalizeProfileReturnTo, normalizeProfileText, profileDescriptionMaxLength, profileLearningContextMaxLength, profileNameMaxLength, } from './fields.js';
import { normalizeProfileModelTier } from './modelTier.js';
const profileFieldLimits = {
    description: profileDescriptionMaxLength,
    learningContext: profileLearningContextMaxLength,
    name: profileNameMaxLength,
};
function ensureVerifiedProfileUser(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return null;
    }
    return user;
}
function normalizeReturnTo(value) {
    if (!value) {
        return '/';
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) {
        return '/';
    }
    return trimmed;
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
        profileFieldLimits,
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
        profileFieldLimits,
        profilePageMode: 'edit',
        selectedProfile,
    });
}
export function renderProfileOnboardingPage(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const activeProfile = request.activeProfile;
    if (!activeProfile) {
        response.redirect('/');
        return;
    }
    const returnTo = normalizeProfileReturnTo(request.query.returnTo);
    response.render('profile-onboarding', {
        ...buildAppShellContext({
            activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'profiles',
            guestInitialGreeting: '',
            request,
            title: `Completa tu perfil · ${appDocumentTitle}`,
            user,
        }),
        error: '',
        profileFieldLimits,
        returnTo,
        selectedProfile: activeProfile,
        values: {
            description: activeProfile.description,
            learningContext: activeProfile.learningContext,
            name: activeProfile.name,
        },
    });
}
export function handleProfileOnboarding(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const activeProfile = request.activeProfile;
    if (!activeProfile) {
        response.redirect('/');
        return;
    }
    const returnTo = normalizeProfileReturnTo(request.body.returnTo);
    const name = normalizeProfileText(request.body.name, profileNameMaxLength);
    const description = normalizeProfileText(request.body.description, profileDescriptionMaxLength);
    const learningContext = normalizeProfileText(request.body.learningContext, profileLearningContextMaxLength);
    if (!name) {
        response.status(422).render('profile-onboarding', {
            ...buildAppShellContext({
                activeProfile,
                authMessage: getHomeAuthMessage(request, user),
                currentView: 'profiles',
                guestInitialGreeting: '',
                request,
                title: `Completa tu perfil · ${appDocumentTitle}`,
                user,
            }),
            error: 'Escribe un nombre para este perfil.',
            profileFieldLimits,
            returnTo,
            selectedProfile: activeProfile,
            values: {
                description,
                learningContext,
                name,
            },
        });
        return;
    }
    updateProfile({
        description,
        learningContext,
        name,
        profileId: activeProfile.id,
        profileOnboardingCompleted: true,
        userId: user.id,
    });
    response.redirect(returnTo);
}
export function handleSkipProfileOnboarding(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    const activeProfile = request.activeProfile;
    if (!user) {
        return;
    }
    if (!activeProfile) {
        response.redirect('/');
        return;
    }
    markProfileOnboardingCompleted({
        profileId: activeProfile.id,
        userId: user.id,
    });
    response.redirect(normalizeProfileReturnTo(request.body.returnTo));
}
export function handleSwitchProfile(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const profileId = String(request.body.profileId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
    if (!profileId) {
        response.redirect(returnTo);
        return;
    }
    const profile = findProfileForUser(profileId, user.id);
    if (!profile) {
        response.redirect(returnTo);
        return;
    }
    setActiveProfileCookie(response, profile.id);
    response.redirect(returnTo);
}
export function handleCreateProfile(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const name = normalizeProfileText(request.body.name, profileNameMaxLength);
    const description = normalizeProfileText(request.body.description, profileDescriptionMaxLength);
    const learningContext = normalizeProfileText(request.body.learningContext, profileLearningContextMaxLength);
    const modelTier = normalizeProfileModelTier(request.body.modelTier);
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
    if (!name) {
        response.redirect(returnTo);
        return;
    }
    const profile = createProfile({
        description,
        learningContext,
        modelTier,
        name,
        profileOnboardingCompleted: true,
        userId: user.id,
    });
    setActiveProfileCookie(response, profile.id);
    response.redirect(returnTo);
}
export function handleUpdateProfile(request, response) {
    const user = ensureVerifiedProfileUser(request, response);
    if (!user) {
        return;
    }
    const profileId = String(request.params.profileId || '').trim();
    if (!profileId) {
        response.redirect('/profiles');
        return;
    }
    const name = normalizeProfileText(request.body.name, profileNameMaxLength);
    const description = normalizeProfileText(request.body.description, profileDescriptionMaxLength);
    const learningContext = normalizeProfileText(request.body.learningContext, profileLearningContextMaxLength);
    const modelTier = normalizeProfileModelTier(request.body.modelTier);
    if (!name) {
        response.redirect(`/profiles/${encodeURIComponent(profileId)}/edit`);
        return;
    }
    const profile = updateProfile({
        description,
        learningContext,
        modelTier,
        name,
        profileId,
        profileOnboardingCompleted: true,
        userId: user.id,
    });
    if (!profile) {
        response.redirect('/profiles');
        return;
    }
    updateConversationModelTierForProfile(user.id, profile.id, modelTier);
    response.redirect('/profiles');
}
//# sourceMappingURL=handlers.js.map