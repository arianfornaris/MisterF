import express from 'express';
import {
  handleAddQuizBlock,
  handleArchiveQuiz,
  handleClaimQuizAttempt,
  handleCreateQuizFollowUpConversation,
  handleCreateQuizResource,
  handleDeleteQuizBlock,
  handleDuplicateQuizBlock,
  handleGenerateQuiz,
  handleMoveQuizBlock,
  handleRestoreQuiz,
  handleReviseQuiz,
  handleSetQuizPublicAttempts,
  handleShareQuizToProfile,
  handleStartPublicQuizAttempt,
  handleStartQuizAttempt,
  handleStartQuizTestAttempt,
  handleSubmitQuizAttempt,
  handleUpdateQuizMetadata,
  renderQuizAttemptPage,
  renderQuizEditPage,
  renderQuizNewPage,
  renderQuizResultPage,
  renderQuizShowPage,
  renderSharedQuizPage,
} from './handlers.js';

export const quizzesRouter = express.Router();

quizzesRouter.get('/quizzes', (_request, response) => {
  response.redirect('/resources');
});
quizzesRouter.get('/quizzes/new', renderQuizNewPage);
quizzesRouter.post('/quizzes/generate', handleGenerateQuiz);
quizzesRouter.post('/quizzes/generate-draft', handleGenerateQuiz);
quizzesRouter.get('/quizzes/shared/:shareId', renderSharedQuizPage);
quizzesRouter.post('/quizzes/shared/:shareId/start', handleStartQuizAttempt);
quizzesRouter.post('/quizzes/public/:shareId/attempt', handleStartPublicQuizAttempt);
quizzesRouter.get('/quizzes/:quizId/edit', renderQuizEditPage);
quizzesRouter.post('/quizzes/:quizId/edit/save', handleUpdateQuizMetadata);
quizzesRouter.post('/quizzes/:quizId/edit/revise', handleReviseQuiz);
quizzesRouter.post('/quizzes/:quizId/edit/blocks', handleAddQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/delete', handleDeleteQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/duplicate', handleDuplicateQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/move-up', handleMoveQuizBlock);
quizzesRouter.post('/quizzes/:quizId/edit/blocks/:blockId/move-down', handleMoveQuizBlock);
quizzesRouter.get('/quizzes/:quizId', renderQuizShowPage);
quizzesRouter.post('/quizzes/:quizId/share/profile', handleShareQuizToProfile);
quizzesRouter.post('/quizzes/:quizId/archive', handleArchiveQuiz);
quizzesRouter.post('/quizzes/:quizId/restore', handleRestoreQuiz);
quizzesRouter.post('/quizzes/:quizId/public-attempts', handleSetQuizPublicAttempts);
quizzesRouter.post('/quizzes/:quizId/test-attempts', handleStartQuizTestAttempt);
quizzesRouter.get('/quiz-attempts/:attemptId', renderQuizAttemptPage);
quizzesRouter.get('/quiz-attempts/:attemptId/result', renderQuizResultPage);
quizzesRouter.post('/quiz-attempts/:attemptId/claim', handleClaimQuizAttempt);
quizzesRouter.post('/quiz-attempts/:attemptId/submit', handleSubmitQuizAttempt);
quizzesRouter.post('/quiz-attempts/:attemptId/practice', handleCreateQuizFollowUpConversation);
quizzesRouter.post('/quiz-attempts/:attemptId/resource', handleCreateQuizResource);
