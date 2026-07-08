import { addMessage, closeConversationForUser, createConversationFromTutorReport, findConversationForUser, findProfileForUser, findTutorConversationReport, listMessages, renameConversationForUser, saveTutorConversationReport, } from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import { getCreditCheckedOpenRouterApiKeyForUser, getCreditExhaustedMessage, isCreditExhaustedError, } from '../services/creditGate.js';
import { appDocumentTitle, buildAppShellContext, getHomeAuthMessage, resolveGuestInitialGreeting, } from '../pages/shell.js';
import { generateTutorConversationReport } from '../services/tutorReports.js';
import { articledContextResourceTypeLabel, buildResourceFromContextPrompt, contextResourceTypeLabel, createResourceFromContextDraft, normalizeContextResourceType, } from '../services/resourceFromContext.js';
import { recordTutorConversationReportProgress } from '../services/learnerProgress.js';
import { translate } from '../i18n/index.js';
import { isGenericConversationTitle, normalizeConversationTitle, } from '../services/llmTutor/conversationTitles.js';
import { logger } from '../services/logger.js';
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
        renameGenericConversationFromReportTitle(conversation, existingReport.summaryTitle);
        recordTutorConversationReportProgress(existingReport);
        response.redirect(`/c/${encodeURIComponent(conversation.id)}?tab=summary`);
        return;
    }
    const messages = listMessages(conversation.id);
    let generatedReport;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        generatedReport = await generateTutorConversationReport({
            instructionLanguage: conversation.instructionLanguage,
            messages,
            openRouterApiKey,
            userName: user.fullName,
        });
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            logger.warn('credit_exhausted_http_redirect', {
                conversationId: conversation.id,
                surface: 'tutor_report',
                userId: user.id,
            });
            response.redirect(buildConversationCreditExhaustedPath(conversation.id));
            return;
        }
        throw error;
    }
    closeConversationForUser(conversation.id, user.id);
    renameGenericConversationFromReportTitle(conversation, generatedReport.summaryTitle);
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
export async function handleCreateResourceFromTutorConversationReport(request, response) {
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
    const summaryPath = `${`/c/${encodeURIComponent(conversation.id)}`}?tab=summary`;
    const type = normalizeContextResourceType(request.body.type);
    if (!type) {
        response.redirect(summaryPath);
        return;
    }
    const report = findTutorConversationReport(conversation.id, user.id);
    if (!report) {
        response.redirect(summaryPath);
        return;
    }
    const instruction = typeof request.body.prompt === 'string' ? request.body.prompt.trim().slice(0, 2000) : '';
    const prompt = buildResourceFromContextPrompt({
        context: buildTutorReportContext(report),
        contextLabel: 'Conversation summary',
        instruction,
        type,
    });
    let created;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        created = await createResourceFromContextDraft({
            openRouterApiKey,
            profileId: conversation.profileId,
            prompt,
            type,
            userId: user.id,
        });
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            logger.warn('credit_exhausted_http_redirect', {
                conversationId: conversation.id,
                surface: 'tutor_report_resource',
                userId: user.id,
            });
            response.redirect(buildConversationCreditExhaustedPath(conversation.id, 'summary'));
            return;
        }
        throw error;
    }
    logger.info('resource_created_from_tutor_report', {
        conversationId: conversation.id,
        profileId: conversation.profileId,
        resourceType: type,
        userId: user.id,
    });
    response.redirect(created.detailPath);
}
export async function handleCreateResourceFromConversation(request, response) {
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
    const conversationPath = `/c/${encodeURIComponent(conversation.id)}`;
    const type = normalizeContextResourceType(request.body.type);
    if (!type) {
        response.redirect(conversationPath);
        return;
    }
    const messages = listMessages(conversation.id);
    if (messages.length === 0) {
        response.redirect(conversationPath);
        return;
    }
    const instruction = typeof request.body.prompt === 'string' ? request.body.prompt.trim().slice(0, 2000) : '';
    const prompt = buildResourceFromContextPrompt({
        context: formatConversationTranscript(messages),
        contextLabel: 'Conversation transcript',
        instruction,
        type,
    });
    let created;
    try {
        const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
        created = await createResourceFromContextDraft({
            openRouterApiKey,
            profileId: conversation.profileId,
            prompt,
            type,
            userId: user.id,
        });
    }
    catch (error) {
        if (isCreditExhaustedError(error)) {
            logger.warn('credit_exhausted_http_redirect', {
                conversationId: conversation.id,
                surface: 'conversation_resource',
                userId: user.id,
            });
            response.redirect(buildConversationCreditExhaustedPath(conversation.id));
            return;
        }
        throw error;
    }
    appendConversationResourceLinkMessage({
        conversationId: conversation.id,
        detailPath: created.detailPath,
        locale: conversation.instructionLanguage,
        title: created.title,
        type,
    });
    logger.info('resource_created_from_conversation', {
        conversationId: conversation.id,
        profileId: conversation.profileId,
        resourceType: type,
        userId: user.id,
    });
    response.redirect(conversationPath);
}
function appendConversationResourceLinkMessage(input) {
    const label = contextResourceTypeLabel(input.type, input.locale);
    const safeTitle = input.title.replace(/[\[\]]/g, '').trim() || label;
    const markdown = translate(input.locale, 'msg.resourceCreatedMessage', {
        articledLabel: articledContextResourceTypeLabel(input.type, input.locale),
        label,
        path: input.detailPath,
        title: safeTitle,
    });
    addMessage(input.conversationId, 'model', markdown, {
        blocks: [{ markdown, type: 'message' }],
        source: 'resource_created',
    });
}
function formatConversationTranscript(messages) {
    const recent = messages.slice(-40);
    const transcript = recent
        .map((message) => {
        const speaker = message.role === 'user' ? 'Learner' : 'Mister F';
        return `${speaker}: ${message.content}`;
    })
        .join('\n\n');
    return transcript.length > 8000 ? transcript.slice(-8000) : transcript;
}
function buildTutorReportContext(report) {
    return JSON.stringify({
        report: report.report,
        summaryDescription: report.summaryDescription,
        summaryTitle: report.summaryTitle,
    }, null, 2);
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
function renameGenericConversationFromReportTitle(conversation, reportTitle) {
    if (!shouldUseReportTitleForConversation(conversation)) {
        return;
    }
    const title = normalizeConversationTitle(reportTitle);
    if (!title) {
        return;
    }
    renameConversationForUser(conversation.id, conversation.userId, title);
}
function shouldUseReportTitleForConversation(conversation) {
    return !conversation.titleUpdatedByUser && isGenericConversationTitle(conversation.title);
}
//# sourceMappingURL=handlers.js.map