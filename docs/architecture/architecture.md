# Architecture

## Application Shape

Mister F is an Express application with:

- server-rendered EJS pages
- page-specific client scripts
- Socket.IO for tutor chat and exercise lifecycle events
- SQLite-style persistence through a repository layer
- prompt-driven LLM services for tutor output and content generation

The entry point is:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/server.ts`

That file is responsible for:

- bootstrapping migrations
- creating the Express app and HTTP server
- configuring static asset mounts
- installing shared middleware
- registering page routes and form actions
- registering the chat socket runtime

## Server-Side Organization

### Route handlers

The server code is organized by feature area. Each feature has its own handlers instead of one large controller.

Main route areas:

- `auth`
- `quizzes`
- `chat`
- `payments`
- `practiceGuides`
- `progress`
- `profiles`
- `resources`
- `settings`
- `superadmin`

This matches the project convention that each page or route should have its own dedicated handler.

### Persistence

The database layer lives under:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/db`

Important files:

- `migrations.ts`: defines schema migrations
- `migrator.ts`: runs migrations on startup
- `repository.ts`: exposes feature-facing persistence helpers
- `database.ts`: low-level DB access

The repository layer is the main interface used by handlers and socket code.

### Services

Business logic and model-facing logic live under:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services`

Important subareas:

- `llmTutor`: tutor model runtime, schemas, providers, validation, tools, prompts
- `tutorWorkflow`: server-side side effects triggered by structured blocks
- `tutorReports`: finalized tutor conversation summaries and report-to-practice-guide generation
- `learnerProgress`: compact global progress and vocabulary aggregation from completed practice
- `administration`
- `secretary`

### LLM credit boundary

Every user-scoped server flow that invokes an LLM must pass through the credit
gate before inference and handle insufficient credit as product UI.

Use:

- `getCreditCheckedOpenRouterApiKeyForUser(...)`
- `isCreditExhaustedError(...)`
- `getCreditExhaustedMessage()`

Socket flows should emit `llm:credit_exhausted`. HTTP form flows should redirect
back to the relevant page with state that opens the credits modal or shows a
Bootstrap credit message. They must never expose raw stack traces for exhausted
credit.

The project skill
`/Users/arian/Documents/GameDev/MatandileGames/MisterF/.agents/skills/llm-credit-gate`
contains the operational checklist for future LLM work.

### Socket runtime

The real-time tutor runtime is implemented in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/socket/chatSocket.ts`

This file coordinates:

- socket authentication
- conversation lifecycle
- closed conversation enforcement
- assistant streaming
- exercise completion events
- quiz submission and result generation
- metadata updates pushed back to clients

## Client-Side Organization

Client code lives under:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client`

Important areas:

- `quizzes`: quiz authoring and attempt page behavior
- `chat`: tutor chat runtime, renderers, exercise cards, socket handlers
- `practiceGuides`: page behaviors for practice guide pages
- `resources`: resource catalog, folders, resource actions, and move modal
- `shared`: page-agnostic helpers
- `styles`: CSS files grouped by surface
- `telemetry`: browser critical-error reporter

### Tutor chat client

The tutor chat boot file is:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client/chat/index.js`

That file wires together:

- chat state
- socket client
- composer view
- conversation list view
- tutor message renderer
- chat runtime controller
- translator controller

The tutor UI is not one giant script. It is assembled from smaller runtime pieces.

## Views

Server-rendered pages are located under:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views`

The main shell partial is:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views/partials/app-shell-open.ejs`

That shell injects:

- auth state
- current view metadata
- active profile model tier
- sidebar structure

The app uses page-level views plus reusable partials rather than one giant conditional template.

## Prompt Architecture

Prompt source files live under:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts`

Prompt families are separated by responsibility:

- `tutor/*`: main tutor system and related structured correction/evaluation prompts
- `tutor/blocks/*`: source-of-truth tutor response block protocol files
- `resources/*`: draft and revision generation for quizzes and practice guides

Tutor prompts also include finalized conversation reporting prompts. Those
generate tutor conversation summaries, repair invalid report JSON, convert tutor
reports into practice guides, and provide report context to new tutor
conversations.

Prompt rendering is handled server-side, which keeps prompt text versioned in the repository and out of application code strings.

## Structured Output Architecture

The tutor runtime expects structured output blocks rather than unconstrained prose.

Key pieces:

- types: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/types.ts`
- schemas: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/schemas.ts`
- validation: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/validation.ts`
- protocol source: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/tutor/blocks/*.md`
- protocol composition: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/blockProtocol.ts`
- valid-block repair pass: `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/blockRepair.ts`

This gives the system three important properties:

- the model can drive richer UI than markdown alone
- invalid responses can be detected early
- correction loops can be based on exact schema errors

When adding a new top-level tutor block, update the contract in all relevant
places:

- server type union in `llmTutor/types.ts`
- Zod schema union in `llmTutor/schemas.ts`
- markdown/history conversion in `llmTutor/validation.ts`
- client renderer/card under `src/client/chat`
- socket lifecycle event if the block submits learner input
- per-block protocol file, protocol composition list, structured correction prompt, and block repair prompt
- docs in this folder

## Tool Architecture

Mr. F can use a limited tool set when the current request is associated with an authenticated user and active profile.

Tool definitions are intentionally centralized under
`misterf-web/src/server/services/llmTutor/`. This section is the entry point for
finding every tutor-accessible tool without scanning the whole project.

The tutor system prompt should keep only high-level tool boundaries. Precise
use/omit rules, parameter requirements, id rules, and language requirements live
in the individual tool descriptions and parameter `.describe(...)` calls.

Tools that return historical or app-owned context should not expose that data as
if it were chat transcript. Use the teacher-only context envelope helper:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/contextEnvelope.ts`

The envelope marks context as external app data with `audience:
"teacher_only"` and interpretation flags such as `notUserMessage` and
`notAssistantMessage`.

### Conversation runtime tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/conversationTools.ts`

Tools:

- `update_conversation_title`

This tool updates app-owned conversation state, not learner-visible chat
content. The tutor should use it at most once for the first automatic title,
when the current title is generic and the conversation purpose has become
clear. Later title changes require an explicit learner request in the current
turn. The server rejects no-op and generic titles, suppresses automatic updates
after manual or already-specific titles, and marks explicit learner-requested
renames as user updates.

### Practice guides (no tutor tools)

The tutor has no practice-guide tools. The former model-facing
`list_practice_guides`, `build_practice_guide_link`, `create_practice_guide`,
`update_practice_guide`, and `delete_practice_guide` tools were all removed.

Practice guides are managed entirely through the app UI. Creating, editing, and
deleting saved guides happens in the resource UI.

A learner can also create a resource (quiz, practice guide, or roleplay)
from a context, where the AI authoring draft is seeded with that context plus an
optional instruction (the instruction is primary, the context is supporting
material). The shared service `src/server/services/resourceFromContext.ts`
(`buildResourceFromContextPrompt` + `createResourceFromContextDraft`) owns the
prompt building, draft generation, credit gate, and resource creation for every
surface:

- Live conversation composer: `POST /c/:conversationId/resource` (context =
  conversation transcript). Appends a link to the new resource as a message in
  the conversation and stays in the conversation.
- Conversation summary: `POST /c/:conversationId/report/resource` (context =
  tutor report). Redirects to the new resource.
- Quiz result: `POST /quiz-attempts/:attemptId/resource` (context =
  the evaluated attempt). Redirects to the new resource.
- Roleplay result: `POST /roleplay-attempts/:attemptId/resource` (context = the
  evaluated attempt). Redirects to the new resource.

The summary and result surfaces keep their existing "Practicar" follow-up
action alongside the new "Crear recurso" menu.

The tutor can no longer emit any practice-guide link block. The
`practice_guide_link` response block was removed from the protocol (schema,
types, validation, renderer, and prompts). To open a saved guide, the learner
uses the resource UI.

### Learner progress tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/progressTools.ts`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/contextEnvelope.ts`

Tools:

- `get_learner_progress`

They are merged into the tutor agent loop inside:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/index.ts`

Every model-facing tool must document both the tool and each input parameter.
See the project skill:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/.agents/skills/llm-tool-documentation/SKILL.md`

## Error Prevention Strategy

A recurring architectural choice in this codebase is to prefer prevention by structure rather than heuristic cleanup later.

Examples:

- route handlers are separated by feature
- structured outputs are validated against schemas
- correction loops ask the model to repair invalid structure
- the tutor block repair loop asks the model to move leaked task payloads into typed blocks instead of patching UI output heuristically
- profile model tier is treated as the source of truth rather than leaving stale chat-local selectors

This is consistent with the project guidance in `AGENTS.md`.
