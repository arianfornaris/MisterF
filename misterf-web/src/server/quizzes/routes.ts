import express from 'express';
import {
  handleApplyQuizAddBlock,
  handleApplyQuizBlockModification,
  handleApplyQuizRevision,
  handleArchiveQuiz,
  handleClaimQuizAttempt,
  handleCreateQuizFollowUpConversation,
  handleCreateQuizResource,
  handleEvaluateQuizAttempt,
  handleDeleteQuizBlock,
  handleDiscardQuizAddBlock,
  handleDiscardQuizBlockModification,
  handleDiscardQuizRevision,
  handleDuplicateQuizBlock,
  handleGenerateQuiz,
  handleGenerateQuizResponsesSummary,
  handleMoveQuizBlock,
  handlePreviewQuizAddBlock,
  handlePreviewQuizBlockModification,
  handlePreviewQuizRevision,
  handleRestoreQuiz,
  handleShareQuizToProfile,
  handleStartSharedQuizAttempt,
  handleStartQuizTestAttempt,
  handleSubmitQuizAttempt,
  handleUpdateQuizMetadata,
  renderQuizAttemptPage,
  renderQuizEditPage,
  renderQuizEvaluatingPage,
  renderQuizNewPage,
  renderQuizParticipationPage,
  renderQuizResultPage,
  renderQuizShowPage,
} from './handlers.js';

export const quizzesRouter = express.Router();

quizzesRouter.get('/quizzes', (_request, response) => {
  response.redirect('/resources');
});
quizzesRouter.get('/quizzes/new', renderQuizNewPage);
quizzesRouter.post('/quizzes/generate', handleGenerateQuiz);
quizzesRouter.post('/quizzes/generate-draft', handleGenerateQuiz);
quizzesRouter.post('/quizzes/shared/:shareId/take', handleStartSharedQuizAttempt);
quizzesRouter.get('/quizzes/:quizId/edit', renderQuizEditPage);
quizzesRouter.post('/quizzes/:quizId/edit/save', handleUpdateQuizMetadata);
quizzesRouter.post('/quizzes/:quizId/edit/modify', handlePreviewQuizRevision);
quizzesRouter.post('/quizzes/:quizId/edit/modify/apply', handleApplyQuizRevision);
quizzesRouter.post('/quizzes/:quizId/edit/modify/discard', handleDiscardQuizRevision);
quizzesRouter.post('/quizzes/:quizId/edit/add-block', handlePreviewQuizAddBlock);
quizzesRouter.post('/quizzes/:quizId/edit/add-block/apply', handleApplyQuizAddBlock);
quizzesRouter.post('/quizzes/:quizId/edit/add-block/discard', handleDiscardQuizAddBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/modify', handlePreviewQuizBlockModification);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/modify/apply', handleApplyQuizBlockModification);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/modify/discard', handleDiscardQuizBlockModification);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/delete', handleDeleteQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/duplicate', handleDuplicateQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/move-up', handleMoveQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/move-down', handleMoveQuizBlock);
quizzesRouter.get('/quizzes/:quizId', renderQuizShowPage);
quizzesRouter.get('/quizzes/:quizId/participation', renderQuizParticipationPage);
quizzesRouter.post('/quizzes/:quizId/summary', handleGenerateQuizResponsesSummary);
quizzesRouter.post('/quizzes/:quizId/share/profile', handleShareQuizToProfile);
quizzesRouter.post('/quizzes/:quizId/archive', handleArchiveQuiz);
quizzesRouter.post('/quizzes/:quizId/restore', handleRestoreQuiz);
quizzesRouter.post('/quizzes/:quizId/test-attempts', handleStartQuizTestAttempt);
quizzesRouter.get('/quiz-attempts/:attemptId', renderQuizAttemptPage);
quizzesRouter.get('/quiz-attempts/:attemptId/evaluating', renderQuizEvaluatingPage);
quizzesRouter.post('/quiz-attempts/:attemptId/evaluate', handleEvaluateQuizAttempt);
quizzesRouter.get('/quiz-attempts/:attemptId/result', renderQuizResultPage);
quizzesRouter.post('/quiz-attempts/:attemptId/claim', handleClaimQuizAttempt);
quizzesRouter.post('/quiz-attempts/:attemptId/submit', handleSubmitQuizAttempt);
quizzesRouter.post('/quiz-attempts/:attemptId/practice', handleCreateQuizFollowUpConversation);
quizzesRouter.post('/quiz-attempts/:attemptId/resource', handleCreateQuizResource);
