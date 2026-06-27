import QRCode from 'qrcode';
import { archivePracticeModuleForUser, createConversationFromPracticeModule, createPracticeModule, deletePracticeModuleForUser, findPracticeModuleById, findPracticeModuleForUser, findPracticeModuleShareLinkById, findProfileById, findProfileForUser, getOrCreatePracticeModuleShareLink, importPracticeModuleToProfile, listConversationsForPracticeModule, restorePracticeModuleForUser, updatePracticeModule, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { getCreditCheckedOpenRouterApiKeyForUser } from '../services/creditGate.js';
import { generatePracticeModuleDraft } from '../services/resourceDrafts.js';
import { appDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
const emptyPracticeModuleFormValues = {
    description: '',
    title: '',
    tutorInstructions: '',
};
function redirectUnauthedPracticeModules(response) {
    response.redirect('/');
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
async function buildPracticeModulesPageModel(request, response, pageKind) {
    const user = request.authUser;
    const availableProfiles = request.availableProfiles ?? [];
    let activeProfile = request.activeProfile;
    if (!user?.emailVerified && pageKind !== 'share') {
        redirectUnauthedPracticeModules(response);
        return null;
    }
    let selectedPracticeModule = null;
    let selectedSharedPracticeModule = null;
    let selectedPracticeModuleShareLink = null;
    let selectedPracticeModuleSharedFromProfileName = '';
    let practiceModuleConversations = [];
    const requestedPracticeModuleId = typeof request.params.practiceModuleId === 'string'
        ? request.params.practiceModuleId.trim()
        : '';
    const requestedShareId = typeof request.params.shareId === 'string' ? request.params.shareId.trim() : '';
    if (pageKind === 'detail' || pageKind === 'edit') {
        if (!user) {
            redirectUnauthedPracticeModules(response);
            return null;
        }
        selectedPracticeModule = findPracticeModuleForUser(requestedPracticeModuleId, user.id);
        if (!selectedPracticeModule) {
            response.redirect('/resources');
            return null;
        }
        if (!activeProfile || selectedPracticeModule.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(selectedPracticeModule.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        practiceModuleConversations = listConversationsForPracticeModule(selectedPracticeModule.id, user.id, selectedPracticeModule.profileId);
    }
    if (pageKind === 'share') {
        selectedPracticeModuleShareLink = findPracticeModuleShareLinkById(requestedShareId);
        if (!selectedPracticeModuleShareLink || selectedPracticeModuleShareLink.revokedAt) {
            response.redirect('/resources');
            return null;
        }
        selectedSharedPracticeModule = findPracticeModuleById(selectedPracticeModuleShareLink.practiceModuleId);
        if (!selectedSharedPracticeModule) {
            response.redirect('/resources');
            return null;
        }
    }
    if (selectedPracticeModule) {
        selectedPracticeModuleShareLink = getOrCreatePracticeModuleShareLink(selectedPracticeModule.id);
        if (selectedPracticeModule.sourceProfileId) {
            selectedPracticeModuleSharedFromProfileName =
                findProfileById(selectedPracticeModule.sourceProfileId)?.name || '';
        }
    }
    if (selectedSharedPracticeModule?.sourceProfileId) {
        selectedPracticeModuleSharedFromProfileName =
            findProfileById(selectedSharedPracticeModule.sourceProfileId)?.name || '';
    }
    const shareTargetPracticeModuleProfiles = availableProfiles.filter((profile) => profile.id !== (selectedPracticeModule?.profileId ?? activeProfile?.id));
    const practiceModuleShareUrl = selectedPracticeModule && selectedPracticeModuleShareLink
        ? buildAbsoluteAppUrl(`/practice-modules/shared/${encodeURIComponent(selectedPracticeModuleShareLink.id)}`)
        : '';
    const practiceModuleShareQrDataUrl = practiceModuleShareUrl
        ? await QRCode.toDataURL(practiceModuleShareUrl, { margin: 1, width: 180 })
        : '';
    return {
        activeProfile,
        authMessage: getHomeAuthMessage(request, user),
        practiceModuleConversations,
        practiceModulePageMode: pageKind,
        practiceModuleShareQrDataUrl,
        practiceModuleShareUrl,
        selectedPracticeModule,
        selectedPracticeModuleShareLink,
        selectedPracticeModuleSharedFromProfileName,
        selectedSharedPracticeModule,
        shareTargetPracticeModuleProfiles,
        title: pageKind === 'new'
            ? `Nueva guía de práctica · ${appDocumentTitle}`
            : pageKind === 'edit'
                ? `Editar guía de práctica · ${appDocumentTitle}`
                : pageKind === 'detail'
                    ? `${selectedPracticeModule?.title || 'Guía de práctica'} · ${appDocumentTitle}`
                    : `${selectedSharedPracticeModule?.title || 'Guía compartida'} · ${appDocumentTitle}`,
        user,
    };
}
async function renderPracticeModulesPage(request, response, pageKind, overrides = {}) {
    const viewModel = await buildPracticeModulesPageModel(request, response, pageKind);
    if (!viewModel) {
        return;
    }
    response.render('practice-modules', {
        ...buildAppShellContext({
            activeProfile: viewModel.activeProfile,
            authMessage: viewModel.authMessage,
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: viewModel.title,
            user: viewModel.user,
        }),
        practiceModuleConversations: viewModel.practiceModuleConversations,
        practiceModuleFormValues: emptyPracticeModuleFormValues,
        practiceModuleGenerationError: '',
        practiceModuleGenerationModalAutoOpen: false,
        practiceModuleGenerationPrompt: '',
        practiceModulePageMode: viewModel.practiceModulePageMode,
        practiceModuleShareQrDataUrl: viewModel.practiceModuleShareQrDataUrl,
        practiceModuleShareUrl: viewModel.practiceModuleShareUrl,
        selectedPracticeModule: viewModel.selectedPracticeModule,
        selectedPracticeModuleShareLink: viewModel.selectedPracticeModuleShareLink,
        selectedPracticeModuleSharedFromProfileName: viewModel.selectedPracticeModuleSharedFromProfileName,
        selectedSharedPracticeModule: viewModel.selectedSharedPracticeModule,
        shareTargetPracticeModuleProfiles: viewModel.shareTargetPracticeModuleProfiles,
        ...overrides,
    });
}
export function renderNewPracticeModulePage(request, response) {
    return renderPracticeModulesPage(request, response, 'new');
}
export async function handleGeneratePracticeModuleDraft(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const prompt = typeof request.body.prompt === 'string' ? request.body.prompt.trim() : '';
    if (!prompt) {
        response.redirect('/practice-modules/new');
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        const draft = await generatePracticeModuleDraft({
            openRouterApiKey,
            prompt,
        });
        const practiceModule = createPracticeModule({
            description: draft.description,
            profileId: activeProfile.id,
            title: draft.title,
            tutorInstructions: draft.tutorInstructions,
            userId: user.id,
        });
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
    }
    catch (error) {
        await renderPracticeModulesPage(request, response, 'new', {
            practiceModuleGenerationError: error instanceof Error && error.message
                ? error.message
                : 'No pude generar la guía automáticamente.',
            practiceModuleGenerationModalAutoOpen: true,
            practiceModuleGenerationPrompt: prompt,
        });
    }
}
export function renderPracticeModuleDetailPage(request, response) {
    return renderPracticeModulesPage(request, response, 'detail');
}
export function renderEditPracticeModulePage(request, response) {
    return renderPracticeModulesPage(request, response, 'edit');
}
export function renderSharedPracticeModulePage(request, response) {
    return renderPracticeModulesPage(request, response, 'share');
}
export function handleCreatePracticeModule(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    const tutorInstructions = String(request.body.tutorInstructions || '').trim();
    if (!title || !description || !tutorInstructions) {
        response.redirect('/practice-modules/new');
        return;
    }
    const practiceModule = createPracticeModule({
        profileId: activeProfile.id,
        userId: user.id,
        title,
        description,
        tutorInstructions,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleCreatePracticeModuleConversation(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = typeof request.params.practiceModuleId === 'string'
        ? request.params.practiceModuleId.trim()
        : '';
    if (!practiceModuleId) {
        response.redirect('/resources');
        return;
    }
    const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/resources');
        return;
    }
    const conversation = createConversationFromPracticeModule(user.id, practiceModule);
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
export function handleUpdatePracticeModule(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = typeof request.params.practiceModuleId === 'string'
        ? request.params.practiceModuleId.trim()
        : '';
    if (!practiceModuleId) {
        response.redirect('/resources');
        return;
    }
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    const tutorInstructions = String(request.body.tutorInstructions || '').trim();
    if (!title || !description || !tutorInstructions) {
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModuleId)}/edit`);
        return;
    }
    const practiceModule = updatePracticeModule({
        practiceModuleId,
        description,
        title,
        tutorInstructions,
        userId: user.id,
    });
    if (!practiceModule) {
        response.redirect('/resources');
        return;
    }
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleArchivePracticeModule(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
    if (!practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    archivePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect(returnTo);
}
export function handleRestorePracticeModule(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
    if (!practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    restorePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect(returnTo);
}
export function handleDeletePracticeModule(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = typeof request.params.practiceModuleId === 'string'
        ? request.params.practiceModuleId.trim()
        : '';
    if (!practiceModuleId) {
        response.redirect('/resources');
        return;
    }
    deletePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect('/resources');
}
export function handleSharePracticeModuleToProfile(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!practiceModuleId || !targetProfileId) {
        response.redirect('/resources');
        return;
    }
    const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/resources');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, user.id);
    if (!targetProfile || targetProfile.id === practiceModule.profileId) {
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
        return;
    }
    importPracticeModuleToProfile({
        shareKind: 'profile',
        sourcePracticeModule: practiceModule,
        targetProfileId: targetProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleAcceptSharedPracticeModuleLink(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/resources');
        return;
    }
    const shareLink = findPracticeModuleShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/resources');
        return;
    }
    const sourcePracticeModule = findPracticeModuleById(shareLink.practiceModuleId);
    if (!sourcePracticeModule) {
        response.redirect('/resources');
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const imported = importPracticeModuleToProfile({
        shareKind: 'link',
        sourcePracticeModule,
        targetProfileId: activeProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(imported.id)}`);
}
//# sourceMappingURL=handlers.js.map