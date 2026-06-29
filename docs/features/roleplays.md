# Roleplays

Date: 2026-06-29

`Roleplay` resources are reusable English-production activities. They are close
to the existing mini-conversation tutor blocks, but promoted to a saved resource
with authoring, sharing, attempts, evaluation, progress, and follow-up practice.

Implementation status: the first authenticated version is implemented as a V2
resource type. Future guest/free attempts, character images, and richer guided
roleplay branching remain deferred.

The core product idea is:

- the learner plays one character in an English roleplay
- the AI plays the other character
- the learner writes English turns in a dedicated roleplay-writing UI
- when the learner finishes, Mr. F evaluates the learner's English turn by turn
- the learner can then practice detected problems with Mr. F

This should reuse the know-how and workflow from `Tareas`: snapshot the resource
when an attempt starts, evaluate the submitted attempt with AI, persist the
result, update progress when attached to an account, and offer follow-up
tutoring.

## Product Positioning

Roleplays are not the old chat-room feature.

They are:

- resource-shaped
- profile-owned
- shareable through generic resource sharing
- focused on learner English production
- evaluated after completion
- connected to progress and follow-up practice

They are not:

- multi-character group chats
- general conversation rooms
- normal Mr. F chats with a different skin
- guided step-by-step lessons for the first version

The first version is a free-form roleplay. Guided plans, branching scripts, and
image-based characters can come later.

## Authoring Data

A roleplay resource stores enough information for the AI to run the fictional
character consistently and for Mr. F to evaluate the learner fairly.

Current fields:

- `title`: short resource title.
- `description`: Markdown-capable teacher-facing summary.
- `scenario`: the situation the learner is entering, including any context the
  learner needs before writing. Markdown is optional.
- `level`: optional learner level.
- `pedagogicalFocus`: one free-form guidance field for language goals,
  evaluation priorities, vocabulary, grammar, register, and any teaching notes.
  Markdown is optional.
- `maxLearnerTurns`: optional hard limit for the number of learner entries.
- `characters`: exactly two characters for the first version. The fixed ids are
  `learner` and `ai`.

Each character should include:

- `id`
- `name`
- `description`
- future optional image fields, once generated character images are introduced

The first AI turn is not stored in the resource. It is generated dynamically
when an attempt starts so each learner run can begin naturally while still using
the same saved scenario and character setup. The UI starts with Bootstrap Icons
for characters. Later, character images can replace or supplement the icon.

## Authoring Workflow

The authoring workflow follows the Assignment pattern where useful:

1. The creator starts from a natural-language prompt.
2. The AI creates a roleplay draft.
3. The creator reviews the general resource information and character setup.
4. The creator can edit manually.
5. The creator can revise with AI.
6. The creator can test the roleplay from the learner perspective.
7. The saved resource appears in `Recursos`.

The authoring UI should make it clear what the model can configure:

- scenario
- learner-facing context inside the scenario
- two character names and descriptions
- maximum learner turns
- one pedagogical focus field

## Learner Runtime

The learner runtime should be a dedicated writing surface, not a normal chat
thread.

Flow:

1. The learner opens the roleplay resource.
2. The app starts a roleplay attempt with a frozen snapshot of the resource.
3. The app shows the scenario.
4. The AI-controlled character's first line is generated for this attempt.
5. The learner writes the next English turn.
6. The AI generates the other character's next turn.
7. The exchange repeats until:
   - the learner presses `Finalizar`, or
   - `maxLearnerTurns` is reached.
8. The app submits the attempt for AI evaluation.
9. The result page shows the roleplay again with annotations and feedback.

The writing surface should feel like a dedicated pedagogical composition tool:

- use the pedagogical content style rather than the normal Mr. F chat chrome
- visually separate the two characters
- use character icons for now
- keep the learner's input area close to the previous fictional character turn
- avoid making the runtime look like the normal Mr. F chat
- keep controls quiet and focused: continue, finish, and possibly restart

## Evaluation Result

The evaluation should mirror the Assignment result workflow, but the visual
presentation should feel like an annotated roleplay transcript.

The result should include:

- the full transcript
- each learner turn annotated in a sentence-evaluation-like format
- optional per-turn rating or qualitative assessment
- optional corrected rewrite for each learner turn
- per-turn feedback
- detected recurring errors
- vocabulary and phrase suggestions
- overall rating or assessment
- general summary
- recommended next practice

The model should evaluate only the learner-controlled character's turns. The
fictional character turns are context, not learner output.

## Follow-Up Practice

After evaluation, the learner should be offered the same kind of follow-up
actions used by assignments:

- practice detected problems with Mr. F
- practice the roleplay topic with Mr. F
- future: create a follow-up practice guide from the evaluation

These follow-up paths should carry a compact snapshot of:

- roleplay title and scenario
- learner role
- transcript
- evaluation result
- detected focus areas

Follow-up tutor practice should use the standard credit policy. Future public
roleplay attempts may be free, but follow-up tutoring should require an account
unless a later explicit billing policy says otherwise.

## Attempts

Roleplays need an attempt model similar to assignments.

Attempt data includes:

- roleplay id
- user/profile id when authenticated
- future guest or claim token if public/free attempts are enabled
- snapshot JSON
- transcript turns
- status
- max learner turns at the time of attempt
- evaluation result JSON
- optional progress event id
- timestamps

The roleplay detail page should show attempts where applicable. This exposes a
current Assignment UI gap too: assignment detail pages should show relevant
attempts/results for the active profile.

The active attempt page and result page should include a deterministic close
control that returns to the roleplay detail page. Result follow-up actions
should be visible directly below the summary area:

- `Practicar`, which starts a targeted Mr. F conversation from a frozen
  roleplay-attempt snapshot
- `Crear guía de práctica`, which creates a practice guide from the evaluated
  roleplay result

## Progress

Authenticated evaluated roleplay attempts should create learner progress events.

Progress event details should include:

- `resourceId`
- `resourceType: "roleplay"`
- practiced topics
- recurring difficulties
- progress highlights
- recommendations
- vocabulary or useful phrases

Guest attempts should not update progress until they are attached to an account.

## Credits And Free Usage

Initial policy:

- AI authoring consumes creator credits.
- AI revision consumes creator credits.
- Authenticated roleplay runtime and evaluation follow the standard credit
  policy unless explicitly changed.
- Follow-up tutor practice follows the standard credit policy.

Future policy:

- Shared roleplay attempts may become free as an acquisition path, similar to
  the planned public/free Tarea flow.
- `maxLearnerTurns` can help cap free usage.
- Free public roleplay attempts must be rate-limited and abuse-resistant.

## Implementation Notes

Use Assignment infrastructure as the closest reference:

- resource-backed authoring
- attempts with frozen snapshots
- evaluation result persistence
- progress event writing
- follow-up tutor conversation creation
- future guest/claim flow

Use existing mini-conversation/tutor dialogue blocks as UI and protocol
reference, but do not store roleplay attempts as normal chat messages.

The first version should avoid guided roleplay branching. Keep it as a free-form
roleplay with evaluation after completion.
