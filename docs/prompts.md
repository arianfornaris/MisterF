# Prompts

## Overview

Prompt source files are stored in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts`

The codebase keeps prompts as versioned markdown files rather than embedding large prompt strings directly in application code.

This makes prompts:

- easier to review
- easier to iterate on
- easier to compare across changes

## Prompt Families

### Tutor prompts

Folder:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/tutor`

Important files:

- `system.md`: main system instruction for Mr. F
- `start-session.md`: first-turn nudge for new tutor sessions
- `structured-correction.md`: repair prompt for invalid tutor structured output
- `internal-tool-continuation.md`: continuation prompt after tool calls
- `practice-module-context.md`: context block for tutor conversations started from a practice module
- `chatroom-report-context.md`: context block for tutor conversations started from a chat room report
- `translator.md`: prompt for translator mode
- `quiz-result-evaluation.md`: prompt for structured quiz result assessment
- `quiz-result-evaluation-correction.md`: repair prompt for invalid quiz result evaluation output

### Chat room prompts

Folder:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/chatrooms`

Important files:

- `master-group-chat.md`: main prompt for multi-character chat room conversations
- `conversation-report.md`: evaluates a finished room conversation into a report
- `conversation-report-correction.md`: structured repair prompt for report generation
- `report-to-practice-module.md`: turns a report into a practice module draft
- `report-to-practice-module-correction.md`: structured repair prompt for that conversion
- `user-message-evaluation.md`: evaluates a user message inside a chat room conversation
- `structured-correction.md`: generic repair helper for chat room structured outputs

### Resource generation prompts

Folder:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/resources`

Important files:

- `practice-module-draft.md`
- `practice-module-draft-correction.md`
- `chatroom-draft.md`
- `chatroom-draft-correction.md`

These are used when the app generates first drafts for user-editable resources.

## Design Principles

### Structured output first

The prompts are designed to produce structured JSON that maps to application block schemas, not just arbitrary conversational prose.

### Prompt separation by responsibility

The codebase does not use one universal prompt for all model tasks.

Instead, prompts are specialized by task:

- tutoring
- quiz result evaluation
- translation
- resource draft generation
- report generation

### Correction via the model

When output structure is wrong, the preferred strategy is:

- tell the model what validation failed
- ask it to re-emit corrected output
- retry a limited number of times

This is why correction prompts are first-class files in the repository.

## Important Current Conventions

### Quiz terminology

The tutor system prompt explicitly treats:

- quiz
- test
- exam
- prueba
- examen

as equivalent learner intents for a self-contained evaluation flow.

### Quiz item kinds

Quiz item kinds are prefixed with `quiz_` for clarity and to avoid ambiguity with top-level block kinds.

This is an important convention because earlier designs were more prone to schema confusion between top-level blocks and quiz item types.

### Mandatory explanations for flagged quiz result annotations

The quiz result evaluation contract now expects concrete explanations for flagged errors or improvements rather than vague optional filler.

This supports the richer inline quiz result UI.
