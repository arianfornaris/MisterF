# Mister F Documentation

This folder contains system-level documentation for the Mister F web application.

The goal of this documentation is to make the project easier to understand for:

- developers joining the codebase
- AI agents working on later tasks
- maintainers who need a fast architectural map before changing behavior

## Documents

- [System Overview](./system-overview.md): product domains, major subsystems, and runtime boundaries
- [Architecture](./architecture.md): server/client organization, routing, persistence, prompts, and real-time chat runtime
- [Data Model](./data-model.md): core entities stored by the application and how they relate
- [Tutor Runtime](./tutor-runtime.md): how Mr. F conversations, tools, structured outputs, exercises, and quiz evaluation work
- [Prompts](./prompts.md): prompt families and what each prompt is responsible for
- [Structured Block Post-Processing](./structured-block-postprocessing.md): future deeper semantic review ideas for tutor block output
- [Message Block Task Leakage](./message-block-task-leakage.md): observed and repaired patterns where `message` blocks leak exercise payloads that should be typed blocks
- [Tutor Visible Plans](./tutor-visible-plans.md): visible teaching plan blocks, validation, persistence, and runtime behavior
- [Feature Flows](./feature-flows.md): end-to-end flow descriptions for the most important user journeys
- [Visual Design](./visual-design.md): theme philosophy, Bootstrap usage, and custom color token rules
- [Writing Practice Ideas](./writing-practice-ideas.md): future writing-first practice patterns

## Scope

This documentation describes the current implementation centered in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts`

It does not attempt to document every helper or every CSS rule. Instead, it focuses on the pieces that matter when changing product behavior or debugging system flows.
