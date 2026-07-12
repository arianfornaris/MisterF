import express from 'express';
import { createSceneMediaFromPrompt, createSceneMediaVariation, archiveSceneMedia, renderEditSceneMediaPage, renderNewSceneMediaPage, renderNewSceneMediaVariationPage, renderSceneMediaDetailPage, renderSceneMediaLibraryPage, reviseSceneMedia, saveSceneMediaTitle, serveSceneMediaAudioAsset, serveSceneMediaImageAsset, } from './handlers.js';
export const sceneMediaRouter = express.Router();
sceneMediaRouter.get('/media-library', renderSceneMediaLibraryPage);
sceneMediaRouter.get('/media-library/new', renderNewSceneMediaPage);
sceneMediaRouter.post('/media-library', createSceneMediaFromPrompt);
sceneMediaRouter.get('/media-library/:mediaId', renderSceneMediaDetailPage);
sceneMediaRouter.get('/media-library/:mediaId/variations/new', renderNewSceneMediaVariationPage);
sceneMediaRouter.get('/media-library/:mediaId/edit', renderEditSceneMediaPage);
sceneMediaRouter.post('/media-library/:mediaId/edit/save', saveSceneMediaTitle);
sceneMediaRouter.post('/media-library/:mediaId/edit/revise', reviseSceneMedia);
sceneMediaRouter.get('/media-library/:mediaId/image', serveSceneMediaImageAsset);
sceneMediaRouter.get('/media-library/:mediaId/audio', serveSceneMediaAudioAsset);
sceneMediaRouter.post('/media-library/:mediaId/archive', archiveSceneMedia);
sceneMediaRouter.post('/media-library/:mediaId/variations', createSceneMediaVariation);
//# sourceMappingURL=routes.js.map