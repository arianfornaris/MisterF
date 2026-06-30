# Teacher-Assigned Practice

## Product Intent

Mister F is not only a self-study tutor. A major product direction is helping
human teachers turn class topics into structured individual practice that
students complete with AI-assisted evaluation and follow-up.

This feature introduces `Quizzes`, a new resource area where a human teacher can
create a shareable sequence of questions. A student opens the shared resource,
completes the questions individually, receives a free AI evaluation, and can
then create an account to continue practicing the detected difficulties with Mr.
F under the normal credit policy.

Quiz creation should be iterative and AI-assisted. The teacher starts with
a natural-language prompt, reviews the draft created by Mr. F, tries the
quiz as if they were a student, and keeps asking the assistant for changes
until the quiz is ready to save and share.

Quizzes are also an acquisition path. Teachers need an account and credits to
create them, but students should be able to complete a shared Quiz before they
have an account. The result becomes the moment where Mister F can invite the
student to save progress and keep practicing.

The feature should reuse the existing quiz contract instead of inventing a
parallel exercise format. Conceptually, a teacher-assigned practice item is a
persisted, shareable `quiz` block with metadata, ownership, attempts, progress
side effects, and follow-up actions.

## Implementation Status

The first V1 implementation is in place:

- `Quizzes` appears in the authenticated sidebar below `Guías de Práctica`.
- Teachers create an AI-generated quiz from a natural-language prompt.
- The authoring workspace includes `General`, `Bloques`, and `AI chat` tabs.
- The `AI chat` tab persists teacher/assistant history and sends that history
  as context on later quiz revisions.
- Blocks are numbered for human reference and keep stable internal ids.
- Teachers can update metadata, reorder, delete, duplicate, and AI-generate
  blocks.
- Teachers can share quizzes and run normal attempts with `Probar`.
- Students can complete shared links as guests.
- Shared-student evaluation is product-funded and free to the student.
- Authenticated attempts update learner progress.
- Guest results can be claimed after login.
- Follow-up tutoring receives the quiz snapshot, responses, and result as
  teacher-only context.

Known hardening still tracked separately:

- rate limiting or abuse protection for free guest evaluations
- deeper manual content editing for individual blocks
- teacher dashboards, rosters, and classroom result review
- prompt-contract fixtures for representative generated quiz payloads

Terminology note: existing prompt/runtime docs use "teacher-only context" to
mean hidden model context that is not shown to the learner. In this feature
document, "human teacher" means a real person creating student practice. When
both ideas appear together, the phrase "teacher-only context envelope" still
refers to hidden model context, not to a human-teacher-only dashboard.

## Naming

The chosen Spanish UI name is `Quizzes`.

Use `Quiz` / `Quizzes` as the internal/domain name in code and
technical documentation. Use `Quiz` / `Quizzes` in Spanish learner-facing UI.

Rationale:

- it clearly communicates teacher-to-student intent
- it leaves room for due dates, classroom groups, teacher dashboards, and result
  review later
- it avoids confusing standalone shareable work with inline tutor exercise
  blocks
- it supports the acquisition path: a student can receive a Quiz link from a
  teacher, complete it, see value immediately, and then create an account to
  continue

## Relationship To Existing Features

### Practice Guides

Practice guides are reusable tutoring configurations. They tell Mr. F how to
conduct a practice conversation.

Teacher-assigned practice is different:

- it is not a tutor conversation by default
- it has a fixed question sequence
- it has a completion event
- it produces one evaluated result
- it can update progress immediately
- it can offer follow-up tutoring after evaluation

The unified `Recursos` navigation can show both practice guides and quizzes
because both are teacher-authored practice resources, but the workflows should
stay separate.

### Quiz Blocks

The existing `quiz` block already supports the right content shape:

- open text
- translate to English
- understand in Spanish
- fill in the blank input
- fill in the blank choice
- multiple choice
- matching pairs
- unscramble sentence

The existing `quiz_result` block already supports the right result shape:

- item-by-item status: `correct`, `partial`, or `incorrect`
- feedback
- optional inline review
- original prompt and learner response

The quiz feature should store a quiz-like payload and reuse the same
evaluation service that currently evaluates quiz submissions. The standalone
quiz runtime can render the same quiz UI outside the tutor message stream.

### Progress

Completed quizzes should become a new progress event source. The progress
record should summarize:

- quiz title
- target topic
- teacher-authored description or learning goal
- item statuses
- recurring difficulty areas
- vocabulary or grammar patterns
- model recommendations

After evaluation, the student should be able to:

- practice detected difficulties with Mr. F
- practice the quiz topic again with Mr. F
- retry the quiz if allowed
- review the submitted answers and feedback
- create an account to save the result and continue with standard credit-backed
  tutoring

## Recommended V1 Scope

Start with a shareable standalone quiz resource, not a full classroom
management system.

Included:

- authenticated users can create quizzes
- quizzes belong to a profile, like practice guides
- quizzes can be listed, viewed, edited, archived, and shared
- quiz content uses the quiz item contract
- quiz creation is an AI-assisted authoring workflow
- teachers can start from a natural-language prompt
- teachers can chat with Mr. F to revise the draft before saving or sharing
- teachers can use a `Bloques` tab to reorder, delete, duplicate, edit, and add
  quiz blocks
- adding a block uses a block-type chooser followed by an AI prompt modal
- teachers can run the student-facing attempt flow from their own profile
- quiz AI generation, single-block generation, and revision are
  credit-gated for the teacher
- shared quizzes can be completed by students without an account
- AI evaluates the student's completed shared attempt for free
- authenticated evaluated attempts update learner progress immediately
- guest evaluated attempts can be saved to progress if the student creates an
  account after seeing the result
- students can create an account and start a tutor conversation from the attempt
  result under the standard credit policy
- teachers can share a link with students

Deferred:

- teacher/student roles
- class rosters
- due dates
- grading dashboard
- teacher-visible student results
- comments from the human teacher
- multiple sections or classrooms
- LMS integration

This keeps the first implementation close to existing resource and quiz
infrastructure while preserving room for a deeper teacher product later.

## Navigation And UI

### Sidebar

Quizzes now live under the unified `Recursos` catalog. Earlier V1 notes
placed `Quizzes` near old practice-guide and chat-room entries, but the
resource navigation model supersedes that sidebar layout.

The empty state can say:

- `Crea una quiz para que tus estudiantes practiquen de forma individual.`

### List Page

Follow the practice guide resource workflow and visual structure.

Primary controls:

- create new quiz
- generate draft with AI
- search/filter
- layout toggle if resource pages already support it
- archive states

Each list item should show:

- title
- short description
- target topic or tags
- item count
- updated date
- share status
- attempt count when available

### Authoring Entry Point

The first create screen should be a lightweight prompt intake, not a full form.

The teacher can describe the quiz in natural language:

- topic or class objective
- student level
- number of items
- preferred exercise types
- content to practice
- constraints, such as "no translation", "include matching", or "focus on
  past tense questions"

The page should also show what Mister F can create. This capability catalog
helps teachers understand the available exercise types before they write the
prompt.

Show teacher-facing names, short examples, and best-use hints for:

- free response
- translate to English
- understand in Spanish
- fill in the blank
- fill in the blank with choices
- multiple choice
- matching
- unscramble sentence

The prompt intake creates a validated quiz draft, persists it as an
quiz, stores the initial prompt in the quiz `AI chat` history, and
opens the authoring workspace.

### AI-Assisted Authoring Workspace

After the first prompt, the teacher lands in an authoring workspace where the
quiz draft and the assistant conversation stay connected.

Use a tabbed workspace as the primary interaction model:

- `General`: shows quiz-level metadata
- `Bloques`: shows the current quiz structure as editable blocks
- `AI chat`: lets the teacher ask Mr. F for broader quiz changes

Use Bootstrap `nav-pills` for the tab control. The tab state should be preserved
in the URL if the page is server-rendered. Client-side tabs are acceptable only
if the whole authoring workspace is already a client-side interaction surface.

The `Bloques` tab is the source-of-truth editing surface for the current draft.
It should show each quiz item as a block in design mode, not as a submitted
student attempt.

Every visible block must be numbered in the current quiz order. Use a
simple teacher-facing label such as `Block 1`, `Block 2`, and `Block 3` so the
teacher can reference specific blocks in the `AI chat` tab. The chat context
sent to Mr. F should include the same block numbers and stable internal block
ids so a request like "change block 4" maps to the correct draft item even after
previous edits.

Each block should show:

- current block number
- exercise type label
- prompt summary
- learner-facing test readiness
- answer readiness status
- validation status
- action buttons for reorder, edit, duplicate, delete, and AI-assisted edit

The `General` tab should expose quiz-level metadata:

- title, description, topic, and level
- overall student instructions

Block operations:

- reorder blocks with stable ordering controls
- update visible block numbers immediately after reordering
- delete a block with a confirmation when the block has non-trivial content
- duplicate a block
- edit a block manually
- ask AI to revise a specific block
- add a new block

The assistant chat should let the teacher ask for changes such as:

- "make it easier"
- "add two fill-in-the-blank items"
- "remove multiple choice"
- "make block 4 accept more possible answers"
- "focus the last questions on irregular verbs"
- "turn this into a 10-minute homework quiz"
- "explain why this block is good for my students"

Assistant revisions should update the structured quiz draft, not just
return prose instructions. The UI should make it clear when a draft has changed
and should allow the teacher to review the result before saving or sharing.
The revision model response should include both a validated updated draft and a
teacher-facing assistant message, so the `AI chat` tab remains conversational
without relying on unstructured text outside the JSON payload.

The `AI chat` history should be persisted with the quiz and displayed in
the authoring workspace. Each revision request should include the prior chat
turns as context alongside the current structured draft. The current draft stays
authoritative; chat history helps Mr. F understand teacher preferences and prior
requests, but it must not be copied into learner-facing quiz text.
Successful assistant turns should store recent draft snapshots in the chat
history so later requests can refer to earlier quiz states. The revision
flow still replaces the validated full draft instead of applying model tools or
database-level block patches.

The `AI chat` tab is for quiz-level or multi-block changes. It should not
replace the `Bloques` tab as the place where the teacher understands the current
structure.

When the teacher sends an `AI chat` message, the request context should include
the current numbered block outline. The model should refer back to the same
visible block numbers in its explanation, for example "I updated Block 4 and
left Blocks 1-3 unchanged."

### Add Block Flow

Adding a block starts from the `Bloques` tab.

Recommended flow:

1. The teacher clicks `Add block`.
2. The UI shows a Bootstrap-native chooser for the supported exercise types.
3. The teacher selects one type.
4. The app opens an `Add block` modal for that type.
5. The teacher describes what the new block should practice.
6. The server checks the teacher's credits because this is AI authoring usage.
7. Mr. F generates one block of the selected type.
8. The server validates the generated block against the quiz item contract.
9. The block is inserted into the current draft at the selected position.
10. The `Bloques` tab highlights the new block so the teacher can review it.

The chooser should reuse the exercise type catalog:

- free response
- translate to English
- understand in Spanish
- fill in the blank
- fill in the blank with choices
- multiple choice
- matching
- unscramble sentence

The modal should follow the standard Bootstrap modal pattern:

- modal title names the selected block type
- body includes a short prompt textarea and optional context fields such as
  difficulty, target vocabulary, or grammar focus
- footer uses `Cancel` as a secondary button and `Generate block` as the primary
  action
- submission disables the primary button and shows progress immediately
- the generated block is not inserted if validation fails

The add-block prompt should generate only the requested block. It should not
rewrite unrelated quiz metadata or existing blocks.

### Teacher Testing

The authoring workspace should expose a clear `Probar` action so the teacher can
execute the Quiz exactly as a student will receive it.

Test requirements:

- launch from the authoring page header
- create a normal authenticated attempt for the active profile
- render the same student-facing quiz layout used by shared links
- hide authoring controls, validation badges, and teacher-only notes
- preserve the current quiz order and block numbers
- show student-facing title, description, instructions, item prompts, and
  expected interactions
- support desktop and mobile responsive layouts
- authenticated evaluated attempts write progress for the active profile
- avoid LLM usage unless the teacher explicitly submits answers for evaluation

The teacher should also be able to test the full student flow:

- the teacher can open the same student-style attempt flow
- the teacher can answer the quiz themselves
- the teacher can submit the attempt to see the evaluation behavior
- authenticated evaluated attempts update learner progress
- quiz evaluation follows the same product-funded policy regardless of
  whether the respondent owns the Quiz

The workspace should avoid making the teacher choose between "form editing" and
"AI editing". Manual edits, assistant revisions, and teacher testing all operate
on the same current draft.

### Create/Edit Page

The editor should support both manual authoring and AI draft generation.

Fields:

- title
- description
- target topic
- optional level
- overall instructions for students
- attempt policy
- ordered quiz items

Item editor controls:

- item type selector
- prompt
- type-specific fields
- optional acceptable answers for open/translation/blank/unscramble items
- add block through the type chooser and AI prompt modal
- reorder
- duplicate
- delete
- test with `Probar`

The authoring UI should not expose internal protocol names like
`quiz_fill_in_the_blank_input` to teachers. Use product names:

- free response
- translate to English
- understand in Spanish
- fill in the blank
- fill in the blank with choices
- multiple choice
- matching
- unscramble sentence

For the AI-assisted workflow, this form should be treated as the structured
editing surface inside the authoring workspace, not as the only way to create an
quiz.

### Detail Page

The quiz detail page should serve two modes:

- owner/teacher mode
- student/taker mode

Owner mode:

- test quiz
- edit
- share
- archive
- duplicate
- view own attempts if the owner also completes it
- future: view student submissions

Student mode:

- quiz title and description
- teacher/creator name when safe to show
- item count
- start/resume button
- previous attempt summary if any

Guest student mode:

- quiz title and description
- teacher/creator name when safe to show
- item count
- clear note that the student can complete the Quiz without an account
- clear note that saving progress and follow-up tutoring require an account

### Attempt UI

The first implementation can reuse the existing quiz card interaction pattern.

Recommended behavior:

- one quiz attempt has one full quiz flow
- students can move through items before final submission
- final submit triggers AI evaluation
- the UI shows an evaluating state immediately
- evaluated results render in a slide/card review similar to `quiz_result`
- answers should be immutable after evaluation

Avoid showing the quiz attempt as a fake chat message. This is a
standalone resource flow. After evaluation, the student can optionally start a
real tutor conversation with the attempt as context.

### Result UI

The result screen should show:

- overall status summary
- item-by-item feedback
- inline review where available
- strengths
- difficulties
- recommended next practice
- progress updated indicator

Primary follow-up actions:

- `Practicar dificultades con Mr. F`
- `Practicar este tema con Mr. F`
- `Reintentar` when policy allows
- `Volver a quizzes`

## Workflow

### Teacher Creates Quiz

1. The teacher opens the quizzes section.
2. The teacher starts a new quiz with a natural-language prompt.
3. The server checks the teacher's LLM credits before the first AI generation
   step.
4. Mr. F generates a strict quiz-compatible quiz draft.
5. The teacher reviews the draft in the `Bloques` tab.
6. The teacher can reorder, delete, duplicate, edit, or add blocks from the
   `Bloques` tab.
7. The UI keeps every block visibly numbered so the teacher can reference it in
   the `AI chat` tab.
8. When adding a block, the teacher selects a block type and describes the
   desired block in an AI prompt modal.
9. The teacher can ask Mr. F for broader revisions in the `AI chat` tab.
10. The teacher can click `Probar` to execute the exact student-facing Quiz.
11. The teacher can submit the attempt for AI evaluation.
12. Each AI generation or revision validates the updated payload against the
   quiz item contract before replacing the current draft.
13. Quiz evaluation follows the same product-funded policy as student
   Quiz evaluation.
14. When ready, the teacher saves the quiz as an owned resource.
15. The teacher shares the quiz link.

### Student Completes Quiz

1. The student opens the shared link.
2. If unauthenticated, the app still lets the student start the Quiz.
3. If authenticated, the quiz opens under the student's active profile.
4. The student starts or resumes an attempt.
5. The student answers every required item.
6. The student submits the quiz.
7. The server evaluates the responses with the model for free to the student.
8. The result is stored and rendered.
9. If the student is authenticated, the progress service records the attempt.
10. If the student is a guest, the result page invites them to create an account
    to save the result and continue practicing.
11. The student chooses a follow-up path or exits.

### Continue With Mr. F

When a student chooses follow-up practice:

1. If the student is not authenticated, the app asks them to create an account
   or log in.
2. The server applies the standard LLM credit policy for tutor conversations.
3. The server creates a tutor conversation under the active profile.
4. The conversation stores an quiz-attempt snapshot.
5. The tutor receives teacher-only context:
   - quiz title
   - quiz goal
   - original quiz payload
   - student responses
   - model evaluation
   - detected focus areas
6. The first tutor turn should help the student practice the relevant
   difficulties, not merely summarize the result.

## Proposed Data Model

Possible first-pass tables:

### `quizzes`

- `id`
- `user_id`
- `profile_id`
- `title`
- `description`
- `target_topic`
- `level`
- `instructions`
- `quiz_json`
- `attempt_policy`
- `archived_at`
- source/copy metadata for shared imports
- timestamps

`quiz_json` should store a strict quiz content shape compatible with the
existing `quiz` block minus `type`, or the full `quiz` object if that makes
runtime reuse simpler. Each stored item should include a stable internal block
id or client key in addition to its current display order. Display numbers can
change when the teacher reorders blocks; stable ids are what let AI revisions,
logs, and later attempts keep referring to the same underlying item.

### `quiz_share_links`

- `id`
- `quiz_id`
- `created_at`
- optional `disabled_at`

This can mirror existing resource share-link patterns.

### `quiz_attempts`

- `id`
- `quiz_id`
- optional `user_id`
- optional `profile_id`
- guest/session identifier or claim token for unauthenticated attempts
- `status` (`draft`, `submitted`, `evaluating`, `evaluated`, `failed`)
- `responses_json`
- `result_json`
- `progress_event_id`
- `started_at`
- `submitted_at`
- `evaluated_at`
- timestamps

Attempts should store snapshots of quiz content or reference a
version/hash so that later teacher edits do not change already-completed
attempts. Guest attempts need a safe claim path so a student can create an
account after seeing the result and attach the attempt to their new profile.

### `conversation_quiz_attempt_snapshots`

If follow-up tutoring is implemented as a snapshot source, store:

- `conversation_id`
- `quiz_attempt_id`
- quiz title/description/topic
- quiz JSON
- response JSON
- result JSON

This mirrors the existing practice guide and report snapshot approach.

## LLM And Credit Boundaries

LLM calls can happen when:

- the teacher generates an quiz draft with AI
- the teacher generates a single new block from the add-block modal
- the teacher asks for an AI revision during authoring
- the teacher creates or saves a Quiz through the credit-gated creation flow
- the student submits an quiz for free evaluation
- an authenticated user submits a Quiz attempt for free evaluation
- the student starts follow-up tutoring from a result

Teacher creation is account-required and credit-gated. AI draft generation,
single-block generation, AI-assisted revisions, and teacher test
evaluation belong to the teacher's paid authoring workflow. This is part of the
product acquisition model: teachers spend credits to create useful work they can
share.

Shared Quiz completion is different. A student can complete a shared Quiz
without an account, and the AI evaluation at the end is free to the student.
This evaluation should be treated as product-funded acquisition usage, not as
usage charged to an anonymous student or silently charged to the teacher after
sharing.

After the result, any follow-up practice with Mr. F returns to the standard
policy:

- the student needs an account
- the follow-up tutor conversation uses the student's normal account credit
  rules
- if the student has no credits, the existing credit UI should handle that state

Operationally, this means quiz evaluation needs a separate credit policy
from normal user-scoped LLM calls. It should still be logged, rate-limited, and
protected against abuse.

## Sharing And Permissions

The existing app already supports share/import flows for resources. Quiz
sharing should follow the same mental model at first.

Suggested first version:

- owner can share a public-but-unlisted link
- any student with the link can open and complete the Quiz
- authenticated student attempts belong to the student profile
- guest attempts are temporary or claimable after account creation
- owner cannot see student results yet unless a future consent/dashboard model
  exists

Future teacher dashboard version:

- teacher owns quiz
- student submits against teacher-owned quiz
- teacher can see submission summary
- student consent/privacy rules are explicit
- class/group membership controls visibility

## Progress Integration

Add a progress event source such as `quiz_attempt`.

Authenticated attempts should write progress immediately after successful
evaluation. Guest attempts cannot update profile progress until the student
creates an account or logs in and claims/saves the result.

Progress event details should include:

- practiced topic
- item count
- status counts
- difficulty areas
- vocabulary
- recommended practice
- source quiz id
- source attempt id

The global progress summary should treat quizzes as structured practice
evidence, similar to finalized tutor reports.

## Prompting Notes

Quiz generation prompt:

- should output a strict quiz-compatible payload
- should include teacher-provided learning goal and level
- should know and explain the available exercise types
- should avoid creating hidden teacher-only answer explanations in learner
  prompts
- should make open-ended prompts specific enough for model evaluation when
  correctness is not a simple answer key

Quiz revision prompt:

- should receive the current quiz draft, the teacher's requested change,
  and relevant authoring history
- should receive the current visible block-number map and stable block ids
- should return a teacher-facing assistant message plus the full updated
  quiz-compatible quiz draft, not only a textual suggestion
- should preserve good existing items unless the teacher asks to change them
- should explain important changes briefly in the authoring chat
- should keep item ids or stable client keys when possible so the UI can show
  what changed and preserve block references after reordering
- should use the teacher-facing block numbers when explaining which blocks
  changed
- should validate that every item type remains supported by the platform

Single-block generation prompt:

- should receive the selected exercise type, insertion context, quiz
  metadata, and the teacher's short block prompt
- should generate exactly one valid block of the selected type
- should assign or return a stable internal block id for the new block
- should not rewrite existing blocks or quiz-level metadata
- should include enough prompt detail or accepted-answer data for later
  evaluation
- should preserve the language and learner level implied by the quiz

Quiz evaluation prompt:

- can reuse `tutor/quiz-result-evaluation.md` initially
- should receive the quiz metadata, quiz payload, and responses
- should return item evaluations only, not a tutor message
- should avoid creating a new exercise during evaluation

Follow-up tutor context:

- should be a teacher-only context envelope
- should tell Mr. F to practice the detected weakness, not to grade again
- should preserve the human teacher's original topic and intent

## Analytics And Logging

Important events:

- quiz authoring started
- quiz draft generated
- quiz authoring revision requested
- quiz authoring revision applied
- quiz block generation requested
- quiz block generation applied
- quiz block deleted
- quiz block reordered
- quiz test opened
- quiz authoring validation failed
- quiz test submitted
- quiz test evaluated
- quiz created
- quiz shared
- quiz attempt started
- quiz attempt submitted
- quiz evaluation failed
- quiz evaluated
- quiz progress event recorded
- follow-up conversation created from quiz attempt

Production logs should include ids and status metadata but not full learner
answers unless full LLM tracing is explicitly enabled.

## UI Risks

- The `Quizzes` label may make self-study users assume the feature is only for
  formal classes.
- If the authoring chat and quiz test flow are separated too much, teachers
  may lose track of what the assistant changed.
- If the exercise type catalog is hidden, teachers may only request simple
  multiple-choice work and miss the richer practice formats already supported.
- If assistant revisions silently rewrite the whole quiz, teachers may not
  trust the authoring workflow.
- If teacher results are promised too early, the app will need roles,
  permissions, consent, and reporting before the core attempt flow is ready.
- If quiz attempts are stored only as chat messages, the feature will be
  hard to query, share, retry, and summarize later.
- If teacher edits mutate completed attempts, old results become unreliable.

## Open Questions

1. Should teachers be able to see student results in the first version, or only
   share the practice resource?
2. Should guest results be persisted for a limited time, or only stored after
   account creation?
3. How should the app prevent abuse of free guest evaluations without hurting
   the acquisition flow?
4. Should students be able to retry unlimited times, once, or according to a
   teacher-set policy?
5. Should a student opening a shared quiz import a copy, or attempt the
   original teacher-owned quiz?
6. Should quiz content support tags/level now, or wait until search and
   classroom dashboards need them?
7. Should quiz AI generation be available to all users, or limited to
   teacher-oriented accounts later?
8. Should guest result claiming create progress automatically, or ask the
   student first?
9. Should quiz follow-up create a normal tutor conversation, a practice
   guide, or offer both?
10. Should AI-generated blocks be inserted immediately as draft blocks, or
    require an explicit `Accept block` action after review?
11. Should quiz authoring show an estimated session cost before each
    generation request, or only charge per accepted AI operation?

## Implementation Roadmap

Implement Quizzes as a sequence of vertical slices. Each slice should leave the
application in a usable, testable state and should avoid changing old applied
migrations after production-era data exists.

Execution status lives in
[Teacher-Assigned Practice Implementation Tracker](../issues/teacher-assigned-practice-implementation-tracker.md).

### Slice 1: Schema And Repository Foundation

Goal: create the persistent model without exposing the feature broadly yet.

Scope:

- Add a new forward-only migration for quiz tables.
- Add `quizzes` and `quiz_share_links`.
- Add `quiz_attempts` if the first migration should reserve the student
  runtime shape from the start.
- Add optional conversation snapshot storage only if follow-up tutoring is part
  of the same release train.
- Extend learner progress source types to allow `quiz_attempt`, but only
  write events in a later slice.
- Add repository types and CRUD helpers.
- Update migration tests for a fresh database.
- Update data-model documentation after the schema is implemented.

Exit criteria:

- Fresh SQLite migration passes.
- Repository tests or focused integration tests can create, read, update,
  archive, and share an quiz record.
- No user-facing route depends on incomplete authoring behavior.

### Slice 2: Basic Quiz Resource Shell

Goal: make Quizzes visible to authenticated teachers as a normal resource area.

Scope:

- Add `quizzes` router and mount it from the server composition root.
- Add list/detail/new/edit/archive/share routes.
- Add the sidebar/navigation entry below `Guías de Práctica`.
- Add EJS views that follow the existing resource page conventions.
- Add static, manually-authored quiz JSON support for development and
  debugging.
- Add a `Probar` action that creates a normal authenticated attempt.

Exit criteria:

- A teacher can create a simple quiz without AI.
- The quiz can be listed, opened, edited, archived, and shared.
- Test attempts render the student-facing shape without creating learner
  progress.

### Slice 3: Quiz Contract And Quiz Renderer Reuse

Goal: make the quiz content contract stable before adding AI authoring.

Scope:

- Define `QuizDraft`, `QuizBlock`, and response schemas around the
  existing `quiz` item contract.
- Add stable internal block ids and visible block-number mapping.
- Extract or adapt quiz rendering helpers so they can run outside chat without
  relying on `messageId:blockIndex`.
- Render every supported exercise type in quiz attempts.
- Add server-side validation for saved drafts.

Exit criteria:

- Invalid quiz payloads are rejected before persistence.
- Reordering blocks preserves stable ids and updates visible block numbers.
- Test attempts support the full supported exercise catalog.

### Slice 4: AI-Assisted Initial Authoring

Goal: let the teacher create a first draft from a natural-language prompt.

Scope:

- Add quiz generation prompts and correction prompts under
  `system-prompts/resources`.
- Extend the structured draft generation service or create an quiz-specific
  service using the same JSON correction pattern.
- Credit-gate initial AI generation with the teacher's account.
- Store the quiz, initial prompt in chat history, and validated current
  draft.
- Log generation success, validation failure, and credit exhaustion events.

Exit criteria:

- A teacher can describe a Quiz and receive a validated draft.
- Credit exhaustion shows product UI instead of a raw error.
- The generated draft opens in the authoring workspace.

### Slice 5: Bloques Tab Editing

Goal: make the teacher able to shape the quiz without AI chat.

Scope:

- Add the `Bloques` tab with numbered editable blocks.
- Add reorder, delete, duplicate, and manual edit operations.
- Add the exercise type catalog.
- Add `Add block` flow: type chooser, Bootstrap modal, and AI prompt field.
- Credit-gate single-block AI generation.
- Validate generated blocks before inserting them.

Exit criteria:

- The teacher can edit the quiz structure from the `Bloques` tab.
- Block numbers are always visible and updated after reordering.
- Single-block generation inserts exactly one validated block.

### Slice 6: AI Chat Revisions

Goal: let the teacher modify the whole quiz or specific numbered blocks
through conversation.

Scope:

- Add the `AI chat` tab.
- Send the current numbered block outline and stable block ids as context.
- Add revision prompts that return a teacher-facing assistant message and the
  full updated quiz draft.
- Validate the revised draft before replacing the current draft.
- Store teacher/assistant authoring chat history on the quiz.
- Show a concise summary of what changed, using visible block numbers.

Exit criteria:

- The teacher can ask for changes like "make block 4 easier".
- The AI updates the structured draft, not just prose.
- Revisions cannot silently corrupt unsupported block types.

### Slice 7: Teacher Test Evaluation

Goal: let the teacher inspect and optionally test the full student experience.

Scope:

- Finalize teacher test attempts as the exact shared-link student layout.
- Use normal authenticated attempts instead of a separate preview attempt mode.
- Allow the teacher to submit test answers for evaluation.
- Use the same product-funded evaluation policy as normal Quiz attempts.
- Ensure evaluated attempts update learner progress consistently.

Exit criteria:

- Starting an attempt does not consume LLM credits.
- Submitting answers follows the product-funded Quiz evaluation policy.
- Authenticated evaluated attempts appear in learner progress.

### Slice 8: Shared Student Runtime

Goal: let students complete shared Quizzes, including without accounts.

Scope:

- Add shared quiz landing page.
- Add student attempt start/resume/submit routes.
- Support guest attempt identity or claim tokens.
- Store quiz snapshots on attempts so future teacher edits do not mutate
  completed work.
- Reuse the quiz quiz renderer for the student attempt UI.
- Make submitted answers immutable.

Exit criteria:

- Any student with a valid link can complete a Quiz without logging in.
- Authenticated attempts are tied to the active profile.
- Guest attempts can be rendered after submission without exposing unrelated
  user data.

### Slice 9: Student Evaluation Policy

Goal: evaluate submitted shared attempts under the free student policy.

Scope:

- Reuse or adapt `evaluateQuizResultItemsWithLlm`.
- Add quiz evaluation prompt context with quiz metadata and block
  numbers.
- Run shared student evaluation under the product-funded policy, not the
  teacher's hidden post-share credits.
- Add rate limiting or abuse protection before enabling public guest evaluation
  in production.
- Store `result_json` and render the result screen.
- Log malformed evaluation output and repair attempts.

Exit criteria:

- Guest student evaluation is free to the student.
- Evaluation failures produce recoverable UI and logs.
- Result JSON validates and can be rendered later.

### Slice 10: Progress And Follow-Up

Goal: turn evaluated quizzes into learner progress and targeted practice.

Scope:

- Record `quiz_attempt` learner progress events for authenticated attempts.
- Add guest result claiming after account creation or login.
- Create conversation quiz-attempt snapshots.
- Add result actions for practicing detected difficulties or the quiz
  topic with Mr. F.
- Apply normal student credit policy to follow-up tutoring.

Exit criteria:

- Authenticated evaluated attempts update progress.
- Guest results can be saved only after account creation or login.
- Follow-up tutoring receives quiz, responses, evaluation, and focus areas
  as teacher-only context.

### Slice 11: Hardening And Release Readiness

Goal: make the feature safe enough for first production use.

Scope:

- Add route smoke tests and architecture tests.
- Add prompt contract tests for quiz generation, block generation,
  revisions, and evaluation.
- Add client error telemetry coverage for the authoring workspace.
- Add production logging events listed above.
- Build and commit client assets if the deploy process still expects committed
  `public/build` artifacts.
- Document operational limits for free guest evaluations.

Exit criteria:

- `npm run typecheck`, `npm test`, and a fresh SQLite migration check pass.
- The feature can be disabled or hidden if guest evaluation needs more abuse
  controls before public launch.
- The docs and implementation agree on payment, logging, and guest-access
  behavior.

### Deferred: Classroom Layer

Keep these outside the first implementation unless the product direction changes
before launch:

- teacher/student roles
- class groups or rosters
- due dates
- teacher dashboard
- student result review by teachers
- organization or teacher-funded student credits
- LMS integration
