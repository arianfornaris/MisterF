import express from 'express';
import {
  createSceneMediaFromPrompt,
  createSceneMediaVariation,
  renderSceneMediaDetailPage,
  renderSceneMediaLibraryPage,
} from './handlers.js';

export const sceneMediaRouter = express.Router();

sceneMediaRouter.get('/media-library', renderSceneMediaLibraryPage);
sceneMediaRouter.post('/media-library', createSceneMediaFromPrompt);
sceneMediaRouter.get('/media-library/:mediaId', renderSceneMediaDetailPage);
sceneMediaRouter.post('/media-library/:mediaId/variations', createSceneMediaVariation);
