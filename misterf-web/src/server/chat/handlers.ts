import type { Request, Response } from 'express';
import {
  closeConversationForUser,
  createConversationFromTutorReport,
  createPracticeGuide,
  findConversationForUser,
  findPracticeGuideForUser,
  findProfileForUser,
  findTutorConversationReport,
  listMessages,
  renameConversationForUser,
  saveTutorConversationReport,
  setTutorConversationReportPracticeGuide,
  type StoredConversation,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
  resolveGuestInitialGreeting,
} from '../pages/shell.js';
import {
  generatePracticeGuideFromTutorConversationReport,
  generateTutorConversationReport,
} from '../services/tutorReports.js';
import { recordTutorConversationReportProgress } from '../services/learnerProgress.js';
import { logger } from '../services/logger.js';

export function renderChatPage(request: Request, response: Response): void {
  const user = request.authUser;
  let activeProfile = request.activeProfile;
  let initialConversationId = '';
  let selectedTutorConversation = null;
  let selectedTutorConversationReport = null;
  let selectedTutorConversationTab: 'conversation' | 'summary' = 'conversation';

  const requestedConversationIdRaw = request.params.conversationId;
  const requestedConversationId =
    typeof requestedConversationIdRaw === 'string'
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

export async function handleFinalizeTutorConversation(
  request: Request,
  response: Response,
): Promise<void> {
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
  let generatedReport: Awaited<ReturnType<typeof generateTutorConversationReport>>;
  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
    generatedReport = await generateTutorConversationReport({
      messages,
      openRouterApiKey,
      userName: user.fullName,
    });
  } catch (error) {
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

export function handlePracticeTutorConversationReport(
  request: Request,
  response: Response,
): void {
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

export async function handleCreatePracticeGuideFromTutorConversationReport(
  request: Request,
  response: Response,
): Promise<void> {
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

  if (report.practiceGuideId) {
    const existingPracticeGuide = findPracticeGuideForUser(report.practiceGuideId, user.id);
    if (existingPracticeGuide) {
      response.redirect(`/practice-guides/${encodeURIComponent(existingPracticeGuide.id)}`);
      return;
    }
  }

  let generatedModule: Awaited<ReturnType<typeof generatePracticeGuideFromTutorConversationReport>>;
  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(user.id);
    generatedModule = await generatePracticeGuideFromTutorConversationReport({
      openRouterApiKey,
      report,
    });
  } catch (error) {
    if (isCreditExhaustedError(error)) {
      logger.warn('credit_exhausted_http_redirect', {
        conversationId: conversation.id,
        surface: 'tutor_report_practice_guide',
        userId: user.id,
      });
      response.redirect(buildConversationCreditExhaustedPath(conversation.id, 'summary'));
      return;
    }

    throw error;
  }

  const practiceGuide = createPracticeGuide({
    description: generatedModule.description,
    profileId: conversation.profileId,
    title: generatedModule.title,
    tutorInstructions: generatedModule.tutorInstructions,
    userId: user.id,
  });

  setTutorConversationReportPracticeGuide({
    conversationId: conversation.id,
    practiceGuideId: practiceGuide.id,
    userId: user.id,
  });

  response.redirect(`/practice-guides/${encodeURIComponent(practiceGuide.id)}`);
}

function buildConversationCreditExhaustedPath(
  conversationId: string,
  tab?: 'conversation' | 'summary',
): string {
  const params = new URLSearchParams({
    credit: 'exhausted',
    creditMessage: getCreditExhaustedMessage(),
  });
  if (tab) {
    params.set('tab', tab);
  }

  return `/c/${encodeURIComponent(conversationId)}?${params.toString()}`;
}

function renameGenericConversationFromReportTitle(
  conversation: StoredConversation,
  reportTitle: string,
): void {
  if (!shouldUseReportTitleForConversation(conversation)) {
    return;
  }

  const title = normalizeGeneratedConversationTitle(reportTitle);
  if (!title) {
    return;
  }

  renameConversationForUser(conversation.id, conversation.userId, title);
}

function shouldUseReportTitleForConversation(conversation: StoredConversation): boolean {
  if (conversation.titleUpdatedByUser) {
    return false;
  }

  const normalizedTitle = normalizeTitleForComparison(conversation.title);
  return (
    !normalizedTitle ||
    normalizedTitle === 'nueva conversacion' ||
    normalizedTitle === 'new conversation'
  );
}

function normalizeGeneratedConversationTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, 90);
}

function normalizeTitleForComparison(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
