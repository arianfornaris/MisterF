# A warmer Mister F experience

## Start here: design continuity contract

This folder is a **design prototype**, not the production application. The user
approved its visual direction and requested extending it across the site. Keep
all demo work here. Do not infer permission to migrate styles, change product
behavior, or deploy. Read this guide before extending a page. Read the root
`AGENTS.md` and relevant `.agents/skills` before implementation.

The design should feel professional, welcoming, and engaging for adults. It
inherits the landing page's editorial warmth and uses the product's existing
quiz/chat visual language as a reference. Avoid infantilizing the experience
with arbitrary points, streak pressure, confetti, emoji navigation, or mascots
unrelated to the activity. Make the next meaningful action easy to understand.

### What another agent must preserve

1. Keep the same brand, sidebar, spacing rhythm, typography hierarchy, and
   resource color meanings across screens.
2. Distinguish learning from teaching through **label, icon, copy, information
   priority, and color together**. Color alone is insufficient.
3. Put visuals where they explain context or an action. Do not add a hero image
   to every screen. Editing, settings, reports, and legal text need quieter
   surfaces than discovery and onboarding.
4. Give each page a dedicated renderer. Share only actual reusable patterns;
   do not build one giant conditional page for unrelated flows.
5. Every visible action must navigate, update a local example, or disclose its
   simulated nature. Never imply a payment, account change, share, upload, or
   AI request happened when it did not.
6. Keep all assets local, all data fictional, and the demo functional by opening
   `index.html` directly. Use classic scripts rather than fetched templates or
   module imports that require a server. No external runtime dependencies.

### Visual tokens and hierarchy

The existing `styles.css` is the source of truth. Reuse tokens; do not create
slightly different page-specific shades or radius values.

| Role | Token / value | Use |
| --- | --- | --- |
| Brand/action | `--bs-primary`, `#00496a` | Primary buttons, important links |
| Page canvas | `--bs-body-bg`, `#fcfbf8` | Warm neutral backdrop |
| Reading surface | White | Forms, tables, chat body, editors |
| Text | `--bs-body-color`, `#203a43` | Headings and primary text |
| Secondary text | `--quiet`, `#657579` | Supporting copy and metadata |
| Learning | `--mint`, `--mint-ink` | Learner mode, encouragement, guides |
| Teaching | `--blue`, `--blue-ink` | Teacher mode, reports, preparation |
| Quiz | `--peach`, `--peach-ink` | Quiz previews and contextual accents |
| Conversation | `--lilac`, `--lilac-ink` | Roleplay and dialogue previews |
| Containers | Bootstrap radius and border variables | Flat, consistent surfaces |

Use Georgia for editorial page titles and selected learning-content headings;
use the Flatly/system sans-serif stack for navigation, controls, tables, and
body copy. Do not use serif for every heading. Desktop page titles are roughly
40–46 px; mobile titles 32–34 px. Body copy is 14–15 px, explanatory text 13 px,
metadata 11–12 px. Reserve uppercase tracking for short kickers, not paragraphs.

Use a 4/8 px spacing rhythm with 16/24/32 px section spacing. Main content has
about 42 px desktop inset and 17–22 px mobile inset. Cards normally use 22–28 px
padding. General chrome is flat: no gradients, custom card shadows, or one-off
radii. Slight rotation is reserved for **illustrative paper mockups**, never
forms, real tables, or text users must act on.

Primary actions use `btn-primary`, secondary actions `btn-outline-secondary`.
Destructive confirmations use `btn-danger`. Prefer one primary action per
decision area. Bootstrap supplies buttons, form controls, badges, cards,
dropdowns, tabs, alerts, progress bars, and modals. Use Bootstrap Icons with
decorative `aria-hidden="true"` and accessible labels for icon-only buttons.

### Mode contract

| Area | Learning | Teaching |
| --- | --- | --- |
| Persistent identity | Compass + “Estoy aprendiendo” | Easel + “Estoy enseñando” |
| Home priority | Start or resume meaningful practice | Create and review activities |
| Resource detail | What I will practice; start; my history | Preview; edit; share; participation |
| Results | Strengths, useful feedback, next step | Participation, patterns, follow-up work |
| Voice | Warm, concrete, reassuring | Clear, supportive, respects teacher judgment |
| Accent | Green | Blue |

Keep the current screen when switching modes, where meaningful. Explicitly
label teacher-preview and guest contexts. Public authentication and legal
screens use a compact public shell rather than an authenticated sidebar.

### Page patterns

- **Discovery:** a contextual introduction, one scene or meaningful mockup,
  visual format cards, and a clear continuation. Keep prose short.
- **Resource detail:** type/icon kicker, resource title, breadcrumb, action row
  (primary then options), description, contents/mission, and relevant history.
- **Creation:** compact format choice, prompt/examples, level/reference input,
  illustrative preview. Explain that demo generation is predefined.
- **Authoring:** quiet editor with a clear outline, editable fields, preview,
  save-example feedback, and a separately identified revision proposal.
- **Attempt:** focus on the exercise or conversation. Put context and progress
  above it, support beside it, and a deterministic exit to the owning resource.
- **Result/report:** concrete feedback first, follow-up actions immediately
  after the summary, evidence below. Avoid invented proficiency claims.
- **Lists:** images for scenes, mockups for formats without artwork, type and
  level text, search/filter controls where useful. Tables are for repeated
  structured facts such as participation, not everything.
- **Account/settings:** grouped labeled controls, short explanations, explicit
  local save feedback. Do not decorate every field or invent plan prices.
- **Empty/pending/error:** useful explanation, a next action, calm visual cue.
  Pending demos must offer a way to inspect completion and failure states.
- **Legal:** legible measure, contents/navigation, restrained typography. Demo
  text is a layout sample, not a replacement policy or legal advice.

### Images and mockups

Reuse the repository's scene illustrations and character portraits. Crop scene
images consistently with `object-fit: cover`; preserve the context being
practiced. Portraits use `object-fit: contain`. Add descriptive alt text when
the image communicates information; use empty alt for redundant decoration.
Use `mini()` for quiz, conversation, roleplay, and guided-route illustrations.
Use realistic English practice examples with Spanish instruction copy.
Do not fetch stock photography or introduce a second illustration style.

### Navigation and implementation contract

`index.html` loads local Flatly, icons, and custom CSS. `demo.js` owns the shell,
hash router, original screens, and shared helpers (`icon`, `badge`, `heading`,
`link`, `mini`). The extended page registry lives in `pages.js`; screen-family
files provide dedicated renderers. Register new screens in that registry and
the visible page index. Use `#learn/<screen>` and `#teach/<screen>` URLs, with
explicit query parameters for format or state. Never use browser history as a
resource's only back action.

Keep UI examples local. Escape user-entered text before interpolating it into
HTML, or assign `textContent`. Bind form handlers after render and prevent
network submission. Use Bootstrap's modal/dropdown behavior and focus handling.
Do not use inline event-handler attributes. Keep page-specific interactions in
the owning screen family, shared behavior in utilities. Draft state only needs
to survive local actions on its screen; do not introduce account persistence.

The complete production-view mapping belongs in `PAGE-MAP.md`. The visible
“Todas las páginas” index must expose every mapped screen, including guest,
account, system-state, and less prominent management pages. A resource list
card should open the matching detail; detail should connect editing, attempt,
result, participation, and sharing, not send every action to the same chat.

### Accessibility, responsive behavior, and verification

- Check desktop and 390 px mobile; also check narrow 320 px when changing the
  shell. No page-level horizontal overflow. Tables may scroll in their region.
- Collapse two-column detail/editor layouts; preserve primary actions and
  context. The mobile navigation can scroll horizontally with a clear affordance.
- Associate labels and controls; use real buttons and links. Preserve visible
  keyboard focus, an operational skip link, and modal Escape/focus restoration.
- Tabs use standard Bootstrap `nav-pills`, with active state represented in the
  URL. Do not create a new tab styling system.
- Add text/icons to color states, respect reduced motion, and use `aria-live`
  for local feedback. Do not hide the only explanation on mobile.
- Check console errors, image loading, all internal route targets, the page
  inventory, main workflows, and input behavior. Run `node --check` on scripts.
- For application-code changes, follow the project testing/restart skills.
  This folder's server is independent; editing it does not require restarting
  the product server. Never claim the product was modified or deployed.

### Handoff checklist

Update `PAGE-MAP.md` with exact source-view coverage and limitations. Record
what was tested separately from what was merely rendered. Keep this README's
architecture, source files, and simulated behavior accurate. Production
integration later needs the real locale catalogs, route/access contracts,
credit gates, attempt lifecycles, and existing data sources; none is authorized
by a visual-demo request alone.

## Running the demo

Standalone, offline-capable visual proposal. Open `index.html` directly or serve
this folder with `python3 -m http.server 4173 --bind 127.0.0.1`.
No install, build, account, API key, network dependency, or application server is
required. All data is illustrative. Spanish review copy is intentional.

## Screens

The expanded demo contains **59 registered screens**: 57 review destinations
in the visible index, the index itself, and the original `chat` compatibility
screen. `PAGE-MAP.md` maps all **42 top-level production EJS views** to these
proposals and documents their deliberate limitations.

Start at `#learn/pages` to browse the full inventory. `#learn/design-guide`
provides a visual summary and links to this README and the coverage map.

### File ownership

| File | Responsibility |
| --- | --- |
| `index.html` | Local dependency and script loading order |
| `styles.css` | Original visual tokens, shell, core page patterns |
| `pages.css` | Extended layouts and responsive adjustments |
| `demo.js` | Hash router, authenticated shell, initial screens and helpers |
| `pages.js` | Extended route registry, index, breadcrumbs, tabs, modal/form helpers |
| `resource-pages.js` | Details, editors, attempts, results, tutor, sharing, archive states |
| `media-pages.js` | Scene catalog, selected scene, authoring and variations |
| `account-pages.js` | Public shell, access, onboarding, account and management |
| `verify.mjs` | Renderer-level inventory, structure, route and asset checks |
| `PAGE-MAP.md` | EJS coverage and limits of the simulation |

Run `node design/experience-demo/verify.mjs` from the repository root. This
checks both modes without a browser. Browser tests remain necessary for
layout and interaction behavior.

### Original entrypoints

- `#learn/home`: learner home with a contextual invitation and format previews.
- `#teach/home`: teacher home with creation shortcuts and a report preview.
- `#learn/library`, `#teach/library`: illustrated resources, type filters, search.
- `#learn/create`, `#teach/create`: format selection, contextual prompts, preview.
- `#learn/progress`: qualitative progress, practice history, next steps.
- `#teach/progress`: question-level results and follow-up activity creation.
- `#learn/chat`: illustrative roleplay, answer feedback, canned conversation.
- `#learn/about`: design rationale and scope, in Spanish for review.

The mode switch keeps the current page so the two treatments can be compared.
Search, filters, format selection, prompt suggestions, example submission,
answer feedback, and the canned chat are interactive. Nothing is persisted.
Creation now opens the matching format's editor. Resource cards now open
their format's detail page. The new quiz checks two closed responses locally;
open-answer feedback remains illustrative. See `PAGE-MAP.md` for all flows.
Files are selected locally only; they are neither uploaded nor parsed.

## Design rationale

Keep Flatly components and the existing navy brand accent. Use warm neutral
page backgrounds, generous spacing, and editorial headings to connect the
authenticated experience to the landing page. Apply green to learning and
blue to teaching, reinforced with explicit mode labels and contextual copy.
Use peach for quizzes, lilac for conversations, and green for guided practice.
Format names and icons communicate the same information without color.

Images should explain a situation, not decorate every surface. Existing scene
illustrations and the Sofia portrait give learning a human context. HTML
mockups explain resource formats and teacher outcomes. Forms and long reading
surfaces stay quiet. The actual product quiz and chat blocks are not modified;
the chat screen here only illustrates the surrounding visual direction.

The dedicated home screens, practice-duration estimates, visual gallery,
weekly progress chart, and teacher dashboard aggregates are proposed features,
not claims about currently available product data. Validate their source,
access controls, empty states, and educational usefulness before production.
The sample report's 71% is rounded from 17 correct answers out of 24.
Production integration must use the application's locale catalogs for all
supported languages and existing resource/attempt contracts.

## Assets and isolation

`assets/` contains copies of the repository's scene illustrations, Sofia
portrait, brand mark, Flatly stylesheet, and Bootstrap Icons font/styles.
No assets were generated or fetched from external services. Dependency assets
retain their upstream license notices. All custom files and asset copies are
inside this folder; no application files, routes, styles, or data were changed.

## Review

Review learning first, then use the mode selector on the same page. Compare
home, library, creation, and progress. Resize to mobile and verify the compact
horizontal navigation. The proposal is suitable for visual discussion; it is
not production-ready functionality. Additional desktop and mobile review of
the expanded screens is recorded below; the following initial checks describe
the first version.

Verified in the browser at desktop width and at 390 px: learner/teacher mode
switching, library filters and empty search results, format switching while
preserving prompt text, example submission, answer feedback, and canned chat.
Reviewed home, library, creation, progress, and report layouts. No console
errors were observed. Node syntax validation, application typecheck, test
typecheck, and the existing 479 tests across 71 files passed. No application
server restart was needed because the demo uses a separate static server.
