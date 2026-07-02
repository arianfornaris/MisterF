---
name: ai-authoring-chat-conventions
description: Use when adding, editing, or reviewing Mister F AI-assisted resource authoring, including AI draft generation from a prompt, AI chat revision tabs, authoring history persistence, revision prompts, or pending-generation modals for quizzes, roleplays, and practice guides.
---

# AI Authoring Chat Conventions

Use this skill with `llm-credit-gate` (every authoring inference runs on the
author's credit-gated key), `bootstrap-tabs-conventions`, and
`bootstrap-modal-conventions`.

## Core Rules

- Authoring pages use tabs: `General` for metadata fields plus type-specific
  editing tabs (for example `Bloques` for quizzes), and `AI chat` for
  conversational revisions.
- A resource is first created from a natural-language prompt through an AI
  draft flow (`generate-draft` style endpoints backed by
  `services/resourceDrafts.ts`), then revised in place.
- Authoring chat history is persisted on the resource itself in
  `authoring_messages_json` (quizzes and roleplays). Do not add separate
  revision-history tables unless a feature genuinely needs them.
- Pass the stored authoring history into each revision inference so the model
  sees prior instructions and its own replies.
- Each revision returns an assistant reply for the chat plus structured JSON
  changes that are validated and applied to the resource draft. Invalid model
  output goes through the matching `*-correction.md` retry prompt before
  failing.
- Authoring history messages store `role`, `content`, `createdAt`, and an
  optional `draftSnapshot` of the applied result.
- While a generation/revision is pending, show the pending state inside the
  modal and keep the modal scrolled so the user sees progress; do not close
  the modal until success or a visible error.
- Credit exhaustion is product UI, not a raw error: reuse the existing
  `*CreditExhausted` view flags and buy-credits messaging.
- System prompts for authoring live in `system-prompts/resources/`; follow
  `system-prompt-coherence` when editing them.

## Checks Before Finishing

- Verify history round-trips: generate, revise twice, reload the page, and
  confirm the chat shows all turns.
- Verify the correction prompt path still parses when the main prompt changes
  shape.
- Add or update service tests for validation and history append behavior.
- Run typecheck/tests and restart the local server when server or view code
  changed.
