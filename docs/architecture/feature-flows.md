# Feature Flows

## Tutor Chat Flow

1. The user opens `/` or `/c/:conversationId`.
2. The page renders the main app shell and chat view.
3. The client initializes the chat runtime and, if authenticated, opens a socket connection.
4. The client joins the conversation or receives an ephemeral greeting for a new thread.
5. When the user sends a message:
   - the message is persisted
   - the tutor runtime is invoked
   - structured assistant output is streamed back
6. The server applies runtime side effects such as:
   - sentence evaluation metadata
   - conversation title updates
   - visible tutor plan creation or updates
7. The client renders the returned structured blocks.

## Visible Tutor Plan Flow

1. Before each tutor turn, the server loads the current fused tutor plan for the
   conversation, if one exists.
2. The server injects that plan into the tutor model context as teacher-only
   authoritative state.
3. If the tutor starts a multi-step path, it emits `tutor_plan`.
4. If the tutor advances, skips, renames, or appends steps, it emits
   `tutor_plan_update`.
5. The server validates plan mutations against the stored plan state.
6. The server persists the newly fused plan.
7. The client updates the plan panel near the composer.

## Tutor Conversation Summary Flow

1. The user chooses `Finalizar y resumir` from the composer footer or from the
   conversation dropdown in the sidebar.
2. The app shows a Bootstrap confirmation modal explaining that Mr. F will
   summarize the conversation, extract progress, difficulty areas, vocabulary,
   and recommendations.
3. When the user confirms, the server loads the conversation transcript and
   checks that the user has enough LLM credit to generate the report.
4. The server asks the model to generate a structured tutor conversation report.
5. The report is validated and persisted.
6. The conversation is marked as closed.
7. If the conversation still has a generic title and the user did not manually
   rename it, the server uses the report summary title as the conversation name.
8. The user is redirected to `/c/:conversationId?tab=summary`.
9. Closed conversations show two tabs:
   - `Conversación`, which shows the original read-only chat history
   - `Resumen`, which shows the structured report

From the summary page:

- `Practicar estos puntos` creates a new tutor conversation seeded with a
  snapshot of the report.
- `Crear guía de práctica` asks the model to convert the report into a
  persistent practice guide.
- If a guide was already created from the report, the UI links to that existing
  guide instead of creating another one.

Closed conversations cannot accept new chat messages. If a stale client tries to
send into a closed conversation, the socket handler rejects the message with a
read-only conversation error.

## Practice Guide Flow

### Create manually

1. The user opens the new practice guide page.
2. The server renders a dedicated page handler for that route.
3. The user submits title, description, and tutor instructions.
4. The guide is persisted and becomes available in the resource catalog and
   detail page.

### Generate draft

1. The user opens the generate modal from the practice guide area.
2. The user describes the desired learning resource.
3. The server calls the resource-draft generation prompt.
4. The structured draft is validated.
5. A new guide is created and the user is redirected to the detail page.

### Start tutoring from a guide

1. The user starts a tutor conversation from a practice guide.
2. A conversation is created with the active profile.
3. A snapshot of the practice guide context is stored.
4. The tutor receives the guide instructions as part of the system context.

## Teacher-Assigned Practice Flow

This flow supports human teachers who want students to practice a class topic
independently. The Spanish UI label is `Quizzes`.

### Create quiz

1. The teacher opens `Recursos` and creates a new `Quiz`.
2. The teacher starts an authoring session with a natural-language prompt.
3. The server checks the teacher's credits for AI-assisted authoring.
4. Mr. F generates a strict quiz-compatible quiz draft.
5. The authoring workspace opens on a `Design` tab that shows the quiz as
   editable blocks.
6. Each block shows a visible number, such as `Block 1`, so the teacher can
   reference it in the `AI chat` tab.
7. The teacher can update quiz metadata and reorder, delete, duplicate,
   or add blocks in the `Design` tab.
8. Reordering updates visible block numbers while preserving stable internal
   block ids for AI revision context.
9. Adding a block shows the supported block types, then opens a modal where the
   teacher describes the block for AI generation.
10. The `AI chat` tab lets the teacher ask Mr. F for broader quiz changes
    using block-number references.
11. AI-generated blocks and AI revisions replace the current structured draft
    only after validation against the supported quiz item contract.
12. The teacher clicks `Probar` to execute the student-facing Quiz shape.
13. The teacher can test the quiz from the student perspective by
    creating the same normal authenticated attempt a student would use.
14. Evaluated authenticated attempts write learner progress for the active
    profile.
15. The quiz stores a fixed quiz-compatible payload with title,
    description, target topic, instructions, rubric, and ordered items.
16. The teacher saves the quiz and can share a link with students.

### Complete quiz

1. The student opens the shared quiz link.
2. Current generic sharing asks the student to create an account or log in
   before adding the shared Quiz to their resources.
3. After authentication, the student starts or resumes an attempt under the active
   profile.
4. The student answers the full sequence.
5. The student submits the attempt.
6. The server asks the model to evaluate the responses for free to the student.
7. The evaluated result is stored and rendered as a structured review.
8. If the attempt is associated with an account, it contributes a progress event
   to the student's profile. That event records the quiz as
   `resourceId` plus `resourceType: "quiz"` inside the event details
   JSON, while preserving the quiz attempt as the source id.
9. Future quiz-specific public sharing should allow guest completion and
   free AI evaluation before account creation; that exception is not part of
   the current generic resource sharing flow.

### Continue practice

1. From the result page, the student can choose to practice the detected
   difficulties or the original quiz topic with Mr. F.
2. If the student is a guest, the app asks them to create an account or log in.
3. The standard account credit policy applies to follow-up tutoring.
4. The server creates a tutor conversation with an quiz-attempt snapshot.
5. The tutor receives the quiz, responses, result, and focus areas as
   teacher-only context.
6. Mr. F continues with targeted practice instead of grading the same attempt
   again.

## Removed Chat Room Flow

The previous standalone chat room flow was removed in Resource Simplification
V2 Slice 7. `/chatrooms` and `/chatroom-conversations/*` now redirect to
`/resources`. Conversational scenario practice now belongs to the `Roleplay`
resource type instead of restoring the old room flow.

## Roleplay Flow

### Create roleplay

1. The user opens `Recursos` and chooses `Nuevo` -> `Roleplay`.
2. The user describes the desired scenario in natural language.
3. The server checks the creator's credits for AI-assisted authoring.
4. The model returns a structured roleplay draft with a scenario, level,
   pedagogical focus, optional learner-turn limit, and exactly two characters:
   `learner` and `ai`.
5. The roleplay is persisted as a `roleplay` resource and opens in the edit
   view.
6. The creator can edit metadata, scenario, pedagogical focus, character names
   and descriptions, and optional learner-turn limit manually.
7. The creator can use the AI edit chat to ask for revisions. The authoring
   history and recent draft snapshots are sent with each revision request.

### Run roleplay

1. The learner opens the roleplay detail page from `Recursos` or through a live
   shared resource reference.
2. The app starts a roleplay attempt with a frozen snapshot of the roleplay.
3. The server checks runtime credit and generates the AI-controlled character's
   first line from the frozen snapshot.
4. The learner writes the next English turn in the dedicated roleplay-writing
   UI.
5. The server checks runtime credit and asks the model for the fictional
   character's next turn.
6. The exchange repeats until the learner presses `Finalizar y resumir` or
   reaches the configured turn limit.
7. The server checks evaluation credit and asks the model to evaluate the
   learner-controlled turns only.
8. The result is saved and rendered with per-turn sentence-evaluation-like
   annotations, strengths, difficulties, recommendations, and vocabulary.
9. Authenticated evaluated attempts write learner progress events with
   `resourceType: "roleplay"` in the event details.

### Continue practice

1. From the result page, the learner can start a follow-up Mr. F conversation
   or create a practice guide from the evaluated result.
2. Follow-up actions appear below the result title/summary area on both desktop
   and mobile, and the result page close control returns to the roleplay detail
   page.
3. When starting a tutor conversation, the server creates it with a frozen
   roleplay-attempt snapshot.
4. The tutor receives the roleplay setup, transcript, and evaluation result as
   teacher-only context.
5. Follow-up tutoring uses the standard account credit policy.
6. When creating a practice guide, the server generates a guide from the
   roleplay result, redirects to the guide detail page, and applies normal guide
   ownership and resource behavior.

## Quiz Flow

1. Mr. F emits a `quiz` block.
2. The client renders an interactive quiz card.
3. The user completes and submits the quiz.
4. The card enters an evaluating state.
5. The server asks the model to evaluate the original quiz and the user's
   submitted responses.
6. If the evaluation structure is invalid, the model is asked to fix its own
   output.
7. When the valid evaluation arrives, the server builds the `quiz_result` block:
   - a `quiz_result` message is persisted
   - the client renders the result as a dedicated slide-based review UI
   - the original quiz card is marked as evaluated

## Profile and Settings Flow

1. New account signup creates the account first and keeps the signup form short.
2. The first profile is created automatically with a default name.
3. After email verification, a profile onboarding page asks for:
   - profile name
   - short profile description
   - learning context for Mr. F
4. The learner may save the onboarding form or skip it. Either action marks the
   onboarding as completed so the app does not keep interrupting navigation.
5. An authenticated user can create or switch profiles.
6. New manually created profiles are considered user-created and do not trigger
   first-run onboarding.
7. The active profile is carried through cookies/session-aware server rendering.
8. The profile form edits profile data and profile-scoped preferences.
9. Profile data includes name, description, learning context, and model tier.
10. The tutor receives profile context as teacher-only background when building
    its system prompt.
11. The settings page is reserved for account-level options such as password management.

## Guest Flow

The app shell behaves differently for visitors without a session.

Current guest behavior:

- the sidebar still renders
- only authentication actions are shown there
- the main sidebar content explains that login is required to access tutor practice features

This keeps the shell visible while making the authenticated-only feature boundary explicit.
