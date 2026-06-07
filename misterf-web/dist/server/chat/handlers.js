import { closeConversationForUser, createConversationFromTutorReport, createPracticeModule, findConversationForUser, findPracticeModuleForUser, findProfileForUser, findTutorConversationReport, listMessages, saveTutorConversationReport, setTutorConversationReportPracticeModule, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, resolveGuestInitialGreeting, } from '../pages/shell.js';
import { generatePracticeModuleFromTutorConversationReport, generateTutorConversationReport, } from '../services/tutorReports.js';
import { recordTutorConversationReportProgress } from '../services/learnerProgress.js';
export function renderChatPage(request, response) {
    const user = request.authUser;
    let activeProfile = request.activeProfile;
    let initialConversationId = '';
    let selectedTutorConversation = null;
    let selectedTutorConversationReport = null;
    let selectedTutorConversationTab = 'conversation';
    const requestedConversationIdRaw = request.params.conversationId;
    const requestedConversationId = typeof requestedConversationIdRaw === 'string'
        ? requestedConversationIdRaw.trim()
        : '';
    if (requestedConversationId) {
        if (!user) {
            response.redirect('/');
            return;
        }
        const conversation = findConversationForUser(requestedConversationId, user.id);
        if (!conversation) {
            response.redirect('/');
            return;
        }
        if (!activeProfile || conversation.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(conversation.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        initialConversationId = conversation.id;
        selectedTutorConversation = conversation;
        selectedTutorConversationReport = findTutorConversationReport(conversation.id, user.id);
        selectedTutorConversationTab =
            request.query.tab === 'conversation'
                ? 'conversation'
                : conversation.closedAt
                    ? 'summary'
                    : request.query.tab === 'summary'
                        ? 'summary'
                        : 'conversation';
    }
    response.render('chat', {
        ...buildAppShellContext({
            activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'chat',
            guestInitialGreeting: resolveGuestInitialGreeting(request, user),
            initialConversationId,
            request,
            title: appDocumentTitle,
            user,
        }),
        selectedTutorConversation,
        selectedTutorConversationReport,
        selectedTutorConversationTab,
    });
}
export async function handleFinalizeTutorConversation(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const conversationId = String(request.params.conversationId || '').trim();
    const conversation = findConversationForUser(conversationId, user.id);
    if (!conversation) {
        response.redirect('/');
        return;
    }
    const existingReport = findTutorConversationReport(conversation.id, user.id);
    if (existingReport) {
        closeConversationForUser(conversation.id, user.id);
        recordTutorConversationReportProgress(existingReport);
        response.redirect(`/c/${encodeURIComponent(conversation.id)}?tab=summary`);
        return;
    }
    const messages = listMessages(conversation.id);
    let generatedReport;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        generatedReport = await generateTutorConversationReport({
            messages,
            openRouterApiKey,
            userName: user.fullName,
        });
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect(buildConversationCreditExhaustedPath(conversation.id));
            return;
        }
        throw error;
    }
    closeConversationForUser(conversation.id, user.id);
    const savedReport = saveTutorConversationReport({
        conversationId: conversation.id,
        profileId: conversation.profileId,
        report: generatedReport.report,
        summaryDescription: generatedReport.summaryDescription,
        summaryTitle: generatedReport.summaryTitle,
        userId: user.id,
    });
    recordTutorConversationReportProgress(savedReport);
    response.redirect(`/c/${encodeURIComponent(conversation.id)}?tab=summary`);
}
export function handlePracticeTutorConversationReport(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const conversationId = String(request.params.conversationId || '').trim();
    const conversation = findConversationForUser(conversationId, user.id);
    if (!conversation) {
        response.redirect('/');
        return;
    }
    const report = findTutorConversationReport(conversation.id, user.id);
    if (!report) {
        response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
        return;
    }
    const nextConversation = createConversationFromTutorReport({
        profileId: conversation.profileId,
        report,
        userId: user.id,
    });
    response.redirect(`/c/${encodeURIComponent(nextConversation.id)}`);
}
export async function handleCreatePracticeModuleFromTutorConversationReport(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const conversationId = String(request.params.conversationId || '').trim();
    const conversation = findConversationForUser(conversationId, user.id);
    if (!conversation) {
        response.redirect('/');
        return;
    }
    const report = findTutorConversationReport(conversation.id, user.id);
    if (!report) {
        response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
        return;
    }
    if (report.practiceModuleId) {
        const existingPracticeModule = findPracticeModuleForUser(report.practiceModuleId, user.id);
        if (existingPracticeModule) {
            response.redirect(`/practice-modules/${encodeURIComponent(existingPracticeModule.id)}`);
            return;
        }
    }
    let generatedModule;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        generatedModule = await generatePracticeModuleFromTutorConversationReport({
            openRouterApiKey,
            report,
        });
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            response.redirect(buildConversationCreditExhaustedPath(conversation.id, 'summary'));
            return;
        }
        throw error;
    }
    const practiceModule = createPracticeModule({
        description: generatedModule.description,
        profileId: conversation.profileId,
        title: generatedModule.title,
        tutorInstructions: generatedModule.tutorInstructions,
        userId: user.id,
    });
    setTutorConversationReportPracticeModule({
        conversationId: conversation.id,
        practiceModuleId: practiceModule.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
function buildConversationCreditExhaustedPath(conversationId, tab) {
    const params = new URLSearchParams({
        credit: 'exhausted',
        creditMessage: getCreditExhaustedMessage(),
    });
    if (tab) {
        params.set('tab', tab);
    }
    return `/c/${encodeURIComponent(conversationId)}?${params.toString()}`;
}
//# sourceMappingURL=handlers.js.map