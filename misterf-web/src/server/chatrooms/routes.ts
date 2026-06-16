import express from 'express';
import {
  handleAcceptSharedChatRoomLink,
  handleArchiveChatRoom,
  handleChatRoomContinue,
  handleChatRoomSendMessage,
  handleCreateChatRoom,
  handleCreateChatRoomConversation,
  handleCreatePracticeModuleFromChatRoomConversationReport,
  handleEvaluateChatRoomConversation,
  handleGenerateChatRoomDraft,
  handleGetChatRoomMessageEvaluation,
  handleJoinChatRoom,
  handlePracticeChatRoomConversationReportWithTutor,
  handleRestoreChatRoom,
  handleShareChatRoomToProfile,
  handleUpdateChatRoom,
  renderChatRoomConversationPage,
  renderChatRoomConversationReportPage,
  renderChatRoomHistoryPage,
  renderChatRoomShowPage,
  renderChatRoomsListPage,
  renderEditChatRoomPage,
  renderNewChatRoomPage,
  renderSharedChatRoomPage,
} from './handlers.js';

export const chatroomsRouter = express.Router();

chatroomsRouter.get('/chatrooms', renderChatRoomsListPage);
chatroomsRouter.get('/chatrooms/new', renderNewChatRoomPage);
chatroomsRouter.post('/chatrooms/generate-draft', handleGenerateChatRoomDraft);
chatroomsRouter.get('/chatrooms/shared/:shareId', renderSharedChatRoomPage);
chatroomsRouter.post('/chatrooms/shared/:shareId/accept', handleAcceptSharedChatRoomLink);
chatroomsRouter.post('/chatrooms', handleCreateChatRoom);
chatroomsRouter.get('/chatrooms/:roomId', renderChatRoomShowPage);
chatroomsRouter.get('/chatrooms/:roomId/edit', renderEditChatRoomPage);
chatroomsRouter.post('/chatrooms/:roomId', handleUpdateChatRoom);
chatroomsRouter.post('/chatrooms/:roomId/archive', handleArchiveChatRoom);
chatroomsRouter.post('/chatrooms/:roomId/restore', handleRestoreChatRoom);
chatroomsRouter.get('/chatrooms/:roomId/history', renderChatRoomHistoryPage);
chatroomsRouter.post('/chatrooms/:roomId/share/profile', handleShareChatRoomToProfile);
chatroomsRouter.post('/chatrooms/:roomId/join', handleJoinChatRoom);
chatroomsRouter.post('/chatrooms/:roomId/conversations', handleCreateChatRoomConversation);
chatroomsRouter.get('/chatroom-conversations/:roomConversationId', renderChatRoomConversationPage);
chatroomsRouter.get('/chatroom-conversations/:roomConversationId/report', renderChatRoomConversationReportPage);
chatroomsRouter.post('/chatroom-conversations/:roomConversationId/evaluate', handleEvaluateChatRoomConversation);
chatroomsRouter.post('/chatroom-conversations/:roomConversationId/report/create-practice-module', handleCreatePracticeModuleFromChatRoomConversationReport);
chatroomsRouter.post('/chatroom-conversations/:roomConversationId/report/practice-with-tutor', handlePracticeChatRoomConversationReportWithTutor);
chatroomsRouter.post('/chatroom-conversations/:roomConversationId/messages', handleChatRoomSendMessage);
chatroomsRouter.get('/chatroom-conversations/:roomConversationId/messages/:messageId/evaluation', handleGetChatRoomMessageEvaluation);
chatroomsRouter.post('/chatroom-conversations/:roomConversationId/continue', handleChatRoomContinue);
