import express from 'express';
import {
  handleCreatePracticeModuleFromTutorConversationReport,
  handleFinalizeTutorConversation,
  handlePracticeTutorConversationReport,
  renderChatPage,
} from './handlers.js';

export const chatRouter = express.Router();

chatRouter.post('/c/:conversationId/finalize', handleFinalizeTutorConversation);
chatRouter.post('/c/:conversationId/report/practice', handlePracticeTutorConversationReport);
chatRouter.post('/c/:conversationId/report/create-practice-module', handleCreatePracticeModuleFromTutorConversationReport);
chatRouter.get('/c/:conversationId', renderChatPage);
chatRouter.get('/', renderChatPage);
