---
name: ai-authoring-chat-conventions
description: Use when adding, editing, or reviewing Mister F AI-assisted resource authoring, including AI draft generation from a prompt, Modify-with-AI proposal preview modals, scoped quiz operations (metadata, per-block, add block, blocks+sections), revision prompts, authoring history persistence, or pending-generation modals for quizzes, roleplays, practice guides, and future resource types.
---

# AI Authoring Conventions (Proposal And Approval)

Use this skill with `llm-credit-gate` (every authoring inference runs on the
author's credit-gated key), `bootstrap-tabs-conventions`, and
`bootstrap-modal-conventions`.

History note (2026-07): resource authoring chats are fully retired. Scene
media dropped its chat on 2026-07-14, roleplays and practice guides on
2026-07-16, and quizzes on 2026-07-17 (live QA 2026-07-20). Every resource now
uses bounded proposal-and-approval modals. There is no authoring chat surface
in `src/` or `views/`, and the shared chat client modules
(`authoringChatRevision.js`, `authoringChatScroll.js`) were deleted. Do not
reintroduce an authoring chat for a resource without an explicit design
decision.

## Lifecycle

- A resource is first created from a natural-language prompt on an AI-first
  `new` page (`generate-draft` style endpoints backed by
  `services/resourceDrafts.ts`), then edited through manual fields plus
  scoped `Modify with AI` operations.
- Manual editing and AI revision coexist. Each AI operation is single-turn:
  request → preview → apply/discard. There is no conversational history sent
  to the model.
- Modification previews receive the author's requested change and the complete
  current form state, including unsaved edits. They must not persist the
  resource before approval. The complete proposal is held server-side and
  committed through an explicit approval endpoint.

## Scoped Quiz Operations (the reference implementation)

Quizzes expose four operations, each scoped to what the author already sees:

- **Metadata** (`General` tab button): revises only the six general fields
  through a metadata-only schema that cannot emit block content
  (`quiz-metadata-revision{,-correction}.md`). Routes:
  `/quizzes/:id/edit/modify{,/apply,/discard}`.
- **Per-block** (each block card's `⋮` menu): one item in, one item out, with
  item kind and level as explicit modal parameters; the per-request schema
  refines `item.kind` to equal the requested kind, so kind change is an
  explicit control, never model discretion
  (`quiz-block-revision{,-correction}.md`). Routes:
  `/quizzes/:id/edit/blocks/:blockId/modify{,/apply,/discard}`.
- **Add block** (`Agregar bloque`): the same block generator with
  `currentItem` omitted, plus explicit kind, level, section, and position
  controls and a preview before insert (`insertQuizBlock` assigns a fresh
  unique id and canonicalizes order). Routes:
  `/quizzes/:id/edit/add-block{,/apply,/discard}`.
- **Blocks + sections** (`Bloques` tab button): revises blocks and sections in
  one call, full-draft validated so cross-references are caught in the
  correction loop, previewed as a per-block diff (added / changed / moved /
  removed / regrouped) with a status summary
  (`quiz-blocks-revision{,-correction}.md`). Routes:
  `/quizzes/:id/edit/blocks-modify{,/apply,/discard}`.

Shared infrastructure:

- Server: generic pending-modification store
  `src/server/resources/modificationPreviewStore.ts`, keyed by operation +
  optional target, with a `listStringFieldChanges` diff helper.
- Client: generic modal controller `src/client/shared/modificationModal.js`
  (describe → preview → apply/retry/discard), supporting multiple triggers on
  one modal with per-open `resolveContext(trigger)`.
- Roleplays and practice guides still carry their own near-duplicate store and
  modal copies; migrating them onto the shared modules is a tracked cleanup.
  New resources must use the shared modules.

## Proposal And Approval UX

- Use scoped buttons/menu items labeled `Modify with AI` (or the resource's
  localized equivalent); they do not call the model until the author submits a
  request.
- The modal has a required modification request, contextual example, explicit
  parameters where the operation calls for them (kind, level, placement),
  cancel action, and immediate generation progress.
- Send the complete unsaved form state as context. Quiz context passed to
  block-scoped prompts is quoted untrusted data.
- Hold the complete proposed result in the bounded server-side preview store
  keyed to user, profile, resource, operation, and target. Return an opaque
  preview id plus the changes to render; never trust a replacement draft
  posted back by the browser.
- Show only actual differences in a responsive before/after comparison.
  Render Markdown-capable fields through the shared safe renderer; render quiz
  items through `quizItemRenderer` (read-only) with an answer-key summary;
  represent roleplay avatar changes visually.
- Approval posts only the opaque preview id, rejects expired or stale
  proposals, atomically writes the proposal, and reloads the edit page from
  the database. Close/cancel discards the proposal server-side.
- Invalid model output goes through the matching `*-correction.md` retry
  prompt before failing. System prompts live in `system-prompts/resources/`;
  follow `system-prompt-coherence` when editing them, and register new
  prompts in `promptPlaceholders.test.ts`.
- Keep failures and credit-exhaustion recovery inside the modal, using the
  existing `*CreditExhausted` view flags and buy-credits messaging.

## Authoring History

- The `authoring_messages_json` columns remain only for backward-compatible
  reads of pre-retirement data. Proposal operations do not append to them.
  Do not add revision-history tables unless a feature genuinely needs them.

## Checks Before Finishing

- Verify the preview request includes unsaved fields, the comparison contains
  only actual differences, and the database remains unchanged before
  approval.
- Verify apply, discard, and stale/expired preview ids have the expected
  persistence behavior.
- For scoped operations, verify isolation: a metadata operation cannot touch
  blocks; a per-block operation leaves every other block byte-identical.
- Verify the correction prompt path still parses when the main prompt changes
  shape.
- Add or update service contract tests (see `quizAuthoringContracts.test.ts`)
  and route-architecture guards for new operations.
- Run typecheck/tests and restart the local server when server or view code
  changed.
