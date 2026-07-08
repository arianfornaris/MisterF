# UI Style Consistency Audit

## Status

Done 2026-07-08. See "Outcome" below.

## Background

Some views reuse CSS classes that were originally named for a specific feature
but now behave as generic layout helpers. For example, profile and chat room
forms currently reuse classes such as `practice-guide-form-card`, even though
those pages are not practice-guide pages.

This works visually, but the naming hides intent and makes future UI work more
fragile. It also increases the risk that a style change made for one feature
accidentally changes unrelated pages.

## Goal

Review how styles are shared across the app and make the UI more consistent
without inventing a separate design system outside Bootstrap/Bootswatch Flatly.

The desired result is:

- page markup uses semantic class names that match the page or reusable pattern
- shared styles are named generically only when they are truly shared
- feature-specific styles do not leak into unrelated features
- buttons, links, cards, forms, tabs, modals, and alerts follow Bootstrap/Flatly
- custom CSS is limited to app-specific layout or pedagogical/chat components

## Audit Scope

Review these areas:

- EJS page templates in `misterf-web/views`
- shared shell and partials in `misterf-web/views/partials`
- app CSS in `misterf-web/src/client/styles`
- generated class usage around forms, cards, page headers, tabs, modals, and
  list/detail layouts

## Specific Things To Look For

- Feature-named classes reused as generic helpers, such as
  `practice-guide-form-card` outside practice-guide pages.
- Custom button or link styles where Bootstrap classes would be enough.
- Multiple visual treatments for equivalent UI patterns.
- Page headers that use different spacing, hierarchy, or typography without a
  product reason.
- Form cards with inconsistent width, padding, labels, help text, and action
  alignment.
- Tabs that diverge from the project Bootstrap tab/pill convention.
- Modals that mix link-style close/cancel actions with Bootstrap button actions.
- Custom color usage that bypasses Bootstrap tokens or the documented app theme
  variables.

## Proposed Remediation

1. Inventory repeated page patterns and decide which are truly shared.
2. Introduce neutral reusable class names only for real shared patterns, such as
   `resource-form-shell` or `app-form-card`.
3. Rename misleading feature-specific classes where possible.
4. Prefer Bootstrap utilities over new custom CSS when the behavior is standard.
5. Keep feature-specific classes only for feature-specific layout or behavior.
6. Update `docs/design/visual-design.md` if the audit establishes new reusable
   UI conventions.
7. Verify representative pages manually after each cleanup pass.

## Non-Goals

- Do not redesign the entire app visually in one pass.
- Do not replace Bootstrap/Bootswatch Flatly with a custom design system.
- Do not rename classes mechanically without checking the visual impact.
- Do not use CSS cleanup as an excuse to change product behavior.

## Outcome (2026-07-08)

The audit found three cross-feature naming families and a layer of dead CSS
left behind by earlier redesigns. Remediation shipped on the `v2` branch:

- **App-wide scaffold renamed.** `app-resource-view` and the
  `resource-page-*` family were the de-facto page scaffold for *every* page
  (settings, credits, progress, profiles, change-password included). They are
  now `app-page` / `app-page-header|kicker|title|copy|detail-shell|…` in a new
  `src/client/styles/app-pages.css`. `resource-eyebrow` and
  `resource-page-section-kicker` were duplicate names for the same rule as the
  kicker and were consolidated into `app-page-kicker`. `resource-*` classes
  remain only on actual resource pages.
- **Profiles pages no longer wear practice-guide classes.**
  `practice-guide-form`/`-form-actions` (whose only users were the profile
  forms) became the shared `app-form-grid`/`app-form-actions`; the profile
  cards now use `profile-card` plus Bootstrap utilities (`text-nowrap`,
  `text-body-secondary`, flex utilities) instead of the
  `practice-guide-card*`, `-chat-count-badge`, and `-empty-state` classes.
- **Authoring revision chat renamed.** The tab + AI-chat layout shared by the
  quiz, practice-guide, and roleplay authoring pages used `quiz-tabs` and
  `quiz-chat-*` everywhere; it is now `authoring-tabs`/`authoring-chat-*` in
  its own `src/client/styles/authoring.css` (the unstyled
  `quiz-chat-message-bubble` hook was dropped).
- **Dead CSS removed.** The retired practice-guide card/grid/filter/markdown
  rules, `resource-page-form-card`/`-form-shell`/`-section-actions`, and
  `quiz-section-menu`/`quiz-section-block-checklist` had no remaining users
  (verified against views, client JS including dynamic `is-${…}` patterns, and
  server code) and were deleted. CamelCase class names (`practiceGuide-*`)
  were normalized to kebab-case or replaced; data attributes kept their
  spelling because client JS selects on them.
- **Guards.** `tests/server/uiClassArchitecture.test.ts` now forbids every
  retired name across views and stylesheets, and asserts the stylesheet
  layering (`app-pages.css`, `authoring.css` imports; no page/feature classes
  in `app-shell.css`). Conventions documented in
  [visual-design.md](../../design/visual-design.md) ("Semantic Class Naming").

Intentional leftovers: `sentence-evaluation` on the roleplay result page is
the shared pedagogical evaluation component (allowed by the design rules);
`resource-form-card`, `practice-guides-page`, `quiz-block-heading`, and
`quiz-share-qr` are style-less semantic markers and were already unstyled
before this pass.

Follow-up completed same day: the scanner hits in the chat shell stylesheets
were traced one by one (exact grep, dynamic-construction grep, `git log -S`
for the commit that removed each markup). Confirmed dead and deleted:
`llm-context-meter*` (markup removed in `f11479ce`; the orphaned null-guarded
JS — the meter element lookups and circle math in `chat/index.js`, the
`updateLlmContextMeter`/`initializeLlmContextMeter` functions in
`ChatRuntime.js`, and their socket-handler call sites — was pruned too; the
`llm:request_tokens` console logging stays),
`tutor-message-actions`/`tutor-message-action-link` (superseded by
`message-actions`/`message-action-button` in `032f0629`),
`new-conversation-button`, `user-menu-button`, `translator-label`, and
`.conversation-panel .offcanvas-title` (the offcanvas header only holds a
logo link and `btn-close`). Confirmed alive and kept: the dynamic `is-${…}`
state classes, `sentence-popover-error`/`-improve` (built via
`sentence-popover-${status}` in the renderer, quiz result card, and
`roleplays-result.ejs`), and Bootstrap runtime classes (`popover-*`).
