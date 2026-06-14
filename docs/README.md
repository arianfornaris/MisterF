# Mister F Documentation

This folder contains system-level documentation for the Mister F web application.

The goal of this documentation is to make the project easier to understand for:

- developers joining the codebase
- AI agents working on later tasks
- maintainers who need a fast architectural map before changing behavior

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

- [Chat Rooms](./features/chatrooms.md): multi-character chat room behavior and implementation notes
- [Payments](./features/payments.md): Stripe payments, credits, OpenRouter balance, and fulfillment rules
- [Writing Practice Ideas](./features/writing-practice-ideas.md): future writing-first practice patterns

### Design

Use `design/` for visual design, UI conventions, and theme philosophy.

- [Visual Design](./design/visual-design.md): theme philosophy, Bootstrap usage, and custom color token rules

### Issues

Use `issues/` for problem analysis, remediation plans, and living trackers for
known technical/product issues.

- [Tutor Loop Prompt Audit](./issues/tutor-loop-prompt-audit.md): prompt/runtime contradictions and cleanup plan for the tutor loop
- [Tutor Loop Remediation Tracker](./issues/tutor-loop-remediation-tracker.md): living implementation plan and status log for tutor-loop prompt/runtime fixes
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
