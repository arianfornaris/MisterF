# Roadmap V3

Date: 2026-07-06 (last updated: 2026-07-26)

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
[Roadmap V2](roadmap-v2.md)), was downgraded on the same date: Phase 1
(reading) stays as an optional stretch goal and the remaining phases moved to
[Roadmap V4](roadmap-v4.md), along with the complete Scene Media Library
record, voice
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
selectable (Spanish, English, Haitian Creole). V3 builds on top of that: all
comprehension stimuli are in English (the target language), while question
wording and feedback follow the user's instruction language.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

# Part 1: Product Initiatives

## 1.1 Comprehension Exercises (Stimulus + Questions)

Promoted from the idea inbox 2026-07-04; carried from Roadmap V2 to V3 on
2026-07-06. Design:
[Comprehension Exercises](../features/comprehension-exercises.md) — one
reusable pattern (a stimulus plus questions bound to it) reusing the `quiz`
item kinds and the `quiz_result` evaluation pipeline, rendered as a single
card. Implementation follows the design doc's phase order; each phase ships
independently.

Downgraded on 2026-07-18 (MVP refocus): Phase 1 (reading) is an **optional
stretch goal** for V3 — it reuses the `quiz`/`quiz_result` pipeline and gives
pilot teachers one more activity type, but it must not delay the MVP. Phase 2
(listening), Phase 3 (image), and availability in teacher quizzes moved to
[Roadmap V4](roadmap-v4.md).

- [ ] Detailed block design decision: `stimulus` field on the existing
  `quiz` block versus dedicated stimulus blocks (the design doc leans to
  the former).
- [ ] Phase 1 — Reading comprehension: LLM-generated passage at the
  learner's level, questions in the same card, results through the
  `quiz_result` pipeline and progress events. No new infrastructure;
  validates the pattern.
- Phases 2 (listening) and 3 (image), and availability in teacher quizzes:
  moved to [Roadmap V4](roadmap-v4.md) on 2026-07-18.
- [ ] Manual QA against live inference for any phase that ships in V3.

Interaction with the V2 i18n work: comprehension stimuli are always in
English (the target language); question wording and feedback follow the
user's instruction language. The i18n prompt parametrization shipped in V2,
so Phase 1 can proceed without double work on prompt copy.

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
- [ ] Migrate roleplay and practice-guide modification modals onto the shared
  controller. Optional for V3 (2026-07-18, MVP refocus): keep only if it stays
  cheap; otherwise it moves to Roadmap V4. Split out of the quiz work on
  2026-07-17: Phase 1 extracted a
  generic pending-modification store (`server/resources/modificationPreviewStore.ts`)
  and a generic client modal controller (`client/shared/modificationModal.js`,
  with multi-trigger + per-open `resolveContext`), and all four quiz operations
  use them. Roleplays and practice guides still carry their own near-duplicate
  `modificationPreviewStore.ts` and their own copies of the modal logic inside
  `client/roleplays/index.js` and `client/practiceGuides/index.js`. Port them to
  the shared store and controller (roleplay avatar diffs and practice-guide
  Markdown fields become custom `renderChanges` implementations), then delete the
  duplicates. Low risk but touches two shipped flows, so it needs its own
  before/after click-through.
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
- Design constraint (2026-07-18): the MVP returns results for **quizzes
  only**, but the cross-cutting pieces — disclosure/consent copy, the
  "Shared by me" view, and the naming of results routes/storage — are built
  resource-generic, because the same feedback loop extends to roleplays
  (attempt evaluation + transcript) and practice guides (the session's
  finalized report, not the raw chat) in the next iteration. Disclosure
  follows assignment, not resource type.
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
- [ ] Funnel instrumentation check: verify each pilot funnel step (invited →
  started → completed → reviewed → practiced → report viewed) is recorded and
  queryable, adding minimal events where missing. Manual SQL is acceptable
  for the pilot.
- [x] Fix the guest evaluation hand-off. Done 2026-07-20: evaluation used to
  run inside the result page's GET, so a student who had just signed up sat on
  a blank navigation for the whole inference. Evaluation moved to
  `POST /quiz-attempts/:id/evaluate` behind a new
  `GET /quiz-attempts/:id/evaluating` page that renders instantly with the
  spinner and self-posts (visible button as the no-JS fallback); the result
  page now redirects there instead of blocking, and signup returns to it.
  Verified live: result redirect 29 ms, evaluating page 22 ms, then the normal
  evaluated-result experience.
- [ ] Manual QA of the full teacher cycle against live inference (create →
  share → guest attempt → signup/claim → evaluation → follow-up practice →
  owner report).

## 1.7 Pilot Readiness

Added 2026-07-18. Operational items that make the pilot runnable within the
business constraints ([Presupuesto inicial](../business/presupuesto-inicial.md)).

- [ ] Pilot credit mechanics: document the existing superadmin per-user
  OpenRouter limit flow as the way to fund pilot teachers/students, and
  define the pilot credit policy with the founder (cap per participant, total
  pilot budget, behavior when a cap is hit). No new payment infrastructure.
- [ ] Measure the real AI cost and latency of one full teacher cycle per
  operation (quiz generation/modification, evaluation, follow-up tutoring,
  report summary), feeding the contribution-margin input the business docs
  need. (This is the slice of section 2.1 kept in V3.)

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
- [ ] Consider a guard test that keeps this rule from regressing: assert every
  route whose handler resolves a credit-gated key has a UI trigger carrying a
  known pending marker. Non-trivial because triggers live in EJS and client
  JS, so it is tracked but not yet scoped.

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

- [ ] Decide delivery mechanism (prompt section vs. tool vs. hybrid).
- [ ] Draft the canonical platform-feature description and decide where it lives.
- [ ] Wire it into regular tutor conversations and verify the tutor answers a
  feature question correctly without losing its pedagogical framing.

Relevant skills when this is picked up: `system-prompt-coherence`,
`llm-tool-documentation`.

---

## 1.10 Tutor Plan Panel Defaults To Minimized

Added 2026-07-26 (founder observation). When Mister F emits a `tutor_plan` or
`tutor_plan_update`, the plan UI currently appears expanded because
`TutorPlanView` initializes `isMinimized` to `false`. The full summary and step
list sit above the composer and take substantial vertical space away from the
conversation. The plan is supporting context, so it should stay visible without
competing with the learner's current exchange.

- [ ] Render a newly visible tutor plan in its minimized state by default,
  showing the current active or next pending step plus the expand and conclude
  controls. The learner can expand it deliberately to inspect the complete
  plan.
- [ ] Preserve the learner's explicit minimized/expanded choice across
  `tutor_plan_update` events. Clearing or concluding the current plan must reset
  the view so the next new plan starts minimized again.
- [ ] Keep minimize, expand, and conclude controls keyboard- and
  screen-reader-accessible, and move the existing hard-coded Spanish action
  labels in `TutorPlanView.js` into the es/en/ht client i18n catalogs when
  implementing the behavior.
- [ ] Add focused client tests for initial minimized rendering, manual
  expansion, update-state preservation, and reset-before-next-plan behavior;
  verify the compact panel above the composer on both mobile and desktop.

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
- [ ] Confirm the exact three-model Google portfolio through representative
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
  `/superadmin` exposes the effective ids and lifecycle state.
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
- [ ] Compare representative operations at all three levels for structured
  contract success, correction-call rate, latency, token use, and effective
  cost. Automated tests must mock inference; record the live comparison
  separately. Account for Flash-Lite's published list-price increase from
  $0.25/$1.50 to $0.30/$2.50 per million input/output tokens and Flash's
  $1.50/$7.50 price when assessing the new default.
- [ ] If the evaluations pass, update the repository environment example and
  the real local/production model settings, preserve every existing user credit
  gate and credit-exhaustion boundary, deploy through the normal versioning
  flow, and verify the selected model ids and inference outcomes in production
  traces.

References:

- [Google: Using the latest Gemini models](https://ai.google.dev/gemini-api/docs/latest-model)
- [Google: Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [OpenRouter: Google models](https://openrouter.ai/google)

---

# V3 Exit Criteria

Replaced on 2026-07-18 (MVP refocus). With this scope, shipping V3 makes the
product pilot-ready; running the pilot itself is business-roadmap work
([negocio-roadmap](../business/negocio-roadmap.md), Fases 2–4), not a
technical exit criterion.

- [ ] A real teacher can run the full cycle in production: create a quiz from
  their own material, share it, students complete it and get evaluated,
  students can start follow-up practice, and the teacher sees the attempts
  and the next-class report.
- [x] Live logged-in QA of the quiz AI modification operations (section 1.3)
  is done. Completed 2026-07-20; the exit-criteria checkbox was synchronized
  with the detailed section on 2026-07-26.
- [ ] The pilot funnel is measurable end to end, and the AI cost of one full
  cycle is known.
- [x] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass; new
  surfaces (attempts views, next-class report) have regression coverage.
  Verified for the 3.0.0 release on 2026-07-26.
- [x] Deployed to production per the versioning policy
  (`versioning-and-releases` skill). Released as 3.0.0 on 2026-07-26.
