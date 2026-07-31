import express from 'express';
import { renderLandingEdition, renderLandingPage, renderRobotsTxt, renderSitemapXml, } from './handlers.js';
export const landingRouter = express.Router();
landingRouter.get('/robots.txt', renderRobotsTxt);
landingRouter.get('/sitemap.xml', renderSitemapXml);
// One real URL per language edition, so a crawler can index all three. `/en`
// serves English and points its canonical at `/`, which is the English edition
// proper — the alias exists for the switcher, not for the index.
landingRouter.get('/en', renderLandingEdition('en'));
landingRouter.get('/es', renderLandingEdition('es'));
landingRouter.get('/ht', renderLandingEdition('ht'));
landingRouter.get('/', renderLandingPage);
//# sourceMappingURL=routes.js.map