import { randomUUID } from 'node:crypto';
import { translate } from '../i18n/index.js';
import QRCode from 'qrcode';
import { addResourceToFolder, archivePracticeGuideForUser, createConversationFromPracticeGuide, createPracticeGuide, deletePracticeGuideForUser, findResourceAccessForProfile, findResourceAccessGrant, findResourceShareLinkById, findPracticeGuideById, findPracticeGuideForUser, findProfileById, findProfileForUser, findResourceFolderForResource, getOrCreateResourceShareLink, getResourceParticipationSummary, upsertResourceParticipationSummary, listCollectedPracticeGuideReportsForOwner, listResourceFolderPathForResource, listResourceFoldersForProfile, grantResourceAccess, listConversationsForPracticeGuide, restorePracticeGuideForUser, updatePracticeGuide, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { findUserById } from '../auth/repository.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { generateGuideParticipationSummary, generatePracticeGuideDraft, generatePracticeGuideRevision, safeParsePracticeGuideDraft, } from '../services/resourceDrafts.js';
import { computeParticipationFingerprint, readParticipationSummaryError, } from '../resources/participationSummary.js';
import { appDocumentTitle, buildAbsoluteAppUrl, buildAppShellContext, formatRelativeTime, getHomeAuthMessage, } from '../pages/shell.js';
import { logger } from '../services/logger.js';
import { deletePendingPracticeGuideModification, getPendingPracticeGuideModification, listPracticeGuideModificationChanges, setPendingPracticeGuideModification, } from './modificationPreviewStore.js';
import { resolveOriginFolderContext, } from '../resources/originFolder.js';
function buildPracticeGuideAuthoringPath(practiceGuideId) {
    return `/practice-guides/${encodeURIComponent(practiceGuideId)}/edit`;
}
function redirectUnauthedPracticeGuides(response) {
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
function readRawField(value) {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}
function storedPracticeGuideToDraft(practiceGuide) {
    return {
        description: practiceGuide.description,
        title: practiceGuide.title,
        tutorInstructions: practiceGuide.tutorInstructions,
    };
}
async function buildPracticeGuidesPageModel(request, response, pageKind) {
    const user = request.authUser;
    const availableProfiles = request.availableProfiles ?? [];
    let activeProfile = request.activeProfile;
    if (!user?.emailVerified) {
        redirectUnauthedPracticeGuides(response);
        return null;
    }
    let selectedPracticeGuide = null;
    let selectedPracticeGuideShareLink = null;
    let selectedPracticeGuideSharedFromProfileName = '';
    let practiceGuideConversations = [];
    let resourceCurrentFolder = null;
    let resourceFolderPath = [];
    let resourceFolderOptions = [];
    let canManagePracticeGuide = false;
    const requestedPracticeGuideId = typeof request.params.practiceGuideId === 'string'
        ? request.params.practiceGuideId.trim()
        : '';
    if (pageKind === 'edit') {
        if (!user) {
            redirectUnauthedPracticeGuides(response);
            return null;
        }
        selectedPracticeGuide = findPracticeGuideForUser(requestedPracticeGuideId, user.id);
        if (!selectedPracticeGuide) {
            response.redirect('/resources');
            return null;
        }
        canManagePracticeGuide = true;
        if (!activeProfile || selectedPracticeGuide.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(selectedPracticeGuide.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
    }
    if (pageKind === 'detail') {
        if (!user?.emailVerified || !activeProfile) {
            redirectUnauthedPracticeGuides(response);
            return null;
        }
        const resourceAccess = findResourceAccessForProfile({
            includeArchived: true,
            profileId: activeProfile.id,
            resourceId: requestedPracticeGuideId,
            userId: user.id,
        });
        if (resourceAccess?.type === 'practice_guide') {
            if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
                response.redirect('/resources');
                return null;
            }
            selectedPracticeGuide = findPracticeGuideById(resourceAccess.id);
            canManagePracticeGuide = resourceAccess.accessKind === 'owner';
        }
        if (!selectedPracticeGuide) {
            selectedPracticeGuide = findPracticeGuideForUser(requestedPracticeGuideId, user.id);
            canManagePracticeGuide = Boolean(selectedPracticeGuide);
            if (selectedPracticeGuide && selectedPracticeGuide.profileId !== activeProfile.id) {
                const profile = findProfileForUser(selectedPracticeGuide.profileId, user.id);
                if (profile) {
                    activeProfile = profile;
                    setActiveProfileCookie(response, profile.id);
                }
            }
        }
        if (!selectedPracticeGuide) {
            response.redirect('/resources');
            return null;
        }
    }
    if (selectedPracticeGuide && user) {
        const conversationProfileId = canManagePracticeGuide
            ? selectedPracticeGuide.profileId
            : activeProfile?.id ?? selectedPracticeGuide.profileId;
        practiceGuideConversations = listConversationsForPracticeGuide(selectedPracticeGuide.id, user.id, conversationProfileId);
        if (canManagePracticeGuide) {
            resourceCurrentFolder = findResourceFolderForResource(selectedPracticeGuide.id, user.id);
            resourceFolderPath = listResourceFolderPathForResource(selectedPracticeGuide.id, user.id);
            resourceFolderOptions = listResourceFoldersForProfile({
                includeArchived: false,
                profileId: selectedPracticeGuide.profileId,
                userId: user.id,
            });
        }
    }
    if (selectedPracticeGuide && canManagePracticeGuide) {
        selectedPracticeGuideShareLink = getOrCreateResourceShareLink(selectedPracticeGuide.id);
        if (selectedPracticeGuide.sourceProfileId) {
            selectedPracticeGuideSharedFromProfileName =
                findProfileById(selectedPracticeGuide.sourceProfileId)?.name || '';
        }
    }
    if (selectedPracticeGuide && !canManagePracticeGuide) {
        selectedPracticeGuideSharedFromProfileName =
            findProfileById(selectedPracticeGuide.profileId)?.name || '';
    }
    const shareTargetPracticeGuideProfiles = availableProfiles.filter((profile) => profile.id !== (selectedPracticeGuide?.profileId ?? activeProfile?.id));
    const practiceGuideShareUrl = selectedPracticeGuide && selectedPracticeGuideShareLink
        ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(selectedPracticeGuideShareLink.id)}`)
        : '';
    const practiceGuideShareQrDataUrl = practiceGuideShareUrl
        ? await QRCode.toDataURL(practiceGuideShareUrl, { margin: 1, width: 180 })
        : '';
    // Owner-only at-a-glance participation, mirroring the quiz detail page: the
    // full list lives on the participation page.
    const collectedReportCount = canManagePracticeGuide && selectedPracticeGuide
        ? listCollectedPracticeGuideReportsForOwner({
            authorProfileId: selectedPracticeGuide.profileId,
            practiceGuideId: selectedPracticeGuide.id,
        }).length
        : 0;
    return {
        activeProfile,
        authMessage: getHomeAuthMessage(request, user),
        canManagePracticeGuide,
        collectedReportCount,
        practiceGuideConversations,
        practiceGuidePageMode: pageKind,
        practiceGuideShareQrDataUrl,
        practiceGuideShareUrl,
        resourceCurrentFolder,
        resourceFolderPath,
        resourceFolderOptions,
        selectedPracticeGuide,
        selectedPracticeGuideShareLink,
        selectedPracticeGuideSharedFromProfileName,
        shareTargetPracticeGuideProfiles,
        title: pageKind === 'new'
            ? `${translate(request.locale, 'practiceGuides.newTitle')} · ${appDocumentTitle}`
            : pageKind === 'edit'
                ? `${translate(request.locale, 'practiceGuides.editTitle')} · ${appDocumentTitle}`
                : `${selectedPracticeGuide?.title || translate(request.locale, 'practiceGuides.defaultTitle')} · ${appDocumentTitle}`,
        user,
    };
}
async function renderPracticeGuidesPage(request, response, pageKind) {
    const viewModel = await buildPracticeGuidesPageModel(request, response, pageKind);
    if (!viewModel) {
        return;
    }
    response.render('practice-guides', {
        ...buildAppShellContext({
            activeProfile: viewModel.activeProfile,
            authMessage: viewModel.authMessage,
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: viewModel.title,
            user: viewModel.user,
        }),
        practiceGuideConversations: viewModel.practiceGuideConversations,
        practiceGuidePageMode: viewModel.practiceGuidePageMode,
        canManagePracticeGuide: viewModel.canManagePracticeGuide,
        collectedReportCount: viewModel.collectedReportCount,
        practiceGuideShareQrDataUrl: viewModel.practiceGuideShareQrDataUrl,
        practiceGuideShareUrl: viewModel.practiceGuideShareUrl,
        resourceCurrentFolder: viewModel.resourceCurrentFolder,
        resourceFolderPath: viewModel.resourceFolderPath,
        resourceFolderOptions: viewModel.resourceFolderOptions,
        selectedPracticeGuide: viewModel.selectedPracticeGuide,
        selectedPracticeGuideShareLink: viewModel.selectedPracticeGuideShareLink,
        selectedPracticeGuideSharedFromProfileName: viewModel.selectedPracticeGuideSharedFromProfileName,
        shareTargetPracticeGuideProfiles: viewModel.shareTargetPracticeGuideProfiles,
    });
}
function ensureVerifiedPracticeGuideUser(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return null;
    }
    return { activeProfile, user };
}
function resolveOwnPracticeGuide(request, response) {
    const auth = ensureVerifiedPracticeGuideUser(request, response);
    if (!auth) {
        return null;
    }
    const practiceGuideId = String(request.params.practiceGuideId || '').trim();
    const practiceGuide = findPracticeGuideForUser(practiceGuideId, auth.user.id);
    if (!practiceGuide) {
        response.redirect('/resources');
        return null;
    }
    let activeProfile = auth.activeProfile;
    if (practiceGuide.profileId !== activeProfile.id) {
        const profile = findProfileForUser(practiceGuide.profileId, auth.user.id);
        if (!profile) {
            response.redirect('/resources');
            return null;
        }
        activeProfile = profile;
        setActiveProfileCookie(response, profile.id);
    }
    return { activeProfile, practiceGuide, user: auth.user };
}
function buildCollectedPracticeGuideReportListItems(reports, locale) {
    return reports.map((report) => ({
        conversationId: report.conversationId,
        participantLabel: report.participantProfileName
            || report.participantName
            || report.participantEmail
            || translate(locale, 'quizzes.resultsAnonymousParticipant'),
        relativeUpdatedAt: formatRelativeTime(report.updatedAt),
        summaryTitle: report.summaryTitle,
    }));
}
/**
 * Owner-only participation page for a practice guide: lists the finalized
 * "Finalizar y resumir" reports collected from shared participants, each
 * linking to the read-only owner report view. Mirrors the quiz/roleplay
 * participation pages.
 */
export function renderPracticeGuideParticipationPage(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const reports = listCollectedPracticeGuideReportsForOwner({
        authorProfileId: resolved.practiceGuide.profileId,
        practiceGuideId: resolved.practiceGuide.id,
    });
    const storedSummary = getResourceParticipationSummary(resolved.practiceGuide.id);
    const participationSummary = storedSummary
        ? {
            generatedAtRelative: formatRelativeTime(storedSummary.generatedAt),
            stale: storedSummary.inputFingerprint
                !== computeParticipationFingerprint(reports),
            text: storedSummary.summaryText,
        }
        : null;
    response.render('practice-guides-participation', {
        ...buildAppShellContext({
            activeProfile: resolved.activeProfile,
            authMessage: getHomeAuthMessage(request, resolved.user),
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: `${resolved.practiceGuide.title} - ${appDocumentTitle}`,
            user: resolved.user,
        }),
        collectedReports: buildCollectedPracticeGuideReportListItems(reports, request.locale),
        participationSummary,
        participationSummaryError: readParticipationSummaryError(request.query.summaryError, request.locale),
        selectedPracticeGuide: resolved.practiceGuide,
    });
}
/**
 * Owner-only AI summary over the collected practice-guide reports. Mirrors the
 * quiz and roleplay summaries: generated on the owner's own credit-gated key,
 * persisted with a fingerprint so the page can flag it as stale, and guarded on
 * an empty state before spending any inference.
 */
export async function handleGeneratePracticeGuideParticipationSummary(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    // The summary lives on the participation page, so every outcome returns there.
    const participationPath = `/practice-guides/${encodeURIComponent(resolved.practiceGuide.id)}/participation`;
    const reports = listCollectedPracticeGuideReportsForOwner({
        authorProfileId: resolved.practiceGuide.profileId,
        practiceGuideId: resolved.practiceGuide.id,
    });
    if (reports.length === 0) {
        response.redirect(`${participationPath}?summaryError=empty`);
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const result = await generateGuideParticipationSummary({
            instructionLanguage: resolved.activeProfile.instructionLanguage,
            openRouterApiKey,
            request: {
                description: resolved.practiceGuide.description,
                reportCount: reports.length,
                reports: reports.map((report) => summarizeGuideReportForParticipation(report.report)),
                title: resolved.practiceGuide.title,
            },
        });
        upsertResourceParticipationSummary({
            inputFingerprint: computeParticipationFingerprint(reports),
            resourceId: resolved.practiceGuide.id,
            summaryText: result.summary,
        });
        logger.info('practice_guide_participation_summary_generated', {
            reportCount: reports.length,
            resourceId: resolved.practiceGuide.id,
            resourceType: 'practice_guide',
            userId: resolved.user.id,
        });
        response.redirect(participationPath);
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect(`${participationPath}?summaryError=credit`);
            return;
        }
        logger.error('practice_guide_participation_summary_failed', {
            error,
            resourceId: resolved.practiceGuide.id,
            resourceType: 'practice_guide',
            userId: resolved.user.id,
        });
        response.redirect(`${participationPath}?summaryError=generic`);
    }
}
/**
 * Reduces one finalized report to the aggregate signal the summary prompt needs.
 * Reads defensively: the report is validated at write time, but a summary must
 * never throw on an older or partial shape.
 */
function summarizeGuideReportForParticipation(report) {
    const readStrings = (value) => Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
    const rawDifficultyAreas = report?.difficultyAreas;
    const difficultyAreas = Array.isArray(rawDifficultyAreas)
        ? rawDifficultyAreas
            .map((area) => typeof area === 'object' && area !== null
            ? area.title
            : area)
            .filter((title) => typeof title === 'string')
        : [];
    return {
        difficultyAreas,
        nextSteps: readStrings(report?.nextSteps),
        practicedTopics: readStrings(report?.practicedTopics),
    };
}
/**
 * Owner read-only view of a single collected practice-guide report. The report
 * must belong to a session whose share collected results for this guide; the
 * owner never sees the raw chat, only the finalized report.
 */
export function renderPracticeGuideReportPage(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const conversationId = String(request.params.conversationId || '').trim();
    const reportRecord = listCollectedPracticeGuideReportsForOwner({
        authorProfileId: resolved.practiceGuide.profileId,
        practiceGuideId: resolved.practiceGuide.id,
    }).find((report) => report.conversationId === conversationId);
    if (!reportRecord) {
        response.redirect(`/practice-guides/${encodeURIComponent(resolved.practiceGuide.id)}/participation`);
        return;
    }
    const participantUser = reportRecord.userId
        ? findUserById(reportRecord.userId)
        : null;
    logger.info('practice_guide_owner_report_viewed', {
        conversationId: reportRecord.conversationId,
        resourceId: resolved.practiceGuide.id,
        resourceType: 'practice_guide',
        userId: resolved.user.id,
    });
    response.render('practice-guides-report', {
        ...buildAppShellContext({
            activeProfile: resolved.activeProfile,
            authMessage: getHomeAuthMessage(request, resolved.user),
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: `${reportRecord.summaryTitle} - ${appDocumentTitle}`,
            user: resolved.user,
        }),
        ownerViewParticipantLabel: reportRecord.participantProfileName
            || participantUser?.fullName
            || participantUser?.email
            || translate(request.locale, 'quizzes.resultsAnonymousParticipant'),
        reportRecord,
        selectedPracticeGuide: resolved.practiceGuide,
    });
}
function renderPracticeGuideAuthoring(request, response, input) {
    response.render('practice-guides-authoring', {
        ...buildAppShellContext({
            activeProfile: input.activeProfile,
            authMessage: getHomeAuthMessage(request, input.user),
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: `${input.practiceGuide.title} - ${appDocumentTitle}`,
            user: input.user,
        }),
        authoringError: input.error || '',
        selectedPracticeGuide: input.practiceGuide,
    });
}
export function renderNewPracticeGuidePage(request, response) {
    const auth = ensureVerifiedPracticeGuideUser(request, response);
    if (!auth) {
        return;
    }
    renderPracticeGuideNewView(request, response, {
        activeProfile: auth.activeProfile,
        generationError: '',
        generationPrompt: '',
        originFolder: resolveOriginFolderContext(request.query.folder, auth.user.id),
        user: auth.user,
    });
}
function renderPracticeGuideNewView(request, response, input) {
    response.render('practice-guides-new', {
        ...buildAppShellContext({
            activeProfile: input.activeProfile,
            authMessage: getHomeAuthMessage(request, input.user),
            currentView: 'resources',
            guestInitialGreeting: '',
            request,
            title: `${translate(request.locale, 'practiceGuides.newTitle')} - ${appDocumentTitle}`,
            user: input.user,
        }),
        ...(input.originFolder ?? { originFolderId: null, originFolderPath: [] }),
        generationCreditExhausted: Boolean(input.generationCreditExhausted),
        generationError: input.generationError,
        generationPrompt: input.generationPrompt,
    });
}
export async function handleGeneratePracticeGuideDraft(request, response) {
    const auth = ensureVerifiedPracticeGuideUser(request, response);
    if (!auth) {
        return;
    }
    const originFolder = resolveOriginFolderContext(request.body.folderId, auth.user.id);
    const prompt = readMultilineField(request.body.prompt, 6000);
    if (prompt.length < 10) {
        renderPracticeGuideNewView(request, response.status(422), {
            activeProfile: auth.activeProfile,
            generationError: translate(request.locale, 'msg.describeGuideBetter'),
            generationPrompt: prompt,
            originFolder,
            user: auth.user,
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
        const draft = await generatePracticeGuideDraft({
            instructionLanguage: auth.activeProfile?.instructionLanguage,
            openRouterApiKey,
            prompt,
        });
        const practiceGuide = createPracticeGuide({
            description: draft.description,
            profileId: auth.activeProfile.id,
            title: draft.title,
            tutorInstructions: draft.tutorInstructions,
            userId: auth.user.id,
        });
        if (originFolder.originFolderId) {
            addResourceToFolder({
                folderId: originFolder.originFolderId,
                resourceId: practiceGuide.id,
                userId: auth.user.id,
            });
        }
        logger.info('practice_guide_created_from_prompt', {
            profileId: auth.activeProfile.id,
            resourceId: practiceGuide.id,
            resourceType: 'practice_guide',
            userId: auth.user.id,
        });
        response.redirect(buildPracticeGuideAuthoringPath(practiceGuide.id));
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        logger.error('practice_guide_generation_failed', {
            error,
            userId: auth.user.id,
        });
        renderPracticeGuideNewView(request, response.status(422), {
            activeProfile: auth.activeProfile,
            generationCreditExhausted: isCreditError,
            generationError: isCreditError
                ? getCreditExhaustedMessage(request.locale)
                : translate(request.locale, 'msg.generateGuideError'),
            generationPrompt: prompt,
            originFolder,
            user: auth.user,
        });
    }
}
export function renderPracticeGuideDetailPage(request, response) {
    return renderPracticeGuidesPage(request, response, 'detail');
}
export function renderEditPracticeGuidePage(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    renderPracticeGuideAuthoring(request, response, {
        ...resolved,
    });
}
export async function handlePreviewPracticeGuideModification(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const rawCurrentDraft = readRawField(request.body.currentDraft);
    const requestedChange = readMultilineField(request.body.requestedChange, 2000);
    let currentDraft = null;
    if (rawCurrentDraft) {
        try {
            currentDraft = safeParsePracticeGuideDraft(JSON.parse(rawCurrentDraft));
        }
        catch {
            currentDraft = null;
        }
    }
    if (!currentDraft || requestedChange.length < 3) {
        response.status(422).json({
            error: translate(request.locale, 'practiceGuides.modificationFailed'),
        });
        return;
    }
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
        const revision = await generatePracticeGuideRevision({
            instructionLanguage: resolved.activeProfile?.instructionLanguage,
            currentPracticeGuide: currentDraft,
            openRouterApiKey,
            prompt: requestedChange,
        });
        const changes = listPracticeGuideModificationChanges(currentDraft, revision.guide);
        if (changes.length === 0) {
            response.status(422).json({
                error: translate(request.locale, 'practiceGuides.modificationNoChanges'),
            });
            return;
        }
        const previewId = randomUUID();
        const owner = {
            practiceGuideId: resolved.practiceGuide.id,
            profileId: resolved.activeProfile.id,
            userId: resolved.user.id,
        };
        setPendingPracticeGuideModification(owner, {
            baseStoredDraft: storedPracticeGuideToDraft(resolved.practiceGuide),
            baseUpdatedAt: resolved.practiceGuide.updatedAt,
            createdAt: Date.now(),
            draft: revision.guide,
            previewId,
        });
        logger.info('practice_guide_modification_preview_generated', {
            changedFields: changes.map((change) => change.field),
            profileId: resolved.activeProfile.id,
            resourceId: resolved.practiceGuide.id,
            resourceType: 'practice_guide',
            userId: resolved.user.id,
        });
        response.json({ changes, previewId });
    }
    catch (error) {
        const isCreditError = isCreditExhaustedError(error);
        logger.error('practice_guide_modification_preview_failed', {
            error,
            resourceId: resolved.practiceGuide.id,
            resourceType: 'practice_guide',
            userId: resolved.user.id,
        });
        response.status(422).json({
            creditExhausted: isCreditError,
            error: isCreditError
                ? getCreditExhaustedMessage(request.locale)
                : translate(request.locale, 'practiceGuides.modificationFailed'),
        });
    }
}
export function handleApplyPracticeGuideModification(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const owner = {
        practiceGuideId: resolved.practiceGuide.id,
        profileId: resolved.activeProfile.id,
        userId: resolved.user.id,
    };
    const pending = getPendingPracticeGuideModification(owner);
    const previewId = readMultilineField(request.body.previewId, 100);
    if (!pending
        || !previewId
        || pending.previewId !== previewId
        || pending.baseUpdatedAt !== resolved.practiceGuide.updatedAt
        || JSON.stringify(pending.baseStoredDraft)
            !== JSON.stringify(storedPracticeGuideToDraft(resolved.practiceGuide))) {
        response.status(409).json({
            error: translate(request.locale, 'practiceGuides.modificationExpired'),
        });
        return;
    }
    const updatedPracticeGuide = updatePracticeGuide({
        description: pending.draft.description,
        practiceGuideId: resolved.practiceGuide.id,
        title: pending.draft.title,
        tutorInstructions: pending.draft.tutorInstructions,
        userId: resolved.user.id,
    });
    if (!updatedPracticeGuide) {
        response.status(422).json({
            error: translate(request.locale, 'practiceGuides.modificationFailed'),
        });
        return;
    }
    deletePendingPracticeGuideModification(owner);
    logger.info('practice_guide_modification_applied', {
        profileId: resolved.activeProfile.id,
        resourceId: resolved.practiceGuide.id,
        resourceType: 'practice_guide',
        userId: resolved.user.id,
    });
    response.json({
        ok: true,
        redirect: buildPracticeGuideAuthoringPath(resolved.practiceGuide.id),
    });
}
export function handleDiscardPracticeGuideModification(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const owner = {
        practiceGuideId: resolved.practiceGuide.id,
        profileId: resolved.activeProfile.id,
        userId: resolved.user.id,
    };
    const pending = getPendingPracticeGuideModification(owner);
    const previewId = readMultilineField(request.body.previewId, 100);
    if (pending && previewId && pending.previewId === previewId) {
        deletePendingPracticeGuideModification(owner);
    }
    response.json({ ok: true });
}
export function handleCreatePracticeGuideConversation(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const practiceGuideId = typeof request.params.practiceGuideId === 'string'
        ? request.params.practiceGuideId.trim()
        : '';
    if (!practiceGuideId) {
        response.redirect('/resources');
        return;
    }
    const resourceAccess = findResourceAccessForProfile({
        profileId: activeProfile.id,
        resourceId: practiceGuideId,
        userId: user.id,
    });
    const practiceGuide = resourceAccess?.type === 'practice_guide'
        ? findPracticeGuideById(resourceAccess.id)
        : findPracticeGuideForUser(practiceGuideId, user.id);
    if (!practiceGuide) {
        response.redirect('/resources');
        return;
    }
    // The guide author's own sessions are private and never collect. A shared
    // participant's session snapshots the grant's results-feedback flag, so the
    // finalized report can flow back to the owner — the same primitive quizzes
    // and roleplays use.
    const isSharedAccess = resourceAccess?.accessKind === 'shared';
    const collectResults = isSharedAccess
        ? findResourceAccessGrant({
            profileId: activeProfile.id,
            resourceId: practiceGuide.id,
            userId: user.id,
        })?.collectResults ?? false
        : false;
    const conversation = createConversationFromPracticeGuide(user.id, practiceGuide, isSharedAccess ? activeProfile.id : practiceGuide.profileId, { collectResults });
    logger.info('practice_guide_conversation_created', {
        accessKind: resourceAccess?.accessKind ?? 'owner',
        collectResults,
        conversationId: conversation.id,
        profileId: conversation.profileId,
        resourceId: practiceGuide.id,
        resourceType: 'practice_guide',
        userId: user.id,
    });
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
/**
 * Starts a shared practice guide. An anonymous visitor is sent to sign up / log
 * in and returned here to launch. Once authenticated, grant access and open the
 * tutor conversation.
 */
export function handleStartSharedPracticeGuide(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    const sharePath = `/resources/shared/${encodeURIComponent(shareId)}`;
    const shareLink = findResourceShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/resources');
        return;
    }
    const practiceGuide = findPracticeGuideById(shareLink.resourceId);
    if (!practiceGuide || practiceGuide.archivedAt) {
        response.redirect(sharePath);
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        const startPath = `/practice-guides/shared/${encodeURIComponent(shareId)}/start`;
        response.redirect(`/signup?returnTo=${encodeURIComponent(startPath)}`);
        return;
    }
    grantResourceAccess({
        collectResults: shareLink.collectResults,
        grantedByUserId: practiceGuide.userId,
        grantedVia: 'link',
        profileId: activeProfile.id,
        resourceId: practiceGuide.id,
        shareLinkId: shareLink.id,
        userId: user.id,
    });
    const conversation = createConversationFromPracticeGuide(user.id, practiceGuide, activeProfile.id, { collectResults: shareLink.collectResults });
    logger.info('practice_guide_conversation_created', {
        accessKind: 'shared',
        collectResults: shareLink.collectResults,
        conversationId: conversation.id,
        profileId: conversation.profileId,
        resourceId: practiceGuide.id,
        resourceType: 'practice_guide',
        userId: user.id,
    });
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
export function handleUpdatePracticeGuide(request, response) {
    const resolved = resolveOwnPracticeGuide(request, response);
    if (!resolved) {
        return;
    }
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    const tutorInstructions = String(request.body.tutorInstructions || '').trim();
    if (!title || !description || !tutorInstructions) {
        renderPracticeGuideAuthoring(request, response.status(422), {
            ...resolved,
            error: translate(request.locale, 'msg.completeGuideFields'),
        });
        return;
    }
    const practiceGuide = updatePracticeGuide({
        practiceGuideId: resolved.practiceGuide.id,
        description,
        title,
        tutorInstructions,
        userId: resolved.user.id,
    });
    if (!practiceGuide) {
        response.redirect('/resources');
        return;
    }
    logger.info('practice_guide_updated', {
        profileId: practiceGuide.profileId,
        resourceId: practiceGuide.id,
        resourceType: 'practice_guide',
        userId: resolved.user.id,
    });
    response.redirect(buildPracticeGuideAuthoringPath(practiceGuide.id));
}
export function handleArchivePracticeGuide(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceGuideId = String(request.params.practiceGuideId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
    if (!practiceGuideId) {
        response.redirect(returnTo);
        return;
    }
    const practiceGuide = archivePracticeGuideForUser(practiceGuideId, user.id);
    if (practiceGuide) {
        logger.info('resource_archived', {
            profileId: practiceGuide.profileId,
            resourceId: practiceGuide.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
    }
    response.redirect(returnTo);
}
export function handleRestorePracticeGuide(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceGuideId = String(request.params.practiceGuideId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/resources'));
    if (!practiceGuideId) {
        response.redirect(returnTo);
        return;
    }
    const practiceGuide = restorePracticeGuideForUser(practiceGuideId, user.id);
    if (practiceGuide) {
        logger.info('resource_restored', {
            profileId: practiceGuide.profileId,
            resourceId: practiceGuide.id,
            resourceType: 'practice_guide',
            userId: user.id,
        });
    }
    response.redirect(returnTo);
}
export function handleDeletePracticeGuide(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceGuideId = typeof request.params.practiceGuideId === 'string'
        ? request.params.practiceGuideId.trim()
        : '';
    if (!practiceGuideId) {
        response.redirect('/resources');
        return;
    }
    deletePracticeGuideForUser(practiceGuideId, user.id);
    response.redirect('/resources');
}
export function handleSharePracticeGuideToProfile(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceGuideId = String(request.params.practiceGuideId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!practiceGuideId || !targetProfileId) {
        response.redirect('/resources');
        return;
    }
    const practiceGuide = findPracticeGuideForUser(practiceGuideId, user.id);
    if (!practiceGuide) {
        response.redirect('/resources');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, user.id);
    if (!targetProfile || targetProfile.id === practiceGuide.profileId) {
        response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
        return;
    }
    grantResourceAccess({
        collectResults: String(request.body.collectResults || '').trim() === 'on',
        grantedByUserId: user.id,
        grantedVia: 'profile',
        profileId: targetProfile.id,
        resourceId: practiceGuide.id,
        userId: user.id,
    });
    logger.info('resource_shared_with_profile', {
        profileId: practiceGuide.profileId,
        resourceId: practiceGuide.id,
        resourceType: 'practice_guide',
        targetProfileId: targetProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
}
//# sourceMappingURL=handlers.js.map