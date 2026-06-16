import express from 'express';
import {
  handleAcceptSharedPracticeModuleCollectionLink,
  handleAcceptSharedPracticeModuleLink,
  handleAddPracticeModuleToCollection,
  handleArchivePracticeModule,
  handleArchivePracticeModuleCollection,
  handleCreatePracticeModule,
  handleCreatePracticeModuleCollection,
  handleCreatePracticeModuleConversation,
  handleDeletePracticeModule,
  handleGeneratePracticeModuleDraft,
  handleMovePracticeModuleCollectionItem,
  handleRemovePracticeModuleFromCollection,
  handleRestorePracticeModule,
  handleRestorePracticeModuleCollection,
  handleSetPracticeModuleCollectionFavorite,
  handleSetPracticeModuleFavorite,
  handleSharePracticeModuleCollectionToProfile,
  handleSharePracticeModuleToProfile,
  handleUpdatePracticeModule,
  handleUpdatePracticeModuleCollection,
  renderEditPracticeModuleCollectionPage,
  renderEditPracticeModulePage,
  renderNewPracticeModuleCollectionPage,
  renderNewPracticeModulePage,
  renderPracticeModuleCollectionDetailPage,
  renderPracticeModuleDetailPage,
  renderPracticeModulesListPage,
  renderSharedPracticeModuleCollectionPage,
  renderSharedPracticeModulePage,
} from './handlers.js';

export const practiceModulesRouter = express.Router();

practiceModulesRouter.get('/practice-modules', renderPracticeModulesListPage);
practiceModulesRouter.get('/practice-modules/new', renderNewPracticeModulePage);
practiceModulesRouter.post('/practice-modules/generate-draft', handleGeneratePracticeModuleDraft);
practiceModulesRouter.post('/practice-modules', handleCreatePracticeModule);
practiceModulesRouter.get('/practice-modules/collections/new', renderNewPracticeModuleCollectionPage);
practiceModulesRouter.post('/practice-modules/collections', handleCreatePracticeModuleCollection);
practiceModulesRouter.get('/practice-modules/collections/shared/:shareId', renderSharedPracticeModuleCollectionPage);
practiceModulesRouter.post('/practice-modules/collections/shared/:shareId/accept', handleAcceptSharedPracticeModuleCollectionLink);
practiceModulesRouter.get('/practice-modules/shared/:shareId', renderSharedPracticeModulePage);
practiceModulesRouter.post('/practice-modules/shared/:shareId/accept', handleAcceptSharedPracticeModuleLink);
practiceModulesRouter.get('/practice-modules/collections/:collectionId/edit', renderEditPracticeModuleCollectionPage);
practiceModulesRouter.get('/practice-modules/collections/:collectionId', renderPracticeModuleCollectionDetailPage);
practiceModulesRouter.post('/practice-modules/collections/:collectionId', handleUpdatePracticeModuleCollection);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/favorite', handleSetPracticeModuleCollectionFavorite);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/archive', handleArchivePracticeModuleCollection);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/restore', handleRestorePracticeModuleCollection);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/share/profile', handleSharePracticeModuleCollectionToProfile);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/items', handleAddPracticeModuleToCollection);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/items/:practiceModuleId/remove', handleRemovePracticeModuleFromCollection);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/items/:practiceModuleId/move-up', handleMovePracticeModuleCollectionItem);
practiceModulesRouter.post('/practice-modules/collections/:collectionId/items/:practiceModuleId/move-down', handleMovePracticeModuleCollectionItem);
practiceModulesRouter.get('/practice-modules/:practiceModuleId/edit', renderEditPracticeModulePage);
practiceModulesRouter.get('/practice-modules/:practiceModuleId', renderPracticeModuleDetailPage);
practiceModulesRouter.post('/practice-modules/:practiceModuleId', handleUpdatePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/favorite', handleSetPracticeModuleFavorite);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/archive', handleArchivePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/restore', handleRestorePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/delete', handleDeletePracticeModule);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/chats', handleCreatePracticeModuleConversation);
practiceModulesRouter.post('/practice-modules/:practiceModuleId/share/profile', handleSharePracticeModuleToProfile);
