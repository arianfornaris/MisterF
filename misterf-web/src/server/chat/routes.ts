import express from 'express';
import {
  handleCreatePracticeGuideFromTutorConversationReport,
  handleFinalizeTutorConversation,
  handlePracticeTutorConversationReport,
  renderChatPage,
} from './handlers.js';

export const chatRouter = express.Router();

chatRouter.post('/c/:conversationId/finalize', handleFinalizeTutorConversation);
chatRouter.post('/c/:conversationId/report/practice', handlePracticeTutorConversationReport);
chatRouter.post('/c/:conversationId/report/create-practice-guide', handleCreatePracticeGuideFromTutorConversationReport);
chatRouter.get('/c/:conversationId', renderChatPage);
chatRouter.get('/', renderChatPage);
