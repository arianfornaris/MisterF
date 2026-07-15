---
name: ai-authoring-chat-conventions
description: Use when adding, editing, or reviewing Mister F AI-assisted resource authoring, including AI draft generation from a prompt, AI chat revision tabs, proposal preview modals, chat shortcuts from other tabs, authoring history persistence, revision prompts, or pending-generation modals for quizzes, roleplays, practice guides, and future resource types.
---

# AI Authoring Chat Conventions

Use this skill with `llm-credit-gate` (every authoring inference runs on the
author's credit-gated key), `bootstrap-tabs-conventions`, and
`bootstrap-modal-conventions`.

## Lifecycle

- A resource is first created from a natural-language prompt on an AI-first
  `new` page (`generate-draft` style endpoints backed by
  `services/resourceDrafts.ts`), then edited through manual fields plus the AI
  editing interaction chosen for that resource.
- Quizzes and practice guides currently use a `Chat IA` tab for conversational
  revisions. Roleplays intentionally do not: they expose one page-level
  `Modify with AI` proposal-and-approval modal.
- Manual editing and AI revision coexist. Reuse one conversational revision
  pipeline for resources that expose authoring chat. A resource may instead
  use a dedicated preview/apply endpoint pair when its UI has a deliberately
  bounded proposal-and-approval flow, as roleplays do.
- Modification previews receive the author's requested change and the complete
  current form state, including unsaved edits. They must not persist the
  resource or authoring history before approval. A flow may either apply values
  to the form for a later normal save or hold a complete proposal server-side
  and commit it through an explicit approval endpoint.

## Conversational revision pipeline (server)

- For resources with `Chat IA`, use one revise endpoint per resource:
  `POST /<resource>/:id/edit/revise` taking
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
  `authoring_messages_json` (currently quizzes and practice guides). The
  roleplay column may remain for backward-compatible reads, but AI
  roleplay modifications do not append to it. Do not add separate
  revision-history tables unless a feature genuinely needs them.
- History messages store `role`, `content`, `createdAt`, and an optional
  `draftSnapshot` of the applied result so the model can resolve references
  like "vuelve a la versión anterior".

## Chat UX (client)

- When a resource exposes `Chat IA`, it must feel like a normal Mister F
  conversation, never a
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

## Proposal And Approval UX (Roleplay)

- Use one page-level button labeled `Modify with AI`; it does not call the model
  immediately.
- The button opens a Bootstrap modal with a required modification request,
  contextual example, cancel action, and immediate generation progress.
- Send the complete unsaved roleplay draft as context and allow the model to
  revise any authoring field.
- Hold the complete proposed draft in a bounded server-side preview store keyed
  to user, profile, and resource. Return an opaque preview id plus a list of
  changed fields; never trust a replacement draft posted back by the browser.
- Show only changed fields in a responsive before/after comparison. Render
  Markdown-capable descriptions through the shared safe renderer and represent
  avatar changes visually.
- Approval posts only the opaque preview id, rejects expired or stale proposals,
  atomically writes the proposed draft, and reloads the edit page from the
  database. Close/cancel discards the proposal.
- Keep failures and credit-exhaustion recovery inside the modal. Do not expose
  a roleplay authoring chat, persist a chat turn, or retain superseded revise
  routes.

## Checks Before Finishing

- For resources with authoring chat, verify history round-trips: generate,
  revise twice, reload the page, and confirm the chat shows all turns.
- For resources with authoring chat, verify the revise endpoint still handles
  both modes: fetch with `Accept: application/json` and a plain form POST.
- For proposal previews, verify the request includes unsaved fields, the
  comparison contains only actual differences, the database remains unchanged
  before approval, and apply/discard/stale ids have the expected persistence
  behavior.
- Verify the correction prompt path still parses when the main prompt changes
  shape.
- Add or update service tests for validation and history append behavior.
- Run typecheck/tests and restart the local server when server or view code
  changed.
