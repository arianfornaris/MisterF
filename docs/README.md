# Mister F Documentation

This folder contains system-level documentation for the Mister F web application.

The goal of this documentation is to make the project easier to understand for:

- developers joining the codebase
- AI agents working on later tasks
- maintainers who need a fast architectural map before changing behavior

## Release Planning

- [Roadmap V1](./roadmap-v1.md): the single planning document for the first
  production version; records all completed initiatives, the remaining work,
  and the post-V1 deferrals, referencing the owning tracker for each item

## Structure

### Architecture

Use `architecture/` for documents that explain how the system is organized and
how the main technical pieces fit together.

- [System Overview](./architecture/system-overview.md): product domains, major subsystems, and runtime boundaries
- [Architecture](./architecture/architecture.md): server/client organization, routing, persistence, prompts, and real-time chat runtime
- [Data Model](./architecture/data-model.md): core entities stored by the application and how they relate
- [Feature Flows](./architecture/feature-flows.md): end-to-end flow descriptions for the most important user journeys
- [Prompts](./architecture/prompts.md): prompt families and what each prompt is responsible for
- [Testing](./architecture/testing.md): Vitest standard, commands, and tutor-loop regression fixture guidance

### Tutor

Use `tutor/` for documents focused on the Mr. F tutor runtime and tutor-specific
interactive behavior.

- [Tutor Runtime](./tutor/runtime.md): how Mr. F conversations, tools, structured outputs, exercises, and quiz evaluation work
- [Tutor Visible Plans](./tutor/visible-plans.md): visible teaching plan blocks, validation, persistence, and runtime behavior

### Features

Use `features/` for product areas, feature concepts, and future feature ideas.

- [Chat Rooms](./features/chatrooms.md): archived notes for the removed chat room feature
- [Teacher-Assigned Practice](./features/teacher-assigned-practice.md): AI-assisted `Quizzes` workflow for human teachers and students, including free guest evaluation and account-based follow-up practice
- [Roleplays](./features/roleplays.md): reusable free-form roleplay resources with evaluated learner English production
- [Resource Simplification V2](./features/resource-simplification-v2.md): planned simplification from separate resource areas into one `Recursos` catalog with quizzes, practice guides, folders, and roleplays
- [Home Start Experience](./features/home-start-experience.md): exploration of personalized start suggestions and a built-in practice topic library
- [Payments](./features/payments.md): Stripe payments, credits, OpenRouter balance, and fulfillment rules
- [Writing Practice Ideas](./features/writing-practice-ideas.md): writing-first practice patterns that use `open_text_prompt` for structured open responses

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
inbox. Implementation trackers for completed initiatives were consolidated into
[Roadmap V1](./roadmap-v1.md); their task-level history lives in git.

- [Incoming Ideas](./issues/incomming.md): idea inbox for unshaped product notes
- [Home Suggestions Tracker](./issues/home-suggestions-tracker.md): design tracker for personalized home and new-chat practice suggestions (post-V1)
- [V1 LLM, Credit, And Payment Guardrails](./issues/v1-llm-credit-payment-guardrails.md): inventory of server-side LLM calls and their credit/fulfillment guardrails
- [Block Input Standardization](./issues/block-input-standardization.md): which tutor blocks own their input UI versus use the chat composer
- [Structured Block Post-Processing](./issues/structured-block-postprocessing.md): current repair loop and future deeper semantic review ideas for tutor block output
- [Message Block Task Leakage](./issues/message-block-task-leakage.md): observed and repaired patterns where `message` blocks leak exercise payloads that should be typed blocks
- [UI Style Consistency Audit](./issues/ui-style-consistency-audit.md): future audit for shared CSS, semantic class names, and app-wide UI consistency

## Scope

This documentation describes the current implementation centered in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts`

It does not attempt to document every helper or every CSS rule. Instead, it focuses on the pieces that matter when changing product behavior or debugging system flows.
