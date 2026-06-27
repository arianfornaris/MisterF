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
- `structured-correction.md`: repair prompt for invalid tutor structured output
- `block-repair.md`: repair prompt for schema-valid tutor output that leaks exercise payloads into `message`
- `internal-tool-continuation.md`: continuation prompt after tool calls
- `profile-context.md`: teacher-only context block with learner-authored profile background
- `practice-module-context.md`: context block for tutor conversations started from a practice module
- `chatroom-report-context.md`: context block for tutor conversations started from a chat room report
- `chatroom-report-start.md`: one-shot internal first-turn nudge for conversations created from a chat room report
- `tutor-report-context.md`: context block for tutor conversations started from a finalized tutor conversation report
- `tutor-report-start.md`: one-shot internal first-turn nudge for conversations created from a finalized tutor report
- `visible-plan-context.md`: teacher-only context with the current fused visible tutor plan
- `translator.md`: prompt for translator mode
- `quiz-result-evaluation.md`: prompt for structured quiz result assessment
- `quiz-result-evaluation-correction.md`: repair prompt for invalid quiz result evaluation output
- `conversation-report.md`: turns a finalized tutor conversation transcript into a structured progress report
- `conversation-report-correction.md`: repair prompt for invalid tutor conversation report output
- `report-to-practice-module.md`: turns a tutor conversation report into a practice module draft
- `report-to-practice-module-correction.md`: repair prompt for invalid report-to-module output

Tutor block protocol files live in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/tutor/blocks`

Those files are the source of truth for tutor response block documentation.
`blockProtocol.ts` composes them into the main tutor system prompt, structured
correction prompt, and block repair prompt. Block-level rules should be written
next to the TypeScript-like interface for that block, not duplicated in
`system.md`.

The global tutor prompt may keep a short block separation rule, but exact
boundaries such as what `message` may not contain belong in the relevant block
JSDoc. Correction and repair prompts should defer to the injected protocol
instead of carrying their own long copies of block-specific rules.
The tutor structured-correction prompt must not maintain a manual valid-block
list; valid model-emitted blocks are exactly the block union from the injected
tutor protocol.
The block repair prompt should prefer conservative typed repair and preserve
the original blocks only for false positives or when repair would require
inventing missing content.

Tool continuation prompts must treat teacher-only context envelopes as external
app context. Envelopes marked with `audience: "teacher_only"` and flags such as
`notUserMessage` or `notAssistantMessage` are not chat transcript and must not
be attributed to the learner or to Mr. F.

Report-based tutor conversations separate persistent context from first-turn
behavior:

- `chatroom-report-context.md` and `tutor-report-context.md` describe the stable
  conversation objective and remain safe to include on every turn.
- `chatroom-report-start.md` and `tutor-report-start.md` are one-shot internal
  messages used only when an empty report-seeded conversation auto-starts.
- Start commands such as "begin with..." or "start practicing..." should live in
  the one-shot start prompts, not in persistent report context prompts.

Normal tutor conversations do not use a generic one-shot `start-session` prompt.
The UI may show an ephemeral greeting before the learner writes, but the first
model turn should be grounded in the learner's actual message or in a
feature-specific one-shot context such as a report or practice-module start.

Learner profile context is persistent teacher-only background, not a one-shot
command. `profile-context.md` may include profile name, short description, and
learning context written by the learner. The tutor should use it quietly for
topic choice, examples, difficulty, and tone when useful, without quoting it
back or treating it as the learner's current message.

Internal tutor reasoning should avoid the plain word "plan" unless it refers to
the visible `tutor_plan` UI. Use terms such as "internal teaching hypothesis" or
"pedagogical direction" for the tutor's private adaptive reasoning. Reserve
"visible plan" for `tutor_plan`, `tutor_plan_update`, and the DB-backed fused
plan state.

Protocol labels are required inside JSON structure, especially `type`
discriminators. They must not appear in learner-visible text fields such as
`message.markdown`, prompts, titles, labels, options, or explanations.

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

Practice-module generation prompts are part of the tutor interaction contract.
Many practice modules are created by AI, so their `tutorInstructions` must avoid
phrasing that nudges Mr. F into batching several top-level exercise blocks in
one tutor response. For normal guided practice, generated module instructions
should describe sequential exercise progression: one item, feedback, then the
next item. If several items must be answered together, the generated
instructions should explicitly frame that section as a quiz, test, checkpoint,
or batch assessment.

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

There are two related repair categories:

- invalid structured output, handled by structured correction prompts
- valid JSON with the wrong block boundary, handled by `tutor/block-repair.md`

The block repair loop is intentionally narrow. It catches high-confidence
patterns such as blanks, translation prompts, open-ended writing prompts,
multiple-choice payloads, unscramble tasks, matching tasks, bracketed correction
markup, or raw evaluation JSON embedded inside a normal `message`.

### Model output is the source of truth

Do not silently rewrite, translate, or reinterpret learner-visible semantic
fields in the UI when the model could be instructed to produce the correct
output instead.

The preferred strategy is:

- make the prompt contract explicit
- validate structure at the schema boundary
- ask the model to repair invalid structure when needed
- render learner-visible labels as authored by the model

Client-side normalization is appropriate for UI mechanics such as whitespace,
layout, ordering, or disabled state. It should not be used to mask an imprecise
model contract for content the learner will read.

### No invented inline teaching formats

The model must not invent mini-formats inside `message` when a specialized block
exists. The detailed forbidden patterns and replacement blocks are documented in
the `MessageBlock` JSDoc inside
`misterf-web/system-prompts/tutor/blocks/message.md`.

## Important Current Conventions

### Quiz terminology

The tutor system prompt explicitly treats:

- quiz
- test
- exam
- prueba
- examen

as equivalent learner intents for a self-contained evaluation flow.

The tutor prompt also distinguishes quiz usage from regular exercises:

- `quiz` means an exam-style assessment, diagnostic check, or checkpoint review
- ordinary one-question practice should use regular top-level practice blocks
- the `quiz` schema requires at least 2 items so one-question checks do not
  become fake quizzes

### Quiz item kinds

Quiz item kinds are prefixed with `quiz_` for clarity and to avoid ambiguity with top-level block kinds.

This is an important convention because earlier designs were more prone to schema confusion between top-level blocks and quiz item types.

### Unscramble token ordering

For `unscramble_sentence` and `quiz_unscramble_sentence`, the model must provide
`tokens` in the correct order.

The client is responsible for shuffling those tokens for display and preserving
the original order as the answer key.

The model should not emit:

- pre-shuffled `tokens`
- `acceptableTokenOrders`
- a separate full-sentence answer field for the same task

This keeps the prompt contract simple and avoids duplicate sources of truth.

### Mandatory explanations for flagged quiz result annotations

The quiz result evaluation contract now expects concrete explanations for flagged errors or improvements rather than vague optional filler.

This supports the richer inline quiz result UI.
