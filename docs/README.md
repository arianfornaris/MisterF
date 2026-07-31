# Mister F Documentation

This folder contains system-level documentation for the Mister F web application.

The goal of this documentation is to make the project easier to understand for:

- developers joining the codebase
- AI agents working on later tasks
- maintainers who need a fast architectural map before changing behavior

## Release Planning

Use `roadmap/` for release roadmaps. Each production version gets one roadmap
document that records its completed initiatives, remaining work, and
deferrals.

- [Roadmap V1](./roadmap/roadmap-v1.md): the first production version.
  **Complete — deployed to production (misterf.us) on 2026-07-02** with the
  clean database baseline.
- [Roadmap V2](./roadmap/roadmap-v2.md): the English-first internationalization
  release. **Shipped 2026-07-08 as `2.0.0`.**
- [Roadmap V3](./roadmap/roadmap-v3.md): the Teacher Pilot MVP — the full
  assigned-practice cycle, from a quiz made with the teacher's own material to
  the next-class report. **Released 2026-07-26 as `3.0.0`;** the document
  remains the living tracker for the rest of V3.
- [Roadmap V3.5](./roadmap/roadmap-v3-5.md): a single-purpose mini-roadmap for
  the public landing page and the entry-surface infrastructure it needs
  (routing, language editions, share previews, crawlability, conversion
  counts). Not a MAJOR bump — it ships as `3.x` MINOR releases.
- [Roadmap V4](./roadmap/roadmap-v4.md): the deferred backlog, waiting for
  pilot evidence before it is re-scoped.
- [Roadmap X](./roadmap/roadmap-x.md): work that is understood well enough to
  start and has been deliberately postponed, with the trigger that would pull
  each item into a real roadmap. Not a release, and not the idea inbox — an
  idea graduates here once it has been thought through and the deferral is a
  decision rather than neglect.

Other product-feature candidates live in the idea inbox,
[issues/incomming.md](./issues/incomming.md).

## Structure

### Business

Use `business/` for the Spanish-language strategic and commercial documentation
for Mister F. This directory is an intentional exception to the repository's
English documentation convention.

- [Business Documentation](./business/README.md): Spanish-language index for
  the business documentation
- [Founder Context](./business/contexto-del-fundador.md): founder profile,
  solo-operator constraints, strengths, and operating rules for every business
  plan
- [Initial Budget](./business/presupuesto-inicial.md): the founder-funded USD
  60 monthly operating constraint and financial discipline rules
- [Business Foundations](./business/fundamentos-del-negocio.md): initial
  vision, product entry points, audiences, principles, hypotheses, and open
  decisions
- [Business Roadmap](./business/negocio-roadmap.md): completed milestones,
  validation phases, business gates, and a suggested 90-day action plan
- [Competitive Research](./business/investigacion-de-la-competencia.md):
  Spanish-language competitive landscape, risks, opportunities, and
  positioning hypotheses
- [Teacher and Creator Referral Program](./business/programa-de-referidos-y-creadores.md):
  Spanish-language hypothesis for referrals, creator monetization, unit
  economics, risks, and low-cost validation

### Architecture

Use `architecture/` for documents that explain how the system is organized and
how the main technical pieces fit together.

- [System Overview](./architecture/system-overview.md): product domains, major subsystems, and runtime boundaries
- [Architecture](./architecture/architecture.md): server/client organization, routing, persistence, prompts, and real-time chat runtime
- [Data Model](./architecture/data-model.md): core entities stored by the application and how they relate
- [Feature Flows](./architecture/feature-flows.md): end-to-end flow descriptions for the most important user journeys
- [Prompts](./architecture/prompts.md): prompt families and what each prompt is responsible for
- [Internationalization](./architecture/i18n.md): how instruction-language support is structured and a checklist for adding a new language
- [Testing](./architecture/testing.md): Vitest standard, commands, and tutor-loop regression fixture guidance

### Tutor

Use `tutor/` for documents focused on the Mr. F tutor runtime and tutor-specific
interactive behavior.

- [Tutor Runtime](./tutor/runtime.md): how Mr. F conversations, tools, structured outputs, exercises, and quiz evaluation work
- [Tutor Visible Plans](./tutor/visible-plans.md): visible teaching plan blocks, validation, persistence, and runtime behavior

### Features

Use `features/` for product areas, feature concepts, and future feature ideas.

Every feature document MUST carry a `Status:` line directly under its title
so implemented behavior is never confused with proposals. The vocabulary is
closed: `implemented`, `partially implemented`, `proposal (not implemented)`,
or `retired`, followed by a dash and one or two sentences of context (what
shipped and when, what remains, or where the work is tracked). Partially
implemented documents must make clear which sections describe shipped
behavior and which are still ideas. Update the line whenever implementation
state changes.

- [Chat Rooms](./features/chatrooms.md): archived notes for the removed chat room feature
- [Teacher-Assigned Practice](./features/teacher-assigned-practice.md): AI-assisted `Quizzes` workflow for human teachers and students, including anonymous guest attempts evaluated on the student's own account
- [Roleplays](./features/roleplays.md): reusable free-form roleplay resources with evaluated learner English production
- [Resource Simplification V2](./features/resource-simplification-v2.md): the implemented simplification from separate resource areas into one `Recursos` catalog with quizzes, practice guides, folders, and roleplays
- [Home Start Experience](./features/home-start-experience.md): exploration of personalized start suggestions and a built-in practice topic library
- [Payments](./features/payments.md): Stripe payments, credits, OpenRouter balance, and fulfillment rules
- [Writing Practice Ideas](./features/writing-practice-ideas.md): writing-first practice patterns that use `open_text_prompt` for structured open responses
- [Comprehension Exercises](./features/comprehension-exercises.md): stimulus-plus-questions concept for reading, listening (server-side quality TTS), and image comprehension
- [Scene Media Library](./features/scene-media-library.md): proposal for a source-neutral `scene_media` block backed by built-in and user-generated scene media
- [Multilingual English Learning](./features/multilingual-english-learning.md): proposal separating target language, support language, and interface locale; English ships first in V2, Haitian Creole and others later
- [Roleplay Character Assets](./features/roleplay-character-assets.md): avatar registry and curated character library for roleplay resources

### Design

Use `design/` for visual design, UI conventions, and theme philosophy.

- [Visual Design](./design/visual-design.md): theme philosophy, Bootstrap usage, and custom color token rules

### Operations

Use `operations/` for runbooks, local/prod sync workflows, observability, and
runtime support procedures.

- [Sync Production To Development](./operations/sync-production-to-development.md): local production-data sync workflow for migration rehearsal
- [Client Error Telemetry](./operations/client-error-telemetry.md): browser critical-error reporting, deduplication, and server rate limits
- [Runtime Logging Policy](./operations/runtime-logging-policy.md): structured server logs, LLM trace modes, redaction, and production/debug expectations

### Issues

Use `issues/` for problem analysis, future-feature design detail, and the idea
inbox. Documents whose work has shipped move to `issues/completed/`.
Implementation trackers for completed initiatives were consolidated into
[Roadmap V1](./roadmap/roadmap-v1.md); their task-level history lives in git.

Open:

- [Incoming Ideas](./issues/incomming.md): idea inbox for unshaped product notes
- [Home Suggestions Tracker](./issues/home-suggestions-tracker.md): design tracker for personalized home and new-chat practice suggestions (post-V1)

Completed:

- [V1 LLM, Credit, And Payment Guardrails](./issues/completed/v1-llm-credit-payment-guardrails.md): inventory of server-side LLM calls and their credit/fulfillment guardrails
- [Block Input Standardization](./issues/completed/block-input-standardization.md): which tutor blocks own their input UI versus use the chat composer
- [Structured Block Post-Processing](./issues/completed/structured-block-postprocessing.md): the implemented repair loop and future deeper semantic review ideas for tutor block output
- [UI Style Consistency Audit](./issues/completed/ui-style-consistency-audit.md): the shipped semantic CSS class naming pass (app-page/app-form/authoring families) and its guard test
- [Message Block Task Leakage](./issues/completed/message-block-task-leakage.md): observed and repaired patterns where `message` blocks leak exercise payloads that should be typed blocks

## Scope

This documentation describes the current implementation centered in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts`

It does not attempt to document every helper or every CSS rule. Instead, it focuses on the pieces that matter when changing product behavior or debugging system flows.
