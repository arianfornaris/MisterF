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
7. The client renders the returned structured blocks.

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
- `Crear módulo de práctica` asks the model to convert the report into a
  persistent practice module.
- If a module was already created from the report, the UI links to that existing
  module instead of creating another one.

Closed conversations cannot accept new chat messages. If a stale client tries to
send into a closed conversation, the socket handler rejects the message with a
read-only conversation error.

## Practice Module Flow

### Create manually

1. The user opens the new practice module page.
2. The server renders a dedicated page handler for that route.
3. The user submits title, description, and tutor instructions.
4. The module is persisted and becomes available in lists and detail pages.

### Generate draft

1. The user opens the generate modal from the practice modules area.
2. The user describes the desired learning resource.
3. The server calls the resource-draft generation prompt.
4. The structured draft is validated.
5. A new module is created and the user is redirected to the detail page.

### Start tutoring from a module

1. The user starts a tutor conversation from a practice module.
2. A conversation is created with the active profile.
3. A snapshot of the practice module context is stored.
4. The tutor receives the module instructions as part of the system context.

## Practice Module Collection Flow

1. The user creates a collection.
2. Practice modules are added to the collection.
3. Ordered collection membership is stored in the database.
4. The detail page shows the collection and its modules.
5. The collection can be shared, favorited, archived, or restored.

## Chat Room Flow

### Create room

1. The user creates a room manually or from an AI draft.
2. Characters are stored with explicit ordering.
3. The room becomes available in the chat room list.

### Run room conversation

1. The user joins a room.
2. A room conversation is created.
3. The room-specific runtime drives a multi-character practice conversation.
4. Messages are stored separately from the tutor chat message model.

### Evaluate room conversation

1. The user requests evaluation.
2. The system generates a structured report with slides.
3. The report is persisted and shown in a dedicated report page.

### Continue with Mr. F

1. From a room report, the user can start a tutor conversation.
2. A conversation snapshot is created from the report.
3. The tutor uses report context to continue practice in one-on-one mode.

### Generate practice module from room report

1. The user chooses to create a practice module from the report.
2. The report is transformed through a prompt dedicated to this conversion.
3. The generated module is persisted and shown to the user.

## Quiz Flow

1. Mr. F emits a `quiz` block.
2. The client renders an interactive quiz card.
3. The user completes and submits the quiz.
4. The card enters an evaluating state.
5. The server asks the model to produce a structured `quiz_result`.
6. If the structure is invalid, the model is asked to fix its own output.
7. When the valid result arrives:
   - a `quiz_result` message is persisted
   - the client renders the result as a dedicated slide-based review UI
   - the original quiz card is marked as evaluated

## Profile and Settings Flow

1. An authenticated user can create or switch profiles.
2. The active profile is carried through cookies/session-aware server rendering.
3. The settings page edits profile-scoped preferences.
4. The current important preference is `modelTier`.
5. Tutor conversations synchronize to the profile model tier when they are opened or used.

## Guest Flow

The app shell behaves differently for visitors without a session.

Current guest behavior:

- the sidebar still renders
- only authentication actions are shown there
- the main sidebar content explains that login is required to access tutor practice features

This keeps the shell visible while making the authenticated-only feature boundary explicit.
