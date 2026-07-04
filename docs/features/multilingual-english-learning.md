# Multilingual English Learning Proposal

Status: V2 design review complete (2026-07-04); implementation in
progress. V2 implements the first step — English as the second instruction language
([Roadmap V2](../roadmap/roadmap-v2.md), section 1.1). Haitian Creole and
further support languages come after V2, on the architecture this document
describes. Decisions resolved so far are recorded in
[V2 Decisions](#v2-decisions) below; the rest of the document is the
original long-term proposal and stays as reference.

## V2 Decisions

Decisions made during the V2 design review. Where a decision diverges from
the long-term proposal below, the decision wins for V2.

### One profile field: `instruction_language` (2026-07-04)

The proposal below models three concepts (target language, support
language, interface locale) and suggests two profile fields
(`support_language` + `interface_locale`). V2 collapses the two
configurable ones into a single per-profile field, since with only `es`
and `en` a split adds cost without a use case:

- Field: `instruction_language` on `profiles`, BCP 47 tag, `'es' | 'en'`
  in V2 (`CHECK` constraint widened when a language is added). It governs
  both the UI chrome and the tutor's assistance/explanations.
- The name is deliberately not "native language": it is the language the
  user *wants instruction in* — a native Spanish speaker may choose
  English for immersion. UX copy should ask for a preference (e.g. "¿En
  qué idioma prefieres la interfaz y las explicaciones?"), not for the
  user's native language.
- Per-profile, not per-user, as argued in the proposal (shared accounts:
  families, classes, tutors managing learners with different home
  languages).
- Collected at profile creation: a required choice in the profile
  onboarding form and in the create/edit profile form. Editable at any
  time from profile settings; changes affect new tutor turns only
  (conversation snapshot behavior per the proposal's migration notes).
- Defaults: existing profiles migrate to `'es'`. New profiles where the
  question is not answered (onboarding is skippable) default from the
  request's `Accept-Language` (resolved to a supported language,
  fallback `'es'`).
- Anonymous / pre-login / shared-link visitors have no profile: see
  "First interaction language" below.
- Post-V2, if tutors need the app chrome in a different language than
  learner explanations, `interface_locale` can be added alongside,
  defaulting from `instruction_language`; nothing in V2 should preclude
  that split.

### First interaction language (pre-account) (2026-07-04)

What language a visitor sees before any account or profile exists
(landing, login, signup, legal pages, shared-resource links). Resolution
is a precedence chain, first match wins:

1. **Explicit choice**: a visible ES/EN language switcher on all public
   pages, persisted in a cookie (e.g. `lang`). No account required. This
   covers shared or mis-configured devices, common in the target
   audience.
2. **`Accept-Language` negotiation**: resolved against the supported
   languages (`es`, `en`). This silently gets the majority of visitors
   right — a Spanish-configured phone sees Spanish from the first page.
3. **Fallback `en`** when the header matches no supported language.
   Deliberately English, not Spanish: the typical no-match visitor is a
   Haitian user with a French or Haitian Creole browser locale — exactly
   the audience Spanish excludes — and English is the roadmap's base
   language.

Additionally:

- Public URLs accept a `?lang=es|en` query parameter that sets the cookie
  and redirects clean — lets marketing links and tutors share
  signup/resource links already in the recipient's language.
- **Continuity into the account**: at signup, the resolved pre-login
  language (cookie or negotiated) seeds the first profile's
  `instruction_language` default; profile onboarding then confirms it as
  an editable question. No language "jump" between signup and the
  product.
- Server-rendered pages set `<html lang>` to the resolved language.

### UI string strategy (2026-07-04)

Approved as proposed in "UI Localization Strategy" below: per-language
TypeScript dictionaries under `src/server/i18n/locales/` (`es.ts`,
`en.ts`), a `t` helper passed into EJS rendering, and client scripts
receiving their strings through page bootstrap data or `data-*`
attributes. No heavyweight i18n framework.

### Shared resources keep their authored language (2026-07-04)

The author decides the language a resource is created in (defaulting to
the authoring profile's `instruction_language`), and the resource is
shown exactly as authored to every reader, regardless of the reading
profile's language. No per-reader translation or adaptation layer in V2.
Ephemeral AI output generated around a resource and addressed to the
learner (e.g. quiz attempt feedback) is governed by the prompt
parametrization design, not by this rule.

### Prompt parametrization (approved 2026-07-04)

How LLM surfaces follow `instruction_language`. Grounded in the current
prompt architecture: versioned markdown prompts rendered through
`renderSystemPrompt(path, placeholders)` with `{{...}}` substitution,
and the tutor block protocol composed by `blockProtocol.ts` from
`tutor/blocks/*.md`.

- **Language packs, not duplicated prompts.** Prompt files stay
  single-source. Per-language material lives in a small pack: a markdown
  fragment per language (`system-prompts/tutor/language-rules/{es,en}.md`)
  injected as `{{LANGUAGE_RULES}}`, plus a TS module
  (`src/server/services/llmTutor/languagePack.ts`) mapping
  `instruction_language` → placeholder values (language name,
  learner-facing example phrases such as the direction-option examples)
  and block-set adjustments.
- **Parametrize, don't fork.** In `system.md` and the block docs,
  literal "Spanish"/Spanish sample phrases become placeholders
  (`{{INSTRUCTION_LANGUAGE_NAME}}` etc.). The tutor identity line stops
  saying "for Spanish-speaking learners". Invariant tutor-contract
  sections (block separation, correction gate, pedagogy) contain no
  language placeholders at all — same text for every language.
- **`en` pack is monolingual.** Per the roadmap scope note, the English
  pack's language rules lean on monolingual scaffolding (definitions,
  paraphrase, examples) instead of translation. `understand_in_spanish_prompt`
  and `translate_to_english_prompt` are enabled only by the `es` pack;
  the `en` pack ships without translation-based blocks. Translator mode
  is left untouched for now (stays Spanish–English regardless of
  profile); a dedicated roadmap item covers making it profile-aware
  with user-selectable language pairs.
- **Conversations snapshot the language.** `conversations` gets an
  `instruction_language` column set at creation from the profile,
  mirroring the existing `model_tier` snapshot. All tutor-turn prompt
  builders read the conversation snapshot, so historical conversations
  stay stable when the profile changes.
- **Which language governs which surface:**
  - Tutor conversation (system, corrections, repair, contexts, visible
    plans, reports): the conversation snapshot.
  - Resource authoring (quiz/guide/roleplay draft + revision): the
    language chosen by the author (default: authoring profile), stored
    with the resource per the shared-resources decision.
  - Ephemeral learner-addressed feedback (quiz result evaluation,
    roleplay evaluation): the learner's `instruction_language`, even on
    a resource authored in the other language — feedback is fresh output
    addressed to the learner, not stored resource content.
- **Rollout order:** (1) thread the language parameter through prompt
  builders with everything still hard-wired `es` (no behavior change);
  (2) tutor family (system + blocks + correction/repair) with the `en`
  pack; (3) secondary families (quiz evaluation, reports, resource
  drafts, roleplay, translator gating); (4) prompt-render regression
  fixtures per family: no unresolved `{{` placeholders, invariant
  sections present in both languages, `es` output unchanged
  (snapshot-guarded), `en` output free of translation-based blocks.

## Purpose

Mister F started as an English-learning app for Spanish-speaking learners. That
focus still matters, especially for Hispanic tutors in South Florida, but the
product should grow into a broader English-learning platform where learners can
receive support in their strongest language.

The most important near-term expansion is Haitian Creole because South Florida
has a large Haitian community, many Haitian learners need English for work,
school, immigration, health care, and daily life, and many tutors or program
coordinators may not speak Spanish.

This proposal describes how to convert the app from a Spanish-first tutor into
a multilingual English-learning product without losing the current Spanish
experience.

## Product Principle

The app should separate three concepts that are currently blended together:

- Target language: the language being learned. For this product, this remains
  English.
- Support language: the learner's strongest language for explanations,
  instructions, hints, UI copy, reports, and translations.
- Interface locale: the language used by app chrome, navigation, settings,
  profile forms, buttons, modals, and account pages.

For the first multilingual version, the target language should stay fixed as
English. The support language and interface locale should become configurable.

## Quality Bar

Multilingual support must preserve the current tutor quality. Selecting a
different support language must not make the tutor less adaptive, less
structured, less pedagogically rigorous, or less reliable than the Spanish
experience.

The architecture should treat language support as a controlled extension of the
existing tutor contract, not as a simplified translation layer. Every supported
language must preserve:

- the same adaptive tutoring behavior
- the same structured block discipline
- the same correction gate and retry expectations
- the same visible tutor plan quality
- the same exercise variety and sequencing
- the same report, progress, and saved-resource quality
- the same tool-use boundaries
- the same validation, repair, and telemetry standards

Language-specific prompt packs may adapt examples, explanations, contrastive
notes, common learner errors, and translation behavior, but they must not
weaken the underlying tutor protocol. If a support-language pack cannot meet
the same tutor-quality bar, it should not be enabled as a production language.

## Current State

The current app is structurally ready for a multilingual direction in some
areas:

- Profiles already scope learner preferences, model tier, learning context,
  conversations, practice guides, quizzes, resources, and progress.
- Tutor prompts are versioned markdown files rather than hard-coded strings.
- Tutor output uses structured blocks, which gives clear places to define
  language behavior.
- The translator is already a dedicated tutor service.
- Practice guides, quizzes, resources, tutor reports, and progress are
  profile-scoped, which makes language preference a natural profile-level
  setting.

The main limitation is that many contracts explicitly assume Spanish:

- `system-prompts/tutor/system.md` says the tutor is for Spanish-speaking
  learners and should speak Spanish by default.
- Many prompt files require Spanish learner-facing text.
- Tool descriptions require Spanish titles, descriptions, labels, and
  instructions.
- The visible tutor plan contract requires Spanish titles, summaries, and
  labels.
- Some block names encode Spanish, such as `understand_in_spanish_prompt`.
- The translator currently assumes Spanish-English directions.
- Server-rendered EJS views contain Spanish UI copy directly in templates.

This means the multilingual work should not be treated as only a translation
task. It is a product architecture change.

## Recommended Direction

Add multilingual support around a profile-level `supportLanguage` first, then
localize the full interface.

The learner experience can be multilingual before every admin or account page
is fully localized. This keeps the first version useful while avoiding a large
all-or-nothing rewrite.

Recommended first support languages:

- Spanish (`es`)
- Haitian Creole (`ht`)
- English (`en`) for learners who prefer English-only immersion or tutors who
  want the app interface and explanations in English

Future support languages can follow the same architecture.

## Proposed Data Model

Add language preferences to profiles, not only users.

Suggested profile fields:

- `support_language`: BCP 47-style language tag, initially `es`, `ht`, or `en`.
- `interface_locale`: BCP 47-style locale for app UI, initially defaulting from
  `support_language`.
- `target_language`: default `en`, reserved for future expansion.
- Optional `support_language_confidence`: learner-reported confidence in the
  support language, useful when a learner is multilingual.

Why profile-level:

- A single account may represent a family, class, tutoring practice, or shared
  device.
- Profiles already isolate progress and learning context.
- A tutor in South Florida may manage different learners with different home
  languages.

Migration behavior:

- Existing profiles should receive `support_language = 'es'`.
- Existing learner-facing Spanish resources should keep their original content.
- New conversations should snapshot the active profile language so historical
  conversations remain stable if the profile language changes later.
- New conversations should also snapshot the enabled tutor block set for that
  language so historical conversations remain renderable if language packs
  change later.

## Prompt Architecture Changes

Introduce a language context block injected into every tutor prompt.

Example fields:

- Target language: English
- Support language: Spanish, Haitian Creole, or English
- Interface locale
- Learner preference notes

The main tutor system prompt should no longer say "Spanish-speaking learners"
as a fixed identity. It should say that Mr. F teaches English and normally uses
the active profile's support language for explanations, scaffolding, reports,
and learner-facing metadata.

Replace hard-coded Spanish rules with parameterized rules:

- "Speak to the learner in `{{SUPPORT_LANGUAGE_NAME}}` by default."
- "Keep titles and learner-facing metadata in `{{SUPPORT_LANGUAGE_NAME}}`."
- "Use English for examples, target sentences, role-play dialogue, and phrases
  the learner is practicing."

Prompt files that generate reports, practice guides, quiz feedback, and chat-room
resources should receive the same language context. They should not carry
independent Spanish-only instructions.

The prompt architecture should include a small set of invariant tutor-contract
sections that cannot vary by support language. Language packs should add or
specialize support-language behavior around those invariants rather than
redefining them. This protects the tutor's reasoning quality when new languages
are added.

## Structured Block Changes

Use a shared core block protocol plus support-language block packs.

The current protocol renderer already accepts a selected block list, which is a
good foundation for this design. Instead of forcing every block to become fully
language-neutral, the tutor runtime can build the injected protocol from:

- Core blocks available to every learner.
- Target-language blocks available because the product teaches English.
- Support-language blocks enabled by the active profile.

Examples of core blocks:

- `message`
- `sentence_evaluation`
- `multiple_choice`
- `open_text_prompt`
- `fill_in_the_blank_input`
- `fill_in_the_blank_choice`
- `matching_pairs`
- `unscramble_sentence`
- `dialogue_character_message`
- `dialogue_transcript`
- `quiz`
- `tutor_plan`
- `tutor_plan_update`

Examples of English-target blocks:

- `translate_to_english_prompt` can stay because the target is English.

Examples of Spanish support-language blocks:

- `understand_in_spanish_prompt`
- Spanish-specific quiz comprehension items
- Spanish-specific translator modes when the support language is Spanish

Examples of Haitian Creole support-language blocks:

- `understand_in_haitian_creole_prompt`
- Haitian Creole-specific quiz comprehension items
- Haitian Creole-specific translator modes when the support language is Haitian
  Creole

This approach has a major product advantage: language-specific pedagogy can be
explicit where it helps. Spanish learners, Haitian Creole learners, and
English-only learners do not need to receive exactly the same block contract if
their support-language experience should differ.

The pack system should be additive and contract-preserving. A support-language
pack may add language-specific blocks or examples, but it must not remove core
blocks that are required for high-quality tutoring unless a replacement block
with equivalent pedagogical power is enabled.

Recommended path:

1. Keep current Spanish blocks working and treat them as the first support
   language pack.
2. Split protocol composition into core blocks, target-English blocks, and
   support-language packs.
3. Add a Haitian Creole support-language pack rather than renaming every
   Spanish block immediately.
4. Add language-neutral aliases only for blocks that truly are universal.
5. Snapshot enabled block names on new conversations if conversation history
   needs stable replay or repair.

Learner-visible labels, prompts, explanations, hints, and feedback should be
authored by the model in the active support language and validated only for
structure, not translated client-side.

## Translator Changes

Convert the translator from a Spanish-English tool into a profile-aware
translator.

Suggested modes:

- support language to English
- English to support language
- auto-detect between English and support language
- future: choose any installed support language

For Haitian Creole:

- Use "Haitian Creole" in English documentation and `ht` as the language code.
- In learner-facing Haitian Creole UI, use localized labels reviewed by a
  fluent speaker before release.
- Avoid assuming French and Haitian Creole are interchangeable.

## UI Localization Strategy

There are two layers of UI language:

- Product chrome: navigation, forms, buttons, modals, errors, empty states.
- AI-authored learning content: tutor messages, exercises, reports, resource
  descriptions, and feedback.

For product chrome, introduce a server-side translation helper for EJS views
instead of continuing to write copy directly in templates.

Suggested structure:

- `src/server/i18n/locales/es.ts`
- `src/server/i18n/locales/ht.ts`
- `src/server/i18n/locales/en.ts`
- `src/server/i18n/index.ts`

EJS pages would receive a `t` helper and render keys such as:

- `t('profiles.title')`
- `t('actions.saveChanges')`
- `t('chat.translator.title')`

For client scripts, expose a small locale dictionary in page bootstrap data or
use `data-*` attributes from server-rendered HTML. Avoid scattering hard-coded
Spanish strings across JavaScript.

## Tutor and Teacher Use Cases

The multilingual work should support two related audiences:

- Learners using the app directly.
- Tutors using the app as a teaching aid with learners from different language
  backgrounds.

Important tutor workflows:

- A tutor creates or switches to a learner profile.
- The tutor selects the learner's support language.
- The tutor can generate practice guides in that support language.
- The tutor can review progress reports in either the learner's support
  language or the tutor's interface locale.
- The tutor can use English-only mode when working with learners whose home
  language the tutor does not speak.

This suggests a future distinction between:

- learner support language
- tutor/admin interface locale
- report audience language

The first implementation can keep this simple by using the active profile
language everywhere learner-facing.

## Haitian Creole Release Considerations

Haitian Creole should be treated as a first-class support language, not as a
Spanish variant or a French fallback.

The release bar should be usefulness, clarity, and respect rather than perfect
academic Haitian Creole. Many Haitian learners are multilingual or comfortable
moving across Haitian Creole, English, French, and sometimes Spanish. That
linguistic flexibility is an advantage for an English-learning app, as long as
the tutor does not become careless or confusing.

This relaxed language-polish bar must not relax the tutor-quality bar. Haitian
Creole support can launch with iterative copy polish, but it should still
preserve the same tutoring intelligence, correction discipline, exercise
quality, report usefulness, and structured-output reliability as Spanish.

Recommended safeguards:

- Review core Haitian Creole UI strings with a fluent speaker when possible,
  especially high-visibility navigation, profile, translator, payment, and
  error copy.
- Create a small prompt evaluation set for common learner scenarios:
  greetings, workplace English, school parent communication, health care
  appointments, transportation, job interviews, and basic grammar explanations.
- Test that the model explains in Haitian Creole while keeping English practice
  sentences in English.
- Test that reports and practice guides do not drift into French unless the
  learner explicitly asks for French.
- Include examples of code-switching because many Haitian learners may mix those
  languages naturally.
- Treat occasional imperfect phrasing as acceptable during beta if the lesson
  remains understandable, respectful, and pedagogically useful.
- Provide a simple feedback path for Haitian learners and tutors to flag
  confusing wording so the prompt pack and UI dictionary can improve over time.

## Implementation Phases

### Phase 1: Language Preference Foundation

- Add profile language fields and migrations.
- Default existing profiles to Spanish.
- Add profile form controls for support language and interface locale.
- Add a language context helper used by tutor prompt builders.
- Update documentation to define target language, support language, and
  interface locale.

### Phase 2: Tutor Runtime Parameterization

- Replace hard-coded Spanish tutor prompt rules with language-context rules.
- Update tutor reports, report-to-practice-guide prompts, quiz evaluation prompts, and
  translator prompts to use support language.
- Update tool descriptions that currently require Spanish learner-facing text.
- Separate invariant tutor-contract rules from support-language prompt pack
  rules.
- Add tests proving Spanish remains unchanged for existing profiles.
- Add tests for Haitian Creole and English support-language profiles.

### Phase 3: Language-Aware Block Packs

- Split block protocol composition into core blocks, target-English blocks, and
  support-language block packs.
- Keep compatibility with existing Spanish-specific block names by treating
  them as the Spanish support-language pack.
- Add Haitian Creole-specific blocks where language-specific comprehension,
  translation, or explanation behavior is useful.
- Add language-neutral block names only where the interaction is genuinely the
  same across support languages.
- Update schema, validation, repair prompts, client renderers, and docs for
  pack-based block inclusion.
- Verify every support-language pack preserves the core tutor block capability
  set or provides equivalent replacements.
- Add migration or rendering compatibility only if historical conversations
  require it.

### Phase 4: Product Chrome Localization

- Add server-side locale dictionaries.
- Pass a `t` helper into EJS rendering.
- Convert high-traffic learner pages first:
  chat, profiles, resources, practice guides, quizzes, progress, auth,
  credits.
- Convert client-side strings through bootstrap dictionaries.
- Add missing-key checks in tests.

### Phase 5: Haitian Creole Launch Track

- Add Haitian Creole copy review for core UI and high-impact messages when
  available.
- Build prompt evaluation scenarios for Haitian learners.
- Run manual QA with Haitian Creole profiles.
- Add tutor-facing guidance for South Florida tutors using the app with
  Haitian learners.
- Release as a beta language only after the full tutor workflow preserves the
  Spanish-quality tutoring bar, even if some language polish remains iterative.

## Testing Strategy

Recommended automated coverage:

- Existing Spanish profile continues to receive Spanish explanations, labels,
  reports, titles, and saved-resource text.
- Haitian Creole profile receives Haitian Creole explanations, labels, reports,
  titles, and saved-resource text.
- English profile receives English explanations while still practicing English
  as the target language.
- English examples and practice answers remain in English regardless of support
  language.
- Translator mode uses English and the active profile support language.
- Profile language changes affect new tutor turns but do not corrupt historical
  conversation snapshots.
- UI locale keys render without missing labels on converted pages.
- Every support-language pack includes the required core tutor blocks or an
  explicitly approved equivalent.
- The same pedagogical regression scenarios pass for Spanish, Haitian Creole,
  and English support-language profiles: error correction, scaffolded retry,
  visible tutor plan progression, quiz feedback, report generation, and saved
  practice-guide creation.
- Prompt rendering tests prove invariant tutor-contract sections are present in
  every support-language prompt.

Manual QA:

- Create a Spanish profile and run a normal tutoring session.
- Create a Haitian Creole profile and run a workplace English session.
- Create an English support-language profile and run an English-only session.
- Generate a practice guide from each profile.
- Finalize a conversation and verify the report language.
- Open translator mode and test both directions.
- Compare Spanish and Haitian Creole sessions for the same learner scenario and
  verify that the Haitian Creole version preserves tutoring depth, pacing,
  correction quality, and next-step selection.

## Risks

- Prompt drift: the model may mix Spanish, Haitian Creole, French, and English
  unless language rules are explicit and tested.
- Schema naming debt: Spanish-specific block names will make future languages
  harder to reason about if they remain in core contracts.
- UI copy spread: direct template strings will become difficult to maintain if
  localization is not centralized.
- Tutor expectations: human tutors may want the app interface in English while
  learner explanations are in Haitian Creole or Spanish.
- Quality assurance: Haitian Creole output should be reviewed by humans because
  model fluency and orthography may vary.
- Capability regression: a new support-language pack could accidentally omit
  rules or blocks that make the Spanish tutor effective. This must be prevented
  through invariant prompt sections, block-pack tests, and cross-language
  pedagogical regression scenarios.

## Recommended First Milestone

The best first milestone is:

> A learner profile can choose Spanish, Haitian Creole, or English as its
> support language, and the tutor chat, translator, conversation titles, quiz
> feedback, tutor plans, and finalized reports honor that choice while the app
> continues teaching English.

This milestone delivers real value to Haitian learners and South Florida tutors
without requiring every page of the product chrome to be fully localized first.
