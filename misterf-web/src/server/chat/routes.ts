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
// Explicit entry to a new conversation, in either home mode. `/` renders the
// landing for visitors and is dispatched by `homeRouter` for a signed-in user,
// so guest chat and the teaching mode's "ask Mr. F" both need this URL.
chatRouter.get('/chat', renderChatPage);
