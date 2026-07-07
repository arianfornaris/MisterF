# Roadmap V2

Date: 2026-07-04 (last updated: 2026-07-06)

Status: **Active.** V2 is the English-first internationalization release: it
makes the platform's instruction language selectable (Spanish, English,
Haitian Creole). The comprehension-exercises pillar (listening, reading, and
image comprehension) that originally shared this roadmap was moved to
[Roadmap V3](roadmap-v3.md) on 2026-07-06 so V2 can ship as the i18n release;
Part 2 carries the engineering and quality items deferred from
[Roadmap V1](roadmap-v1.md). Remaining product-feature candidates stay in
the idea inbox, [issues/incomming.md](../issues/incomming.md), until they
are promoted here.

This document is also the living tracker for V2: items move through the
status legend as work happens (`[~]` when started, `[x]` with a date when
done), and notes are added inline when decisions change an item's scope.
There is no fixed execution order — the next item is chosen by analyzing
the current state at each step.

V2 development happens on the `v2` branch (created 2026-07-04 from `main`
at the prompt-contract fixtures commit). `main` remains the production
branch: deploys and V1.x patches come from `main`, and `v2` merges into
`main` when V2 releases as `2.0.0`.

Product context: the primary audience is students in South Florida, many of
them Hispanic and Haitian. Today the whole platform (UI and tutor
assistance) is Spanish-only, which serves the Hispanic audience but excludes
everyone else.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Internationalization (English First)

Goal: make the platform's instruction language selectable. V2 ships exactly
two instruction languages — Spanish (current) and English — following the
common pattern in pedagogical materials of English as the base language.
The architecture must make adding a third language cheap (Haitian Creole is
the natural post-V2 candidate for the Haitian community), but V2 does not
ship it.

Scope notes:

- The instruction language is the language of the UI and of the tutor's
  assistance/explanations. The target language of study (what students
  practice producing and comprehending) remains English and is unaffected.
- For English-instruction users studying English, prompts must avoid
  translation-based scaffolding and lean on monolingual techniques.

- [x] Design review: validate and update the existing
  [Multilingual English Learning](../features/multilingual-english-learning.md)
  proposal (target language / support language / interface locale) as the
  design doc for this initiative, resolving: where the language preference
  lives (per-user setting, onboarding choice, and pre-login detection), the
  string strategy for EJS views and client scripts, how system prompts
  parametrize the instruction language, and what happens to mixed-language
  shared resources. V2 ships English only; Haitian Creole stays post-V2.
  2026-07-04: resolved where the preference lives — a single per-profile
  `instruction_language` field (`es`/`en`) collected at profile
  creation/onboarding and editable, governing UI and tutor — and the
  pre-account first-interaction language (switcher cookie →
  `Accept-Language` → `en` fallback, seeding the first profile at
  signup); details in the design doc's "V2 Decisions" section. Also
  2026-07-04: string strategy approved (per-language TS dictionaries +
  `t` helper, no framework), shared resources resolved (author picks
  the resource language; shown as authored to every reader), and the
  prompt parametrization proposal approved (language packs + invariant
  sections + conversation language snapshot). Done 2026-07-04; all
  decisions live in the design doc's "V2 Decisions" section.
- [x] i18n infrastructure: externalize UI strings from EJS views, partials,
  client scripts, flash messages, and validation errors into per-language
  catalogs (`es`, `en`); pick or build a minimal helper (no heavyweight
  framework unless the design doc justifies it). 2026-07-04: infrastructure
  built and shipped — `src/server/i18n/` with per-language catalogs, a
  `translate()`/`t` helper (dot-path keys, `{{param}}` interpolation), the
  `attachLocale` middleware exposing `res.locals.t/locale/htmlLang`, and an
  integration test. The app shell (nav, all modals, translator, credit and
  help dialogs), `<html lang>`, and the settings page are externalized.
  2026-07-04: string externalization of every product EJS view and every
  client script is complete — all 48 views/partials (profiles, chat,
  resources, quizzes, roleplays, practice-guides, progress, credits,
  superadmin, auth) plus the client bundles (chat + cards, quizzes,
  roleplays, resources, practice-guides, and the shared modules) render
  through `t()` / a browser-injected client dictionary
  (`window.__APP_I18N__`). A whole-tree sweep (accented and accent-free
  Spanish) confirms no learner-facing Spanish literals remain outside the
  intentional `Español` endonym and the two legal-document bodies.
  2026-07-05: the previously open items — server-side flash/validation
  messages (auth `forms.ts`, profiles, quizzes, roleplays, resources,
  practice-guide handlers) and the `privacy`/`terms` legal-document bodies
  — are done (see transactional surfaces below). The operational guide for
  adding a language is [i18n](../architecture/i18n.md). 2026-07-05: language
  config centralized into a single registry (`i18n/languages.ts`) — `Locale`,
  the supported list, the UI pickers/switcher, and the tutor packs derive
  from it, and the DB `instruction_language` CHECK was dropped (validated in
  app code) so adding a language needs no schema change: one registry entry
  plus a catalog and a language-rules file.
- [x] Per-user language preference: onboarding choice, settings toggle, and
  a sensible default for anonymous/shared-link visitors (`Accept-Language`
  with explicit override). Done 2026-07-04: `instruction_language` profile
  field (migration, repository, onboarding + profile forms); a settings
  language toggle (`/settings/language`) that flips UI + tutor on redirect;
  locale resolution (profile → switcher cookie → `Accept-Language` → `en`);
  a visible ES/EN switcher for signed-out visitors with `?lang=` override;
  and first-profile seeding at signup inheriting the pre-account language.
- [x] Translator: let the user select other language pairs beyond the
  default. Done 2026-07-05: the translator toolbar has a gear button that
  opens a curated language picker (~10 languages: `es`, `ht`, `fr`, `pt`,
  `it`, `de`, `zh`, `ar`, `ru`, `vi`; English excluded — it's always the
  other side of the pair). Selecting language X sets the toolbar to
  X → EN / EN → X, persisted in localStorage (`misterf_translator_lang`)
  so the UI always shows the last choice, defaulting to Spanish. The
  server contract is now language-agnostic (`auto`/`to-english`/
  `from-english` + a language code resolved against
  `i18n/translatorLanguages.ts`, injected to the client as
  `window.__TRANSLATOR_LANGUAGES__`). Not done: seeding the initial
  default from the profile's instruction language (moot for `en`
  profiles, since English is excluded) — the persisted choice governs
  instead.
- [x] Tutor and LLM surface: parametrize system prompts, block protocol
  copy, evaluation feedback, and AI authoring (quiz/guide/roleplay
  generation and revision) by instruction language. Started 2026-07-04:
  conversations snapshot `instruction_language` at creation; the tutor
  system prompt is parametrized via language packs
  (`tutor/language-rules/{es,en}.md` + `languagePack.ts`) with the `en`
  pack monolingual and translation blocks excluded from the `en` block
  set; correction and block-repair prompts follow the conversation
  language. Block-doc JSDoc is now parametrized too: every generic
  learner-facing field across `tutor/blocks/*.md` authors in the
  instruction language, and the `TutorResponseBlock` union drops the
  translation members for `en`. A golden snapshot test guards Spanish
  output byte-for-byte. Also 2026-07-04: the secondary LLM families are
  parametrized — quiz-result evaluation and tutor reports render in the
  learner's instruction language (threaded from the conversation
  snapshot or the attempt's profile), and resource-draft authoring
  (quiz/guide/roleplay draft + revision) plus roleplay evaluation render
  in the authoring/reader profile's language. 2026-07-05: fixed the socket
  initial greeting for signed-in users to use the profile's instruction
  language (it previously always fell back to Spanish; the guest HTTP
  greeting already honored the locale). 2026-07-05: the two remaining
  gaps are closed — the Spanish-only quiz item kinds
  (`quiz_translate_to_english`, `quiz_understand_in_spanish`) are now
  excluded from the non-Spanish quiz protocol (fragment + registry
  union), and block-repair leakage detection is language-aware
  (per-language `es`/`en`/`ht` pattern sets threaded from the
  conversation snapshot). This item is complete.
- [x] Transactional surfaces: emails, legal pages, and error pages in both
  languages. Done 2026-07-04: verification and password-reset emails
  render in the recipient's resolved locale (`email.*`), the privacy and
  terms pages are fully translated (`legal.*`), and error surfaces (the
  global 500, superadmin 404s, and Google-OAuth failures) resolve through
  the catalog. Server-side flash/validation/status/authoring messages
  across the auth, quiz, roleplay, practice-guide, credits, progress, and
  superadmin handlers are localized too (`msg.*`, threaded via the request
  locale or the conversation snapshot). Documented residuals: relative-time
  formatting, a few context-less socket edges (pre-auth prompt, ES–EN
  translator, not-found paths), progress-overview summaries, and stored
  default names (`Nueva conversación`, `Perfil principal`) — all deeper
  non-request layers, tracked for a follow-up.
- [x] English translation pass over the full catalog, reviewed against the
  product glossary (`Recursos`/`Resources`, `Guías de Práctica`/`Practice
  Guides`, etc.). Done 2026-07-04: translations were authored inline per
  surface with consistent glossary terms; a whole-tree sweep (accented and
  accent-free) confirms no learner-facing Spanish literals remain outside
  the intentional `Español` endonym and the documented residuals above.
- [x] Manual QA: full product walkthrough in English (signup → onboarding →
  tutor session → quiz → shared resource) and regression walkthrough in
  Spanish. Done 2026-07-06: manual walkthrough completed in English with the
  Spanish regression pass; automated coverage (typecheck, 156 tests, per-view
  render smokes in both locales) is green.
- [x] Language registry + Haitian Creole (`ht`) as a full instruction
  language. 2026-07-05: the multilingual config was consolidated into a
  single registry (`src/server/i18n/languages.ts`) — `Locale`,
  `supportedLocales`, the UI catalogs, the language pickers/switcher (now a
  loop), and the tutor language packs all derive from it, and the
  `instruction_language` DB `CHECK` was dropped in favor of app-level
  validation (migration 16), so adding a language needs no schema change.
  `ht` (Kreyòl ayisyen) was added end to end: registry entry, a complete
  `locales/ht.ts` (every namespace, no English fallback), a
  `language-rules/ht.md` support-language pack with an anti-French rule, ht
  greetings, and language-aware block-repair patterns. It is a support
  language (Creole explanations) but uses the monolingual block set because
  the two translation blocks are Spanish-hardcoded. Shipped out of beta
  2026-07-05 (experimental flag removed). Recommended follow-ups, non-
  blocking: a fluent-speaker review of high-visibility/legal copy and a
  tutor-quality eval set for Haitian scenarios. Guide:
  [i18n architecture](../architecture/i18n.md).

## 1.2 Comprehension Exercises — moved to V3

Moved 2026-07-06 to [Roadmap V3](roadmap-v3.md) (Part 1.1). This pillar
(reading, listening, and image comprehension) was scoped out of V2 so V2 can
ship as the internationalization release. The i18n prompt parametrization it
depended on shipped in V2, so V3 can proceed without double work.

---

# Part 2: Engineering And Quality

Carried over from Roadmap V1, Part 3 (moved here 2026-07-04). The "static
manual quiz JSON for development" item was reframed as a resource
import/export product idea and moved to the idea inbox
([issues/incomming.md](../issues/incomming.md)).

- [x] Prompt-contract fixtures that validate representative generated quiz
  JSON (generation, single-block generation, revision, and evaluation)
  without a live model. Done 2026-07-04:
  `tests/server/quizAuthoringContracts.test.ts` with fixtures in
  `tests/server/fixtures/quizAuthoringFixtures.ts` — valid outputs for all
  nine item kinds, broken-output recovery through the correction loop,
  clean exhaustion, and prompt-schema drift guards.
- [x] Deeper semantic review layer for structured tutor blocks
  ([Structured Block Post-Processing](../issues/completed/structured-block-postprocessing.md)).
  Done 2026-07-06 for V2 scope: the three-layer pipeline (hard validation →
  deterministic semantic lint → model repair) was already shipped and
  language-aware; this pass added the multi-exercise batch guard
  (`detectMultiExerciseBatch` — at most one top-level interactive exercise
  per response, extras consolidated into a single `quiz` via the repair
  loop) with regression fixtures, and fixed a stale Spanish-only line in
  the repair prompt. The always-on message classifier was deferred to
  Roadmap V3 with a data prerequisite (quantify linter miss rate from
  production logs).
- [ ] [UI Style Consistency Audit](../issues/ui-style-consistency-audit.md):
  semantic CSS class naming pass across the app.

## 2.1 Prompt & Agent-Loop Audit Fixes

Added 2026-07-06 from a full audit of `system-prompts/` against every call
site and of the seven LLM loops (tutor agent loop, block repair, quiz
evaluation, tutor reports, resource drafts, roleplay turns/evaluation,
translator). Fix before the `2.0.0` release; items are independent unless
noted.

Bugs:

- [x] Quiz follow-up context never reaches the tutor:
  `tutor/quiz-attempt-context.md` still uses `{{ASSIGNMENT_*}}` placeholders
  while `llmTutor/prompt.ts` injects `QUIZ_*` (rename miss from the
  Tarea→Quiz commit `032f0629`), so the model receives literal
  `{{ASSIGNMENT_TITLE}}` etc. and works without the quiz title/topic/
  snapshot. Done 2026-07-06: prompt file renamed to `QUIZ_*`, plus a
  fully-loaded system-instruction regression test (all contexts × three
  languages) asserting no leftover `{{PLACEHOLDER}}` remains — this also
  covers part of the "regression test" item below.
- [x] `shouldUseTemperature` (`llmTutor/providers.ts`) matches
  `/^(gpt-5|o[134]|o4)/i` against vendor-prefixed OpenRouter ids
  (`openai/gpt-5-mini`), so it never excludes anything and `temperature`
  is always sent; `o4` is also redundant with `o[134]`. Done 2026-07-06:
  matches the model segment after the vendor prefix, redundant `o4`
  dropped, unit tests added (`tests/llmTutor/providers.test.ts`).
- [x] `continueTutorResponseAfterToolUse` (`llmTutor/index.ts`) sends only
  the internal-continuation prompt + tool results — it drops the
  conversation history, so the re-emitted response cannot address what the
  learner actually said. Related nit: the finish-reason check reads
  `effectiveResult.finishReason` but throws with `result.finishReason`.
  Done 2026-07-07 by removal instead of repair: the continuation was a
  second, weaker repair mechanism overlapping the structured-correction
  retry (which already re-runs the turn with full history), so the branch
  now logs the invalid output and falls through to that retry.
  `continueTutorResponseAfterToolUse`, `tutor/internal-tool-continuation.md`
  and the `effectiveResult` split were deleted; the generateText inventory
  in `llmCreditGateArchitecture.test.ts` dropped to 3 calls for `index.ts`.

Dead code / loose ends:

- [x] Delete `llmTutor/challenges/` (dialogueScene/produceEn/understandEn
  `challenge_started` schemas — imported nowhere, block type doesn't exist
  in the protocol). Done 2026-07-07.
- [x] Remove the unused `toTutorBlockProtocolNames` export
  (`llmTutor/blockProtocol.ts`). Done 2026-07-07 (with its now-unused
  name set).
- [x] Remove the dead `renderTutorSystemPrompt` fallback in
  `llmTutor/prompt.ts` that rebuilds the Structured Response Protocol
  section when `system.md` lacks `{{BLOCK_PROTOCOL}}` (it has it; the guard
  contradicts the AGENTS.md no-defensive-guards rule). Done 2026-07-07:
  inlined to a direct `renderSystemPrompt` call; a missing placeholder now
  fails visibly via the placeholder regression test instead of being
  silently patched. Spanish golden snapshot unchanged.
- [x] Deduplicate conversation-title helpers: `normalizeConversationTitle`
  reimplemented in `chatSocket.ts`, generic-title check triplicated across
  `conversationTitles.ts` / `chat/handlers.ts`. Done 2026-07-07: both files
  now import the canonical helpers from `conversationTitles.ts` (the
  handlers copy was already out of sync — missing two generic variants),
  and the canonical generic-title list gained the missing `ht` defaults
  (`Nouvo konvèsasyon` / `Konvèsasyon`), with a unit test fixing the
  three-language variants.
- [x] Minor: `Math.max(recentEventLimit ?? 5, 30)` in
  `llmTutor/progressTools.ts` is always 30 (limit caps at 10); the
  `rawFinishReason` parameter of `getUserFacingFinishReasonMessage` is
  never passed by any call site. Done 2026-07-07: the events query is a
  plain `limit: 30` with a comment on the recency window, and the
  Gemini-era `rawFinishReason` parameter (raw `MAX_TOKENS`/`SAFETY`
  string checks) was removed from the signature and the three call
  sites; the metadata `RECITATION` check stays.

i18n hardening (tutor/LLM surfaces beyond the documented catalog residuals):

- [x] `update_conversation_title` tool description hardcodes "Short
  Spanish title" for every profile, contradicting the per-language
  `conversationTitleRule` in the system prompt; thread `instructionLanguage`
  into `buildTutorConversationTools`. Done 2026-07-07: the title field
  description now embeds the registry's `conversationTitleRule` for the
  conversation's language (same source as the system prompt, so the two
  halves of the contract cannot diverge), threaded from
  `runTutorAgentLoop`; test asserts the es/en/ht variants.
- [x] `blocksToMarkdown` (`llmTutor/validation.ts`) hardcodes Spanish
  fallback strings ('Revisemos esta parte:', 'Ejercicio de emparejar.',
  'Ordena las oraciones.', 'Traduce al ingles:', 'Resumen del quiz'); the
  text is persisted as message content and feeds the tutor-report
  transcript and conversation previews (the model chat history uses the
  blocks JSON, not this content). Done 2026-07-07: strings moved to a
  `tutorBlocks.*` catalog namespace (es byte-identical, en/ht authored)
  and `blocksToMarkdown` takes the conversation locale, threaded from
  `runTutorAgentLoop`; covered by `tests/llmTutor/blocksToMarkdown.test.ts`.
- [x] `get_learner_progress` builds vocabulary with a hardcoded `'es'`
  locale (`llmTutor/progressTools.ts`). Done 2026-07-07:
  `buildTutorProgressTools` takes `instructionLanguage` (threaded from
  `runTutorAgentLoop`, same pattern as the title tool) so vocabulary
  source labels render in the conversation language. The Spanish
  "bitácora" trigger word in the tool description stays — it is a
  learner-phrase trigger, not learner-visible text.
- [x] Remaining hardcoded-Spanish learner-facing strings in LLM flows:
  tool status label in `chatSocket.ts` ('Ejecutando herramienta…'),
  `buildQuizResultTitle` ('X/Y respuestas correctas') and the fallback
  feedback in `quizzes.ts`, and the Spanish seed prompts in
  `resourceFromContext.ts`. Done 2026-07-07, wider than listed: the
  learner-visible strings (tool status, quiz result title/fallbacks —
  including the socket copy with 'Quiz completado' — and the stored
  "Creé …" resource-link chat message with its type labels) moved to
  `msg.*` catalog keys threaded with the conversation/request locale;
  the model-facing seed text (`resourceFromContext` intros, context
  labels in the chat/quiz/roleplay handlers, transcript speaker tags)
  was rewritten in English per the meta-prompt convention.
- [ ] `tutor/quiz-result-evaluation.md` rules still hardcode Spanish as the
  support language ("Do not evaluate Spanish grammar…") even when
  `INSTRUCTION_LANGUAGE_NAME` is Haitian Creole.

Protocol/loop consistency:

- [ ] `system.md` counts `dialogue_character_message` as a learner exercise
  block but the repair loop's `interactiveExerciseBlockTypes` does not —
  decide which is right and align contract + detector.
- [ ] A valid response consisting only of `tutor_plan`/`tutor_plan_update`
  yields empty `blocksToMarkdown` content and is rejected as "empty
  response" in `chatSocket.ts` — cover plan blocks in the markdown
  fallback or enforce the message+plan pairing in validation.
- [ ] Loop robustness parity: roleplays/resourceDrafts/tutorReports loops
  use bare `JSON.parse` (no ```json fence tolerance) and never check
  `finishReason`, unlike the tutor and quiz-evaluation loops; also
  `practice-guide-draft-correction.md` lacks `INSTRUCTION_LANGUAGE_NAME`
  while its revision twin has it.
- [ ] Regression test: render every prompt with its real placeholder set
  and fail on any leftover `{{PLACEHOLDER}}` (would have caught the
  `ASSIGNMENT_*` bug; `promptContracts.test.ts` only spot-checks
  `DIALOGUE_AVATAR_OPTIONS` today).

---

# V2 Exit Criteria (Draft)

- [x] A new user can complete the full product experience with English as
  the instruction language, and Spanish behavior is unchanged. Met
  2026-07-06 with the 1.1 manual QA walkthrough (English + Spanish
  regression) on top of the completed i18n initiative.
- [x] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass;
  new prompt surfaces have regression fixtures. Green 2026-07-06 (typecheck
  clean, `test:typecheck` clean after fixing the migration-test `up?`
  guards, 156 tests passing). Re-verify before the 2.0.0 release.
- [ ] Deployed to production as `2.0.0` per the versioning policy
  (`versioning-and-releases` skill).
