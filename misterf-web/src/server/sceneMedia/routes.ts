import express from 'express';
import {
  applySceneMediaPreview,
  applySceneMediaScript,
  createSceneMediaFromPrompt,
  createSceneMediaVariation,
  archiveSceneMedia,
  discardSceneMediaPreview,
  previewSceneMediaImage,
  previewSceneMediaMetadata,
  previewSceneMediaScript,
  renderEditSceneMediaPage,
  renderNewSceneMediaPage,
  renderNewSceneMediaVariationPage,
  renderSceneMediaDetailPage,
  renderSceneMediaLibraryPage,
  reviseSceneMedia,
  saveSceneMediaDetails,
  serveSceneMediaImageAsset,
} from './handlers.js';

export const sceneMediaRouter = express.Router();

sceneMediaRouter.get('/media-library', renderSceneMediaLibraryPage);
sceneMediaRouter.get('/media-library/new', renderNewSceneMediaPage);
sceneMediaRouter.post('/media-library', createSceneMediaFromPrompt);
sceneMediaRouter.get('/media-library/:mediaId', renderSceneMediaDetailPage);
sceneMediaRouter.get('/media-library/:mediaId/variations/new', renderNewSceneMediaVariationPage);
sceneMediaRouter.get('/media-library/:mediaId/edit', renderEditSceneMediaPage);
sceneMediaRouter.post('/media-library/:mediaId/edit/save', saveSceneMediaDetails);
sceneMediaRouter.post('/media-library/:mediaId/edit/revise', reviseSceneMedia);
sceneMediaRouter.post('/media-library/:mediaId/preview/image', previewSceneMediaImage);
sceneMediaRouter.post('/media-library/:mediaId/preview/script', previewSceneMediaScript);
sceneMediaRouter.post('/media-library/:mediaId/preview/metadata', previewSceneMediaMetadata);
sceneMediaRouter.post('/media-library/:mediaId/preview/apply', applySceneMediaPreview);
sceneMediaRouter.post('/media-library/:mediaId/preview/script/apply', applySceneMediaScript);
sceneMediaRouter.post('/media-library/:mediaId/preview/discard', discardSceneMediaPreview);
sceneMediaRouter.get('/media-library/:mediaId/image', serveSceneMediaImageAsset);
sceneMediaRouter.post('/media-library/:mediaId/archive', archiveSceneMedia);
sceneMediaRouter.post('/media-library/:mediaId/variations', createSceneMediaVariation);
