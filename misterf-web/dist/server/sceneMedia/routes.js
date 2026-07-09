import express from 'express';
import { createSceneMediaFromPrompt, createSceneMediaVariation, renderSceneMediaDetailPage, renderSceneMediaLibraryPage, serveSceneMediaAudioAsset, serveSceneMediaImageAsset, } from './handlers.js';
export const sceneMediaRouter = express.Router();
sceneMediaRouter.get('/media-library', renderSceneMediaLibraryPage);
sceneMediaRouter.post('/media-library', createSceneMediaFromPrompt);
sceneMediaRouter.get('/media-library/:mediaId', renderSceneMediaDetailPage);
sceneMediaRouter.get('/media-library/:mediaId/image', serveSceneMediaImageAsset);
sceneMediaRouter.get('/media-library/:mediaId/audio', serveSceneMediaAudioAsset);
sceneMediaRouter.post('/media-library/:mediaId/variations', createSceneMediaVariation);
//# sourceMappingURL=routes.js.map