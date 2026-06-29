import express from 'express';
import { handleAcceptSharedPracticeGuideLink, handleArchivePracticeGuide, handleCreatePracticeGuide, handleCreatePracticeGuideConversation, handleDeletePracticeGuide, handleGeneratePracticeGuideDraft, handleRevisePracticeGuide, handleRestorePracticeGuide, handleSharePracticeGuideToProfile, handleUpdatePracticeGuide, renderEditPracticeGuidePage, renderNewPracticeGuidePage, renderPracticeGuideDetailPage, renderSharedPracticeGuidePage, } from './handlers.js';
export const practiceGuidesRouter = express.Router();
practiceGuidesRouter.get('/practice-guides', (_request, response) => {
    response.redirect('/resources');
});
practiceGuidesRouter.get('/practice-guides/new', renderNewPracticeGuidePage);
practiceGuidesRouter.post('/practice-guides/generate-draft', handleGeneratePracticeGuideDraft);
practiceGuidesRouter.post('/practice-guides', handleCreatePracticeGuide);
practiceGuidesRouter.get('/practice-guides/shared/:shareId', renderSharedPracticeGuidePage);
practiceGuidesRouter.post('/practice-guides/shared/:shareId/accept', handleAcceptSharedPracticeGuideLink);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId/edit', renderEditPracticeGuidePage);
practiceGuidesRouter.get('/practice-guides/:practiceGuideId', renderPracticeGuideDetailPage);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/revise', handleRevisePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId', handleUpdatePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/archive', handleArchivePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/restore', handleRestorePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/delete', handleDeletePracticeGuide);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/chats', handleCreatePracticeGuideConversation);
practiceGuidesRouter.post('/practice-guides/:practiceGuideId/share/profile', handleSharePracticeGuideToProfile);
//# sourceMappingURL=routes.js.map