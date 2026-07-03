---
name: ai-authoring-chat-conventions
description: Use when adding, editing, or reviewing Mister F AI-assisted resource authoring, including AI draft generation from a prompt, AI chat revision tabs, chat shortcuts from other tabs, authoring history persistence, revision prompts, or pending-generation modals for quizzes, roleplays, practice guides, and future resource types.
---

# AI Authoring Chat Conventions

Use this skill with `llm-credit-gate` (every authoring inference runs on the
author's credit-gated key), `bootstrap-tabs-conventions`, and
`bootstrap-modal-conventions`.

## Lifecycle

- A resource is first created from a natural-language prompt on an AI-first
  `new` page (`generate-draft` style endpoints backed by
  `services/resourceDrafts.ts`), then edited on an authoring page with tabs:
  `General` for metadata, type-specific tabs when needed (for example
  `Bloques` for quizzes), and `Chat IA` for conversational revisions.
- Manual editing and AI revision coexist: the `General` tab saves fields
  directly, while every AI content change flows through the single revision
  pipeline. Do not add dedicated single-purpose generation endpoints (the old
  quiz "generate one block" pipeline was removed in favor of the chat).

## Revision pipeline (server)

- One revise endpoint per resource: `POST /<resource>/:id/edit/revise` taking
  a `message` field. It loads the stored authoring history, calls the
  `*-revision.md` prompt with `conversationHistory`, `currentDraft` (or
  current fields), and `requestedChange`, and expects
  `{ assistantMessage, <draft> }` back.
- Invalid model output goes through the matching `*-correction.md` retry
  prompt before failing. System prompts live in `system-prompts/resources/`;
  follow `system-prompt-coherence` when editing them.
- The endpoint is dual-mode: when the request `Accept` header includes
  `application/json` it answers `{ assistantMessage }` on success or
  `{ error, creditExhausted? }` with status 422 on failure; otherwise it
  keeps the redirect-to-chat-tab flow as the no-JS fallback. Both paths
  persist the turn (user + assistant messages, including failure messages).
- Authoring chat history is persisted on the resource itself in
  `authoring_messages_json` (quizzes, roleplays, practice guides). Do not add
  separate revision-history tables unless a feature genuinely needs them.
- History messages store `role`, `content`, `createdAt`, and an optional
  `draftSnapshot` of the applied result so the model can resolve references
  like "vuelve a la versión anterior".

## Chat UX (client)

- The `Chat IA` tab must feel like a normal Mister F conversation, never a
  blocking modal. Reuse `src/client/shared/authoringChatRevision.js`: mark the
  composer with `data-authoring-chat-form` (plus
  `data-authoring-chat-credits-return-to`) and the submit button with
  `data-authoring-chat-submit`; the history container uses
  `data-authoring-chat-history`.
- The module appends the teacher bubble, shows a `typing-caret` assistant
  bubble while waiting, then swaps in the assistant reply. Errors (including
  credit exhaustion, which adds a buy-credits link) render as assistant
  bubbles in the chat, not as page alerts.
- Composer keys match the main chat: Enter sends the message, Shift+Enter
  inserts a line break (ignore Enter while `event.isComposing`).
- Shortcuts from other tabs stage a message instead of duplicating pipelines:
  compose the chat message client-side, call `stageAuthoringChatMessage`, and
  navigate to the chat tab, where the staged message auto-submits through the
  normal flow (see the quiz "Agregar bloque" modal). The shortcut's form
  action keeps a server-side fallback that composes the same message and
  delegates to the revise handler.
- Blocking pending modals remain only for full-page generation flows (the
  AI-first `new` pages); keep that modal open until success or a visible
  error.
- Credit exhaustion is product UI, not a raw error: reuse the existing
  `*CreditExhausted` view flags and buy-credits messaging.

## Checks Before Finishing

- Verify history round-trips: generate, revise twice, reload the page, and
  confirm the chat shows all turns.
- Verify the revise endpoint still handles both modes: fetch with `Accept:
  application/json` and a plain form POST.
- Verify the correction prompt path still parses when the main prompt changes
  shape.
- Add or update service tests for validation and history append behavior.
- Run typecheck/tests and restart the local server when server or view code
  changed.
