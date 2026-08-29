# Roadmap V3

Date: 2026-07-06 (last updated: 2026-08-01)

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

- [ ] **Next escalation, if the shipped checks stop working: require a real
  browser.** Not started. The attacker's demonstrated behaviour is to fetch the
  form, parse the CSRF token out of the HTML and post the fields back, which
  means it almost certainly **does not execute JavaScript**. That is the
  largest weakness we have not used, and two techniques exploit it:

  - **A token minted by JavaScript.** The server issues a nonce, a script on
    the page transforms it, and the result travels in the POST. A plain HTTP
    client cannot produce it. One step up from the honeypot, still zero
    friction.
  - **Proof of work.** The browser spends a few hundred milliseconds hashing
    before the form can be submitted. Invisible to one person; multiplied by
    thousands of registrations it is a real cost to the operator.

  Requiring JavaScript is acceptable here specifically because the tutor chat
  already requires it — this excludes nobody who could use the product anyway.

  **Do not build either by hand.** The proof-of-work token *is* a
  JavaScript-minted token, so one dependency covers both, and
  [ALTCHA](https://altcha.org) is the mature option: self-hosted, no external
  service, no vendor account. As of 2026-08-29 `altcha-lib` (server) is 2.3.2,
  MIT, **zero dependencies**, ~133k weekly downloads, last published
  2026-07-27; the `altcha` widget is 3.2.2, MIT, one dependency (`hash-wasm`),
  ~113k weekly downloads, last published 2026-08-19. Both are current and
  actively maintained.

  **Mobile is a hard requirement, and it constrains the design:**

  - **Tune the proof-of-work cost against a cheap Android phone, never against
    the founder's Mac.** ALTCHA's difficulty is the `maxnumber` parameter;
    their own figure is roughly 2.5 s at `maxnumber: 1000000` *on a powerful
    computer*, and their guidance is to reduce difficulty when the 95th
    percentile solve time passes about 500 ms. Our learners are adult
    immigrants in South Florida, so budget Android hardware is the design
    target, not the exception. Measure on a real low-end device before
    choosing a value, and watch battery and thermal cost.
  - **The "a human touched this form" signal must be touch-first.** Take the
    union of `input`, `pointerdown`, `keydown` and `touchstart` — never
    `keydown` alone. On mobile a person can autofill every field from the
    password manager and tap submit without ever producing a key event, and
    iOS Safari's autofill fires `input` without `keydown`. A keyboard-only
    signal would reject real phone users, which is the one failure this whole
    section exists to avoid.
  - Verify the widget inside the mobile viewport with the on-screen keyboard
    open, since it covers roughly half the screen while the form is being
    filled.

  **Ship it in report-only mode first**, logging what *would* have been
  rejected, and enforce only once the false-positive count on real signups is
  known. This is the same discipline the honeypot shipped under, and it is
  what makes a mobile regression visible before it costs a registration rather
  than after.

  What this still does not buy is what Turnstile does: the TLS (JA3/JA4) and
  HTTP/2 fingerprints that expose a scripted client claiming to be Chrome, and
  IP/ASN reputation aggregated across many sites. Those need to sit at the TLS
  termination and see traffic we cannot see. If an attacker turns up that runs
  a real automated browser, proof of work will not stop it and that is the
  point to buy the edge.

  Not chosen: dropping email signup in favour of Google-only. All 378 bot
  accounts came through the email form and none through Google, so it would have
  blocked this specific attack — but it raises the attacker's cost rather than
  eliminating it, and excludes learners without a Google account.

---

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
