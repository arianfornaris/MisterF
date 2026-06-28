import express from 'express';
import {
  handleArchiveResource,
  handleCreateResourceFolder,
  handleMoveResourceToFolder,
  handleRemoveResourceFromFolder,
  handleRestoreResource,
  handleUpdateResourceFolder,
  renderResourcesListPage,
} from './handlers.js';

export const resourcesRouter = express.Router();

resourcesRouter.get('/resources', renderResourcesListPage);
resourcesRouter.get('/resources/folders/:folderId', renderResourcesListPage);
resourcesRouter.post('/resources/folders', handleCreateResourceFolder);
resourcesRouter.post('/resources/folders/:folderId', handleUpdateResourceFolder);
resourcesRouter.post('/resources/folders/:folderId/items/:resourceId/remove', handleRemoveResourceFromFolder);
resourcesRouter.post('/resources/:resourceId/folder', handleMoveResourceToFolder);
resourcesRouter.post('/resources/:resourceId/archive', handleArchiveResource);
resourcesRouter.post('/resources/:resourceId/restore', handleRestoreResource);
