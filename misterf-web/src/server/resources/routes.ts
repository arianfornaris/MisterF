import express from 'express';
import {
  handleArchiveResource,
  handleAcceptSharedResourceLink,
  handleCreateResourceFolder,
  handleMoveResourceToFolder,
  handleRemoveResourceFromFolder,
  handleDuplicateResource,
  handleRestoreResource,
  handleShareResourceToProfile,
  handleUpdateResourceFolder,
  handleUpdateResourceShareCollectResults,
  renderResourcesListPage,
  renderResourceTrashPage,
  renderSharedResourcePage,
} from './handlers.js';

export const resourcesRouter = express.Router();

resourcesRouter.get('/resources', renderResourcesListPage);
resourcesRouter.get('/resources/trash', renderResourceTrashPage);
resourcesRouter.get('/resources/shared/:shareId', renderSharedResourcePage);
resourcesRouter.post('/resources/shared/:shareId/accept', handleAcceptSharedResourceLink);
resourcesRouter.get('/resources/folders/:folderId', renderResourcesListPage);
resourcesRouter.post('/resources/folders', handleCreateResourceFolder);
resourcesRouter.post('/resources/folders/:folderId', handleUpdateResourceFolder);
resourcesRouter.post('/resources/folders/:folderId/items/:resourceId/remove', handleRemoveResourceFromFolder);
resourcesRouter.post('/resources/:resourceId/folder', handleMoveResourceToFolder);
resourcesRouter.post('/resources/:resourceId/share/profile', handleShareResourceToProfile);
resourcesRouter.post('/resources/:resourceId/share/collect-results', handleUpdateResourceShareCollectResults);
resourcesRouter.post('/resources/:resourceId/archive', handleArchiveResource);
resourcesRouter.post('/resources/:resourceId/restore', handleRestoreResource);
resourcesRouter.post('/resources/:resourceId/duplicate', handleDuplicateResource);
