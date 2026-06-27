import express from 'express';
import { handleAcceptSharedPracticeModuleLink, handleArchivePracticeModule, handleCreatePracticeModule, handleCreatePracticeModuleConversation, handleDeletePracticeModule, handleGeneratePracticeModuleDraft, handleRestorePracticeModule, handleSharePracticeModuleToProfile, handleUpdatePracticeModule, renderEditPracticeModulePage, renderNewPracticeModulePage, renderPracticeModuleDetailPage, renderSharedPracticeModulePage, } from './handlers.js';
export const practiceModulesRouter = express.Router();
practiceModulesRouter.get('/practice-modules', (_request, response) => {
    response.redirect('/resources');
});
practiceModulesRouter.get('/practice-modules/new', renderNewPracticeModulePage);
practiceModulesRouter.post('/practice-modules/generate-draft', handleGeneratePracticeModuleDraft);
practiceModulesRouter.post('/practice-modules', handleCreatePracticeModule);
practiceModulesRouter.get('/practice-modules/shared/:shareId', renderSharedPracticeModulePage);
practiceModulesRouter.post('/practice-modules/shared/:shareId/accept', handleAcceptSharedPracticeModuleLink);
practiceModulesRouter.get('/practice-modules/:practiceModuleId/edit', renderEditPracticeModulePage);
practiceModulesRouter.get('/practice-modules/:practiceModuleId', renderPracticeModuleDetailPage);
practiceModulesRouter.post('/practice-modules/:practiceModuleId', handleUpdatePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/archive', handleArchivePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/restore', handleRestorePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/delete', handleDeletePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/chats', handleCreatePracticeModuleConversation);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/share/profile', handleSharePracticeModuleToProfile);
//# sourceMappingURL=routes.js.map