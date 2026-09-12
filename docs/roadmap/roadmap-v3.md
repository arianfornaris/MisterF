# Roadmap V3

Date: 2026-07-06 (last updated: 2026-09-12)

Status: **Released as 3.0.0 on 2026-07-26; current release 3.0.2.** V3's
headline is the **Teacher Pilot MVP**: the
smallest product that lets a real teacher run the full assigned-practice
cycle — create a quiz from their own material, share it by link, students
complete it and get evaluated, students practice their difficulties, and the
teacher sees the attempts and a next-class report. Refocused on 2026-07-18 to
align with the approved business focus (independent teachers of adult
immigrant learners); decision record:
[Roadmap V3/V4 MVP Adjustment Proposal](roadmap-v3-v4-mvp-adjustment-proposal.md)
and [Propuesta de MVP](../business/propuesta-mvp.md).

The previous headline pillar, comprehension exercises (carried from
[Roadmap V2](roadmap-v2.md)), was downgraded on the same date and transferred
in full to [Roadmap V4](roadmap-v4.md) on 2026-07-26, along with the complete
Scene Media Library record, voice
messages in roleplays, and CEFR standardization. Remaining product-feature
candidates stay in the idea inbox,
[issues/incomming.md](../issues/incomming.md), until they are promoted here.

This document is the living tracker for V3: items move through the status
legend as work happens (`[~]` when started, `[x]` with a date when done), and
notes are added inline when decisions change an item's scope. There is no fixed
execution order — the next item is chosen by analyzing the current state at each
step.

V3 development continues on the `v2` branch lineage after `2.0.0` ships; a `v3`
branch will be cut from `main` once V2 releases. `main` remains the production
branch.

Product context: the primary audience is students in South Florida, many of
them Hispanic and Haitian. V2 made the platform's instruction language
selectable (Spanish, English, Haitian Creole).

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Comprehension Exercises — moved to V4

The complete initiative, including the optional Phase 1 reading stretch goal,
was transferred to [Roadmap V4 §1.2](roadmap-v4.md#12-comprehension-exercises)
on 2026-07-26 at the founder's direction. V3 retains no comprehension
checklist.

## 1.2 Scene Media Library — moved to V4

The complete Scene Media Library record — shipped foundation, implementation
decisions, and remaining work — moved to
[Roadmap V4 §1.3](roadmap-v4.md#13-scene-media-library) on 2026-07-26 at the
founder's direction. V3 retains no media-library checklist.

**One exception, added 2026-09-09:** §1.12 tracks folding scene media into the
resource model. It sits here rather than in V4 because it is being done against
the current release line, not deferred behind pilot evidence. The record itself
stays in V4 §1.3.

## 1.3 Review Resource AI Editing Chats

Added 2026-07-14 to review every remaining resource editing chat and confirm
that conversation was still the clearest interaction for the resource rather
than hiding parameters better expressed next to the content being changed.
The preceding Media Library decision and implementation history now live in
[Roadmap V4 §1.3](roadmap-v4.md#13-scene-media-library).

- [x] Review the quiz `Chat IA` edit tab, including the add-block shortcut and
  whether block-level changes should use contextual controls with preview and
  explicit parameters. Reviewed 2026-07-17: the chat should be replaced by
  scoped per-unit operations. All six implementation phases below are
  code-complete as of 2026-07-17 (typecheck/tests/build green). **Done
  2026-07-20: live logged-in click-through of all four operations against real
  inference passed** — fresh account, new quiz generated from a prompt, then
  metadata modify (only changed fields in the preview; apply persisted),
  per-block modify with an explicit kind change (`fill_in_the_blank_input` →
  `multiple_choice`; only the target block changed), add block with
  explicit placement (`start`; preview shown before insert; unique id
  collision handled), and blocks+sections modify ("Nuevo: 1 · Movido: 5" diff;
  two sections created and persisted correctly). The discard path was also
  exercised (preview generated, cancelled, no persistence). Server error log
  clean across the session (6 LLM calls, 4 previews, 4 applies). Observation,
  not a bug: the first inserted block gets the id `block` (base id without
  suffix); later inserts get `block_5` etc. — ids stay unique. Design:
  [Quiz AI Modifications](../features/quiz-ai-modifications.md). The review found
  that, unlike roleplays and practice guides, the quiz chat is the **only** editor
  for block content and the only manager of sections (design-mode block cards are
  read-only, `Agregar bloque` is a facade that delegates to `handleReviseQuiz`,
  and section headers are display-only), so the operations must be built before
  the chat is retired. Every chat turn also regenerates the whole draft, so today
  even a one-word fix pays whole-draft latency and lets untouched blocks drift.
  Decisions: scope operations by authoring tab (`General` button, `Bloques`
  button, per-block menu option) because that maps to what the author already
  sees; single-turn operations with no conversational history; manual per-kind
  block editing out of scope; item kind changeable through an explicit control.
  Note the tab split is a UX win rather than a cost win — blocks are
  substantially all of a quiz's content, so the `Bloques` operation costs about
  what a chat turn costs today. The real win is demoting the expensive call from
  the only path to the rare path, with a preview so drift is visible before it
  lands.
  - [x] Phase 1 — Extract the shared pending-modification store and client
    preview modal (today duplicated across roleplays and practice guides, keyed
    per resource; quizzes need per-operation/per-target keys), then ship the
    `General` tab button over the six metadata fields. Code complete 2026-07-17;
    live QA passed 2026-07-20. Delivered: generic
    server store `src/server/resources/modificationPreviewStore.ts` (keyed by
    operation + optional target, with a `listStringFieldChanges` diff helper);
    generic client `src/client/shared/modificationModal.js` (describe → preview →
    apply/retry/discard, plus `renderStringFieldChanges`); a metadata-only
    revision (`quizMetadataSchema`/`applyQuizMetadataToDraft` in
    `services/quizzes.ts`, `generateQuizMetadataRevision` in
    `services/resourceDrafts.ts`, prompts
    `system-prompts/resources/quiz-metadata-revision{,-correction}.md`) that can
    never emit block content; quiz preview/apply/discard handlers + routes
    (`/quizzes/:id/edit/modify{,/apply,/discard}`); a `Modify details with AI`
    button and modal on the `General` tab; i18n in es/en/ht; and the new prompts
    registered in `promptPlaceholders.test.ts`. Verified: `typecheck`,
    `test:typecheck`, full `tests/server` suite, and client build all pass; the
    new route is registered on the running dev server. Note: roleplays and
    practice guides still carry their own store/modal copies — migrating them
    onto the shared modules is a deferred cleanup, not required for later phases.
  - [x] Phase 2 — Per-block menu option: one item in, one item out, side-by-side
    preview through the existing `quizItemRenderer` and `preview` card mode, with
    item kind and level as explicit modal parameters. The intended default path.
    Code complete 2026-07-17; live QA passed 2026-07-20 (including an explicit
    kind change and the discard path). Delivered:
    block helpers `findQuizBlock`/`setQuizBlockItem` in `services/quizzes.ts`
    (item-only replacement, preserves id/section/other blocks); block-scoped
    revision `generateQuizBlockRevision` in `services/resourceDrafts.ts` (per-
    request schema refined so `item.kind` must equal the requested kind — kind
    change is an explicit control) with prompts
    `system-prompts/resources/quiz-block-revision{,-correction}.md` (quiz context
    passed as untrusted quoted data); handlers
    `handle{Preview,Apply,Discard}QuizBlockModification` keyed by
    operation `quiz-block` + block-id target; routes
    `/quizzes/:id/edit/blocks/:blockId/modify{,/apply,/discard}`; a `Modificar con
    IA` item in each design-mode block card `⋮` menu plus the item JSON embedded
    per card; a shared block modal with kind `<select>` + level input reusing the
    generic controller; client before/after render via `quizItemRenderer`
    (read-only) plus a per-kind answer-key summary. The generic client controller
    (`src/client/shared/modificationModal.js`) was extended to support multiple
    triggers on one modal with per-open `resolveContext(trigger)`, which phases 3
    and 4 reuse. i18n es/en/ht; new prompts registered in
    `promptPlaceholders.test.ts`. Verified: typecheck, test:typecheck, full
    `tests/server` (158), client build, and route registration on the running dev
    server. Answer key shows in the preview (a plus over EJS `preview` mode, which
    hides it).
  - [x] Phase 3 — Re-point `Agregar bloque` at the block-scoped generator with
    preview-before-insert and explicit placement, removing the chat facade.
    Code complete 2026-07-17; live QA passed 2026-07-20 (insert at `start`
    verified in the persisted draft). Delivered:
    `generateQuizBlockRevision` now doubles as creation when `currentItem` is
    omitted (same one-item-out schema with the kind refine; prompt updated to
    cover create-or-revise); `insertQuizBlock` in `services/quizzes.ts` (fresh
    unique id, explicit `sectionId` + `position` placement, canonicalized order);
    add-block handlers `handle{Preview,Apply,Discard}QuizAddBlock` (owner op
    `quiz-add-block`, placement stored in the pending record) on routes
    `/quizzes/:id/edit/add-block{,/apply,/discard}`; the `Agregar bloque` modal
    rebuilt as a describe→preview→insert flow with explicit kind, level, section,
    and position controls, previewing the proposed item card before it is added.
    Removed the chat facade: `handleAddQuizBlock`, `buildAddQuizBlockChatMessage`,
    the `/edit/blocks` POST route, and the client `stageAuthoringChatMessage`
    add-block shortcut. i18n es/en/ht. Verified: typecheck, test:typecheck, full
    `tests/server` (158), client build, and EJS compile of the changed templates.
    (Note: POST route registration cannot be probed by curl because CSRF 403s
    before routing; it is guaranteed by typecheck + explicit router wiring
    instead.) Leftover dead i18n keys `addBlockOfKind`/`bestFitKind` can be swept
    in Phase 5.
  - [x] Phase 4 — `Bloques` tab button over blocks and sections in one call, with
    a block-by-block preview covering changed, added, removed, reordered, and
    regrouped blocks. Code complete 2026-07-17; live QA passed 2026-07-20
    (sections created + regroup + new block in one call, diff labels correct,
    persistence verified). Delivered:
    `generateQuizBlocksRevision` returns `{ blocks, sections }` only (metadata
    injected + full-draft validated via `superRefine` so section cross-refs and
    unique ids are caught inside the correction loop) with prompts
    `quiz-blocks-revision{,-correction}.md`; `applyQuizBlocksAndSectionsToDraft`,
    `diffQuizBlocks`, and `quizBlocksDiffHasChanges` in `services/quizzes.ts`
    (per-block status added/changed/moved/unchanged + removed list + section
    diff); handlers `handle{Preview,Apply,Discard}QuizBlocksModification` (owner
    op `quiz-blocks`) on routes `/quizzes/:id/edit/blocks-modify{,/apply,/discard}`;
    a `Modificar con IA` button next to `Agregar bloque`, its modal, and a client
    diff renderer with a status summary + color-coded per-block cards. Verified:
    typecheck, test:typecheck, tests/server (158), client build, EJS compile.
  - [x] Phase 5 — Retire the chat tab. Done 2026-07-17. Removed: the `Chat IA`
    nav pill and panel, `POST /quizzes/:id/edit/revise` + `handleReviseQuiz` +
    `saveQuizAuthoringTurn`, the `generateQuizRevision` service with its schema,
    result type, conversation-history type, and normalizer, the
    `quiz-revision{,-correction}.md` prompts, and the `chat` authoring tab from
    the tab type/reader (legacy `?tab=chat` now redirects to `general`). Quizzes
    were the last consumer of the shared authoring chat, so
    `src/client/shared/authoringChatRevision.js` and `authoringChatScroll.js` were
    deleted and `authoring.css` reduced to the tab layout. The
    `authoring_messages_json` column and its `updateQuizAuthoringMessages`
    repository function are retained for backward-compatible reads (no destructive
    migration), per the practice-guide/roleplay precedent. Dead chat i18n keys
    (`quizzes.tabChat`, `modifyWithAi`, `authoringChat*`, `msg.writeChange`,
    `msg.addBlockOfKind`, `msg.bestFitKind`, …) were left in place: harmless at
    runtime, and a mechanical key sweep across three locales is a low-priority
    follow-up not worth risking at the end of the change.
  - [x] Phase 6 — Tests and documentation. Done 2026-07-17. Added service
    contract tests for the metadata, per-block (revise + create + kind-mismatch
    recovery), and blocks (parse + cross-ref recovery) operations in
    `quizAuthoringContracts.test.ts`; pure-logic unit tests for `setQuizBlockItem`
    isolation, `insertQuizBlock` placement, and `diffQuizBlocks`/
    `quizBlocksDiffHasChanges` in `quizzesService.test.ts`; a route-architecture
    guard in `routeArchitecture.test.ts` asserting the chat is gone and the four
    modals + scoped routes exist; and prompt↔placeholder registration for the four
    new prompts. Full suite: `tests/server`+`tests/db` 181 passing, typecheck and
    test:typecheck clean, client build clean, dev server healthy (200).
  - [x] Follow-up — Update the `ai-authoring-chat-conventions` skill and the chat
    references in
    [Teacher-Assigned Practice](../features/teacher-assigned-practice.md) to match
    the retired-chat reality. Done 2026-07-20: the skill was rewritten around
    the proposal-and-approval model with the four scoped quiz operations as
    the reference implementation (chat sections removed, retirement history
    noted); the feature doc got a prominent supersedence note and an updated
    Implementation Status, keeping the original chat design as historical
    record.
- [x] Migrate roleplay and practice-guide modification modals onto the shared
  controller. Done 2026-07-27. Server: both resources now use the generic
  `resources/modificationPreviewStore.ts` (keyed by `operation` + resource), so
  the two near-duplicate stores are gone; what remains of each old file is only
  its domain diff (`listRoleplayModificationChanges` for avatars,
  `listPracticeGuideModificationChanges` for Markdown fields), renamed to
  `modificationChanges.ts` since they no longer store anything. Client: the two
  bespoke modal controllers (~240 and ~180 lines) were replaced by
  `initializeModificationModal` from `client/shared/modificationModal.js`, with
  only `buildCurrentDraft` and `renderChanges` supplied per resource; the
  per-resource `data-roleplay-modify-*` / `data-practice-guide-modify-*`
  attributes were renamed to the shared `data-modify-*` contract in both views,
  and the route guard tests were updated to assert the shared contract.
  Verified: typecheck, test:typecheck, 311 tests, client build (both bundles
  import the shared chunk), server healthy. **Pending:** the before/after
  click-through this item asked for, since it touches two shipped flows.
- [x] Sweep the dead chat i18n keys left by the quiz chat retirement
  (`quizzes.tabChat`, `modifyWithAi`, `modifyWithAiCopy`, `authoringChat*`,
  `quizzes.message`, `describeChangesPlaceholder`, `applyChanges`, `blockTypeAria`,
  `msg.writeChange`, `msg.applyChangeError`, `msg.addBlockOfKind`,
  `msg.bestFitKind`, `msg.describeBlock`, `clientMisc.addBlock`/`addBlockOfKind`)
  across es/en/ht. Done 2026-07-17: removed from all three locales; the shared
  translation-map type enforced parity (typecheck stays green), and
  `quizzes.addBlock` (the button label) was deliberately kept. Verified:
  typecheck, test:typecheck, `tests/server` (168), client build.
- [x] Decide whether V3 needs manual block editing in quiz authoring. **Deferred
  entirely to [Roadmap V4](roadmap-v4.md) on 2026-07-26 at the founder's
  direction; V3 will not ship the previously proposed minimal editor.** A typo
  in one option still requires the scoped block-change AI operation because
  design-mode cards are read-only. V4 now owns the complete problem: manual
  editing across all item kinds plus deterministic section
  rename/delete/reassignment.
- [x] Retire the practice-guide `Chat IA` edit tab. Practice guides now use the
  roleplay proposal pattern: one page-level `Modify with AI` action receives
  the complete unsaved title, description, and tutor instructions; shows only
  changed fields in a before/after comparison; and persists atomically only
  after explicit approval. Superseded routes, history writes, and client hooks
  were removed while the legacy data column remains readable.
- [x] Retire the roleplay `Chat IA` edit tab. Roleplay now exposes one
  page-level `Modify with AI` action that can reach every authoring field, uses
  the complete unsaved form as context, shows only proposed field differences
  in a before/after comparison, and persists atomically only after explicit
  approval.
- [x] For each remaining resource, decide whether to keep, redesign, or retire the chat;
  document the chosen ownership boundary and remove any superseded routes,
  prompts, history writes, client hooks, and unused persistence safely.
  Done 2026-07-17: every remaining V3 resource has been decided and its chat
  retired — roleplays and practice guides (2026-07-16), then quizzes
  (2026-07-17). No authoring chat surface remains in `src/` or `views/`, and the
  shared chat client modules were deleted with the quiz work. Ownership
  boundaries are documented per resource in
  [Quiz AI Modifications](../features/quiz-ai-modifications.md) and the roadmap
  entries above. Legacy `authoring_messages_json` columns remain readable by
  design; no destructive migration was introduced.

## 1.4 Voice Messages in Roleplays

Added 2026-07-08. **Moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18 (MVP
refocus):** the character-audio half is sequenced after the TTS
infrastructure that also moved to V4, and neither half is needed for the
teacher pilot. Full scope and notes now live in Roadmap V4.

## 1.5 CEFR Level Standardization

Added 2026-07-14. **Moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18 (MVP
refocus):** the pilot runs with the existing `A1-A2`/`B1-B2`/`C1` authoring
bands. Full scope now lives in Roadmap V4.

## 1.6 Quiz Results & Next-Class Report

Added 2026-07-18. **The MVP centerpiece** and the only wholly missing piece of
the approved teacher promise ("reach the next class knowing where each
student needs help"). Business context:
[Propuesta de MVP](../business/propuesta-mvp.md).

Design decision (2026-07-18, with the founder): no teacher/student profiles,
no role-aware homes, no dashboards, no classroom entity. Authorization is
resource-scoped — the quiz owner sees the attempts of their quiz — and the
surface is the existing quiz page. The long-term classroom/packages/
organization shape is designed in [Classrooms](../features/classrooms.md) and
stays out of V3.

**Partially amended 2026-09-09 by [§1.14](#114-signed-in-home-modes--learning-and-teaching)**,
after testing with a real teacher: the *presentation* half — "no role-aware
homes" — is reversed, and the home is now composed differently for learning
and for teaching. The *authorization* half stands: still no account-level
roles, no classroom entity, and nothing gated by mode.

- [x] Results-feedback flag on sharing (added 2026-07-20, founder decision):
  when sharing a quiz, the owner chooses whether they want to receive the
  results of the people who complete it. Each attempt snapshots the flag
  at start time: turning the flag on later never exposes attempts made
  without the disclosure notice, and turning it off stops collection for new
  attempts without hiding legitimately collected ones. Default on for the
  teacher flow. Done 2026-07-20: migration 24 adds
  `resource_share_links.collect_results` (default on; resource-generic, so
  roleplay/guide shares reuse it as-is) and `quiz_attempts.collect_results`
  (default off, so pre-flag attempts are never exposed);
  `POST /resources/:resourceId/share/collect-results` (owner-only) backs a
  switch in the quiz share-link modal that reopens the modal after saving.
  Note vs the original sketch: the sharing model is one live link per
  resource, so "one link with feedback, another without" became "one
  toggleable flag per share link" — sequential, not simultaneous, control.
- [x] Attempts visibility for the quiz owner. Done 2026-07-20: a
  `Resultados de estudiantes` section on the quiz page (owner-only) lists
  collected attempts — student account name or `Invitado`, status badge,
  correct/total summary, relative time — and evaluated ones link to a
  read-only owner view of the result page (banner with the student label; no
  learner actions; the guest token is never embedded). Only attempts whose
  share had the flag on at start appear; the owner's own attempts (`Probar`
  or self-taken) are excluded by query. The owner path in the result handler
  runs before the normal attempt resolver, so it can never claim or evaluate
  a student's attempt. Route/repository/migration tests added; live
  click-through verified (including the frozen-visibility rule). Also fixed
  in passing: a latent 500 in `resolveAccessibleAttempt` on GETs without a
  body (`request.body.guestToken` on `undefined`), and the retired-chat
  leftover in `promptContracts.test.ts` that still loaded
  `quiz-revision-correction.md`.
- [x] Disclosure-at-start consent: when the share collects results, the
  shared-link page states clearly — before answering — that the person who
  shared the activity will see the student's answers and evaluation;
  starting the attempt constitutes consent. Shown only when the flag is on
  (no collection, no notice needed). Adults-only pilot policy. (Per-student
  opt-in was considered and rejected: an incomplete report breaks the
  teacher promise. Voluntary sharing is reserved for the student's own
  follow-up practice, deferred past the MVP.) Done 2026-07-20: notice on the
  shared page (es/en/ht), gated on the share flag; the flag rides the
  attempt through the guest → signup → claim flow via the start-time
  snapshot. Verified live and by route tests (notice shown/hidden per flag).
- [x] Responses summary per quiz. Done 2026-07-21. Renamed away from the
  teacher-framed "next-class report" to a general "Resumen de respuestas" on
  the quiz page (founder decision: use "participants", not "students", while
  the sharing primitive stays general). Two layers:
  (1) a **live deterministic aggregation** — per-question correct/partial/
  incorrect tallies keyed by prompt (survives block reordering), plus
  responded/evaluated counts — recomputed on every view, never persisted, so
  it can never go stale;
  (2) an **optional AI summary** the owner generates on their own credit-gated
  key, persisted in `quiz_response_summaries` (migration 26) with an input
  fingerprint (`evaluatedCount:maxUpdatedAt`). When new responses arrive the
  fingerprint diverges and the card shows a "Hay respuestas nuevas desde este
  resumen" badge with an "Actualizar resumen" action. Generation shows the
  pending modal (§1.8 rule). `POST /quizzes/:id/summary`, owner-only, empty
  state guarded before inference. Prompts
  `resources/quiz-responses-summary{,-correction}.md`; generator reuses the
  shared `generateStructuredDraft` (no new `generateText` site). Verified live
  end to end (aggregation, AI generation, staleness on a new response).
  The per-participant list was renamed "Participantes" and anonymous attempts
  labeled "Anónimo".
- [x] "Shared by me" aggregated view (added 2026-07-18): one page listing the
  user's shared resources — quizzes, practice guides, and roleplays, since
  sharing already exists for all three — with attempt counts and who
  practiced each, as the guide's entry point. Same primitive, no roles and no
  new entities — serves the teacher, the private tutor, and a parent with
  their own account (the parent-child case runs through learning profiles
  inside the parent's account). Full formula:
  [Classrooms](../features/classrooms.md). **Done 2026-07-23:** first shipped as
  a dedicated "Compartidos" page, then simplified the same day (founder
  preference) into the existing `/resources` catalog rather than a separate
  surface — the catalog already mixes owned and shared-with-me resources, so no
  new page was warranted. Each resource carries a **"Compartido por mí"** badge
  (owned, with an active share link or grant — via `listSharedResourcesForProfile`)
  or a **"Compartido conmigo"** badge (reached through a grant). The two sharing
  categories are **integrated into the existing type filter** (options `by_me` /
  `with_me` alongside the resource types, not a separate filter control — founder
  correction 2026-07-23). Scoped to the active profile. Trade-off accepted: the
  at-a-glance attempt counts / "who practiced" are dropped from the list — that
  data stays on each quiz's participation page (one click from the detail).
  Covered by a repo test (`listSharedResourcesForProfile`) and a route test
  (badges + both filter values). Verified live on the QA account.
  Follow-up 2026-07-23: the catalog filters (search, type/sharing, sort) were
  folder-scoped, which fragmented the "what have I shared" view once resources
  live in folders. Added a **scope selector** (`scope=folder|all`) inside the
  Search and Filter panels — `Todo` flattens the whole profile catalog across
  folders (folders hidden, filed resources included) and each row shows `en:
  Carpeta X`. Default stays `Carpeta actual`. Covered by a route test
  (filed shared resource hidden at folder scope, surfaced with its folder under
  `scope=all`).
- Design constraint (2026-07-18): the MVP first returned results for **quizzes
  only**, but the cross-cutting pieces — disclosure/consent copy, the
  "Shared by me" view, and the naming of results routes/storage — were built
  resource-generic, because the same feedback loop extends to roleplays
  (attempt evaluation + transcript) and practice guides (the session's
  finalized report, not the raw chat). Disclosure follows assignment, not
  resource type. Update 2026-07-26 (founder decision): that extension was
  **pulled into V3** from Roadmap V4 Step 2.5 — see the item below.
- [x] Make the feedback flag uniform across both share kinds. Done 2026-07-20:
  the share link carried the flag but `Compartir con perfil` did not, so the
  interim parent→child (same-account) case never collected. Added
  `collect_results` to `resource_access_grants` (migration 25), a toggle on
  the quiz profile-share modal (default on), grant-flag snapshot when a
  non-author profile starts a `Probar` attempt, link grants inheriting the
  link's flag (so repeats from Resources also collect), and re-keyed the
  owner's collected-attempts list on the **author profile** (not the owner
  user) so sibling profiles surface, labeled by profile name. Verified live
  end to end: a child-profile attempt shared with the flag on appears in the
  owner's `Resultados de estudiantes` as "Hijo QA" while the author's own
  `Probar` runs stay out. Note: taking an owned quiz auto-switches the active
  profile back to the author profile on navigation, so the child must have
  their own profile active to attempt as a student — a known interim-model
  wrinkle, not a blocker.
- [x] Funnel instrumentation check: verify each pilot funnel step (invited →
  started → completed → reviewed → practiced → report viewed) is recorded and
  queryable, adding minimal events where missing. Manual SQL is acceptable
  for the pilot. **Closed 2026-08-01 (founder decision), with the cost
  measurement in §1.7.** The events themselves are emitted — every step of the
  cycle writes one, and Phase D of the extension above added the missing
  owner-view events (`roleplay_owner_result_viewed`,
  `practice_guide_owner_report_viewed`) and the `collectResults` flag on the
  start events. What does not exist is anything that *aggregates* them, and that
  is not a V3 gap: it is the platform-wide problem
  [Roadmap X §X.1](roadmap-x.md) was opened to hold, where this funnel is
  written down as blocked item 2. Closing it here stops the same missing
  capability being tracked in three roadmaps at once.
- [x] Fix the guest evaluation hand-off. Done 2026-07-20: evaluation used to
  run inside the result page's GET, so a student who had just signed up sat on
  a blank navigation for the whole inference. Evaluation moved to
  `POST /quiz-attempts/:id/evaluate` behind a new
  `GET /quiz-attempts/:id/evaluating` page that renders instantly with the
  spinner and self-posts (visible button as the no-JS fallback); the result
  page now redirects there instead of blocking, and signup returns to it.
  Verified live: result redirect 29 ms, evaluating page 22 ms, then the normal
  evaluated-result experience.
- [x] Manual QA of the full teacher cycle against live inference (create →
  share → guest attempt → signup/claim → evaluation → follow-up practice →
  owner report). Completed 2026-07-26; founder-confirmed end-to-end pass.
- [x] Extend participant results to **roleplays and practice guides** (moved
  from Roadmap V4 Step 2.5 on 2026-07-26 at the founder's direction; previously
  the planned first post-MVP extension). Code-complete 2026-07-26; **closed
  2026-08-01 when phases D and E passed live QA** — see below. The resource-generic pieces already
  cover all three types — the sharing primitive (`resource_share_links`,
  `resource_access_grants`), the `collect_results` flag + start-time snapshot,
  the disclosure-at-start consent, and the "Compartido por mí" catalog. What is
  still quiz-only is the **owner participation surface**
  (`quizzes-participation.ejs`, `listCollectedQuizAttemptsForOwner`, the owner
  read-only result view). Each type's **result artifact already exists** (see
  phases), so this is mostly mirroring the quiz plumbing, not new inference.
  Both roleplays and practice guides **require the participant to have an
  account and profile to run** (no guest flow — confirmed 2026-07-26), so a
  participant is always a known profile; the quiz guest→signup→claim path has no
  analog here and is out of scope.
  - [x] Phase A — Generalize the participation surface. Done 2026-07-26:
    pragmatic reuse rather than a merged page — each type gets its own
    owner-only `*-participation` page (quiz behavior unchanged), sharing the
    quiz participation vocabulary (`quizzes.participationKicker`,
    `participantsSectionTitle`, `participantsEmpty{Title,Body}`,
    `resultOwnerView`, `resultsAnonymousParticipant`) and the friendly
    empty-state pattern. The tutor report markup was extracted to
    `partials/tutor-report-document.ejs` (shared by chat + owner view).
  - [x] Phase B — Roleplay results (first; cheap): `roleplay_attempts` already
    carries an evaluated `result_json` + transcript. Add `collect_results` to it
    (mirror migration 24), snapshot the flag at attempt start
    (`handleStartRoleplayAttempt` + `handleStartSharedRoleplayAttempt`,
    inheriting the share-link / grant flag), add
    `listCollectedRoleplayAttemptsForOwner` (keyed on the author profile,
    excluding the owner's own `Probar`), and an owner read-only mode of
    `roleplays-result` (evaluation + transcript). Done 2026-07-26 (migration 2):
    `/roleplays/:id/participation` reached from the options menu, owner result
    view with a participant banner and no learner actions. Repo test added.
  - [x] Phase C — Practice-guide results (also cheap; no new artifact): the
    finalized report **already exists** — the learner's "Finalizar y resumir"
    persists a `tutor_conversation_reports` row (`summary_title`/
    `summary_description` + `report_json`) already linked to the guide via
    `practice_guide_id`. So no new report and no new inference. Work: (1)
    snapshot `collect_results` when a shared practice-guide conversation starts
    (`createConversationFromPracticeGuide` / `handleStartSharedPracticeGuide`) —
    `conversations` has no such column yet, so add it, mirroring the attempt
    snapshot; (2) `listCollectedPracticeGuideReportsForOwner` over
    `tutor_conversation_reports` (by `practice_guide_id`, collect flag on,
    excluding the author profile); (3) surface the existing report read-only to
    the owner. The raw chat is never shared — only the finalized report.
    Done 2026-07-26 (migration 3): implementation note — the report's own
    `practice_guide_id` is never populated by the current finalize flow, so the
    query filters on the **conversation's** `practice_guide_id` +
    `collect_results` instead (the conversation always carries both). Owner
    report view at `/practice-guides/:id/reports/:conversationId`, reached from
    `/practice-guides/:id/participation`. Repo test added.
  - [x] Phase D — Funnel instrumentation + QA. Done 2026-07-26: start events now
    log `collectResults`, and owner-view events were added
    (`roleplay_owner_result_viewed`, `practice_guide_owner_report_viewed`);
    disclosure-at-start now shows for roleplay/guide shares on the shared
    resource page, gated on the collect flag. Owner-side share toggles added to
    both the roleplay and practice-guide share modals (profile-share checkbox
    read by the share handler; link-share auto-submit switch reusing the generic
    `POST /resources/:resourceId/share/collect-results`), matching the quiz.
    **Live QA passed 2026-08-01**, self-served against real inference on the
    local server. Both cycles run end to end:
    *Roleplay* — owner creates it, shares it (profile share and link share, each
    with the `collect_results` toggle present and honoured), participant starts,
    exchanges turns, finishes; the attempt snapshots `collect_results = 1` from
    the grant and again from the link; evaluation persists with a progress
    event; the owner's participation page lists both participants by name.
    *Practice guide* — owner creates and link-shares it, participant starts the
    conversation (`conversations.collect_results = 1`), practises, and
    `Finalizar y resumir` persists a `tutor_conversation_reports` row the owner
    reaches at `/practice-guides/:id/reports/:conversationId`.
    The disclosure-at-start notice renders on the shared page for **both** types,
    gated on the collect flag and in the participant's own language.
    Wait-state affordances were exercised incidentally and hold: the roleplay
    turn composer disables its button and shows a thinking turn, and the shared
    start pages carry the pending modal.
    **Fixture note for whoever repeats this:** the owner read-only result view is
    gated on `attempt.userId !== viewer.id` (`roleplays/handlers.ts:1336`), so it
    is **unreachable with one account holding two profiles** — that setup falls
    through to the learner's own view, with learner actions, which looks like a
    bug and is not. A second real user is required. With one
    (`qa.student@misterf.local`), the owner view is correct: banner *"Estás
    viendo el resultado de Estudiante QA en modo solo lectura"*, transcript and
    evaluation present, and **zero** learner action forms. The guide report view
    behaves the same and leaks no raw chat.
  - [x] Phase E — Owner AI participation summary for roleplays and practice
    guides (added 2026-07-27 at the founder's request; closes the last gap
    against the quiz participation page). Done 2026-07-27: migration 29 adds a
    resource-keyed `resource_participation_summaries` table shared by both types
    (quizzes keep `quiz_response_summaries`, same shape); a shared
    `resources/participationSummary.ts` provides the staleness fingerprint and
    the `?summaryError=` reader; generators
    `generateRoleplayParticipationSummary` / `generateGuideParticipationSummary`
    reuse `generateStructuredDraft` with new prompts
    `resources/{roleplay,guide}-participation-summary{,-correction}.md`;
    owner-only `POST /roleplays/:id/summary` and
    `POST /practice-guides/:id/summary` guard the empty state before spending
    inference and show the pending modal (§1.8). The roleplay summary aggregates
    each evaluated attempt's recurring difficulties and turns needing work; the
    guide summary aggregates the finalized reports' practiced topics, difficulty
    areas, and next steps — no transcripts and no raw chat are ever sent.
    Per-question tallies stay quiz-only, since only quizzes have right answers.
    Verified: typecheck, test:typecheck, 303 tests (7 new contract/fingerprint
    tests), build, migration applied, server healthy. **Live QA passed
    2026-08-01** with the Phase D click-through. Both summaries generate against
    real inference and persist to `resource_participation_summaries` with the
    staleness fingerprint. The roleplay summary correctly aggregated **two**
    participants' recurring difficulties (fingerprint `2:<timestamp>`) and the
    guide summary the single finalized report (`1:<timestamp>`), each naming the
    practised topics and next steps without reproducing a transcript or any raw
    chat.

## 1.7 Pilot Readiness

Added 2026-07-18. Operational items that make the pilot runnable within the
business constraints ([Presupuesto inicial](../business/presupuesto-inicial.md)).

- [x] Pilot credit mechanics. **Closed 2026-07-27 (founder decision): the pilot
  runs on the existing self-serve model, so there is nothing to define.** This
  item was written on 2026-07-18 assuming the founder would fund pilot
  participants through superadmin per-user OpenRouter limits, which would have
  needed a per-participant cap and a pilot budget. That assumption is dropped.
  What ships today already covers the whole loop: a new user's key is
  provisioned with a welcome credit (`OPENROUTER_USER_KEY_LIMIT_USD`), spending
  draws it down, `assertUserHasLlmCredit` raises `CreditExhaustedError` when it
  runs out, and every credit-gated surface redirects to the purchase flow
  (`/credits` → `/credits/checkout`), which raises the key limit by the amount
  bought. The superadmin per-user limit flow stays an admin tool, not the pilot
  funding mechanism.
  **Working assumption (founder, 2026-07-27): the welcome credit is enough for a
  participant to complete one full cycle.** It is not measured yet, so it is an
  assumption, not a verified fact — the item below is what would confirm it. If
  it turns out to be false, a student invited by a pilot teacher would hit the
  purchase wall part-way through the activity their teacher assigned, so revisit
  `OPENROUTER_USER_KEY_LIMIT_USD` before widening the pilot.

  **The assumption is false, and it failed for a reason nobody would have found
  by measuring average cost.** Observed 2026-08-01 during the §1.6 Phase C/D QA,
  with a genuinely fresh account (`OPENROUTER_USER_KEY_LIMIT_USD=0.05`, the
  value in both `.env.development` and `.env.production`): the student completed
  a shared roleplay end to end, then `Finalizar y resumir` on a shared practice
  guide was **rejected by OpenRouter before any inference ran**:

  > This request requires more credits, or fewer max_tokens. You requested up to
  > 65536 tokens, but can only afford 33333.

  The mechanism matters more than the number. OpenRouter reserves the request's
  **maximum possible** output against the key limit, not its actual cost, so a
  $0.05 key is refused for any operation whose model advertises a large output
  budget — regardless of how few tokens the answer would really have used, and
  regardless of how little the key has actually spent (reported usage was still
  `0` at the time of the refusal). The tutor report runs on the `regular` tier
  (`services/tutorReports.ts:200`). This interacts directly with the
  `llm-credit-gate` rule that the app must **not** set application-level
  `maxOutputTokens` — the rule is right for output quality, and its cost is that
  the provider's reservation is the model's native ceiling.

  **What worked:** the credit gate itself behaved exactly as designed — the
  failure surfaced as `credit_exhausted_http_redirect` with no stack trace and
  no broken page.

  **What this means for the pilot:** a student invited by a pilot teacher can
  finish a roleplay but cannot finalize a practice-guide report on the welcome
  credit.

  **Tested 2026-08-01 at the founder's request, to recommend a value.** Fresh
  accounts, same shared practice guide, three tutor turns, then `Finalizar y
  resumir`:

  | `OPENROUTER_USER_KEY_LIMIT_USD` | Result |
  | --- | --- |
  | `0.05` (current, dev **and** production) | **Rejected** — could afford 33 333 of 65 536 tokens |
  | `0.20` | **Rejected** — could afford 53 333 |
  | `0.35` | **Succeeded** |
  | `0.50` | Succeeded (also the value both QA accounts now run at) |

  The decisive observation is that **the cap is not a budget, it is a
  reservation**. That session's real cost was **$0.029 for the three turns plus
  $0.005 for the report — about $0.034 total** — yet $0.20 was refused. OpenRouter
  reserves the request's maximum possible output, and because the reservation
  grows with the conversation's accumulated input, **the cap a learner needs
  scales with how long they have been talking, not with what they have spent.**
  There is therefore no single correct value, only one that covers a session of
  realistic length.

  **Superseded 2026-08-03 — remeasured after BYOK was removed and the model tier
  was made profile-driven (shipped in `3.7.0`). `0.05` is now enough.** Both root
  causes are gone: the tutor report ran on a hardcoded `regular` tier, whose
  large output ceiling drove the reservation, and it now follows the profile
  (`lite` by default). Re-run at the production value with a fresh Lite profile:
  quiz answered and evaluated, guide session of two turns, `Finalizar y resumir`
  — **all four calls succeeded, no rejection**, ending at `usage` **$0.0233** of
  the $0.05 limit, $0.0268 left. **Keep `OPENROUTER_USER_KEY_LIMIT_USD = 0.05`;
  no change needed.** The earlier recommendation below is kept as the record of
  what the number was while the tier was hardcoded.

  ~~Recommendation: `OPENROUTER_USER_KEY_LIMIT_USD = 0.50`~~ (20 credits, up from
  2). Reasoning: `0.35` is the lowest value observed to work and it worked for a
  *short* session, so it is the floor rather than a safe setting; `0.50` clears it
  with margin for a longer conversation. The expected real cost of a first full
  cycle is **~$0.03–0.05**, so a free account is expected to consume roughly a
  tenth of its cap — 100 signups cost about $4 in practice, with a worst case of
  $50 only if every one of them exhausted the ceiling, which takes on the order of
  70 tutor turns each. Note `.env.example`'s current `0.10` is **worse than
  useless**: it clears the bare reservation for an empty conversation and fails
  the moment the learner says anything.

  **The cheaper fix is engineering, not operations.** Setting an explicit output
  cap for *bounded structured* outputs — the tutor report's schema already
  constrains what a valid answer can contain — would collapse the reservation and
  make the welcome credit go far further. That is a deliberate, narrow exception
  to the `llm-credit-gate` rule against application-level `maxOutputTokens`, which
  exists to protect open-ended generation quality and has no reason to bind a
  fixed-shape report. **Both options are the founder's call; the measurement is
  done.**
- [x] Measure the real AI cost and latency of one full teacher cycle per
  operation (quiz generation/modification, evaluation, follow-up tutoring,
  report summary), feeding the contribution-margin input the business docs
  need. (This is the slice of section 2.1 kept in V3.) Concrete output: the cost
  of one cycle, and whether the welcome credit above covers it.
  **Closed 2026-08-01 (founder decision): not measuring it for now.** The
  reasoning is that inference is paid for by the credits users buy, so cost per
  cycle is not a margin risk the pilot has to answer before it runs — it is an
  input to pricing, and pricing is not being set yet
  ([negocio-roadmap](../business/negocio-roadmap.md), Fase 5).
  What stays true, and is worth re-reading before the pilot widens: the working
  assumption above — that the welcome credit covers one full cycle — is still an
  assumption, and this item was the thing that would have confirmed it. If it is
  false, a student invited by a pilot teacher hits the purchase wall part-way
  through the activity their teacher assigned. The measurement itself remains
  available in [Roadmap X §X.1](roadmap-x.md), which owns the general "the
  platform emits events but cannot answer questions" gap; it is deferred, not
  deleted.

---

## 1.8 Inference Wait-State Coverage

Added 2026-07-20 after the guest-evaluation hang. **Rule: every operation that
runs an inference must show a wait or progress affordance** — a pending modal,
an inline spinner, a streamed progress log, or at minimum a disabled button
with a loading label. A blank navigation or an unresponsive button is a bug,
because inferences routinely take several seconds and the learner cannot tell
the app apart from a freeze.

- [x] Audit every inference entry point against its UI surface. Done
  2026-07-20; covered surfaces confirmed: quiz creation, the four quiz AI
  modification operations (`data-modify-phase="generating"`), quiz submit,
  guest evaluation (section 1.6), practice-guide creation and modification,
  roleplay creation/modification/turns/finish, scene-media creation,
  variations, title generation and the streamed preview flows, chat finalize,
  report-practice, and the create-resource-from-context actions. Follow-up
  practice buttons (`/quiz-attempts/:id/practice`,
  `/roleplay-attempts/:id/practice`) and the shared practice-guide start run
  no inference — they create a conversation and hand off to the chat, whose
  own typing indicator covers the tutor's first message.
- [x] Fix the two gaps the audit found, both in roleplay opening-turn
  generation. Done 2026-07-20: (1) starting a roleplay from its detail page
  posted with no pending wiring at all; (2) starting a shared roleplay is a
  plain link navigation, so it waited on a blank page. Both now show the
  pending modal, which was also extracted to
  `views/partials/roleplay-pending-modal.ejs` instead of being duplicated per
  page.
- [x] Consider a guard test that keeps this rule from regressing: assert every
  route whose handler resolves a credit-gated key has a UI trigger carrying a
  known pending marker. Non-trivial because triggers live in EJS and client
  JS, so it is tracked but not yet scoped. **Done 2026-08-01:**
  `tests/server/inferenceWaitStateArchitecture.test.ts`.

  What made it scopable was noticing that the credit gate is reachable
  transitively, not just from the handler. The test collects every function in
  `src/server` whose body calls `getCreditCheckedOpenRouterApiKeyForUser`, then
  folds in callers to a fixpoint, so a handler still counts when the inference
  is modules deep — the scene-media routes reach it through `requireCreditKey`,
  quiz evaluation through `evaluateSubmittedQuizAttemptForUser`. Intersecting
  that with the handlers registered on a router yields **31 credit-gated
  routes**, which must equal the inventory: a new one fails the test until
  someone declares how it tells the user to wait.

  The "triggers live in two places" difficulty became the assertion rather than
  the obstacle. Each entry names the marker, the **template** that emits it, and
  the **client module** that reads it, and both are checked — because an
  attribute no client reads paints nothing, which is precisely the failure the
  rule exists to prevent. A route may instead be declared `no-ui-trigger` with a
  reason, and a third test keeps that declaration honest by asserting nothing in
  `views/` or `src/client/` references the route.

  The inventory documents the six affordances in use: the blocking pending
  modal, the shared describe→generating→preview modification modal, the
  scene-media change modal with its progress bar, a disabled button swapped for
  a loading label, the roleplay transcript's thinking turn, and the evaluating
  page that renders a spinner and posts itself.

  Verified by breaking it three ways and confirming each failure names the fix:
  removing an inventory entry, deleting a marker from a view, and pointing a
  view at the route declared as having no trigger.

  Found in passing, not fixed: **`POST /quizzes/generate-draft` is a dead
  alias** of `POST /quizzes/generate` on the same handler — nothing in `views/`
  or `src/client/` posts to it. It is recorded as `no-ui-trigger` rather than
  deleted, since removing a route is a compatibility decision, not a test one.

---

## 1.9 In-Tutor Platform Awareness

Added 2026-07-23 (founder request). In regular conversations with Mister F, the
tutor currently has no knowledge of the platform itself, so if a learner or
teacher asks about a feature ("how do I create a quiz?", "where are my shared
resources?", "can I make a roleplay?"), the tutor cannot help. Goal: give the
tutor enough general product knowledge to answer feature questions and point
users to the right place, without bloating every prompt or letting the tutor
drift off its pedagogical role.

Open design questions (to consider, not yet decided):

- **Delivery mechanism.** Two candidates: (a) a compact, always-present
  "About the platform" section in the system prompt, or (b) an on-demand tool
  the tutor calls only when the user asks about the platform (keeps the base
  prompt small and the knowledge in one maintainable place). The founder leans
  toward considering the tool approach. A hybrid is possible: a one-line pointer
  in the prompt plus a tool for detail.
- **Scope of knowledge.** Which features to describe (quizzes, roleplays,
  practice guides, media library, resources/folders, sharing, progress) and at
  what depth. Keep it feature-level and navigational, not a full manual.
- **Freshness/maintenance.** Where the canonical platform description lives so it
  does not drift from the actual product as features change.
- **Role boundaries.** Ensure platform answers do not derail tutoring; the tutor
  should answer briefly and return to the learning task.

- [x] Decide delivery mechanism (prompt section vs. tool vs. hybrid). Done
  2026-07-26 (founder decision): **hybrid** — an on-demand `get_platform_help`
  tool holds the knowledge, plus a one-line boundary in the tutor system prompt
  so the base prompt stays small and the model knows when to call it.
- [x] Draft the canonical platform-feature description and decide where it lives.
  Done 2026-07-26: single source of truth is
  `misterf-web/system-prompts/tutor/platform-overview.md` (prompt-as-file
  convention, cached, edited when the product changes). Feature-level and
  navigational only — main nav, activity types (quiz/roleplay/practice guide),
  sharing/results, progress, profiles, translator — with an explicit rule to
  answer briefly in the instruction language and that the tutor performs no app
  actions.
- [x] Wire it into regular tutor conversations and verify the tutor answers a
  feature question correctly without losing its pedagogical framing. Code
  complete 2026-07-26: `buildTutorPlatformTools` (`llmTutor/platformTools.ts`,
  no params, always available — no auth/profile needed) merged into the agent
  loop in `llmTutor/index.ts`; the `system.md` Tool Use Boundaries updated to
  list `get_platform_help` with its use/omit rule (no contradiction with the
  "only tools are…" clause); docs synced (`architecture.md` Tool Architecture,
  `runtime.md` Tools Available to Mr. F); unit test `tests/llmTutor/
  platformTools.test.ts` and prompt registered in `promptPlaceholders.test.ts`.
  Verified: typecheck, full `tests/server`+`tests/llmTutor` (281), server
  restarted healthy. **Live behavioral QA passed 2026-07-26** (founder
  click-through): a feature question in a logged-in chat fired the tool and the
  tutor answered correctly without losing its pedagogical framing.

Freshness/maintenance (design question) resolved 2026-07-26: the platform help
is hand-written and has no generator, so it can silently drift as the product
changes. Closed with the `tutor-platform-help` convention skill, which requires
updating `platform-overview.md` in the same change whenever a main feature,
navigation area, activity type, or sharing behavior changes.

Relevant skills: `tutor-platform-help` (keeps the help in sync),
`system-prompt-coherence`, `llm-tool-documentation`.

---

## 1.10 Tutor Plan Panel Defaults To Minimized

Added 2026-07-26 (founder observation). When Mister F emits a `tutor_plan` or
`tutor_plan_update`, the plan UI currently appears expanded because
`TutorPlanView` initializes `isMinimized` to `false`. The full summary and step
list sit above the composer and take substantial vertical space away from the
conversation. The plan is supporting context, so it should stay visible without
competing with the learner's current exchange.

- [x] Render a newly visible tutor plan in its minimized state by default,
  showing the current active or next pending step plus the expand and conclude
  controls. The learner can expand it deliberately to inspect the complete
  plan. Done 2026-07-26.
- [x] Preserve the learner's explicit minimized/expanded choice across
  `tutor_plan_update` events. Clearing or concluding the current plan must reset
  the view so the next new plan starts minimized again. Done 2026-07-26.
- [x] Keep minimize, expand, and conclude controls keyboard- and
  screen-reader-accessible, and move the existing hard-coded Spanish action
  labels in `TutorPlanView.js` into the es/en/ht client i18n catalogs when
  implementing the behavior. Done 2026-07-26.
- [x] Add focused client tests for initial minimized rendering, manual
  expansion, update-state preservation, and reset-before-next-plan behavior;
  verify the compact panel above the composer on both mobile and desktop.
  Done 2026-07-26: focused DOM behavior coverage plus the existing responsive
  composer layout verified through the client build.

---

## 1.11 Duplicate Resources And Folders

Added 2026-07-27 (founder request). There is no way to copy an existing resource
today, so reusing an activity means recreating it. The driving use case comes
straight from the participant-results work in §1.6: an owner who runs the same
exercise with **different groups** needs one copy per group, because attempts,
reports, and the participation summary are all keyed to a single resource. Today
a second group's results land on top of the first group's. Duplicating gives each
group its own resource and therefore its own segmented evaluations and summary.

Scope: duplication applies to **resources** (quizzes, roleplays, practice guides,
and scene media) and to **folders**.

- [x] Duplicate a resource from the catalog and its detail page, producing an
  independent copy owned by the active profile, with a clearly derived title.
  Copy only the authored content; never copy participation data — no attempts,
  reports, share links, grants, or participation summary carry over, and the copy
  starts unshared so the new group's results stay separate. Done 2026-07-27:
  `resources/duplicate.ts` + `POST /resources/:resourceId/duplicate`, offered
  from the catalog row menu and each detail page's `Opciones`. A duplicate is
  written as a fresh original — no `source*` or `sharedVia` marks — so it is not
  confused with an imported share, and the owner lands on the copy.
- [x] Duplicate a folder, including the resources filed inside it. Done
  2026-07-27. **Recorded decisions:** nested folders **do** recurse (bounded to
  10 levels, since the schema does not prevent a pathological chain); resources
  shared *with* the owner are **skipped**, as are archived ones, because
  duplication produces owned copies; and only the duplicated folder itself is
  renamed — its contents keep their titles, so the copy reads like the original.
- [x] Keep it archive- and Trash-aware. Done 2026-07-27: duplicating an archived
  resource is refused outright, and archived children are skipped when copying a
  folder, so a duplicate never resurrects Trash content.
- [x] Cover with tests. Done 2026-07-27 for repository/service behavior
  (`tests/db/resourceDuplication.test.ts`, 5 tests: independent copy with derived
  title, no attempts or share link carried over, folder recursion with nested
  subfolder, archived refusal, and other-profile refusal). **Live click-through
  done 2026-08-01**, self-served on the local server with the QA account against
  a quiz that already had participation (3 attempts, a live share link, and a
  persisted AI summary). Duplicated from the detail page; the owner landed on
  the copy, titled `Copia de …`.

  Verified in SQLite and in the UI: the copy carries the 5 authored blocks and
  **nothing else** — zero attempts, zero grants, no participation summary, and
  no `source*` or `sharedVia` marks, so it reads as a fresh original rather than
  an imported share. Its participation page renders the friendly empty state
  (*"Todavía no hay respuestas"*) while the original still lists its two
  collectable participants and keeps its AI summary. The `resource_duplicated`
  event logged with the right source and target; the error log stayed clean.

  One thing worth recording because it looks like a violation and is not: the
  copy **does** get a `resource_share_links` row. It is not copied — `duplicate.ts`
  never touches share links — it is minted lazily by `renderQuizShowPage`, which
  calls `getOrCreateResourceShareLink` for any owner opening the detail page, so
  the share modal has a URL to show. The id differs from the original's, nobody
  has been given it, and the copy is unreachable through the original's link.
  The separation the feature promises holds; the row is pre-existing product
  behavior, not duplicated participation.

---

## 1.12 Scene Media As A Resource

Added 2026-09-09 at the founder's direction, immediately after built-in scene
media was removed from the product (V4 §1.3, decision of the same date). Design
context: [Scene Media Library](../features/scene-media-library.md).

**This reverses, for this one initiative, the "V3 retains no media-library
checklist" line in §1.2.** The Media Library *record* stays in
[V4 §1.3](roadmap-v4.md#13-scene-media-library); what lives here is the
unification work, because it is being done now against the current release line
rather than deferred behind pilot evidence.

### The Problem

`resources` is a spine, not a type: `id, user_id, profile_id, type, title,
description, topic, level, archived_at, source_resource_id, shared_via`. Each
type hangs off it through a detail table whose `id` is a foreign key to
`resources.id` (`quizzes`, `roleplays`, `practice_guides`), and so do
`resource_share_links`, `resource_access_grants`, `resource_folder_items`, and
`resource_participation_summaries`.

`user_scene_media` sits entirely outside that spine and reimplements what the
spine already provides: ownership columns, archive/restore, its own trash page,
its own listing and filters, its own breadcrumbs, and 19 routes under
`/media-library` served by a 1,325-line handler module.

The only thing that ever justified the separate layer was blending the built-in
catalog with the user's own media — `listSceneMediaItems` concatenated user
items first, built-ins after. That blend was deleted on 2026-09-09. What remains
is a second resource infrastructure that no longer merges anything, and that
pays for its separateness: **scene media has no sharing at all, and cannot go in
a folder.**

### The Decision

Two decisions, taken 2026-09-09:

- **Data: scene media becomes a resource.** `resources.type = 'scene_media'`,
  with `user_scene_media` kept as the detail table, keyed by `resources.id`,
  exactly like `quizzes`.
- **UI: `/resources` only.** Media appears in the resources catalog with the
  type filter, and **`/media-library` stops existing** — no nav entry, no
  route, no link anywhere in the product, the tutor's platform help included.
  Per-media pages move under `/scene-media/:mediaId`, matching how `/quizzes`
  redirects to `/resources` while `/quizzes/:quizId` serves the resource.

Timing is deliberate: **production holds zero media rows**, and the local test
rows are disposable (founder, 2026-09-09). This is the cheapest this migration
will ever be, and it gets more expensive the moment media has share links to
preserve.

### Decisions To Make Before Building

These are genuine product questions, not implementation detail. Each one has a
cheap default; the point is to choose deliberately rather than inherit an
answer from the quiz flow.

- [ ] **What does sharing a media mean?** Every shareable resource today is
  something the recipient *does*: `/{quizzes,roleplays}/shared/:shareId/take`
  starts an attempt, and `collect_results` decides whether the owner sees it.
  Scene media has no attempt — Roadmap X says so in as many words ("Scene media
  has no attempts and is unaffected"). So a shared media is view-and-reuse, and
  the share UI must not offer result collection. Cheap default: allow profile
  and link sharing, force `collect_results = 0`, and hide the participation
  affordances for this type.
- [ ] **What does duplicating a media mean?** `handleDuplicateResource` deep-copies
  the detail row. For media the detail row points at Spaces objects, so a
  duplicate either copies binaries (real storage cost, and the variation flow
  already exists for "same image, new script") or shares them (two resources
  pointing at one object, and deleting one must not orphan the other). Cheap
  default: no duplicate action for `scene_media` in V1 — "Create variation"
  already covers the intent and does it better.
- [ ] **Do the level and format filters survive?** `/resources` filters on
  query + type + sort; `/media-library` filters on query + level + format. A
  straight merge loses the last two. Search already covers `resources.level`
  once the level is copied onto the spine row, so the cheap default is to drop
  the dedicated dropdowns and revisit if the catalog gets big.
- [ ] **Does the catalog distinguish material from activity?** Everything in
  `/resources` today is something the learner does; media is something they use.
  `resource_folder` is already a non-activity in that list, so the spine is not
  the problem — the question is whether a media card needs to read differently
  (thumbnail, no "assign" affordance) so the list does not promise an activity
  it cannot deliver.

### Make The Schema Extensible For Future Resource Types

Added 2026-09-09 at the founder's direction. `scene_media` is the **first type
added since `resources` was created**, and the cost showed up immediately: the
allowed types are frozen in two `CHECK` constraints — `resources.type` and
`resource_folder_items.resource_type` — and SQLite cannot alter a CHECK, so a
new type means editing `sqlite_master` or rebuilding a table that three others
reference by foreign key. That is a disproportionate price for adding a word to
a list, and it will be paid again by every type after this one.

Two findings make the fix smaller than it looks:

- **One of the two CHECKs is already redundant.** `resource_folder_items` has
  the composite foreign key `(resource_id, resource_type) REFERENCES resources
  (id, type)`, so a row can only name a `(id, type)` pair that already exists in
  `resources` — whose own CHECK constrains it. The pair is genuinely enforced,
  not decorative: `idx_resources_id_type` is the `UNIQUE` index SQLite requires
  on the parent columns, and `foreign_keys` is `ON`
  (`db/database.ts:12`). The item-level CHECK re-states an invariant the FK
  already guarantees and can simply be dropped.
- **The type list lives in six places, and nothing keeps them in step:** the two
  CHECKs, the `ResourceType` union (`db/repository.ts:40`), the hand-written
  `isKnownResourceType` or-chain (`db/repository.ts:1177`), the deliberately
  smaller `ContextResourceType` (`services/resourceFromContext.ts:15`, the types
  creatable from a conversation), and the per-type branching in the handlers and
  views (kicker icons and labels, duplication, trash, progress). The per-type
  branching is irreducible — each type has its own detail table and pages — but
  the *lists* are not, and today a forgotten one fails at runtime rather than at
  build time.

- [ ] **Decide how the allowed types are expressed.** Options, in the order I
  would consider them:
  - **A lookup table plus a foreign key.** `resource_types(type TEXT PRIMARY
    KEY)`, `resources.type REFERENCES resource_types (type)`. Adding a type
    becomes a one-line declarative `INSERT` in a normal forward-only migration —
    no `sqlite_master` editing, no table rebuild, ever again. Keeps the
    invariant in the database, which is this schema's house style (see the
    cross-column CHECKs on `user_scene_media`). Costs one table and a seed.
  - **Drop the CHECK and let the application own the invariant.** There is
    exactly one writer (`insertResource`) and the union already gates it. Zero
    migration cost for future types, but the database stops defending itself
    against a bug in our own code.
  - **Keep the CHECKs and standardise the widening.** A helper in
    `migrations.ts` that rewrites a CHECK through the `run(db)` hatch, so each
    new type is a one-liner. Cheapest now, but keeps a schema migration in the
    path of every future type.
- [ ] **Derive the type list from one source.** Export a `resourceTypes` const
  array, derive `ResourceType` from it, replace the `isKnownResourceType`
  or-chain with a membership check, and define `ContextResourceType` as an
  explicit subset of it so the relationship is visible instead of coincidental.
- [ ] **Guard the places that must be extended together** with an architecture
  test, the way `resourceBreadcrumbArchitecture.test.ts` already guards view
  classification: a new entry in `resourceTypes` should fail the suite until the
  kicker label, icon, trash copy, and duplication behaviour exist for it.

This is scoped deliberately: it changes how the type list is *expressed*, not
what the spine is. It belongs to this item because `scene_media` is what
surfaces the cost, and doing it in the same migration is nearly free — the
`resources` table is being touched anyway.

### Plan

**Phase 1 — Schema (one migration, id 30).**

- [ ] Allow `scene_media` as a resource type, applying whatever the extensibility
  decision above settles on — so this is the last time a new type costs a schema
  change. Whichever option wins, the mechanism is the programmatic `run(db)`
  migration hatch: it exists precisely for this (its doc comment cites "editing
  `sqlite_master` to drop a CHECK"), the migrator already enables better-sqlite3
  unsafe mode and resets the schema afterwards, and no migration has used it
  yet. That avoids rebuilding a table three others reference by foreign key.
- [ ] Drop the redundant `resource_type` CHECK on `resource_folder_items`; its
  composite foreign key into `resources (id, type)` already enforces it.
- [ ] Rebuild `user_scene_media` as a detail table: drop `user_id`,
  `profile_id`, `title`, `status`, `archived_at` (all now on the spine), make
  `id` a foreign key to `resources.id ON DELETE CASCADE`. Keep what is genuinely
  media-specific: `generation_mode`, `generation_prompt`,
  `script_type_preference`, `format`, `level`, `setting`, `visual_summary_json`,
  `image_json`, `audio_json`, `script_json`, `created_from_json`,
  `provenance_json`, `source_media_id`, `source_visual_asset_id`.
- [ ] Decide the spine mapping and apply it in the same migration: media
  `title` → `resources.title`, `setting` → `resources.topic`, `level` →
  `resources.level`, `visual_summary_json` joined → `resources.description`
  (so catalog search finds a scene by what is in it).
- [ ] Backfill: insert one `resources` row per existing `user_scene_media` row.
  With zero rows in production this is a no-op there; locally it is four rows
  and they may simply be deleted instead.
- [ ] Drop the dead `authoring_messages_json` column while the table is being
  rebuilt anyway — it has been unused since the authoring chat was retired
  (V4 §1.3, 2026-07-14), and the "no destructive migration" reason for keeping
  it was production-data compatibility that no longer applies.

**Phase 2 — Domain.**

- [ ] Move ownership, archive/restore and listing off `sceneMedia/userMediaRepository.ts`
  onto the resource repository; the media repository keeps only the layer
  operations (`applyUserSceneMediaImage`, `applyUserSceneMediaScript`,
  `applyUserSceneMediaMetadata`, `createReadyUserSceneMedia`).
- [ ] Delete `sceneMedia/library.ts`. Listing becomes a resource query; the
  media-specific `SceneMediaLibraryFilters` disappear with the dedicated
  filters.
- [ ] Point `services/sceneMediaResolver.ts` at the resource-backed listing.
- [ ] Leave the generation pipeline alone: `creation.ts`, `sceneMediaPreview.ts`,
  `imageGeneration.ts`, `audioGeneration.ts`, `generationContext.ts`,
  `imageAssets.ts` are media-specific and do not move.

**Phase 3 — Routes and URLs.**

- [ ] `/media-library` → **gone**, not redirected: it was never a public URL,
  it needs no permanent redirect, and leaving one keeps the concept alive in
  the codebase. (If the pilot has bookmarks, add a temporary redirect and say
  so here.)
- [ ] Per-media routes move to `/scene-media/:mediaId` (`/edit`, `/preview/*`,
  `/image`, `/variations/new`, `/variations`, `/generate-title`).
- [ ] Archive, restore, folder, and share go through the existing
  `/resources/:resourceId/*` routes — nine media routes disappear rather than
  being ported.
- [ ] `POST /media-library` (create) becomes `/scene-media/new` +
  `POST /scene-media`, matching `/quizzes/new`.

**Phase 4 — Views.**

- [ ] `media-library.ejs` and `media-library-trash.ejs` are deleted; the
  catalog and trash are `resources-list.ejs` and `resources-trash.ejs` with a
  `scene_media` card and icon.
- [ ] `media-library-show.ejs`, `-new.ejs`, `-variation-new.ejs`,
  `-authoring.ejs` are renamed to `scene-media-*.ejs` and adopt the resource
  page conventions (kicker, breadcrumbs, close button, action row, Options
  dropdown with share/duplicate/move-to-folder/archive).
- [ ] The `scene-media-*` partials (audio player, change modal, pending modal,
  client script) keep their names and only lose their `/media-library` URLs.

**Phase 5 — Reference sweep. No `/media-library` may survive anywhere.**

Known references, by file, to work through: `sceneMedia/handlers.ts` (46),
`partials/scene-media-change-modal.ejs` (39), `tests/server/routes.test.ts` (39),
the five `media-library-*.ejs` views (~130 between them),
`sceneMedia/routes.ts` (19), `tests/server/inferenceWaitStateArchitecture.test.ts`
(14), `partials/scene-media-audio-player.ejs` (11),
`tests/server/resourceBreadcrumbArchitecture.test.ts` (8),
`partials/scene-media-pending-modal.ejs` (3), `partials/app-shell-open.ejs`
(the nav entry), the three i18n catalogs, `partials/resource-page-kicker.ejs`,
`partials/breadcrumb.ejs`, `partials/media-library-client-script.ejs`,
`pages/shell.ts` (the `mediaLibrary` view id),
`tests/server/routeArchitecture.test.ts`, `tests/llmTutor/platformTools.test.ts`,
and `system-prompts/tutor/platform-overview.md`.

- [ ] Remove the side-panel nav entry and the `mediaLibrary` `currentView` id;
  media pages become `currentView: 'resources'`.
- [ ] Fold the ~144 `mediaLibrary.*` i18n keys into `resources.*` where they
  duplicate an existing string, and keep only what is media-specific.
- [ ] Update `system-prompts/tutor/platform-overview.md` so `get_platform_help`
  stops naming a page that no longer exists (`tutor-platform-help` skill).
- [ ] Finish with a repo-wide grep for `media-library` and `mediaLibrary` that
  returns only history: this roadmap, the feature doc, and V4 §1.3.

**Phase 6 — Tests and guards.**

- [ ] `resourceBreadcrumbArchitecture.test.ts` and
  `inferenceWaitStateArchitecture.test.ts` inventory view filenames and must be
  updated with the renames (`testing-conventions`).
- [ ] Route/render coverage for a media resource in the catalog, in a folder,
  shared by link and by profile, archived and restored.
- [ ] A repository test for the spine/detail split: creating a media writes both
  rows, archiving through the resource route hides it from the catalog, and
  deleting the resource cascades to the detail row.

### Verification

- [ ] `npm test`, `npm run typecheck`, `npm run test:typecheck`, `npm run build`.
- [ ] Live QA as `qa.fable` (`live-product-qa`): create a media, find it in
  `/resources` and inside a folder, share it by link and open it as
  `qa.student`, archive and restore it from the resources trash, and create a
  variation. None of it costs inference except the creation itself, which does —
  budget one media generation.
- [ ] Confirm in SQLite that a media has exactly one `resources` row and one
  `user_scene_media` row, and that archiving sets `resources.archived_at` only.

### Related

- [Roadmap V4 §1.3](roadmap-v4.md#13-scene-media-library) — the Media Library
  record, including the two open items this unblocks: media-to-resource
  derivation (which becomes resource-to-resource) and the "media-resource
  sharing model" that grant-aware storage protection was deferred behind.
- [Scene Media Library](../features/scene-media-library.md) — design doc, whose
  built-in sections are now history.
- [Roadmap V3.5 §1.10](roadmap-v3-5.md) — the precedent for the counterargument
  weighed here: two lists with different jobs should not be merged just because
  they look similar. The difference is that `resources` is not a second list of
  the same records; it is the spine media should have been on.

## 1.13 Make The Exercise Catalog Visible At Creation Time

Added 2026-09-09 at the founder's direction. **Evaluation item: the decision is
what the affordance should be, not whether to build a particular widget.**

### The Problem

The content creator cannot see what the platform can build. Creating a quiz is
a single free-text box — `views/quizzes-new.ejs` posts one `prompt` field, and
the only hint about what is possible is the placeholder text ("an 8-question
quiz to practice present perfect vs. past simple with B1 students"). Nothing
tells the teacher that the platform supports nine item kinds, or names any of
them.

The catalog exists and is already well-formed — it is just pointed at the wrong
audience:

- **The model sees it.** `system-prompts/resources/quiz-draft.md` lists every
  supported item shape with its JSON schema, and
  `quiz-translation-authoring-kinds.md` is appended for the language packs that
  use it (`services/llmTutor/languagePack.ts:86`).
- **The teacher sees it, but only after the quiz exists.**
  `getQuizBlockKinds` (`quizzes/handlers.ts:129`) already returns a localized
  `{value, label, description}` list, filtered by
  `includesSpanishTranslationBlocks`, and the authoring editor renders it as a
  `<select>` in both the add-block and modify-block modals
  (`views/quizzes-authoring.ejs:184`, `:406`).

So the creator learns the vocabulary by generating something first, reading
what came out, and then correcting it — one inference round-trip to discover a
list we could have shown for free. The predictable failure mode is a teacher
describing what they want in their own words ("preguntas para completar"),
getting the model's guess at which kind that maps to, and iterating against a
menu they cannot see.

### Why This Matters Beyond Convenience

Three properties of the catalog make the invisible version actively wrong, not
merely unhelpful:

- **It is language-dependent.** `quiz_translate_to_english` and
  `quiz_understand_in_spanish` only exist for language packs with
  `includesSpanishTranslationBlocks`. Any static help text, screenshot, or
  onboarding doc would be wrong for some locales — whatever we build must read
  from the same source the filter reads.
- **It is about to grow.** §1.12 makes adding a *resource* type cheap; item
  kinds have the same "list lives in several places" shape (the prompt files,
  the Zod schemas, `getQuizBlockKinds`, the i18n label pairs), so a creator-
  facing surface must be derived, never hand-maintained.
- **Precision is the whole point of the pilot.** The MVP promise is that a
  teacher gets a usable quiz from their own material on the first try. Every
  round-trip spent discovering vocabulary is inference the teacher pays for and
  a step where they may conclude the tool does not do what they meant.

### Questions To Answer

- [ ] **Where does the catalog belong — reference, or input?** Two different
  products: (a) a *visible list* at `/quizzes/new` that teaches the vocabulary
  and lets the teacher name kinds in their own prose, and (b) *structured
  input* — pick kinds, optionally counts, and constrain the draft. (a) is
  nearly free and changes nothing downstream; (b) is a real feature with a
  prompt contract behind it. They are not exclusive, and (a) is likely a
  prerequisite for (b).
- [ ] **If structured input: does the model obey, and how do we know?** A
  selected set of kinds has to travel into `quiz-draft.md` as a constraint and
  come back honored. Decide whether it is a hard constraint (validate the draft
  and repair, the way `blockRepair` already does) or a strong hint, and what
  the UI says when the model returns something else.
- [ ] **What does "not selected" mean?** Empty selection must keep working
  exactly as today — the model chooses — or we have made the flow heavier for
  the teacher who just wants a quiz.
- [ ] **Does this generalize past quizzes?** Roleplays and practice guides
  compose the *tutor* block set (`system-prompts/tutor/blocks/`, 18 files),
  which the creator cannot see either; a practice guide steers it only through
  prose `tutorInstructions`. Decide whether this item covers quizzes only, or
  whether the answer is one shared "what this platform can build" surface.
- [ ] **Does the same list have a job outside authoring?** The tutor's platform
  self-knowledge (§1.9) answers "what can you do" from a hand-written
  description; a derived catalog could feed both.

### Cheap First Cut, If The Evaluation Confirms It

Not a commitment — the shape to price the evaluation against:

- [ ] Lift `getQuizBlockKinds` out of `quizzes/handlers.ts` into a place the
  new-quiz handler can call, and render its `label` + `description` under the
  prompt box as a collapsible list. Zero prompt changes, zero new inference,
  correct per locale by construction.
- [ ] Only then decide on selection, based on whether teachers who can see the
  list still describe kinds imprecisely.

### Related

- §1.9 In-Tutor Platform Awareness — the other place the product has to explain
  itself, today from prose rather than from the code's own lists.
- §1.12's "derive the type list from one source" — the same pattern one level
  up (resource types); the item kinds are the level below it.
- [Roadmap V4 §2.2 Structured Block Post-Processing](roadmap-v4.md) — if kind
  selection becomes a hard constraint, the repair path is where it is enforced.

## 1.14 Signed-In Home Modes — Learning And Teaching

Added 2026-09-09 at the founder's direction, after testing the product with a
real teacher (the founder's father, the original Mister F).

**This amends the design decision recorded in §1.6** — "no teacher/student
profiles, no role-aware homes" (2026-07-18) — and it amends **only the
presentation half of it**. The authorization half stands unchanged and is not
reopened:

- **Unchanged.** Access is resource-scoped: the owner of a resource sees its
  attempts. No account-level roles, no classroom entity, no capability gated
  by mode, no second authorization axis.
- **Changed.** The home surface is composed differently depending on how the
  person is using the product right now. A mode is a *view*, not a permission.

**Scope: the signed-in home only.** `/` serves two different products
depending on the session — `landingRouter` renders the public marketing
landing for a visitor (`views/landing.ejs`, with its `/en`, `/es`, `/ht`
editions), and passes any authenticated request through to the app shell.
This item touches only the second one. The landing page is finished work and
is not reopened here; nothing below changes what a new or logged-out visitor
sees.

### The Problem

`/` is a new tutor conversation for everyone (`chatRouter.get('/',
renderChatPage)`, `misterf-web/src/server/chat/routes.ts:21`). For someone who
opened the app to prepare material for their students, that is a blank canvas
for a task they do not have — and their actual work is buried: what they
created and shared is two clicks away in `/resources`, and the results they
came for are one click deeper still, on each quiz's participation page.

The gap is symmetric, and the pilot only made the teaching half visible first:
for the learner, the activities shared *with them* are equally buried in the
same catalog, behind the `with_me` filter value added on 2026-07-23.

Everything both homes need already exists as data. What is missing is a
surface that puts it first.

### The Model (decided 2026-09-09)

- **Mode is presentation, never permission.** Both modes reach every feature.
  A teacher who wants to experience the product as a student switches mode;
  they must not be forced to create a second profile to do it.
- **The profile stores a preferred mode; the mode is switchable at any time**
  without editing the profile. The stored value decides what the home opens
  as; the switch decides what it shows now.
- **Per profile, not per account.** This preserves the acid test in
  [Classrooms](../features/classrooms.md) — a parent who studies English *and*
  assigns practice to their child — and reuses the profile switcher already in
  the user menu (`views/partials/switch-profile-modal.ejs`).
- **Existing profiles default to learning**, which is today's behavior; the
  user changes it from profile settings. No backfill guesses a mode from
  history.
- **Naming: a verb in the first person, never a noun for the person.**
  `Estoy aprendiendo` / `Estoy enseñando`, with the help text carrying the
  breadth ("your class, your child, anyone you are helping") so the short
  label does not have to. Internal values are `learn` / `teach`.
  Deliberately **not** "guía": the product already uses *Guías de Práctica*
  for a resource type, so the word cannot also name a person. Also rejected:
  "profesor/estudiante" (identity labels that exclude the parent and the
  tutor) and "acompaño" (accurate but too vague to read as an action).

### Teaching Home

In priority order:

1. **New since your last visit** — activity on shared resources, e.g. "3 new
   responses in *Past simple*". This is the retention mechanic: without it, a
   teacher has no reason to open the app between one class and the next. The
   attempts are already collected (§1.6, `collect_results` snapshotted per
   attempt).
2. **What I shared**, with attempt counts and who practiced. Note this
   deliberately restores what the 2026-07-23 simplification in §1.6 gave up:
   folding "Compartidos" into `/resources` dropped the at-a-glance counts and
   sent them to each resource's participation page. The home is the right
   place for them; the separate catalog page is still not.
3. **Create an activity** — direct shortcuts to quiz, roleplay, and practice
   guide from a prompt.
4. **Create an activity from these results** — the evidence-driven authoring
   action already named as the cheapest rung in
   [Classrooms](../features/classrooms.md); it closes share → results → next
   activity and needs no new entity.
5. **Ask Mr. F** — the tutor stays reachable but demoted. A teacher does use
   it, to prepare material rather than to practice.

### Learning Home

1. **Waiting for you** — activities shared with me and not yet completed, plus
   unfinished attempts.
2. **Continue** — the open conversation or the guide in progress.
3. **The chat composer, prominent.** For this mode the conversation stays the
   emotional center of the product.
4. **See my progress** — an entry point to the existing `/progress` page.
   (Chosen 2026-09-09 over the "a couple of practice suggestions" sketch: a
   link to a page that already exists costs nothing and does not commit the
   home to a recommender.)

This is the same skeleton as
[Home Start Experience](../features/home-start-experience.md) Option B — a
compact panel above the composer. The specialization is only *which panel sits
there and how much it weighs*: one route, one shell, two compositions. Not two
dashboards and not a second home route.

**Superseded 2026-09-10 by [§1.16](#116-a-learner-home-that-is-not-the-chat)**
(founder direction): the learning composition is its own page, not the chat
with a panel above the composer, and the panel was removed from `/chat`. What
still holds from this section is one route and one shell — `/` renders one of
two compositions by mode, and the tutor chat lives at `/chat`.

### Checklist

Shipped 2026-09-09; typecheck, test typecheck, and the full suite pass, and the
whole surface was exercised live on the QA account (evidence below).

- [x] Persist the preferred mode. Migration 30 adds `profiles.home_mode`
  (`TEXT NOT NULL DEFAULT 'learn'`), mapped through `StoredProfile.homeMode`
  and normalized by `src/server/profiles/homeMode.ts`. The field is on the
  profile form (`views/profiles-form.ejs`) and on profile onboarding
  (`views/profile-onboarding.ejs`), so it is asked once and editable forever.
- [x] Runtime switch. `POST /home/mode` writes the **stored preference**
  rather than a session override — decision below — behind a two-button
  control (`views/partials/home-mode-switch.ejs`) that appears on both
  compositions.
- [x] Compose `/` per active mode. A new `src/server/home/` module owns the
  route: `renderHomePage` dispatches to `renderChatPage` or the teaching page,
  and `homeRouter` is mounted between `landingRouter` and `chatRouter`. `/chat`
  stayed on the chat router and renders the chat in either mode; guests are
  untouched.
- [x] Teaching panel from existing queries. One new aggregate,
  `listSharedResourceParticipationForProfile`, unions the three collected
  participation sources (quiz attempts, roleplay attempts, practice-guide
  reports) so the page is a single query instead of one call per resource. It
  reuses the exact membership rules of the per-resource lists: only
  `collect_results` participations, never the author profile's own runs.
- [x] Learning panel from existing queries.
  `listResourcesSharedWithProfile` returns granted, non-archived, non-folder
  resources with whether this profile has started them; not-yet-started first.
- [x] **Deterministic only.** No inference on either composition: no ranking
  call, no generated copy, no pending modal. Opening the app costs nothing and
  never waits.
- [x] i18n for `es`, `en`, and `ht` under a new `home` namespace; no
  hard-coded strings in the new views. Verified by rendering the teaching home
  in Haitian Creole with a clean missing-key log.
- [x] Route and repository tests. `tests/db/homeRepository.test.ts` covers the
  mode default, the single-column update, cross-account rejection, collected
  vs. uncollected vs. owner participation, the recency window, pending
  ordering, and an archived resource dropping out. Seven cases in
  `tests/server/routes.test.ts` cover both compositions, their empty states,
  the switch round trip, `/chat` in teaching mode, and a signed-out switch.

### Decisions Made During Implementation

- **The switch writes the stored preference; there is no session override.**
  One value, one source of truth: the profile form and the home switch can
  never disagree, switching survives the next visit, and no new state was
  added. This answers both switch open questions at once. It lives on the home
  itself rather than the user menu, where it would read as a profile change.
- **"New since your last visit" is a fixed 7-day window, not a stored
  marker.** A per-profile `last_seen` advances on render, so an accidental
  refresh would erase the very badge the teacher came for, and it would add a
  write to a read-only page. A week matches the pilot's cadence — what happened
  between one class and the next. The constant is
  `recentParticipationWindowDays` in `src/server/home/data.ts`.
- **Section order is Novedades → Crear actividad → Lo que compartí**, not the
  order sketched above. Putting creation second means a profile that has shared
  nothing still opens on a useful action, while an active one still leads with
  what arrived — without a second empty-state layout.
- **"Create an activity from these results" was not built.** It needs a
  generative flow of its own (a prompt contract over the aggregate, the credit
  gate, the §1.8 pending modal), which is exactly what the deterministic-home
  rule excludes. Instead every row links to the resource's participation page,
  where the response summary already lives. The action stays a candidate there,
  next to the data it would read.
- **The sidebar is unchanged.** The blast radius stays at one page, which is
  what makes the change measurable.
  **Amended 2026-09-09 (same day, founder direction) when the Cuaderno theme
  landed**, which asked for the modes to be visibly different rather than only
  structurally different. `<html>` now carries `data-mode` on every app page
  (`views/partials/app-shell-open.ejs`, from `activeProfile.homeMode`) and the
  conversation panel carries a three-pixel accent rail. What that buys is the
  one mode signal that survives navigating away from the home; what it
  deliberately does not do is repaint the app. Bootstrap compiles
  `.btn-primary` to concrete values, so a full per-mode reskin would mean
  forking every Bootstrap component behind a `[data-mode]` selector — refused.
  The mode moves color on the theme's own components and nothing else: no
  layout, no spacing, no type outside `.mf-mode-skin`, which only
  `views/home-teaching.ejs` wears. The blast radius is therefore wider than
  one page but still zero-risk to read: see
  `misterf-web/src/client/theme/README.md` §5.
- **The switch is the theme's segmented control, not nav pills.** Bootstrap's
  `.nav-pills .nav-link.active` compiles to the app's primary, so in learning
  mode the control that exists to show the mode was painted the teaching
  color. `.mf-mode-switch` paints its selected option with `--mf-mode`, so the
  control now shows the mode instead of only naming it. Same two options, same
  posted form.
- **Amended again 2026-09-10, on founder direction, and this one reverses the
  two calls above.** Shown both versions side by side, the founder chose the
  demo's behavior: the switch lives **under the brand in the side panel**, and
  the mode reskins the **whole signed-in app**, not just the home.
  - The switch moved out of both home compositions into
    `views/partials/app-shell-open.ejs`, with the profile's mode help text
    under it. One control in one place; `returnTo` is now the current page, so
    switching repaints where you are instead of sending you home. The two
    options sit on one line with short labels (`Aprendo` / `Enseño`,
    `Learning` / `Teaching`, `Aprann` / `Anseye` — keys `home.modeLearnShort`
    and `home.modeTeachShort`), founder direction 2026-09-10: the full phrases
    do not fit side by side in a 220px panel, and stacked they read as two nav
    links rather than one choice. The short forms are still verbs, never a noun
    for the person, so the naming rule above holds; the full phrase stays as
    the tooltip and on the profile form. Cost, accepted: below `lg` the panel is an offcanvas,
    so on a phone the switch is one tap behind the hamburger.
  - The mode now moves the page ground, the card radius, the heading face and
    Bootstrap's whole primary family, so a primary button is terracotta while
    you are learning and navy while you are teaching. This restores the two
    variables the theme had dropped (`--mf-app-bg`, `--mf-card-radius`).
  - The earlier claim that this would mean "forking every Bootstrap component"
    was wrong, and worth recording because it nearly settled the decision.
    Bootstrap 5.3 components read their own `--bs-*-*` custom properties, so
    re-pointing those at `--mf-mode` is a set of rules written **once** —
    `misterf-web/src/client/theme/_mode-bootstrap.scss`, which contains no
    `[data-mode=…]` selector at all.
  - Two guardrails hold and are the reason this stays safe: the mode never
    moves **layout** (nothing reflows or disappears, so switching is a repaint)
    and never changes **meaning** (semantic colors are identical in both). A
    page with no profile gets no mode and keeps the app's navy.
  - Follow-up, same day: secondary buttons stayed a fixed slate and read as
    blue on the learning mode's warm paper. Neutrals now follow the mode's
    **temperature** (warm grey / slate) but never its accent, and every
    border follows too — component borders read `var(--bs-border-color)` at
    runtime instead of a compiled hex. Same mechanism, no view touched.
  - Follow-up, same day, on founder direction: on phones the switch is no
    longer only behind the hamburger. An icon-only copy sits at the end of
    the mobile toolbar, beside the translator; the side-panel copy stays.
    This retires the "one tap behind the hamburger" cost accepted above.
  - Regression found and fixed the same day: the mode rail's commit
    (`5c413f9d`, 2026-09-09) gave `.conversation-panel` `position: relative`,
    which outranked Bootstrap's `position: fixed` for `.offcanvas-lg`. On
    phones the open side panel collapsed to zero height. The rule is now
    scoped to `lg` and up.
- Also extracted in passing: `src/server/resources/paths.ts`, so the catalog
  and the home build resource links from one definition, and
  `PedagogicalResourceType`, which makes "folders are not activities" a type
  error to forget rather than a missing lookup at render time.

### Live QA (2026-09-09, local, no inference)

Run on `qa.fable@misterf.local`, everything free of LLM calls. Verified: the
learning panel renders the profile's real shared-with-me activities above the
composer and disappears on an open conversation; the switch flips both
compositions and persists to `profiles.home_mode`; the teaching home lists four
real shared activities with participant counts and last-response times; a
freshly inserted collected attempt made **Novedades** appear with "1 respuesta
nueva" and moved the count 5 → 6; each row reaches the participation page with
the participant listed; the profile form persists the mode without disturbing
name, tier, or language; mobile (375px) lays both compositions out without
overflow; the Haitian Creole render is complete. The probe attempt was deleted
and the QA profile restored to `learn`/`es`. Server error log gained nothing
during the session.

Adjusted after looking at it: the shared-activity rows first rendered their
titles as links, which Flatly paints green — they now use the resource
catalog's row shape (body-text title, whole row as a stretched link) so the two
lists read alike.

Adjusted again on founder review the same day: the mode switch was crowded
beside the page title and beside the panel heading, where it also read as an
action on that title rather than as the choice of which home you are looking
at. It now sits on a **row of its own above both compositions**, rendered as
nav pills — the pattern the app already uses to switch views (the progress
tabs, the closed-conversation tabs). The pills stay side by side on a narrow
screen (`flex-nowrap`, with the labels shrinking under 480px) because a wrapped
pill loses its background and reads as a stray link under the active one.

Fixed on founder report after the 3.13.0 deploy: the starter panel did not
disappear when the learner sent a message. It was dropped in the form's submit
handler, but Enter calls `runtime.sendMessage()` directly and never fires
submit, so the panel survived the way everyone actually sends. Both paths now
go through one helper that drops the panel **on the result** of `sendMessage`,
which also fixes the other half — pressing send on an empty box used to remove
the panel without sending anything, since `sendMessage` declines an empty box,
a busy assistant, and a pending guest prompt. Guarded by
`tests/server/chatComposerArchitecture.test.ts`.

### Deferred To A Later Iteration (recorded 2026-09-09 at the founder's request)

- **"Suggest me a practice."** The action belongs inside `/progress`, reading
  the progress the learner is already looking at — not as cards on the home.
  It is the first LLM-assisted piece of this area and is explicitly out of
  this round. Relates to
  [Home Start Experience](../features/home-start-experience.md) phases 2 and 4.
- **Mode-aware tutor behavior and progress events.** Today a conversation with
  Mr. F produces learner progress regardless of intent, so a teacher
  preparing a class pollutes their own progress record and is addressed as a
  student under evaluation. Deciding what the tutor knows about the active
  mode — and whether teaching-mode conversations emit progress events at all —
  is a prompt-coherence question (`system-prompt-coherence`,
  `learner-progress-events`), not a home-layout one. Not in this round.
- **"Create an activity from these results"** (see the decision above): the
  generative loop from a response summary back into a new activity.

### Related

- §1.6 Quiz Results & Next-Class Report — the source of the amended decision
  and of every query the teaching home reads.
- [Classrooms](../features/classrooms.md) — the guide/practicer primitive this
  is a presentation layer over; nothing here promotes a rung of its ladder.
- [Home Start Experience](../features/home-start-experience.md) — the learning
  half of this design, and where the deferred suggestion work is specified.

---

## 1.15 Navigating Back To The Home

Added 2026-09-10 (founder direction). Leaving a view and getting back to the
home has no clear path. What the app does today:

- The shell links to `/` three times: the logo in the mobile offcanvas header,
  the `Mr. F` brand in the desktop panel, and **Nueva conversación**
  (`data-new-conversation`). In learning mode the home *is* a new chat, so "go
  home" and "start a new conversation" are the same link — and nothing in the
  navigation is labelled `Inicio`.
- Breadcrumbs start at the section (`Recursos`, `Biblioteca de medios`), never
  at the home, and the close `X` returns to the owning resource or list
  (`resource-page-conventions`). Neither one leads home.
- Since §1.14, `/` renders one of two compositions, so where "home" lands
  depends on the active mode.

- [x] Decide what the home entry is (2026-09-10, founder choice: **both**). An
  explicit `Inicio` item (`bi-house`, key `nav.home`) is the first link in the
  panel nav and is active on either home (`currentView: 'home'`); the `Mr. F`
  brand still links to `/`. `Nueva conversación` now points at `/chat`
  everywhere it used to mean `/`: the panel link, `startNewConversation()`, the
  id-less fallback of both `buildConversationPath` helpers, and the redirect
  after deleting the open conversation. This also fixed a latent bug from
  §1.14 — in teaching mode "Nueva conversación" had been opening the teaching
  home, not a conversation.
- [x] Decide whether breadcrumbs gain a home root (2026-09-10): **no**. The way
  home is the panel's `Inicio` (and the phone toolbar's house). On the
  founder's addition, a section's **root page** — `/resources`,
  `/media-library`, `/progress` — carries the close `X` that inner pages
  already use, pointing at `/` (`views/partials/home-close-button.ejs`), so
  the close chain ends at the home instead of at a page with no way back.
  Recorded in `resource-page-conventions`.
- [x] On phones, a house icon sits in the top toolbar between the menu and the
  translator (`.chat-home-button`, `d-lg-none`), so the home never needs the
  offcanvas.
- [x] Verified at 375px and on desktop, in both modes — see §1.16's live QA.

Guarded by `tests/server/routes.test.ts` ("separates the way home from a new
conversation"): the `Inicio` link, `/chat` on `data-new-conversation`, the
section root's `X`, and the toolbar house.

---

## 1.16 A Learner Home That Is Not The Chat

Added 2026-09-10 (founder direction). The learning home is currently the tutor
chat with a compact panel above the composer — §1.14's learning composition.
The founder wants a **different experience**: a page with its own layout and
presentation, where asking Mr. F is still there but as one entry point with its
own placement and look, not as the page itself.

This revisits two recorded decisions, and both must be updated when the design
settles rather than left contradicting it: §1.14 chose "the chat page with a
panel above the composer" for the learning home, and
[Home Start Experience](../features/home-start-experience.md) holds "the
composer stays available" and "keep start a conversation as the main
affordance" as principles.

- [x] Design the learner home as its own page (2026-09-10). `views/home-learning.ejs`,
  rendered by `renderLearningHomePage` in `src/server/home/handlers.ts`. Top to
  bottom:
  1. **Greeting** with the profile name and a lede that counts pending
     activities ("Tienes 2 actividades pendientes." / "¿Qué quieres practicar
     hoy?").
  2. **Next step** — one card with one primary button: the first shared
     activity not yet started (`Empezar`), else the most recent open
     conversation (`Continuar`), else nothing. An activity outranks the
     learner's own conversation because it is the only thing on the page
     someone else asked for.
  3. **Preguntar a Mr. F** — a text box (founder choice over a plain button).
     It opens `/chat` with the text already in the composer and does **not**
     send it, so arriving from the home never starts a paid turn. The text
     travels in sessionStorage (`misterf.homeDraft`), never the URL: the
     textarea has no `name`, so without JavaScript the form still just opens
     `/chat`. **Attachments** (founder request, 2026-09-11): the box carries
     the chat composer's own picker and wizard (`prompt-attachments`), so a
     file or URL is processed and approved on the home; the handoff carries
     each accepted attachment as a summary — staged id, name, type, counts,
     never the extracted text — and the chat's picker lists them again
     (`restore()`), to be claimed when the learner sends. Staged entries live
     10 minutes, which a one-click handoff never approaches.
  4. **Para ti** — activities shared with the profile as `mf-rcard`s in their
     content family, `Pendiente` / `Empezado` chips, capped at 6 (was 4 until
     2026-09-11, when the grid went to three columns on wide screens), with
     `Ver todo` → `/resources?type=with_me` only when there are more.
  5. **Continúa donde lo dejaste** — other open conversations, capped at 3,
     minus the one already leading as the next step.
  6. **Practica por tu cuenta** — create a practice guide, my resources, my
     progress.
- [x] Give the tutor chat its own entry and URL: `/chat`, with §1.15. The
  §1.14 panel above the composer was **removed** from `/chat` (founder choice):
  `learning-home-panel.ejs`, the client code that dropped it on send, and
  `tests/server/chatComposerArchitecture.test.ts`, whose only invariant was
  that panel. Replaced by `tests/server/homeDraftHandoff.test.ts`, which
  guards the two properties a route test cannot see — the draft is placed, not
  sent, and it never reaches a query string.
- [x] Build on what exists. `mf-rcard`, `mf-chip` and the `mf-fam-*` classes —
  the first app view to use the content families. One theme addition:
  `.mf-rcard-glyph.bi`, so the glyph slot takes a Bootstrap Icon
  (`bootstrap-icons-conventions` forbids one-off SVGs in views); added to the
  kitchen sink. From the demo, the next-step card and the shared-activity grid
  were taken; its hero art (§1.17), streak, focus meters and "last
  correction" were not — each needs a progress query with no stated reason
  yet.
- [x] Reuse the data: **no new query.** `listResourcesSharedWithProfile` (the
  old panel's query) and the conversation list the shell already loads for the
  side panel.
- [x] Mobile first; both modes; signed-in QA (below).

**Decisions made during implementation**

- **No "Charla libre" card.** The demo had one; next to the text box it would
  be a second way to do the same thing. `Mis recursos` took its place.
- **Self-directed routes are plain Bootstrap cards, not `mf-acard`.** The theme
  reserves the family-colored action card for the create screen ("nowhere else
  may a family own a surface this large").
- **Suggestions stay deferred.** The [Home Suggestions
  Tracker](../issues/home-suggestions-tracker.md) is still a recommender with
  a credit policy to write; the page stays deterministic, as §1.14 required.
- **`Empezado` is generous by construction.** It comes from
  `listResourcesSharedWithProfile.hasStarted` (any attempt row, or any
  conversation opened from a guide), so an activity opened once reads as
  started. That query decides ordering and a chip, never access.

**Live QA (2026-09-10, local, no inference)** on `qa.fable@misterf.local`,
profile `QA Fable`. The learning home matched SQLite: two roleplays shared with
the profile, both started, so no pending badge and the idle lede; the next step
was the most recent open conversation (`b854e5f2`), and "Continúa" listed the
next two without repeating it; `Ver todo` hidden at 2 of 2. Typing into the box
and pressing Enter opened `/chat` with the text in the composer, sessionStorage
cleared, no conversation id, and the message count for the account unchanged
(12 before and after). `Nueva conversación` from `/chat` stayed on `/chat` with
an empty composer. `/resources` showed the `X` to `/` ("Ir al inicio"). The
teaching home rendered with `Inicio` active and `Nueva conversación` on
`/chat`; the profile was switched back to `learn`. At 375px the toolbar showed
menu, house, translator and mode switch with no horizontal overflow. No
console errors, and the server error log gained nothing during the session.

Related: §1.15, §1.17, §1.14.

---

## 1.17 Illustrations Across The App

Added 2026-09-10 (founder direction). The signed-in app is almost entirely
text. Outside the roleplay avatars and the scene-media images inside their own
features, no page carries an illustration: the homes, the library, progress,
empty states and creation flows are type and borders.

What already exists to build on:

- [Illustration Style Guide](../../design/illustration-style-guide.md) — the
  house style: 2D workbook illustration, no readable text.
- `design/ui-refresh-demo/` — its README §6 *Imagery* sets a decision tree
  (HTML mockup vs drawn cover vs generated illustration), asset classes, visual
  rules, a generation recipe, an optimization pipeline and naming; plus nine
  generated illustrations (two heroes, four resource-family spots, two empty
  states, one progress spot) and `generate-illustrations.py` (OpenRouter +
  Gemini image).
- The landing's HTML mockups — the pattern the founder likes — and the theme's
  drawn resource covers.
- `public/roleplay-characters/` and the scene-media images.

- [~] Decide where images earn their place first. **Started with the homes
  (2026-09-11, founder direction):** the learning home gets the `hero-aprendo`
  hero carrying the greeting and the next step, inline spots on "Preguntar a
  Mr. F" (`spot-charla`) and on the three self-directed routes (`spot-guia`,
  `spot-biblioteca`, `spot-progreso`), and `empty-biblioteca` when nothing is
  shared; the teaching home gets `empty-clase` on an empty "Lo que compartí".
  **Amended the same week (founder direction): the teaching home gets the
  same treatment** — the `hero-enseno` hero carrying the greeting, a lede
  counting this week's answers, and the activity with the newest answers as
  the next step (`Ver respuestas`), with the rest of the news below; the three
  creation shortcuts became cards with the content-family spots (`spot-quiz`,
  `spot-guia`, `spot-roleplay` — each spot is that family's mark); and
  `spot-charla` beside "Preguntar a Mr. F". Three more demo images reused, no
  generation. Resource covers stay drawn in CSS (a generated image per
  resource is refused by the theme). The library, progress, and creation
  pages are still to do, one decision-tree pass each.
- [x] Settle the app pipeline. Files live in `misterf-web/public/illustrations/`
  (served as `/public/illustrations/…`), every file has an entry in
  `design/ui-illustrations/illustrations.json`, and
  `design/ui-illustrations/generate.py` is the one generator: the locked style
  block, the class derived from the file-name prefix (`hero-`, `spot-`,
  `empty-`), ImageMagick PNG8 optimization, and a byte-budget check. Five demo
  images were reused as they were already optimized (all within budget); two
  were generated new (`spot-biblioteca` 39 KB, `spot-charla` 11 KB).
  `tests/server/uiIllustrations.test.ts` keeps the registry, the files, the
  budgets and the views' references in agreement.
- [x] Decide whether illustrations vary by mode: **no.** A mode never makes
  anything appear or disappear, so there is no `[data-mode]` rule for art. Each
  home composition renders its own hero because that view does. This
  also corrects the theme README, which claimed a hero "is hidden in Enseño" —
  no such rule existed, and it would have broken the guardrail.
- [x] Promote the rules into a skill: `.agents/skills/ui-illustrations/SKILL.md`
  — decision tree, classes and budgets, visual rules, the style block, how to
  write a subject, the add/regenerate flow, view markup, and the pre-commit
  checks. Pointed to from `AGENTS.md`, `cuaderno-theme`, the theme README, the
  demo README §6 (whose generator is now historical) and the scene-image style
  guide. Generation runs on the design-side key, never on a user's credit.
- [x] Accessibility: spots and empty-state images are decorative (`alt=""`,
  beside text that says the same); the hero is `role="img"` with
  `home.heroAlt` in es/en/ht.

Related: §1.16 (the learner home is the first page that needs them).

---

## 1.18 Dead Ends On The Logged-Out Path

Added 2026-09-11 (founder report: "hay acciones que están rotas, como la de
ver un ejemplo"). Audited as a visitor with no session, locally (the flows
are unchanged since `3.14.0`) and with anonymous GETs against production,
which behaves the same.

**What works.** Every landing link answers 200: the three editions, `Iniciar
sesión`, `Crea tu primera actividad` (`/signup?returnTo=/quizzes/new`, kept by
the form and by Google), privacy, terms, the roleplay avatars, and both demo
buttons, which open one of the ten seeded quizzes. `Hacer el quiz` starts a
guest attempt, and submitting it saves the answers and sends the visitor to
signup with the `/evaluating?guestToken=…` return intact — the account wall at
evaluation is the recorded V3.5 decision (roadmap-v3-5 §1.2), not a bug. No
horizontal overflow at 375px.

**What breaks.** Every way *out* of the demo sends an anonymous visitor to
`/login`. None of it is demo-specific: a student opening a teacher's share
link without an account hits the same walls.

- [ ] **The close `X` on a guest attempt leads to a login wall.**
  `views/quizzes-attempt.ejs:19` and `views/quizzes-result.ejs:53` point at
  `/quizzes/:quizId`, the owner's page; for a guest it 302s to `/login` (on the
  demo, `/quizzes/landing-demo-grocery-shopping`). For an attempt with no
  `userId`, the `X` should return to the share page it came from (or `/`).
- [x] **`No ahora` on the shared page leads to a login wall.**
  `views/resources-shared.ejs` sends all three variants (quiz, start, add) to
  `/resources`, which 302s to `/login` without a session. A visitor declining
  should land on `/` — the landing — not be asked to sign in.
  *Done 2026-09-12 with the shared-page redesign: `/` without a session,
  `/resources` with one.*
- [ ] **The signup after a guest submit has no context.** It is the generic
  "Empezar a practicar" page: nothing says the answers were saved or that the
  evaluation is what the account unlocks, and there is no way back to the
  quiz. `auth.ejs` already receives the `returnTo`; when it is an
  `/quiz-attempts/…/evaluating` path, the page should say so (es/en/ht). This
  is the moment the demo exists for (roadmap-v3-5 §1.2's "create an account
  when you want to see the evaluation"), and today it reads as an unrelated
  signup.
- [ ] **Decide whether the example should read as an example.** The landing
  calls it "Actividad de ejemplo"; the page it opens says "Recurso
  compartido" with a `Compartido` badge, inside the app shell whose side panel
  says "Abre una sesión para practicar" — the visitor lands in someone else's
  app, not in a demo. A share of the `LANDING_DEMO_EMAIL` account is easy to
  detect server-side if it deserves its own kicker and copy.
  *Partly addressed 2026-09-12: the redesigned shared page names the person
  who shared ("Compartido contigo por …"), and for the demo account it says
  "Una actividad de ejemplo de Mister F" instead of naming the "Examples"
  profile. The kicker and the guest side panel are unchanged.*
- [ ] **Decide what `Practicar con Mr. F` should do.** The learner section
  promises practice with corrections; `/chat` gives a guest composer whose
  first message is answered with "inicia sesión o crea una cuenta" (no
  inference is spent). Guest chat was kept on purpose (roadmap-v3-5 §1.3); the
  question is whether this CTA should still point there or go to signup.

Not a finding: a visitor who has signed in before is greeted on `/chat` with
"¡Bienvenido otra vez!" — that is the known-visitor greeting
(`resolveGuestInitialGreeting`, `pages/shell.ts`), working as designed.

Related: [Roadmap V3.5](roadmap-v3-5.md) §1.2 and §1.3 (the demo pool and the
guest path), `resource-sharing-conventions`, `resource-page-conventions`.

---

## 1.19 Share To Adopt — Teacher-To-Teacher Copies

Added 2026-09-12, from the pilot with the real Mister F: to make it easier for
other teachers to adopt the tool, they should be able to **get resources from
him** — not run them, but take a copy and use it with their own students. That
is a different act from today's sharing, which is built around *running* a
resource.

### The Problem

Today's sharing is live and resource-scoped (`resource-sharing-conventions`):
one share link per resource, recipients see the owner's current version, and
results collected through it belong to the owner (§1.6). That is right for a
teacher and their students. It is a dead end for a colleague who receives the
same link:

- **They can only run it.** It lands in their catalog as "Compartido
  conmigo", and duplication (§1.11) skips shared-with-me resources on purpose,
  so they can't make it their own.
- **If they forward it to their students, the results go to the author.**
  Attempts and summaries are keyed to the author's resource, so the colleague
  sees nothing and the author gets strangers' answers.

So a colleague who wants to use one of Mister F's activities has to recreate it
with AI, spending credits and time at exactly the point where they trust the
tool least.

### Why It Matters

- **It removes the empty catalog.** A new teacher's first useful moment could
  be a classroom-tested activity from a colleague, at no inference cost.
- **It is a teacher-to-teacher acquisition channel.** Link sharing is the
  product's only acquisition channel (V4 §1.12). Teacher → student brings
  students; teacher → teacher brings the people who bring students.
- **It is the first rung of things already planned.** "Camino D" in
  [Programa de referidos y creadores](../business/programa-de-referidos-y-creadores.md),
  the resource import/export idea in [issues/incomming.md](../issues/incomming.md)
  (already framed as a future marketplace base), and the "several quizzes
  behind one share link" precursor in [Classrooms](../features/classrooms.md).

### Proposed Shape

Reuse what exists; add one new kind of link.

- **A separate "copy" link, alongside the run link — not a toggle on it.** The
  author needs both at once (students run, colleagues copy), and the current
  model has one live link per resource. More importantly, **copying a quiz
  exposes its answer key**, so copying must be a permission the author grants
  on purpose, never something any holder of the run link can do.
- **The shared page (redesigned 2026-09-12) gets a colleague variant**: "Mister
  F te comparte esta actividad para que la uses con tus estudiantes", with
  copying as the primary action and a test run as secondary. The account wall
  goes on the copy action, not on viewing (the sharing rule). A colleague
  without an account signs up there, and that is the funnel.
- **The copy reuses `duplicateResourceForProfile` across accounts**: a fresh
  original owned by the recipient, no attempts, grants, share links or
  summaries, and folders recurse. So one link can hand over a whole package.
- **A copy is a snapshot.** Later edits by the author do not reach it. That is
  the point: the colleague has made it theirs.

### Decisions (made 2026-09-12, founder: "implement it with your recommendations")

- [x] **Naming.** The two owner actions are named for what the recipient
  gets, not who they are: **"Compartir para practicar"** (the existing run
  link, which the menus and modal title used to call just "Compartir") and
  **"Compartir una copia"**. The founder suggested "Compartir con aprendices" /
  "Compartir con colega". Those were dropped because "aprendices" reads oddly
  in UI Spanish, and sharing is used by tutors and parents too (§1.6 already
  chose "participantes" over "estudiantes"). "Una copia" also says what matters:
  the answer key goes with it. The modal copy names the audience ("Para otros
  profesores…"). Renaming is an i18n-only change if the pilot disagrees.
- [x] **Attribution.** Kept, in a new `resource_copies` table, **not**
  `resources.source_*`: the roleplay and practice-guide detail pages read
  `sourceProfileId` as "Compartido por", so reusing those columns would badge
  owned copies as shares. Copies show "Basado en un recurso de {{name}}".
- [x] **Chains.** Allowed. A copy is an owned resource, so it has its own
  "Compartir una copia". The credited origin stays the root author
  (`origin_*`), and `source_resource_id` records the immediate parent.
- [x] **Link, not catalog.** Link first, as recommended. A public "Recursos de
  Mister F" library stays open until the pilot says colleagues want to browse
  rather than receive.
- [x] **Button copy.** The colleague's action is "Hacer mi copia", distinct
  from the live grant's "Agregar a mis recursos". A returning colleague gets
  "Abrir mi copia" instead of a second copy.
- [x] **Amend `resource-sharing-conventions`.** Done: the skill has a Copy
  Links section, and its checks now forbid snapshot copies *outside* the
  copy-link path.
- [x] **No test run on the colleague page.** The draft proposed "Probar" as a
  secondary action. Dropped: running the author's resource from that page
  would reintroduce the misrouted-results problem, and copying is free, so the
  colleague tests their own copy instead.

### Done 2026-09-12

- [x] Migration 31: `resource_copy_links` (one active per resource via a
  partial unique index; revoked ids stay dead) and `resource_copies` (origin
  per copied resource).
- [x] `copyResourceFromLink` in `resources/duplicate.ts`, which generalizes the
  §1.11 tree copy to read as the author and write as the recipient. It keeps the
  original title, records origins for folder contents too, and runs in one
  transaction.
- [x] Owner side: "Compartir una copia" in `Opciones` on quiz, roleplay,
  practice-guide and folder pages and in the catalog row menu (`?share=copy`),
  opening one shared modal (`partials/resource-copy-link-modal.ejs`). The link
  is created only by its "Crear enlace de copia" button, never on page view,
  and "Desactivar enlace" revokes it without touching copies already made.
- [x] Colleague side: `/resources/copy/:id` is the shared page's copy variant
  (kicker "Copia para ti", "{{name}} te comparte una copia…", "Hacer mi
  copia", three copy-specific steps). Signup comes before login for a visitor,
  since this page exists to bring new teachers in. The account wall sits on
  the copy action (§1.18 rules for declining).
- [x] Events `resource_copy_link_created`, `resource_copy_link_revoked`,
  `resource_copy_link_accepted` (the adoption metric).
- [x] Tests: `tests/db/resourceCopyLinks.test.ts` (link lifecycle, cross-account
  quiz copy with answer key and origin, chain keeps the root author, folder
  copy credits every child and keeps avatars, archived refusal) and a route
  test covering author, anonymous colleague, signed-in colleague, the second
  visit, the author on their own link, the run link refused as a copy link, a
  non-owner unable to create or revoke, and revocation.
- [x] **Live QA 2026-09-12**, local, no inference, two real users. As
  `qa.fable`, "Opciones" on the quiz "Domina el pasado simple en el trabajo"
  lists "Compartir para practicar" and "Compartir una copia". `?share=copy`
  opens the modal with only "Crear enlace de copia", and creating it shows the
  link, copy, QR and "Desactivar enlace". Logged out, the copy page offers
  "Create account" / "Sign in" and never the quiz. It rendered in English,
  which exercised the `en` catalog. As `qa.student`, "Make my copy" landed on
  the copy: author's "Try it", "Based on a resource by QA Fable", its own "Share
  a copy", no shared badge. Revisiting the link offered "Open my copy" with the
  same id. No horizontal overflow at 375px. SQLite: the copy is owned by the
  student with an identical 6-block draft, 0 attempts (the original has 2), 0
  grants, no `shared_via` / `source_profile_id`, and a `resource_copies` row
  crediting QA Fable. `resource_copy_link_created`, `_accepted` and `_revoked`
  logged with the right ids, and the error log gained nothing. Cleanup: the
  student's copy is archived and the link revoked. After revoking, the modal
  is back to "Crear enlace de copia" and the old URL redirects away.
  *Looks like a violation and is not:* the copy's detail page mints a
  `resource_share_links` row for itself (the §1.11 lazy share link). That is the
  colleague's own run link, never the author's.

### Implementation Notes

- `duplicateOwnedResource` loads each resource with the *caller's* `userId`
  (`findQuizForUser(resource.id, userId)` and friends). A cross-account copy
  has to load with the author's identity and create with the recipient's, so
  the loader and creator identities split.
- Roleplay characters reference built-in avatars by `avatarId`, which are
  global, so copies across accounts keep their faces. Recheck this if
  user-uploaded media ever reaches a resource (V4 scene media).
- The copy link needs its own table or a `kind` on `resource_share_links`
  (`database-migration-safety`), its own accept route, and an event
  (`resource_copy_link_accepted` or similar) carrying author, recipient and
  source, which is the adoption metric.
- Route tests: author, colleague with an account, anonymous colleague through
  signup, archived source, a run-link holder unable to copy, and a folder copy.

Related: §1.6 (why forwarded links misroute results), §1.11 (the duplication
primitive), §1.18 (the shared page this reuses), `resource-sharing-conventions`,
`resource-page-conventions`.

# Part 2: Engineering And Quality

## 2.1 LLM Inference Portfolio Audit And Governance

Added 2026-07-15 after investigating practice-guide draft latency and finding
that resource authoring operations can inherit a global model tier and reasoning
effort even when their output contract does not require the same quality/latency
tradeoff as a tutor conversation.

**Rescoped 2026-07-18 (MVP refocus):** only the pilot-cycle cost/latency
measurement stays in V3, tracked as part of
[1.7 Pilot Readiness](#17-pilot-readiness). The full inventory, model-selection
policy, governing artifact, CI enforcement, and evaluation sets moved to
[Roadmap V4](roadmap-v4.md).

## 2.2 Structured Block Post-Processing

Deferred from V2 on 2026-07-06. **Moved to [Roadmap V4](roadmap-v4.md) on
2026-07-18** (unchanged: still gated on quantifying the deterministic
linter's miss rate from production block-repair logs first).

## 2.3 Resource And Media Navigation Consistency — moved to V4

The complete cross-area navigation record moved to
[Roadmap V4 §2.3](roadmap-v4.md#23-resource-and-media-navigation-consistency-breadcrumbs)
on 2026-07-26 so every Media Library initiative and its shipped history live
in V4.

## 2.4 Archived Resource Recovery

Added 2026-07-23 (founder observation). When a resource is archived there is
currently **no way to recover it from the app**. The restore path exists
server-side — `POST /resources/:resourceId/restore` →
`handleRestoreResource` → `restoreResourceForUser`, which clears `archived_at` —
but nothing in the UI reaches an archived resource: `renderResourcesListPage`
always queries with `includeArchived: false`, the catalog has no "archived"
filter or view, and there is no restore control anywhere. So archiving is
effectively a one-way delete from the user's perspective, even though the data
is still there and un-archivable by a single POST. This is a data-loss-shaped
UX gap and should be closed.

- [x] Give the catalog a way to see archived resources while keeping them out
  of the default listing. Done 2026-07-26: `/resources/trash` is a dedicated,
  profile-scoped Trash page reached through a quiet link below the catalog
  controls. It lists only archived resources owned by the active profile and
  uses the existing generic resource model; no schema change or parallel
  archive system was introduced.
- [x] Add a restore control on archived items. Done 2026-07-26: each Trash row
  restores through the existing generic `POST /resources/:resourceId/restore`
  route and returns to the Trash page.
- [x] Confirm folder and sharing behavior with route coverage. Done 2026-07-26:
  folder membership, live share links, and profile grants remain persisted.
  Archived resources are unavailable through those shares; restoring the
  resource returns it to its original folder and makes the existing shares
  usable again.
---

## 2.5 Google Text Model Review And Three-Tier Simplification

Added 2026-07-26 after the founder requested a check of the latest Google
models and whether Mister F still targets preview ids that have since reached
general availability. Founder observation: the current Regular model,
`openai/gpt-5-mini`, is extremely slow in real product use and is not acceptable
as Mister F's normal text default. The working direction is to simplify text
inference to exactly three Google model levels — Flash-Lite, Flash, and Pro —
instead of the current four-level, mixed-provider portfolio. This is a narrow
production-model lifecycle follow-up; it does not bring the full inference
portfolio and governance audit from section 2.1 back into V3.

- [x] Audit the Google models configured in production against the current
  Google lifecycle documentation and the OpenRouter catalog. Done 2026-07-26:
  the four configured text levels are Lite
  (`google/gemini-3.1-flash-lite`), Regular (`openai/gpt-5-mini`), Advanced
  (`google/gemini-3.5-flash`), and Max (`anthropic/claude-sonnet-5`). The
  separate image/TTS lifecycle decision is recorded with the Media Library in
  [Roadmap V4 §1.3](roadmap-v4.md#13-scene-media-library).
- [x] Confirm the exact three-model Google portfolio through representative
  evaluation, using this intended product hierarchy:
  - **Flash-Lite / Lite:** lowest latency and cost for bounded, high-volume
    operations. Evaluate `google/gemini-3.5-flash-lite` as the replacement for
    `google/gemini-3.1-flash-lite`, which Google schedules for shutdown no
    earlier than 2027-05-07.
  - **Flash / Regular:** the normal default for tutor conversations and general
    text generation. Evaluate `google/gemini-3.6-flash` as the replacement for
    the extremely slow `openai/gpt-5-mini`.
  - **Pro / Advanced:** the maximum-quality option. Select the current supported
    Google Pro id only after checking its lifecycle status, structured-output
    reliability, latency, and cost; do not bind the product tier permanently to
    a preview or rolling alias without recording that trade-off.
  Implementation selection recorded 2026-07-26: Lite uses
  `google/gemini-3.5-flash-lite`, Regular uses
  `google/gemini-3.6-flash`, and Advanced uses the exact current Pro id
  `google/gemini-3.1-pro-preview`. The Pro choice is explicitly temporary
  because Google still classifies it as preview; the first section of
  `/superadmin` exposes the effective ids and lifecycle state. Closed
  2026-07-26 (founder decision): the recorded three-model portfolio is accepted
  for V3 from live product use; a formal representative-evaluation pass is
  waived for the pilot and, if wanted later, moves to V4.
- [x] Prepare the compatibility change required by the newest text models.
  Google 3.6 Flash and 3.5 Flash-Lite deprecate and ignore `temperature`,
  `top_p`, and `top_k`, with future generations expected to reject them.
  Done 2026-07-26: `shouldUseTemperature` now omits the parameter for all
  Gemini 3.x ids, with focused provider-policy coverage. The request builders
  were checked: initial and correction requests end in a user turn, including
  block repair.
- [x] Reduce the application model-tier shape from four levels to three. Keep
  the existing persisted discriminators `lite`, `regular`, and `advanced`,
  mapping them to Flash-Lite, Flash, and Pro respectively; remove Max from the
  UI and normalize historical `max` profile/conversation values to `advanced`
  at the compatibility boundary. Remove `LLM_MODEL_MAX` and the Max fallback
  chain only after legacy values are covered. Update model-tier controls,
  configuration, types, and tests together. Done 2026-07-26: the server and
  browser normalizers map legacy `max` to `advanced`, repository row mapping
  covers existing persisted values, and the profile form/configuration expose
  only the three active tiers. Lite is the default for new profiles,
  conversations, and requests without an explicit tier; existing selections
  remain unchanged.
- [x] Compare representative operations at all three levels for structured
  contract success, correction-call rate, latency, token use, and effective
  cost. Automated tests must mock inference; record the live comparison
  separately. Account for Flash-Lite's published list-price increase from
  $0.25/$1.50 to $0.30/$2.50 per million input/output tokens and Flash's
  $1.50/$7.50 price when assessing the new default. Closed 2026-07-26 (founder
  decision): the formal three-level comparison is waived for V3; the tiers are
  validated by live product use. The general cost/latency measurement of a full
  pilot cycle remains tracked in [1.7 Pilot Readiness](#17-pilot-readiness).
- [x] If the evaluations pass, update the repository environment example and
  the real local/production model settings, preserve every existing user credit
  gate and credit-exhaustion boundary, deploy through the normal versioning
  flow, and verify the selected model ids and inference outcomes in production
  traces. Done 2026-07-26: the accepted three-model portfolio ships to
  production in the 3.1.0 release; existing credit gates and credit-exhaustion
  boundaries are unchanged. Confirm the effective model ids in production
  traces / `/superadmin` after the deploy.
- [x] Fix the comparative cost label in the profile model selector. Added
  2026-07-26 (founder observation): both Lite and Regular read "costo 1x"
  (`modelLiteDesc`/`modelRegularDesc` in `src/server/i18n/locales/{es,en,ht}.ts`),
  so the comparison between tiers was wrong now that the three levels have
  distinct costs. Scope is intentionally narrow — adjust only this learner-facing
  comparison; do **not** expose model ids or real prices in the profile UI (those
  belong to `/superadmin`). Done 2026-07-26: the tier descriptions now carry a
  corrected relative-cost comparison across es/en/ht — Lite 1x, Regular ~3x,
  Advanced ~5x — derived from the combined input+output list price per 1M tokens
  of the bound models ($0.30+$2.50=$2.80 Flash-Lite → 1x; $1.50+$7.50=$9.00
  Flash → 3.2x; $2.00+$12.00=$14.00 Pro → 5.0x). An earlier pass had briefly
  added the raw
  model id and per-million list price to each profile radio; that learner-facing
  disclosure was reverted (founder direction) back to the simple three-radio
  layout, and its backend (`buildProfileModelTierOptions`) and tests removed.

References:

- [Google: Using the latest Gemini models](https://ai.google.dev/gemini-api/docs/latest-model)
- [Google: Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [OpenRouter: Google models](https://openrouter.ai/google)

---

## 2.6 Instruction-Language Selection Review

Added 2026-07-26 (founder observation). The instruction language can currently
be set from **two** places, and it is unclear whether both should exist: the
account **Settings** page (`views/settings.ejs`, `POST /settings/language`) and
the per-profile form (`views/profiles-form.ejs`, the `instructionLanguage`
field). Both write `instructionLanguage`, so the same setting surfaces twice and
the relationship between "the account's language" and "the profile's language"
is ambiguous to the user.

- [x] Map exactly what each control writes and reads today: whether the Settings
  form edits the active profile's `instructionLanguage` or a separate
  account/user-level value, how the two interact when a user has multiple
  profiles, and which one wins on new conversations. Done 2026-07-26: there is
  no account-level language field. Both controls wrote the active profile's
  `profiles.instruction_language`; each new conversation snapshots that
  profile value into `conversations.instruction_language`, while existing
  conversations retain their original language.
- [x] Decide the intended model — instruction language as a per-profile setting,
  an account-level default, or both with a clear precedence — and where it
  should live in the UI so it is not duplicated confusingly. Done 2026-07-26:
  instruction language remains a per-profile preference and lives with the
  other profile-specific tutor preferences on the profile form.
- [x] Reconcile the surfaces per that decision (remove or relabel the redundant
  control), keeping es/en/ht copy consistent, and verify the change end to end
  for single- and multi-profile accounts. Done 2026-07-26: the duplicate
  Settings control and write route were removed; profile editing remains the
  single authenticated path. Repository and HTTP coverage verify independent
  profile values and new-conversation snapshot behavior.

## 2.7 Automated Signup Abuse

Added 2026-08-29 after a production log review that started as a tutor-quality
question. Production held **380 accounts and 2 verified addresses**. The other
378 had each been issued a real OpenRouter key against our own account, and none
had ever opened a conversation.

Inference was never at risk: `chatSocket.ts` already requires `emailVerified`
before any tutor turn, which is exactly why those accounts have zero
conversations. What leaked was the key itself, minted before anyone proved the
address was theirs.

- [x] Stop provisioning keys for unverified accounts. Done 2026-08-29, shipped
  in **3.8.1**. The guard lives inside `ensureOpenRouterKeyForUser` rather than
  at the call sites, because there are three and one is easy to miss: signup,
  *every* sign-in via `signInUser`, and the Google OAuth callback. Removing the
  signup call alone would have changed nothing, since `signInUser` runs moments
  later in the same request. Provisioning moved to the point of verification,
  where a failure is logged rather than fatal. Verified in production: a signup
  at 05:06, after the 02:44 deploy, received **zero** keys.
- [x] Remove the second defect on the same path. Done 2026-08-29: signup wrapped
  provisioning in a catch that called `deleteUserById` and returned 503, so a
  transient OpenRouter timeout permanently destroyed a legitimate new account.
  Three such timeouts had already fired on 2026-08-28.
- [x] Purge the bot accounts and their keys. Done 2026-08-29: 377 accounts and
  378 keys removed, leaving the founder account and the `examples@misterf.us`
  landing seeder. Backup taken first at
  `data/backups/misterf-pre-bot-purge-2026-08-29T02-50-38-839Z.sqlite`.
- [x] **Raise the cost of driving the form as a script.** Done 2026-08-29, not
  yet released. Two checks, chosen because neither adds a step for a real
  person and so neither had to wait on the Turnstile decision below.

  - A **honeypot and a timing check**, in `src/server/auth/signupBotTrap.ts`.
    The signup form carries a decoy input that is positioned off-screen and
    removed from the tab order, plus a signed "rendered at" stamp; a submission
    that fills the decoy or arrives less than two seconds after the render is
    rejected. Both target what the attacker demonstrably *does* — fetch the
    form, parse the CSRF token, post the fields back — rather than who it is,
    which is what made reputation and fingerprinting unusable. The decoy is
    moved off-screen rather than undisplayed, because a script that skips
    hidden inputs would skip the trap too, and its name (`website`) is one no
    password manager autofills, which is the only realistic false positive.
  - A **per-IP flood brake** on `/signup` (40 per hour), which did not exist at
    all: the rate limiting in `forms.ts` was wired into `handleLogin` only. It
    is sized above a whole class registering from one school's NAT — the
    pilot's normal case — and so, as measured below, will not catch this
    attacker. Its job is to bound the worst case if someone points a fast
    script at the form, not to be the defense.

  Both run before account creation *and before the verification email*, and
  every rejection is logged with the signal that fired (`honeypot_filled`,
  `submitted_too_fast`, `missing_stamp`, `invalid_stamp`) so the question below
  gets decided on counts rather than on guesswork.

- [ ] **Decide whether the registrations need stopping at the edge.** Still
  open. The checks above raise the attacker's cost but an operator who inspects
  the form can defeat both; what happens next is now a measurement, not a
  prediction.

  One correction to the note above: a bot signup does **not** cost nothing. It
  still sends a verification email through Resend, so a run of registrations at
  invented addresses burns quota and raises the bounce rate against our sender
  reputation. The failure mode that matters is not a junk `users` table — it is
  a real student's verification email stopping at the spam folder. That is why
  the new checks reject before the mailer, and it is the reason to keep this
  item open rather than to accept the junk.

  The 359 bot sessions preserved in the pre-purge backup characterize the
  attacker well enough to rule two defenses out before building them:

  - **231 distinct IPs across 87 `/24` subnets**, with 60% of subnets appearing
    exactly once, and a **median of 60 minutes** between signups. Per-IP rate
    limiting would catch only the 23 signups that arrived less than five minutes
    apart — about 6%. It would feel like a defense without being one.
  - **A single user-agent across all 359 sessions**, an ordinary Chrome-on-Mac
    string. It is the best detection signal available, but blocking it would
    also block real users on that browser.
  - **Six of the ten busiest subnets are publicly known Tor exit ranges**
    (`185.220.101.0/24`, `185.220.100.0/24`, `109.70.100.0/24`,
    `171.25.193.0/24`, `23.129.64.0/24`, `204.8.96.0/24`), identified by public
    reputation rather than verified individually. The busiest single subnet,
    `45.84.107.0/24` with 66 sessions, looks like commercial proxy or datacenter
    space.

  Candidates still on the table, to be decided against the rejection counts the
  shipped checks now produce:

  - **Cloudflare Turnstile** on signup is the only candidate that also covers
    the 52 single-use subnets and the attacker's next infrastructure change. It
    needs a Cloudflare site registration and two secrets in `.env.production`,
    and adds some friction. `misterf.us` resolves straight to the droplet with
    no Cloudflare proxy in front, but Turnstile works as a standalone widget,
    so this does not require moving DNS.
  - A **Tor exit-node blocklist** from the Tor Project's published list would
    remove more than half the measured traffic with no external paid dependency
    and no added friction. For a Spanish-language English-tutoring product the
    false-positive cost is close to theoretical, though it does exclude anyone
    using Tor for legitimate privacy. Weaker than it looks: it removes the half
    of the traffic that is cheapest for the attacker to replace.
  - **MX validation on the email domain before sending** would not stop a
    registration, but it protects the sender reputation described above, and
    rises in priority if Resend shows a raised bounce rate.

  The deciding measurement is whether the honeypot and timing counters keep
  rising while new accounts stop appearing. If registrations continue past the
  new checks, the attacker has adapted to the form and Turnstile is the
  answer; if they stop, none of the remaining options need to be paid for.

- [x] **Require a real browser.** Done 2026-08-29, **shipped in report-only
  mode**, not yet enforcing. The attacker fetches the form, parses the CSRF
  token out of the HTML and posts the fields back, which means it almost
  certainly does not execute JavaScript — the largest weakness left to use.
  Two signals now travel with every signup:

  - **A challenge answered by JavaScript.** The page's script returns the
    SHA-256 of the `signupFormStamp` the server already signed. Reusing the
    stamp rather than issuing a second nonce keeps one signed value in the
    form and inherits its signature check for free. A plain HTTP client cannot
    produce the answer.
  - **A human-interaction flag**, set by the first `pointerdown`,
    `touchstart`, `input` or `keydown` on the form.

  Requiring JavaScript is acceptable here specifically because the tutor chat
  already requires it — this excludes nobody who could use the product anyway.

  **Proof of work was considered and deliberately not built.** It works
  through volume: you impose CPU on the operator and multiply by their rate.
  This attacker registers a median of once an hour, so the cost imposed would
  be a rounding error, while the cost to us would be real — difficulty tuned
  against budget Android hardware, a worker to keep the main thread free, and
  battery. The half that pays here is proving JavaScript ran, and that half is
  nearly free on any phone. Both techniques fall equally to an operator who
  reads the script and reimplements it, so between two options with the same
  outcome the cheap one wins.

  [ALTCHA](https://altcha.org) remains the right library **if the volume ever
  changes** — self-hosted, no vendor account, and at that point the worker,
  difficulty tuning and accessibility work become real work worth not doing by
  hand. As of 2026-08-29 `altcha-lib` (server) is 2.3.2, MIT, zero
  dependencies, ~133k weekly downloads; the `altcha` widget is 3.2.2, MIT, one
  dependency (`hash-wasm`), ~113k weekly downloads. Both current. The trigger
  to adopt it is registrations arriving at tens per hour, not this attack
  continuing at its present rate.

  **Mobile shaped the design rather than being checked afterwards.** The
  interaction signal takes the union of four events and leads with touch,
  because on a phone someone can fill every field from the password manager
  and tap submit without ever producing a key event, and iOS Safari's autofill
  fires `input` without `keydown`. A keyboard-only signal would reject real
  phone users, which is the one failure this section exists to avoid. There is
  no proof-of-work cost to tune precisely because proof of work was dropped,
  so the whole low-end-device risk went with it.
  `tests/server/signupBrowserChallenge.test.ts` asserts each of the four
  events sets the flag on its own, so the list cannot be quietly narrowed
  later.

  **Report-only until the numbers say otherwise.** Every failure is logged as
  `signup_browser_check_failed` with its signal and an `enforcing` flag, and
  nothing is rejected.
  `SIGNUP_BROWSER_CHECK_MODE=enforce` switches it on — and back off — without
  a deploy, which matters because every way this can go wrong is a way of
  turning away a person: a script that failed to load, a device that never
  fired the event we watched. `tests/server/signupBrowserCheckEnforced.test.ts`
  boots a server with the flag set and proves the enforcing path actually
  rejects, so flipping it in production cannot silently do nothing.

  What this still does not buy is what Turnstile does: the TLS (JA3/JA4) and
  HTTP/2 fingerprints that expose a scripted client claiming to be Chrome, and
  IP/ASN reputation aggregated across many sites. Those need to sit at the TLS
  termination and see traffic we cannot see. If an attacker turns up running a
  real automated browser, none of the above stops it and that is the point to
  buy the edge.

- [ ] **Turn the browser checks on.** Open. Read the
  `signup_browser_check_failed` counts by signal against real signups; when
  `browser_answer_missing` is dominated by bots rather than by people on
  devices we did not anticipate, set `SIGNUP_BROWSER_CHECK_MODE=enforce`.

  Not chosen: dropping email signup in favour of Google-only. All 378 bot
  accounts came through the email form and none through Google, so it would have
  blocked this specific attack — but it raises the attacker's cost rather than
  eliminating it, and excludes learners without a Google account.

---

## 2.8 Hardcoded Spanish In A Non-Spanish UI

**Done 2026-09-10** (commit `50f910ab` on `v3`, not yet released). Audit,
fixes, and regression guard are complete; the record of what changed, what
turned out not to be a violation, and what remains uncovered is below.

Added 2026-09-10 (founder observation). With the profile language set to
English, the app shows many Spanish strings like "hace 3 meses". The UI locale
itself is correct: `resolveLocale` (`src/server/i18n/resolve.ts`) makes the
active profile's `instructionLanguage` authoritative. The problem is code that
never asks for the locale. The relative-time case is the most visible one, and
it is not the only one.

Known offenders, from a first grep (not exhaustive):

- `formatRelativeTime` in `src/server/pages/shell.ts` formats through a
  module-level `Intl.RelativeTimeFormat('es')`. It has no locale parameter and
  feeds every "updated X ago" / "generated X ago" label: the home page
  (`home/data.ts`), the resource catalog, quizzes, roleplays, practice guides,
  scene media, and the conversation list in the shell.
- `src/client/chat/utils/dates.js` has its own `Intl.RelativeTimeFormat('es')`
  for the chat conversation list (`formatConversationDates` /
  `formatConversationDate`).
- `localeCompare(..., 'es')` sorts resource titles in
  `server/resources/handlers.ts` and `client/shared/resourceMoveModal.js`. The
  effect is small (collation, not visible copy), but it belongs to the same
  class of bug.
- `server/superadmin/routes.ts` formats dates with `'es'`. It is internal-only,
  so the decision is whether to leave it as-is on purpose, not whether to fix it.

- [x] **Audit the whole site for this class of defect.** The goal is an
  inventory of every place a user sees text that ignores the profile language,
  not just the "hace…" labels. Two passes:
  1. *Code:* every `Intl.*` constructor and `toLocale*String` / `localeCompare`
     with a hardcoded locale; literal user-facing copy in `views/` and
     `src/client/` that bypasses the i18n catalogs (including `title`,
     `placeholder`, `aria-label`, and `alt` attributes); server responses and
     flash messages built from string literals instead of `translate`; and
     LLM-generated labels or fallbacks that assume Spanish.
  2. *Live:* browse every page, modal, and empty state signed in with an `en`
     profile, then an `ht` profile, and write down every Spanish string. The
     grep will miss copy that comes from data, prompts, or client-rendered
     templates, and this pass catches it.

  Record the findings as checkboxes in this section before fixing, so the scope
  is visible.

  **Done 2026-09-10.** Code pass: greps for literal-locale `Intl`,
  `toLocale*String` and `localeCompare`; for string literals carrying Spanish
  (accented *and* unaccented) in `views/`, `src/client/` and `src/server/`; and
  for every function with a `locale = 'es'` default together with the callers
  that rely on it. Live pass: `qa.fable` with the `QA Fable` profile switched
  to `en`, then `ht`, directly in SQLite (restored to `es` afterwards); 38
  signed-in pages fetched and scanned (text nodes plus `title`, `placeholder`,
  `aria-label`, `alt`, and the document title), and 5 JS-heavy pages rendered in
  an iframe so client-rendered copy was included. The es/en/ht catalogs have
  identical key sets, so every finding below is code that never asks the
  catalog, not a missing translation.

  **The one design finding: `ht` has no locale data in `Intl`.** Node's ICU
  resolves `Intl.RelativeTimeFormat('ht')` and `Intl.DateTimeFormat('ht')` to
  `en-US`. So "pass the request locale" fixes `es` and `en` but renders
  Haitian Creole users **English** ("3 months ago", "Jul 23, 2026, 12:34 PM"
  on `/progress` under `ht`, seen live). Relative and absolute date wording for
  `ht` has to come from the catalog or the language registry, not from `Intl`.
  Check the browser's ICU for the client helper before assuming it differs.

  Findings — dates and collation (all fixed 2026-09-10 unless noted):

  - [x] `formatRelativeTime` moved to `src/server/i18n/dates.ts` with a
    required locale; all 16 callers pass the request, conversation, or
    profile locale.
  - [x] `src/client/chat/utils/dates.js` now words dates through
    `src/client/shared/relativeTime.js` (same thresholds, same catalog keys),
    and reads zone-less SQLite timestamps as UTC like the server does.
  - [x] Absolute dates in `progress.ejs` / `credits.ejs` go through
    `formatDateTime` (`res.locals.formatDateTime`); `ht` uses the registry's
    Creole month names.
  - [x] Title sorting uses `compareText` on the server and the client
    `locale` in the move modal.
  - [x] `superadmin/routes.ts`: **left as-is on purpose** (founder-only
    surface), and allowlisted by name in the guard test.

  Findings — server-built copy that bypasses the catalogs:

  - [x] Resource type labels now come from `resources.type*` keys. The folder
    label uses `resources.folder`: `resources.typeFolder` never existed, so
    the shared-resource preview for a folder had been rendering the raw key.
  - [x] `/progress` overview and "Seguir practicando: …": the summary
    builder is now pure (`buildLearnerProgressSummary(events, locale)`); the
    page rebuilds it per request in the viewer's language, so stored rows
    written in Spanish no longer leak. The stored copy (read by the tutor's
    progress tool) is worded in the profile's language.
  - [x] Found during implementation: the quiz progress event summary
    ("Completaste N ejercicios…") was built in Spanish and stored with the
    event. New events are worded in the learner's language
    (`progress.quizEventSummary`); events recorded before 2026-09-10 keep their
    stored wording.
  - [x] `getHomeAuthMessage` → `home.verifyEmailNotice` /
    `home.verifyEmailLink`.
  - [x] Onboarding validation error → `profiles.nameRequired`.
  - [x] Credits: the balance error no longer prints the raw internal message,
    and a failed checkout no longer puts the raw Stripe or configuration error
    into `?error=`; the buyer sees `credits.payErrorDefault`. The package's
    Spanish `label`/`description` were internal defaults the page already
    overrode (Stripe gets the price id, not the label); now English and marked
    internal.
  - [x] Scene-media content-policy message: **not a user-facing string** — the
    page maps the error to `mediaLibrary.failure.contentPolicy`. The literal
    is now an English internal message.
  - [x] Default names: a new conversation's title, the first profile's name,
    and "Practicar: …" (found during implementation) are written in the
    profile's language at creation. Rows created before 2026-09-10 keep the
    Spanish value until renamed; the tutor prompt's fallback title uses the
    conversation language.

  Findings — socket messages:

  - [x] All 18 literals and both `translate('es', …)` calls now use the
    conversation's language, or `socketLocale()` (profile, then handshake
    cookie / `Accept-Language` via `resolveHandshakeLocale`) when no
    conversation loaded. `emitAuthRequired` uses `msg.authRequiredUse`.
  - [x] Every `locale = 'es'` default is gone (`toUserFacingError`,
    `getCreditExhaustedMessage`, the credit-exhaustion emitters, mailer,
    greetings, `buildQuizResultTitle`, finish-reason messages, resource-draft
    prompts, whose `instructionLanguage` is now required). The compiler listed
    the callers; the translator's finish-reason notice and credit notice now
    follow the profile. Internal `Error` messages that were Spanish (draft
    parsing, evaluator, translator, Google sign-in) are now English.

  Findings — client copy:

  - [x] Chat cards, pending labels, markdown toolbar, move modal, quiz editor
    remove button, and native-share titles all read the client catalog
    (`card.*`, `clientChat.*`, `clientMisc.*`, es/en/ht).
  - [x] `Correct` badge in `partials/quiz-item-card.ejs` →
    `card.evaluationCorrect`.
  - [x] `Modify with AI`: **not a violation.** The audit saw it under an
    `en` profile, where it is the English catalog value; es and ht are
    translated.
  - [x] `sceneAudioPlayer.js` English fallbacks: **unreachable.** The only
    partial that renders the player sets every `data-*` label.
  - [x] `ht` `restoreQuiz` / `restoreRoleplay`: **not a violation.** The Creole
    catalog uses the loanword "restore" throughout ("Restore gid",
    "jiskaske ou restore yo").

  Verification (2026-09-10): `npm run typecheck`, `npm run test:typecheck`,
  and `npm test` pass. Live, as `qa.fable` with `QA Fable` switched to `en`
  and then `ht` in SQLite (restored to `es` afterwards): 27 signed-in pages
  under `en` with no Spanish chrome ("Updated 6 days ago"); 10 pages under
  `ht` with no Spanish chrome and no English dates ("sa gen 2 semèn",
  "23 jiyè 2026, 12:34", "Pwogrè ki baze sou 2 pratik resan"); the
  client-rendered conversation list and markdown toolbar checked in a rendered
  frame ("Tit", "Gra", "Italik"). Signed-out home, login, signup and password
  reset checked under `en` and `ht` with the language cookie.

  Still not covered: email bodies (the mailer's locale parameter is now
  required, so every caller passes one), and modals that only render on
  interaction beyond the move modal.
- [x] Make `formatRelativeTime` take the request locale, with no Spanish
  default. **Done 2026-09-10**, amended by the audit: relative wording comes
  from the catalog's `common.relativeTime` keys rather than
  `Intl.RelativeTimeFormat`, and absolute dates use the registry's new
  `dates` field (`intlLocale`, or Creole `monthNames` when it is `null`).
- [x] Fix the remaining findings from the audit in es/en/ht. **Done
  2026-09-10**, see the findings above.
- [x] Add a regression guard. **Done 2026-09-10:**
  `tests/server/localeArchitecture.test.ts` rejects a literal locale handed
  to `Intl`, `localeCompare`, `toLocale*String` or `translate`, and any
  `Locale = 'xx'` default, outside `src/server/i18n/` and two named files;
  `tests/server/i18n.test.ts` renders `/resources` under `en` and `ht`
  profiles and asserts no "hace" and no Spanish type label;
  `tests/server/dates.test.ts` covers the wording in all three languages and
  checks that the browser formatter buckets time exactly as the server does.
---

## 2.9 Production Node Version And PDF Extraction

Added 2026-09-11 (founder direction), from what the `3.14.0` deploy printed.

The production server runs **Node 20.16.0** (npm 9.2.0). The deploy's
`npm ci --omit=dev` finished, but warned `EBADENGINE` for two packages:

- `unpdf@1.8.1` requires **Node ≥ 22**. It is a runtime dependency: it is what
  extracts text from **PDF attachments** (`prompt-attachments`). An engine
  mismatch is a warning at install time, not an error, so nothing has shown
  whether PDF extraction actually works in production on Node 20.
- `vite@8.2.2` requires `^20.19.0 || >=22.12.0`. It is a build tool; production
  installs with `--omit=dev` and serves the compiled `public/build`, so this one
  is only a symptom of the same old Node.
- Every production start logs `ExperimentalWarning: Importing JSON modules is an
  experimental feature` (seen on both the `3.14.0` and `3.15.0` starts,
  2026-09-11). It is not our code — nothing in `src/` or `dist/` uses JSON
  import attributes — but `sharp`, a runtime dependency (image processing),
  imports JSON with `with { type: 'json' }`, which is experimental on Node 20
  and stable from Node 22. Harmless today; it disappears with the upgrade
  below and is a quick way to confirm the server picked up the new Node.

Locally the app runs on Node 24 (see the local-server notes: two Node installs
on the dev machine, and `better-sqlite3` is compiled for exactly one ABI).

- [ ] Verify PDF attachment extraction in production: attach a small PDF from a
  prompt surface on misterf.us and confirm the review text appears. One
  extraction call on a real account's credit; check the server log for an
  `unpdf` / import error either way.
- [ ] Upgrade the server's Node to a current LTS (22 or 24, matching what
  development and tests run on) — via the server's version manager, not a
  hardcoded path in `ecosystem.config.cjs`, which is shared with local.
- [ ] After the upgrade, rebuild native modules on the server
  (`npm rebuild better-sqlite3`, or a clean `npm ci`) and restart pm2 **from a
  shell running the new Node**, since pm2 forks the app under the Node on the
  PATH that started it. Confirm `/health` and a signed-in page.
- [ ] Declare the supported Node in `misterf-web/package.json` (`engines`) so
  the next mismatch is visible in the repo, not only in a deploy log; consider
  a `node -v` check in `deploy.sh` before `npm ci`.
- [ ] Record the procedure in `production-server-ops`.

Related: `prompt-attachments`, `production-server-ops`,
`versioning-and-releases`.

# V3 Exit Criteria

Replaced on 2026-07-18 (MVP refocus). With this scope, shipping V3 makes the
product pilot-ready; running the pilot itself is business-roadmap work
([negocio-roadmap](../business/negocio-roadmap.md), Fases 2–4), not a
technical exit criterion.

- [x] A real teacher can run the full cycle in production: create a quiz from
  their own material, share it, students complete it and get evaluated,
  students can start follow-up practice, and the teacher sees the attempts
  and the next-class report. Founder-confirmed manual QA completed 2026-07-26.
- [x] Live logged-in QA of the quiz AI modification operations (section 1.3)
  is done. Completed 2026-07-20; the exit-criteria checkbox was synchronized
  with the detailed section on 2026-07-26.
- [x] ~~The pilot funnel is measurable end to end, and the AI cost of one full
  cycle is known.~~ **Dropped as an exit criterion 2026-08-01 (founder
  decision).** Both halves depend on aggregation the platform does not have, now
  owned by [Roadmap X §X.1](roadmap-x.md); the cost half is additionally not a
  margin risk while inference is paid for by purchased credits (§1.7). V3 ships
  measured by nothing, which is a known and accepted cost — the same trade V3.5
  made.
- [x] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass; new
  surfaces (attempts views, next-class report) have regression coverage.
  Verified for the 3.0.0 release on 2026-07-26.
- [x] Deployed to production per the versioning policy
  (`versioning-and-releases` skill). Released as 3.0.0 on 2026-07-26.
