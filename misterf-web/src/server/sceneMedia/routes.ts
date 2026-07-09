import express from 'express';
import {
  renderSceneMediaDetailPage,
  renderSceneMediaLibraryPage,
} from './handlers.js';

export const sceneMediaRouter = express.Router();

sceneMediaRouter.get('/media-library', renderSceneMediaLibraryPage);
sceneMediaRouter.get('/media-library/:mediaId', renderSceneMediaDetailPage);
