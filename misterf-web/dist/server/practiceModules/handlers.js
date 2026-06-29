import QRCode from 'qrcode';
import { archivePracticeModuleForUser, createConversationFromPracticeModule, createPracticeModule, deletePracticeModuleForUser, findResourceAccessForProfile, findPracticeModuleById, findPracticeModuleForUser, findPracticeModuleShareLinkById, findProfileById, findProfileForUser, findResourceFolderForResource, getOrCreateResourceShareLink, listResourceFolderPathForResource, listResourceFoldersForProfile, grantResourceAccess, listConversationsForPracticeModule, restorePracticeModuleForUser, updatePracticeModule, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { generatePracticeModuleDraft, generatePracticeModuleRevision, } from '../services/resourceDrafts.js';
import { appDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
import { logger } from '../services/logger.js';
const emptyPracticeModuleFormValues = {
    description: '',
    title: '',
    tutorInstructions: '',
};
function getDefaultPracticeModuleFormValues(pageKind, selectedPracticeModule) {
    if (pageKind !== 'edit' || !selectedPracticeModule) {
        return emptyPracticeModuleFormValues;
    }
    return {
        description: selectedPracticeModule.description,
        title: selectedPracticeModule.title,
        tutorInstructions: selectedPracticeModule.tutorInstructions,
    };
}
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
function readMultilineField(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
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
    let resourceCurrentFolder = null;
    let resourceFolderPath = [];
    let resourceFolderOptions = [];
    let canManagePracticeModule = false;
    const requestedPracticeModuleId = typeof request.params.practiceModuleId === 'string'
        ? request.params.practiceModuleId.trim()
        : '';
    const requestedShareId = typeof request.params.shareId === 'string' ? request.params.shareId.trim() : '';
    if (pageKind === 'edit') {
        if (!user) {
            redirectUnauthedPracticeModules(response);
            return null;
        }
        selectedPracticeModule = findPracticeModuleForUser(requestedPracticeModuleId, user.id);
        if (!selectedPracticeModule) {
            response.redirect('/resources');
            return null;
        }
        canManagePracticeModule = true;
        if (!activeProfile || selectedPracticeModule.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(selectedPracticeModule.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
    }
    if (pageKind === 'detail') {
        if (!user?.emailVerified || !activeProfile) {
            redirectUnauthedPracticeModules(response);
            return null;
        }
        const resourceAccess = findResourceAccessForProfile({
            includeArchived: true,
            profileId: activeProfile.id,
            resourceId: requestedPracticeModuleId,
            userId: user.id,
        });
        if (resourceAccess?.type === 'practice_guide') {
            if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
                response.redirect('/resources');
                return null;
            }
            selectedPracticeModule = findPracticeModuleById(resourceAccess.id);
            canManagePracticeModule = resourceAccess.accessKind === 'owner';
        }
        if (!selectedPracticeModule) {
            selectedPracticeModule = findPracticeModuleForUser(requestedPracticeModuleId, user.id);
            canManagePracticeModule = Boolean(selectedPracticeModule);
            if (selectedPracticeModule && selectedPracticeModule.profileId !== activeProfile.id) {
                const profile = findProfileForUser(selectedPracticeModule.profileId, user.id);
                if (profile) {
                    activeProfile = profile;
                    setActiveProfileCookie(response, profile.id);
                }
            }
        }
        if (!selectedPracticeModule) {
            response.redirect('/resources');
            return null;
        }
    }
    if (selectedPracticeModule && user) {
        const conversationProfileId = canManagePracticeModule
            ? selectedPracticeModule.profileId
            : activeProfile?.id ?? selectedPracticeModule.profileId;
        practiceModuleConversations = listConversationsForPracticeModule(selectedPracticeModule.id, user.id, conversationProfileId);
        if (canManagePracticeModule) {
            resourceCurrentFolder = findResourceFolderForResource(selectedPracticeModule.id, user.id);
            resourceFolderPath = listResourceFolderPathForResource(selectedPracticeModule.id, user.id);
            resourceFolderOptions = listResourceFoldersForProfile({
                includeArchived: false,
                profileId: selectedPracticeModule.profileId,
                userId: user.id,
            });
        }
    }
    if (pageKind === 'share') {
        const legacyShareLink = findPracticeModuleShareLinkById(requestedShareId);
        if (!legacyShareLink || legacyShareLink.revokedAt) {
            response.redirect('/resources');
            return null;
        }
        selectedPracticeModuleShareLink = legacyShareLink;
        selectedSharedPracticeModule = findPracticeModuleById(legacyShareLink.practiceModuleId);
        if (!selectedSharedPracticeModule) {
            response.redirect('/resources');
            return null;
        }
    }
    if (selectedPracticeModule && canManagePracticeModule) {
        selectedPracticeModuleShareLink = getOrCreateResourceShareLink(selectedPracticeModule.id);
        if (selectedPracticeModule.sourceProfileId) {
            selectedPracticeModuleSharedFromProfileName =
                findProfileById(selectedPracticeModule.sourceProfileId)?.name || '';
        }
    }
    if (selectedSharedPracticeModule?.sourceProfileId) {
        selectedPracticeModuleSharedFromProfileName =
            findProfileById(selectedSharedPracticeModule.sourceProfileId)?.name || '';
    }
    if (selectedPracticeModule && !canManagePracticeModule) {
        selectedPracticeModuleSharedFromProfileName =
            findProfileById(selectedPracticeModule.profileId)?.name || '';
    }
    const shareTargetPracticeModuleProfiles = availableProfiles.filter((profile) => profile.id !== (selectedPracticeModule?.profileId ?? activeProfile?.id));
    const practiceModuleShareUrl = selectedPracticeModule && selectedPracticeModuleShareLink
        ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(selectedPracticeModuleShareLink.id)}`)
        : '';
    const practiceModuleShareQrDataUrl = practiceModuleShareUrl
        ? await QRCode.toDataURL(practiceModuleShareUrl, { margin: 1, width: 180 })
        : '';
    return {
        activeProfile,
        authMessage: getHomeAuthMessage(request, user),
        canManagePracticeModule,
        practiceModuleConversations,
        practiceModulePageMode: pageKind,
        practiceModuleShareQrDataUrl,
        practiceModuleShareUrl,
        resourceCurrentFolder,
        resourceFolderPath,
        resourceFolderOptions,
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
        practiceModuleFormValues: getDefaultPracticeModuleFormValues(pageKind, viewModel.selectedPracticeModule),
        practiceModuleGenerationCreditExhausted: false,
        practiceModuleGenerationError: '',
        practiceModuleGenerationModalAutoOpen: false,
        practiceModuleGenerationPrompt: '',
        practiceModulePageMode: viewModel.practiceModulePageMode,
        practiceModuleRevisionCreditExhausted: false,
        practiceModuleRevisionError: '',
        practiceModuleRevisionModalAutoOpen: false,
        practiceModuleRevisionPrompt: '',
        practiceModuleRevisionSuccess: String(request.query.aiRevision || '') === 'success',
        canManagePracticeModule: viewModel.canManagePracticeModule,
        practiceModuleShareQrDataUrl: viewModel.practiceModuleShareQrDataUrl,
        practiceModuleShareUrl: viewModel.practiceModuleShareUrl,
        resourceCurrentFolder: viewModel.resourceCurrentFolder,
        resourceFolderPath: viewModel.resourceFolderPath,
        resourceFolderOptions: viewModel.resourceFolderOptions,
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
        logger.info('practice_guide_created_from_prompt', {
            profileId: activeProfile.id,
            resourceId: practiceModule.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        await renderPracticeModulesPage(request, response, 'new', {
            practiceModuleGenerationCreditExhausted: isCreditError,
            practiceModuleGenerationError: isCreditError
                ? getCreditExhaustedMessage()
                : error instanceof Error && error.message
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
    const shareId = String(request.params.shareId || '').trim();
    const legacyShareLink = findPracticeModuleShareLinkById(shareId);
    if (!legacyShareLink || legacyShareLink.revokedAt) {
        response.redirect('/resources');
        return;
    }
    const resourceShareLink = getOrCreateResourceShareLink(legacyShareLink.practiceModuleId);
    response.redirect(`/resources/shared/${encodeURIComponent(resourceShareLink.id)}`);
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
    logger.info('practice_guide_created', {
        profileId: activeProfile.id,
        resourceId: practiceModule.id,
        resourceType: 'practice_guide',
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export async function handleRevisePracticeModule(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const requestedChange = readMultilineField(request.body.prompt, 4000);
    if (!practiceModuleId) {
        response.redirect('/resources');
        return;
    }
    const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/resources');
        return;
    }
    if (requestedChange.length < 3) {
        await renderPracticeModulesPage(request, response.status(422), 'edit', {
            practiceModuleRevisionError: 'Describe los cambios que quieres aplicar.',
            practiceModuleRevisionModalAutoOpen: true,
            practiceModuleRevisionPrompt: requestedChange,
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        const revision = await generatePracticeModuleRevision({
            currentModule: {
                description: practiceModule.description,
                title: practiceModule.title,
                tutorInstructions: practiceModule.tutorInstructions,
            },
            openRouterApiKey,
            prompt: requestedChange,
        });
        const updatedPracticeModule = updatePracticeModule({
            description: revision.description,
            practiceModuleId: practiceModule.id,
            title: revision.title,
            tutorInstructions: revision.tutorInstructions,
            userId: user.id,
        });
        if (!updatedPracticeModule) {
            await renderPracticeModulesPage(request, response.status(422), 'edit', {
                practiceModuleRevisionError: 'No pude guardar los cambios de la guía.',
                practiceModuleRevisionModalAutoOpen: true,
                practiceModuleRevisionPrompt: requestedChange,
            });
            return;
        }
        logger.info('practice_guide_revised', {
            profileId: updatedPracticeModule.profileId,
            resourceId: updatedPracticeModule.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
        response.redirect(`/practice-modules/${encodeURIComponent(updatedPracticeModule.id)}/edit?aiRevision=success`);
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        await renderPracticeModulesPage(request, response.status(422), 'edit', {
            practiceModuleRevisionCreditExhausted: isCreditError,
            practiceModuleRevisionError: isCreditError
                ? getCreditExhaustedMessage()
                : 'No pude editar la guía con IA ahora mismo.',
            practiceModuleRevisionModalAutoOpen: true,
            practiceModuleRevisionPrompt: requestedChange,
        });
    }
}
export function handleCreatePracticeModuleConversation(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
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
    const resourceAccess = findResourceAccessForProfile({
        profileId: activeProfile.id,
        resourceId: practiceModuleId,
        userId: user.id,
    });
    const practiceModule = resourceAccess?.type === 'practice_guide'
        ? findPracticeModuleById(resourceAccess.id)
        : findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/resources');
        return;
    }
    const conversation = createConversationFromPracticeModule(user.id, practiceModule, resourceAccess?.accessKind === 'shared' ? activeProfile.id : practiceModule.profileId);
    logger.info('practice_guide_conversation_created', {
        accessKind: resourceAccess?.accessKind ?? 'owner',
        conversationId: conversation.id,
        profileId: conversation.profileId,
        resourceId: practiceModule.id,
        resourceType: 'practice_guide',
        userId: user.id,
    });
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
    logger.info('practice_guide_updated', {
        profileId: practiceModule.profileId,
        resourceId: practiceModule.id,
        resourceType: 'practice_guide',
        userId: user.id,
    });
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
    const practiceModule = archivePracticeModuleForUser(practiceModuleId, user.id);
    if (practiceModule) {
        logger.info('resource_archived', {
            profileId: practiceModule.profileId,
            resourceId: practiceModule.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
    }
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
    const practiceModule = restorePracticeModuleForUser(practiceModuleId, user.id);
    if (practiceModule) {
        logger.info('resource_restored', {
            profileId: practiceModule.profileId,
            resourceId: practiceModule.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
    }
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
    grantResourceAccess({
        grantedByUserId: user.id,
        grantedVia: 'profile',
        profileId: targetProfile.id,
        resourceId: practiceModule.id,
        userId: user.id,
    });
    logger.info('resource_shared_with_profile', {
        profileId: practiceModule.profileId,
        resourceId: practiceModule.id,
        resourceType: 'practice_guide',
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
    const resourceShareLink = getOrCreateResourceShareLink(sourcePracticeModule.id);
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect(`/login?returnTo=${encodeURIComponent(`/resources/shared/${resourceShareLink.id}`)}`);
        return;
    }
    grantResourceAccess({
        grantedByUserId: sourcePracticeModule.userId,
        grantedVia: 'link',
        profileId: activeProfile.id,
        resourceId: sourcePracticeModule.id,
        shareLinkId: resourceShareLink.id,
        userId: user.id,
    });
    logger.info('resource_share_link_accepted', {
        ownerProfileId: sourcePracticeModule.profileId,
        ownerUserId: sourcePracticeModule.userId,
        profileId: activeProfile.id,
        resourceId: sourcePracticeModule.id,
        resourceType: 'practice_guide',
        shareLinkId: resourceShareLink.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(sourcePracticeModule.id)}`);
}
//# sourceMappingURL=handlers.js.map