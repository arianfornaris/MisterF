import express from 'express';
import { renderLandingPage, renderRobotsTxt, renderSitemapXml, } from './handlers.js';
export const landingRouter = express.Router();
landingRouter.get('/robots.txt', renderRobotsTxt);
landingRouter.get('/sitemap.xml', renderSitemapXml);
landingRouter.get('/', renderLandingPage);
//# sourceMappingURL=routes.js.map