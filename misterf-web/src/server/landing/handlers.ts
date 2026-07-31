import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { listDemoActivitiesForUserEmail } from '../db/repository.js';
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

  const demoActivity = pickDemoActivity();

  response.render('landing', {
    canonicalUrl: buildAbsoluteAppUrl('/'),
    contactEmail: env.landingContactEmail,
    // The primary call to action promises "create your first activity", so it
    // has to land there. Without `returnTo` the visitor signs up and arrives at
    // `/`, the tutor chat, having been asked to do something else entirely.
    // The parameter survives the signup form, Google OAuth, email
    // verification, and profile onboarding, and an already-signed-in visitor is
    // redirected straight through by `renderSignup`.
    createActivityUrl: `/signup?returnTo=${encodeURIComponent(createActivityPath)}`,
    demoActivity,
    ogImageUrl: buildAbsoluteAppUrl('/public/brand/share-card.png'),
    // Served straight from `public/`, so the app version busts the cache.
    pageStylesheet: `/public/landing.css?v=${env.appVersion}`,
    title: `Mister F · ${appDocumentTitle}`,
  });
}

/** Where the landing's primary call to action has to end up. */
const createActivityPath = '/quizzes/new';

/**
 * One of the seeded example activities, chosen at random per visit so the pool
 * gets exercised and no single activity carries the whole first impression.
 * Returns null when the environment has no seeded demos, which hides the demo
 * section rather than offering a link that goes nowhere.
 */
function pickDemoActivity(): { level: string; title: string; url: string } | null {
  const activities = listDemoActivitiesForUserEmail(env.landingDemoEmail);
  if (activities.length === 0) {
    return null;
  }

  const activity = activities[Math.floor(Math.random() * activities.length)];

  return {
    level: activity.level,
    title: activity.title,
    url: `/resources/shared/${encodeURIComponent(activity.shareId)}`,
  };
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
