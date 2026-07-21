# Roadmap V3/V4 MVP Adjustment Proposal

Date: 2026-07-18

Status: **Applied on 2026-07-18.** The founder approved this proposal and the
changes were applied to [Roadmap V3](roadmap-v3.md) and
[Roadmap V4](roadmap-v4.md) on 2026-07-18 (V3 refocused as the Teacher Pilot
MVP with new sections 1.6/1.7 and new exit criteria; deferred work carried to
V4). This document is kept as the decision record; the roadmap files are now
the source of truth. The MVP definition lives in
[Propuesta de MVP](../business/propuesta-mvp.md).

## 1. Why adjust the roadmaps now

The business documentation in `docs/business/` approved a concrete initial
focus: independent teachers/tutors of adult immigrant English learners in South
Florida, with the promise *"turn every task and real difficulty into guided
practice, and reach the next class knowing where each student needs help"*. The
business roadmap requires a real pilot with 3–5 teachers within ~90 days.

Roadmap V3 as written predates that decision. Its headline pillar is
comprehension exercises, and most of its recent energy went into the scene
media library and authoring quality. Meanwhile the one capability the approved
promise depends on — **the teacher seeing student results and getting a
next-class report** — exists nowhere in the product or in any roadmap. Today a
teacher can create and share a quiz, but attempts, evaluations, and follow-up
practice are visible only to the student.

The proposal: **V3 becomes the Teacher Pilot MVP release.** Everything the
pilot does not need moves to V4, regardless of how attractive or how far along
it is. Work already shipped inside V3 stays shipped; only remaining work moves.

## 2. Proposed V3 (restructured)

### Keep in V3

- **1.3 Quiz AI modifications — finish.** All six phases are code-complete
  (2026-07-17, 181 tests green). Remaining: the live logged-in click-through
  against real inference, plus the small follow-up doc/skill updates
  (`ai-authoring-chat-conventions`, teacher-assigned-practice references).
  This is step 1 of the MVP cycle.
- **Roleplay/practice-guide modal migration to the shared controller** —
  optional; keep only if it stays cheap. Otherwise move to V4.

### Add to V3 (new headline: Teacher Results & Next-Class Report)

This is the MVP centerpiece and the only wholly missing piece of the approved
promise. Design decision (2026-07-18, with the founder): **no teacher/student
profiles, no role-aware homes, no dashboards, no classroom entity.**
Authorization is resource-scoped — the quiz owner sees the attempts of their
quiz — and the surface is the existing quiz page (a `Resultados`
section/tab). The long-term classroom/packages/organization shape is captured
as a north-star design in [Classrooms](../features/classrooms.md) and stays
out of the MVP. Suggested new section `1.6 Quiz Results & Next-Class Report`:

- [ ] Attempts visibility for the quiz owner: per-quiz list of attempts
  (student, date, completion, overall result) and a per-attempt detail view of
  the evaluated answers, inside the quiz page. Owner-only; the owner's own
  test attempts (`Probar`) are excluded from the list.
- [ ] Disclosure-at-start consent: before answering, the shared-link page
  states clearly that the person who shared the activity will see the
  student's answers and evaluation; starting the attempt constitutes consent.
  Applies across the guest → signup → claim flow. Adults-only pilot policy.
  (Per-student opt-in was considered and rejected: an incomplete report
  breaks the teacher promise. Voluntary sharing is reserved for the student's
  own follow-up practice, deferred past the MVP.)
- [ ] Next-class report per quiz: deterministic aggregation of persisted
  results — most-failed items, recurring difficulty patterns, per-student
  summary, who started follow-up practice. Optional AI-written summary gated
  on the teacher's credits. One clear page; no dashboards.
- [ ] Funnel instrumentation check: verify each pilot funnel step (invited →
  started → completed → reviewed → practiced → report viewed) is recorded and
  queryable, adding minimal events where missing. Manual SQL is acceptable for
  the pilot.

### Add to V3 (pilot readiness)

- [ ] Minimal manual block editing for teachers, scoped to the most common
  item kinds (fixing a typo must not cost an inference). This is a deliberate
  scope-down of the "manual block editing" item split out on 2026-07-17; the
  full nine-kind editor stays out.
- [ ] Pilot credit mechanics: document and verify the superadmin per-user
  limit flow as the way to fund pilot teachers/students; measure real AI cost
  per full cycle (create → attempt → evaluate → follow-up → report) so the
  business docs get a contribution-margin input. No new payment infrastructure.

### Downgrade in V3

- **1.1 Comprehension exercises:** Phase 1 (reading) becomes an explicit
  *stretch goal* — it is small, reuses the `quiz`/`quiz_result` pipeline, and
  gives pilot teachers one more activity type, but it must not delay the MVP.
  Phases 2 (listening/TTS) and 3 (image) move to V4. The V3 exit criterion
  "reading and listening comprehension work end to end" is dropped.
- **1.2 Scene media library:** freeze at what is shipped. Remaining items
  (tutor `scene_media` block + prompt guidance + tests, media-to-resource
  derivation, step-by-step creation flow, script-review-then-audio flow, voice
  and delivery-style control, transcript/player unification, storage-backed
  media tests, preview orphan sweep, adult-voice listening QA) move to V4. The
  shipped library, authoring, and prompt-hardening work stays as-is.
- **2.1 LLM inference audit:** keep only the slice the pilot needs — the
  per-operation cost/latency measurement for the operations in the teacher
  cycle (quiz generation/modification, evaluation, follow-up tutoring,
  report summary). The full inventory, governance artifact, CI enforcement,
  and evaluation sets move to V4.

### Move out of V3 entirely

- **1.4 Voice messages in roleplays** → V4 (already depends on the TTS
  infrastructure sequenced with comprehension Phase 2).
- **1.5 CEFR level standardization** → V4 (keep authoring bands as they are
  for the pilot).
- **2.2 Structured block post-processing classifier** → stays deferred, V4
  inbox.

### Proposed new V3 exit criteria

- [ ] A real teacher can run the full cycle in production: create a quiz from
  their own material, share it, students complete and get evaluated, students
  can start follow-up practice, and the teacher sees the attempts and the
  next-class report.
- [ ] Live QA of the quiz AI modification operations is done.
- [ ] The pilot funnel is measurable end to end, and the AI cost of one full
  cycle is known.
- [ ] `npm run typecheck`, `npm run test:typecheck`, and `npm test` pass; new
  surfaces (teacher report, attempts views) have regression coverage.
- [ ] Deployed to production per the versioning policy
  (`versioning-and-releases` skill).

With this scope, shipping V3 makes the product pilot-ready; the pilot itself
is business-roadmap work (Fases 2–4), not a technical exit criterion.

## 3. Proposed V4 (restructured)

V4 stops being an empty idea backlog and becomes "everything deliberately
deferred past the MVP", ordered by how directly it serves the teacher segment
once the pilot produces evidence:

1. **Comprehension exercises, Phases 2–3** (listening with server-side TTS,
   image comprehension) — carried from V3. Listening leans on the TTS/object
   storage infrastructure the scene media work already built.
2. **Scene media library, remaining work** — carried from V3 (tutor block,
   derivation, step-by-step creation, voice/style control, player/transcript
   unification, tests, QA).
3. **Voice messages in roleplays** — carried from V3; sequenced after the
   shared TTS infra.
4. **CEFR level standardization** — carried from V3.
5. **Generalized translation scaffolding (any support language)** — already
   in V4.
6. **LLM inference portfolio audit and governance, full version** — carried
   from V3.
7. **Classroom layer (roles, classrooms, activity packages, invitations,
   dashboards, organizations, teacher-funded student credits)** — the full
   north-star flow is designed in [Classrooms](../features/classrooms.md);
   promote stages from it *only if the pilot shows teachers need them*. The
   MVP deliberately stays resource-scoped. The opt-in "share my practice with
   the teacher" action and a public landing page are the cheapest first
   stages once outreach starts.
8. **Structured block post-processing classifier** — unchanged, still gated on
   quantifying the linter miss rate.

Pilot evidence should reorder this list before V4 planning is committed; that
is the point of running the pilot first.

## 4. What this proposal does not change

- No shipped functionality is removed or reworked.
- The V3 branch/versioning flow stays as documented (V3 ships as `3.0.0` via
  the release process).
- The business roadmap (`docs/business/negocio-roadmap.md`) stays the decision
  record for market validation; this proposal only aligns the technical
  roadmaps with it.
- The idea inbox ([issues/incomming.md](../issues/incomming.md)) keeps its
  role; nothing new is promoted from it except as noted for V4 item 7.

## 5. Suggested application steps once approved

1. Edit `roadmap-v3.md`: update the status header (headline becomes the
   Teacher Pilot MVP), add section 1.6, annotate moved items with
   "moved to V4 on <date>" notes, and replace the exit criteria.
2. Edit `roadmap-v4.md`: add the carried sections with their design-doc links
   and "deferred from V3 on <date>" provenance notes.
3. Update `docs/business/negocio-roadmap.md` section 4.2 to note that the
   technical V3 now targets the pilot-ready product.
4. Archive this proposal (or mark it applied with the date).
