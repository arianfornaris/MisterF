import { findLearnerProgressProfile, listLearnerProgressEvents, } from '../db/repository.js';
import { buildLearnerProgressEventViews, buildLearnerProgressVocabularyItems, } from '../services/learnerProgressView.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
function ensureVerifiedProgressUser(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return null;
    }
    return user;
}
export function renderProgressPage(request, response) {
    const user = ensureVerifiedProgressUser(request, response);
    if (!user) {
        return;
    }
    if (!request.activeProfile) {
        response.redirect('/profiles');
        return;
    }
    const progressProfile = findLearnerProgressProfile(user.id, request.activeProfile.id);
    const events = listLearnerProgressEvents({
        limit: 50,
        profileId: request.activeProfile.id,
        userId: user.id,
    });
    const eventViews = buildLearnerProgressEventViews(events);
    const vocabularyItems = buildLearnerProgressVocabularyItems(events);
    response.render('progress', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'progress',
            guestInitialGreeting: '',
            request,
            title: `Progreso · ${appDocumentTitle}`,
            user,
        }),
        events: eventViews,
        progressProfile,
        selectedProgressTab: normalizeProgressTab(request.query.tab),
        vocabularyItems,
    });
}
function normalizeProgressTab(value) {
    return value === 'events' || value === 'vocabulary' ? value : 'general';
}
//# sourceMappingURL=handlers.js.map