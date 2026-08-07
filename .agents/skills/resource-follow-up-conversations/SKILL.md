---
name: resource-follow-up-conversations
description: Use when adding, editing, or reviewing Mister F follow-up tutor conversations created from resource results, including "Practicar" actions on quiz/roleplay results and tutor reports, conversation source snapshots, follow-up context prompts, and "Crear recurso" from result surfaces.
---

# Resource Follow-Up Conversations

Use this skill with `resource-attempt-runtime` for the source results,
`llm-credit-gate` for the tutor conversation, and `system-prompt-coherence`
when editing context prompts.

## Core Rules

- Result surfaces (quiz result, roleplay result, tutor conversation report)
  offer a `Practicar` action that creates a Mr. F conversation seeded with
  that result (`POST /{quiz|roleplay}-attempts/:attemptId/practice`).
- Each follow-up conversation stores a frozen source snapshot in its
  `conversation_*_snapshots` table (`quiz_attempt`, `roleplay_attempt`,
  `tutor_report`, `practice_guide`). The conversation reads the snapshot, not
  the live source, so later changes never alter an existing chat.
- The conversation UI shows a visible link back to the source resource or
  result so the learner can return to what they practiced from. That line is
  rendered from `services/conversationOrigin.ts` at the top of the chat pane,
  for all four snapshot kinds; a new kind of derived conversation must be added
  there, or it will look like an ordinary chat. The chip links only while
  `findResourceAccessForProfile` still grants the viewer access, so an archived
  or unshared source is named but not linked.
- Follow-up context prompts live in `system-prompts/tutor/*-context.md`. They
  instruct the tutor to continue from the result's difficulties, not to
  restart the task, not to re-grade or dump the stored result back, and not to
  reveal the internal snapshot/JSON.
- The tutor conversation runs on the learner's own credit-gated key, like any
  other conversation.
- Result surfaces also offer `Crear recurso` backed by
  `services/resourceFromContext.ts`: it seeds AI authoring with that surface's
  context and redirects to the new resource. Keep both actions; they serve
  different intents.

## Checks Before Finishing

- Verify the snapshot is written at conversation creation and the conversation
  renders from it after the source is edited or archived.
- Verify the source link renders in the conversation for the changed flow.
- Verify the context prompt does not ask the model to introduce itself again
  or ask broad reset questions.
- Run typecheck/tests and restart the local server when server or view code
  changed.
