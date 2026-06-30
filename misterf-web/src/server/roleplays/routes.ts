import express from 'express';
import {
  handleCreateRoleplayFollowUpConversation,
  handleCreateRoleplayResource,
  handleFinishRoleplayAttempt,
  handleGenerateRoleplay,
  handleReviseRoleplay,
  handleShareRoleplayToProfile,
  handleStartRoleplayAttempt,
  handleSubmitRoleplayTurn,
  handleUpdateRoleplay,
  renderRoleplayAttemptPage,
  renderRoleplayEditPage,
  renderRoleplayNewPage,
  renderRoleplayResultPage,
  renderRoleplayShowPage,
} from './handlers.js';

export const roleplaysRouter = express.Router();

roleplaysRouter.get('/roleplays/new', renderRoleplayNewPage);
roleplaysRouter.post('/roleplays/generate', handleGenerateRoleplay);
roleplaysRouter.get('/roleplays/:roleplayId/edit', renderRoleplayEditPage);
roleplaysRouter.post('/roleplays/:roleplayId/edit', handleUpdateRoleplay);
roleplaysRouter.post('/roleplays/:roleplayId/edit/revise', handleReviseRoleplay);
roleplaysRouter.post('/roleplays/:roleplayId/revise', handleReviseRoleplay);
roleplaysRouter.get('/roleplays/:roleplayId', renderRoleplayShowPage);
roleplaysRouter.post('/roleplays/:roleplayId/share/profile', handleShareRoleplayToProfile);
roleplaysRouter.post('/roleplays/:roleplayId/attempts', handleStartRoleplayAttempt);
roleplaysRouter.get('/roleplay-attempts/:attemptId', renderRoleplayAttemptPage);
roleplaysRouter.post('/roleplay-attempts/:attemptId/turns', handleSubmitRoleplayTurn);
roleplaysRouter.post('/roleplay-attempts/:attemptId/finish', handleFinishRoleplayAttempt);
roleplaysRouter.get('/roleplay-attempts/:attemptId/result', renderRoleplayResultPage);
roleplaysRouter.post('/roleplay-attempts/:attemptId/practice', handleCreateRoleplayFollowUpConversation);
roleplaysRouter.post('/roleplay-attempts/:attemptId/resource', handleCreateRoleplayResource);
