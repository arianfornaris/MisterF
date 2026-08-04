import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { listDemoActivitiesForUserEmail } from '../db/repository.js';
import { createTranslator, defaultLocale, type Locale } from '../i18n/index.js';
import { getLocaleCookie, setLocaleCookie } from '../i18n/resolve.js';
import { buildAbsoluteAppUrl, buildDocumentTitle } from '../pages/shell.js';

/**
 * Path each language edition of the landing lives at.
 *
 * English keeps the root: it is the URL people type, share, and print, and it
 * should render rather than redirect. `/en` exists anyway so the switcher has
 * three links of the same shape, and it declares `/` as its canonical so the
 * two never compete for the same index entry.
 */
const editionPaths: Record<Locale, string> = {
  en: '/',
  es: '/es',
  ht: '/ht',
};

/** Where the landing's primary call to action has to end up. */
const createActivityPath = '/quizzes/new';

/**
 * The public landing page, shown to visitors without a session.
 *
 * Registered before the chat router, so an authenticated request to `/` falls
 * through to `renderChatPage` and the root keeps meaning "the app" for anyone
 * signed in. A session with an unverified email also falls through: that user
 * belongs in the app, where the verification notice is shown.
 *
 * `forcedLocale` is what makes a language edition a real page instead of a
 * cookie state. On `/es` and `/ht` the path is an explicit choice, so it wins
 * over `Accept-Language` and over the cookie, and it writes the cookie so the
 * app the visitor signs into speaks the language the landing did. The root
 * keeps negotiating, and says which edition it served through its canonical
 * link — that is what lets a crawler index all three from one entry point.
 */
function renderLanding(
  request: Request,
  response: Response,
  next: NextFunction,
  forcedLocale?: Locale,
): void {
  if (request.authUser) {
    if (forcedLocale) {
      // A language edition is a marketing page, not an app route.
      response.redirect('/');
      return;
    }

    next();
    return;
  }

  const locale = forcedLocale ?? resolveRootLocale(request);
  if (locale !== request.locale) {
    response.locals.locale = locale;
    response.locals.htmlLang = locale;
    response.locals.t = createTranslator(locale);
  }

  if (forcedLocale) {
    // The path is an explicit choice, so it should still be in force when the
    // visitor moves on into the app.
    setLocaleCookie(response, forcedLocale);
  }

  if (!forcedLocale) {
    // The root serves different copy to different visitors, so caches and
    // crawlers have to be told what it varies on.
    response.vary('Accept-Language');
  }

  response.render('landing', {
    alternateEditions: buildAlternateEditions(),
    canonicalUrl: buildAbsoluteAppUrl(editionPaths[locale]),
    contactEmail: env.landingContactEmail,
    // The primary call to action promises "create your first activity", so it
    // has to land there. Without `returnTo` the visitor signs up and arrives at
    // `/`, the tutor chat, having been asked to do something else entirely.
    // The parameter survives the signup form, Google OAuth, email
    // verification, and profile onboarding, and an already-signed-in visitor is
    // redirected straight through by `renderSignup`.
    createActivityUrl: `/signup?returnTo=${encodeURIComponent(createActivityPath)}`,
    demoActivity: pickDemoActivity(),
    editionPaths,
    ogImageUrl: buildAbsoluteAppUrl('/public/brand/share-card.png'),
    // Served straight from `public/`, so the app version busts the cache.
    pageStylesheet: `/public/landing.css?v=${env.appVersion}`,
    title: buildDocumentTitle(locale, 'Mister F'),
  });
}

/**
 * Language for the root, which negotiates rather than being pinned to a path.
 *
 * Express's `acceptsLanguages` returns the *first* supported locale whenever
 * the request expresses no preference — Spanish, here, purely because of key
 * order in the language registry. Crawlers and plain HTTP clients routinely
 * send nothing, or the wildcard `Accept-Language: *`, so the root would have
 * served them Spanish and canonicalised to `/es`, leaving the chain `/en` →
 * `/` → `/es` and English effectively unindexed. No stated preference means
 * the default edition, not the first key in a map.
 */
function resolveRootLocale(request: Request): Locale {
  const cookie = getLocaleCookie(request);
  if (cookie) {
    return cookie;
  }

  return statesLanguagePreference(request.headers['accept-language'])
    ? request.locale
    : defaultLocale;
}

/** True only for a header naming at least one concrete language tag. */
function statesLanguagePreference(header: string | undefined): boolean {
  if (!header) {
    return false;
  }

  return header
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .some((tag) => tag !== '' && tag !== '*');
}

/*
 * Both exports below are deliberately three-argument functions.
 *
 * Express decides what a handler *is* from its arity: register a four-argument
 * function and it becomes an error handler, silently skipped during normal
 * routing. `renderLanding` takes a fourth `forcedLocale` parameter, so it can
 * never be handed to `router.get` directly — the root would 200 with whatever
 * matched next (the chat page) and nothing would look broken.
 */
export function renderLandingPage(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  renderLanding(request, response, next);
}

export function renderLandingEdition(locale: Locale) {
  return (request: Request, response: Response, next: NextFunction): void => {
    renderLanding(request, response, next, locale);
  };
}

/**
 * `hreflang` pairs for every edition, plus `x-default` for a visitor whose
 * language we do not publish. Emitted identically on all three pages, which is
 * what the reciprocity rule asks for.
 */
function buildAlternateEditions(): Array<{ href: string; hreflang: string }> {
  const alternates = (Object.keys(editionPaths) as Locale[]).map((code) => ({
    href: buildAbsoluteAppUrl(editionPaths[code]),
    hreflang: code,
  }));

  return [
    ...alternates,
    { href: buildAbsoluteAppUrl(editionPaths.en), hreflang: 'x-default' },
  ];
}

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
    'Allow: /en',
    'Allow: /es',
    'Allow: /ht',
    'Allow: /login',
    'Allow: /signup',
    'Allow: /privacy',
    'Allow: /terms',
    // Allowed so link-preview bots and crawlers can fetch the page; the pages
    // themselves carry `noindex`, which is the mechanism that keeps them out
    // of the index. A Disallow here would stop the crawl before the tag is
    // ever read, and some preview bots refuse a disallowed URL outright — the
    // card a whole class sees would go blank.
    'Allow: /resources/shared/',
    'Disallow: /',
    '',
    `Sitemap: ${buildAbsoluteAppUrl('/sitemap.xml')}`,
    '',
  ].join('\n');

  response.type('text/plain').send(body);
}

export function renderSitemapXml(_request: Request, response: Response): void {
  const editions = (Object.keys(editionPaths) as Locale[]).map((code) => code);
  const entries = editions.map((code) => {
    const alternates = editions
      .map(
        (other) =>
          `    <xhtml:link rel="alternate" hreflang="${other}" href="${buildAbsoluteAppUrl(editionPaths[other])}"/>`,
      )
      .join('\n');

    return [
      '  <url>',
      `    <loc>${buildAbsoluteAppUrl(editionPaths[code])}</loc>`,
      alternates,
      '  </url>',
    ].join('\n');
  });

  for (const path of ['/privacy', '/terms']) {
    entries.push(`  <url><loc>${buildAbsoluteAppUrl(path)}</loc></url>`);
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  response.type('application/xml').send(body);
}
