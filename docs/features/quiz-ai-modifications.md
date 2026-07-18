# Quiz AI Modifications

Status: implemented (pending live QA) — designed and built 2026-07-17 for
Roadmap V3 item 1.3. Replaces the quiz `Chat IA` authoring tab with scoped,
per-unit AI modification operations. All six phases are code-complete
(typecheck, 181 server/db tests, client build green); the remaining step is a
logged-in click-through against real inference. Implementation details and
verification live in the [V3 roadmap](../roadmap/roadmap-v3.md) item 1.3.

## Purpose

The quiz authoring workspace is the last resource in Mister F that edits through
a conversational `Chat IA` tab. Scene media (2026-07-14), roleplays, and practice
guides all moved to bounded proposal-and-approval interactions because explicit
parameters placed next to the content being changed proved more intuitive for
non-technical authors than a chat that hides those parameters in prose.

This document designs the equivalent move for quizzes. It is not a like-for-like
port: the quiz chat carries capability that the other chats never had, so the
work is mostly *building the missing editors*, and only incidentally *retiring a
chat*.

## Current State

Three findings shape the design.

### The chat is the only editor for block content and sections

Unlike roleplays and practice guides — where every authoring field had a manual
input and the chat was an optional accelerator — the quiz has no manual path to
its own content:

- `views/partials/quiz-item-card.ejs` renders design-mode blocks read-only. The
  `⋮` menu offers move up, move down, duplicate, and delete. No route edits a
  block's content.
- `Agregar bloque` is a facade over the chat. `handleAddQuizBlock`
  (`src/server/quizzes/handlers.ts`) builds a natural-language message from the
  selected kind and prompt, then delegates to `handleReviseQuiz`.
- Sections have no UI at all. `views/partials/quiz-section-header.ejs` states it
  directly: "Sections are managed through the AI chat tab."

Consequence: retiring the chat before the scoped operations exist would remove
capability. Build first, retire last — the scene media order, not the roleplay
order.

### Every chat turn regenerates the whole draft

`system-prompts/resources/quiz-revision.md` returns a complete `draft`. Adding
one block to a twenty-block quiz asks the model to re-emit all twenty. This costs
latency proportional to quiz size and, more seriously, lets the model silently
reword blocks the teacher never mentioned. Scoping each operation to one unit
removes both problems by construction.

This is Roadmap V3 item 2.1 (LLM Inference Portfolio Audit) landing on a concrete
case: a prompt that takes one item and returns one item is a natural candidate
for a cheaper model tier and minimal reasoning effort, and the change is
measurable before and after.

### The per-block response contract already exists

`quizItemSchema` (`src/server/services/llmTutor/schemas.ts`) already validates a
standalone quiz item, and `src/client/shared/quizItemRenderer.js` already renders
one. `quiz-item-card.ejs` already carries a `quizItemMode === 'preview'` branch.
A block-scoped operation needs no new schema and no new renderer.

## Design Principle

**Every AI operation is scoped to a surface the author can see, and the default
path for an edit is the smallest operation that can make it.**

Two scopes, matching the authoring tabs, plus one local operation:

1. The `General` tab owns the six metadata fields.
2. The `Bloques` tab owns blocks and sections.
3. A single block owns its own item.

Corollaries:

- No operation spans tabs. A metadata change cannot touch blocks, and vice versa.
  A cross-cutting request such as "translate everything to English" is honestly
  two operations with two approvals, which is what the author sees anyway.
- The local block operation is the intended default. Most edits are local, and
  today every one of them pays whole-draft cost because the chat is the only door.
- Parameters that label content (level, item kind, placement) are explicit form
  controls, not phrases the model infers from prose. This is the scene media
  rule: labels must not drift from the content they describe.
- Reordering, duplicating, and deleting spend no inference at all.

### What the tab split does and does not buy

It does not reduce tokens or drift risk in any meaningful way. Blocks are
substantially all of a quiz's content; the metadata is six short fields. A
whole-`Bloques`-tab call costs roughly what a whole-draft chat turn costs today,
and can still reword a block nobody mentioned. The split confines that risk to
the tab where all the content lives, which is close to not confining it.

The win comes from somewhere else: making the local operation the default demotes
the expensive call from *the only path* to *the rare path*. And preview changes
the nature of drift — today a chat turn applies silently; a previewed operation
shows the author every changed block before anything lands.

## Operations

| Operation | Model returns | Surface |
| --- | --- | --- |
| Modify general details | the six metadata fields | Button on the `General` tab |
| Modify all blocks | `blocks` and `sections` | Button on the `Bloques` tab, next to `Agregar bloque` |
| Modify this block | one `item` | Block card `⋮` menu |
| Add block | one `item` | Existing add-block modal, re-pointed |
| Order, duplicate, delete | nothing (deterministic) | Existing |

### Modify general details

A direct port of the roleplay pattern: the action receives the complete unsaved
form (title, description, targetTopic, level, instructions,
evaluationInstructions), proposes a revision, shows only the changed fields in a
before/after comparison, and persists atomically on approval. It never touches
`blocks` or `sections`.

An inline, credit-gated title generator (the scene media `General` tab pattern)
fits here and can be added in the same phase or deferred.

### Modify all blocks

The escape hatch for genuinely collective requests: "translate every prompt",
"take all items down to A1", "balance the item kinds", "reorganize into two
sections", "add three more blocks about the past tense". It owns both `blocks`
and `sections`, because section headers render on this tab and regrouping is a
blocks-tab request.

- **One call returning all blocks.** Requests that reach this operation are
  collective by nature: they need cross-block awareness, or they add, remove, or
  regroup blocks. Splitting the work into repeated per-block calls is explicitly
  rejected — it cannot do that work, and it would turn one approval into many.
- The preview is block-by-block: changed, added, removed, reordered, and section
  changes must all be visible before approval. This is the most expensive UI in
  this design — considerably more than roleplay's field diff — and it is what
  makes the operation's token cost acceptable.
- Nothing is persisted until the author approves.

### Modify this block

The intended default path, and the capability the chat currently monopolizes. An
option in the block card's `⋮` menu runs describe → generate → preview → apply
against a single item.

- The preview renders current and proposed items side by side through
  `quizItemRenderer`, reusing the existing `preview` mode.
- The model receives the current item plus quiz context (level, target topic, the
  owning section's instructions, sibling item kinds) as **quoted, non-actionable
  data**, following `buildSceneMediaSourceContextPrompt`. Only the active request
  is actionable.
- **Item kind and level are explicit modal controls.** Kind defaults to the
  current kind; changing it is allowed and the preview then shows the full new
  item. Level defaults to the quiz level.
- It cannot touch any other block. This is a hard boundary, covered by a
  regression test.

### Add block

Keeps the existing modal (kind selector + prompt) but re-points it at the
block-scoped generator, adds preview-before-insert, and makes placement (section
and position) an explicit parameter. It is the modify-block prompt with an empty
current item. The `Modify all blocks` operation can also add blocks, but a
dedicated single-block path stays cheaper and more direct for the common case.

### Sections

No dedicated AI operation. `Modify all blocks` owns section creation, wording,
and regrouping. Deterministic section CRUD (rename, delete, reassign a block
without an inference) is desirable but not required to retire the chat; it is
tracked as a follow-up rather than a phase.

## Mechanics

### Shared preview/apply extraction

The `preview → apply/discard` machine is already written twice
(`roleplays/modificationPreviewStore.ts` and
`practiceGuides/modificationPreviewStore.ts` are near-identical), and the client
modal is duplicated inside `src/client/roleplays/index.js` and
`src/client/practiceGuides/index.js`. Quizzes would be the third copy — except
with four operations instead of one, so in practice six or seven copies.

Extract before building:

- A generic pending-modification store parameterized by payload, with the key
  extended to **operation and target** (`quiz:{id}:block:block_3`). Roleplays
  needed one pending preview per resource; quizzes need one per block.
- A shared client module for the describe → generating → preview →
  apply/retry/discard cycle, with the comparison area as an extension point:
  roleplays render field diffs, quizzes render an item card.
- Keep roleplay's strict conflict check (`baseUpdatedAt` plus base-draft
  equality). Any other change to the quiz invalidates a pending preview with a
  409.

### Prompts and contracts

One system prompt per operation, each carrying its response contract in
TypeScript syntax as the single source of truth, with anti-drift tests comparing
the contract to its Zod schema — the shape `system-prompts/scene-media/generation.md`
settled on.

- `quiz-draft.md` (creation from a prompt) survives unchanged.
- New: a metadata-modification prompt and a block-scoped item prompt.
- Retired at the end: `quiz-revision.md` and `quiz-revision-correction.md`.

Follow `system-prompt-coherence` when writing each one.

## Explicit Scope Decisions

Decided 2026-07-17.

- **Scope by tab, not by draft.** Three buttons — `General`, `Bloques`, and a
  per-block menu option — because they map to what the author already sees. An
  earlier draft of this design scoped operations by "smallest honest model unit"
  and produced a five-operation matrix that was correct internally but that the
  author would have had to learn. See the trade-off analysis above: the tab split
  is a UX win, not a cost win.
- **Manual block editing is out of scope.** Nine item kinds with different shapes
  means a per-kind editor, an effort comparable to this entire proposal. The
  block modal with preview makes the gap survivable meanwhile. Tracked separately
  on the roadmap.
- **Kind changes are allowed**, through an explicit modal control.
- **No conversational history anywhere.** Every operation is a single turn with an
  explicit request, explicit parameters, and an approval. References like "undo
  that" or "like the earlier block" stop being supported; the preview and the
  saved quiz are the only state.

## Phases

Each phase ships independently.

1. **Foundation + `General` button.** Extract the shared store and client modal;
   prove them by shipping the metadata operation against the already-validated
   roleplay shape.
2. **Per-block operation.** Block-scoped prompt and validation, side-by-side
   preview. The default path, and the capability the chat monopolizes.
3. **Add block, scoped.** Re-point the existing modal at the block-scoped
   generator; the chat facade dies.
4. **`Bloques` button.** Whole-tab operation over blocks and sections, with the
   block-by-block preview. Sequenced last of the four because it is the most
   expensive UI and the least frequent path — but it must land before the chat is
   retired, since it carries the collective capability.
5. **Retire the chat.** Tab, `edit/revise` route and handler, revision prompts,
   authoring-history writes, client hooks.
6. **Tests and documentation.**

## Consequences of Retiring the Chat

Quizzes are the **last** consumer of the authoring chat infrastructure. Phase 5
therefore ends an era:

- `src/client/shared/authoringChatRevision.js`, `authoringChatScroll.js`, and the
  chat portion of `src/client/styles/authoring.css` become unused.
- The `ai-authoring-chat-conventions` skill stops describing reality — it
  currently states "Quizzes currently use a `Chat IA` tab" — and should be
  rewritten as AI authoring conventions without a chat.
- `docs/features/teacher-assigned-practice.md` documents the chat tab throughout
  (roughly twenty references) and needs a status pass.
- `views/partials/quiz-section-header.ejs` carries a comment pointing at the chat
  tab.
- `authoring_messages_json` on the quiz keeps its column for backward-compatible
  reads with no new writes, following the practice-guide and roleplay precedent.
  No destructive migration.

Completing this closes Roadmap V3 item 1.3 entirely.

## Tests

- Anti-drift tests binding each prompt's TypeScript contract to its Zod schema.
- Route/handler tests for preview, apply, discard, expired-preview 409s, credit
  exhaustion, and profile access boundaries per operation.
- A regression test that a block-scoped operation cannot alter any other block.
- Manual QA per phase against live inference.
