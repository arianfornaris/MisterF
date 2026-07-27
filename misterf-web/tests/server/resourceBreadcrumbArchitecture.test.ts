import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for the resources + media-library back-navigation convention
 * (`resource-page-conventions` skill, roadmap V3 item 2.3). Every page in these
 * areas must expose the shared breadcrumb partial so a new view cannot silently
 * ship without a trail back. This test also forces any newly added area view to
 * be classified as required, delegating, or explicitly exempt.
 */

const BREADCRUMB_PARTIAL = 'partials/breadcrumb.ejs';
// Top-level views include it as `partials/breadcrumb`; a partial that already
// lives under views/partials/ includes its sibling relatively as `breadcrumb`.
const BREADCRUMB_INCLUDE = /include\('(?:partials\/)?breadcrumb'/;

// Top-level area views that must render the breadcrumb partial directly.
const requiredBreadcrumbViews = [
  'resources-list.ejs',
  'resources-trash.ejs',
  'quizzes-show.ejs',
  'quizzes-participation.ejs',
  'quizzes-authoring.ejs',
  'quizzes-new.ejs',
  'quizzes-attempt.ejs',
  'quizzes-evaluating.ejs',
  'quizzes-result.ejs',
  'roleplays-show.ejs',
  'roleplays-new.ejs',
  'roleplays-edit.ejs',
  'roleplays-attempt.ejs',
  'roleplays-result.ejs',
  'roleplays-participation.ejs',
  'practice-guides-new.ejs',
  'practice-guides-authoring.ejs',
  'media-library-show.ejs',
  'media-library-trash.ejs',
  'media-library-authoring.ejs',
  'media-library-new.ejs',
  'media-library-variation-new.ejs',
];

// The breadcrumb of the practice-guide detail page lives in the shared render
// partial the page delegates to, so assert both the delegation and the partial.
const delegatingViews: Record<string, string> = {
  'practice-guides.ejs': "include('partials/practice-guides-view')",
};
const delegatedBreadcrumbPartials = ['partials/practice-guides-view.ejs'];

// Area views that intentionally carry no breadcrumb, with the reason.
const exemptViews: Record<string, string> = {
  // Area list root: it is the origin of the trail and its title already names
  // the location, so it needs no breadcrumb.
  'media-library.ejs': 'area list root',
  // External share-recipient landing pages: reached via a share token by someone
  // who has no /resources catalog of their own, so a resources breadcrumb does
  // not belong here.
  'quizzes-shared.ejs': 'external share landing',
  'resources-shared.ejs': 'external share landing',
};

// Any top-level view whose name starts with one of these belongs to the
// resources/media area and must be classified above.
const areaPrefixes = [
  'quizzes-',
  'roleplays-',
  'practice-guides',
  'media-library',
  'resources-',
];

function readView(relativeToViews: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'views', relativeToViews),
    'utf8',
  );
}

function listTopLevelViews(): string[] {
  const viewsDir = path.join(process.cwd(), 'views');
  return fs
    .readdirSync(viewsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ejs'))
    .map((entry) => entry.name);
}

function isAreaView(name: string): boolean {
  return areaPrefixes.some((prefix) => name.startsWith(prefix));
}

describe('resource + media breadcrumb architecture', () => {
  it('ships the shared breadcrumb partial with the expected structure', () => {
    const partial = readView('partials/breadcrumb.ejs');
    expect(partial).toContain('data-breadcrumb');
    expect(partial).toContain('aria-label');
    expect(partial).toContain('<nav');
    expect(partial).toContain("t('nav.breadcrumb')");
  });

  it('renders the breadcrumb on every required area view', () => {
    for (const view of requiredBreadcrumbViews) {
      expect(readView(view), `${view} must include ${BREADCRUMB_PARTIAL}`)
        .toMatch(BREADCRUMB_INCLUDE);
    }
  });

  it('keeps delegating pages wired to a breadcrumb-bearing partial', () => {
    for (const [view, includeMarker] of Object.entries(delegatingViews)) {
      expect(readView(view), `${view} must delegate rendering`)
        .toContain(includeMarker);
    }
    for (const partial of delegatedBreadcrumbPartials) {
      expect(readView(partial), `${partial} must include ${BREADCRUMB_PARTIAL}`)
        .toMatch(BREADCRUMB_INCLUDE);
    }
  });

  it('classifies every area view as required, delegating, or exempt', () => {
    const classified = new Set<string>([
      ...requiredBreadcrumbViews,
      ...Object.keys(delegatingViews),
      ...Object.keys(exemptViews),
    ]);

    const unclassified = listTopLevelViews()
      .filter(isAreaView)
      .filter((name) => !classified.has(name));

    expect(
      unclassified,
      `New resources/media views must be classified in ${path.basename(__filename)} `
        + '(add a breadcrumb and list them as required, or document why they are exempt): '
        + unclassified.join(', '),
    ).toEqual([]);
  });
});
