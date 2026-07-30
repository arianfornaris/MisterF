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
// Explicit entry to a new conversation. `/` still opens the app for a signed-in
// user, but it now renders the landing page for visitors, so guest chat needs a
// URL of its own for the landing to link to.
chatRouter.get('/chat', renderChatPage);
chatRouter.get('/', renderChatPage);
