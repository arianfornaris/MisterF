import express from 'express';
import {
  handleArchivePracticeGuide,
  handleApplyPracticeGuideModification,
  handleCreatePracticeGuideConversation,
  handleDeletePracticeGuide,
  handleDiscardPracticeGuideModification,
  handleGeneratePracticeGuideDraft,
  handlePreviewPracticeGuideModification,
  handleStartSharedPracticeGuide,
  handleRestorePracticeGuide,
  handleSharePracticeGuideToProfile,
  handleUpdatePracticeGuide,
  renderEditPracticeGuidePage,
  renderNewPracticeGuidePage,
  renderPracticeGuideDetailPage,
  handleGeneratePracticeGuideParticipationSummary,
  renderPracticeGuideParticipationPage,
  renderPracticeGuideReportPage,
} from './handlers.js';

export const practiceGuidesRouter = express.Router();

practiceGuidesRouter.get('/practice-guides', (_request, response) => {
  response.redirect('/resources');
});
practiceGuidesRouter.get('/practice-guides/new', renderNewPracticeGuidePage);
practiceGuidesRouter.post('/practice-guides/generate-draft', handleGeneratePracticeGuideDraft);
practiceGuidesRouter.get('/practice-guides/shared/:shareId/start', handleStartSharedPracticeGuide);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId/edit', renderEditPracticeGuidePage);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId/participation', renderPracticeGuideParticipationPage);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/summary', handleGeneratePracticeGuideParticipationSummary);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId/reports/:conversationId', renderPracticeGuideReportPage);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId', renderPracticeGuideDetailPage);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/edit/save', handleUpdatePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/edit/modify', handlePreviewPracticeGuideModification);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/edit/modify/apply', handleApplyPracticeGuideModification);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/edit/modify/discard', handleDiscardPracticeGuideModification);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/archive', handleArchivePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/restore', handleRestorePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/delete', handleDeletePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/chats', handleCreatePracticeGuideConversation);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/share/profile', handleSharePracticeGuideToProfile);
