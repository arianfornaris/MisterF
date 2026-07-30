import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { appDocumentTitle, buildAbsoluteAppUrl } from '../pages/shell.js';

/**
 * The public landing page, shown at `/` to visitors without a session.
 *
 * Registered before the chat router, so an authenticated request falls
 * through to `renderChatPage` and `/` keeps meaning "the app" for anyone
 * signed in. A session with an unverified email also falls through: that user
 * belongs in the app, where the verification notice is shown.
 */
export function renderLandingPage(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (request.authUser) {
    next();
    return;
  }

  // No `ogImageUrl` yet: the share card is still an unbuilt asset, and an
  // `og:image` pointing at a 404 previews worse than no tag at all.
  response.render('landing', {
    canonicalUrl: buildAbsoluteAppUrl('/'),
    contactEmail: env.landingContactEmail,
    demoUrl: env.landingDemoUrl,
    title: `Mister F · ${appDocumentTitle}`,
  });
}

/**
 * Served from a route rather than `public/`, which is mounted under `/public`
 * and therefore cannot answer the root paths crawlers ask for.
 *
 * The policy is deliberately closed: only the public surfaces are crawlable.
 * Shared resource links are public by design but were written to be opened by
 * a student who was given the link, not found by a stranger — opening them to
 * indexing is an explicit decision tracked in
 * `docs/roadmap/roadmap-v3-5.md`, sections 1.7 and 2.2.
 */
export function renderRobotsTxt(_request: Request, response: Response): void {
  const body = [
    'User-agent: *',
    'Allow: /$',
    'Allow: /login',
    'Allow: /signup',
    'Allow: /privacy',
    'Allow: /terms',
    'Disallow: /',
    '',
    `Sitemap: ${buildAbsoluteAppUrl('/sitemap.xml')}`,
    '',
  ].join('\n');

  response.type('text/plain').send(body);
}

export function renderSitemapXml(_request: Request, response: Response): void {
  const paths = ['/', '/privacy', '/terms'];
  const urls = paths
    .map((path) => `  <url><loc>${buildAbsoluteAppUrl(path)}</loc></url>`)
    .join('\n');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  response.type('application/xml').send(body);
}
