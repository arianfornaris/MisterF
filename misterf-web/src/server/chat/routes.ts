import express from 'express';
import {
  handleCreateResourceFromConversation,
  handleCreateResourceFromTutorConversationReport,
  handleFinalizeTutorConversation,
  handlePracticeTutorConversationReport,
  renderChatPage,
} from './handlers.js';

export const chatRouter = express.Router();

chatRouter.post('/c/:conversationId/finalize', handleFinalizeTutorConversation);
chatRouter.post('/c/:conversationId/report/practice', handlePracticeTutorConversationReport);
chatRouter.post('/c/:conversationId/report/resource', handleCreateResourceFromTutorConversationReport);
chatRouter.post('/c/:conversationId/resource', handleCreateResourceFromConversation);
chatRouter.get('/c/:conversationId', renderChatPage);
chatRouter.get('/', renderChatPage);
