# Tutor Runtime

## Overview

Mr. F runs as a structured-output tutor agent rather than as a plain chat completion.

The main runtime lives in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/index.ts`
- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/socket/chatSocket.ts`

The browser-side runtime lives in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client/chat`

## Conversation Lifecycle

### Join

When the client joins a conversation:

- the socket authenticates the user
- the active profile is resolved
- the conversation is loaded if it exists
- the conversation model tier is synchronized to the active profile when needed
- messages are loaded
- contextual snapshots are loaded
- the client receives `conversation:ready`

If no persisted conversation exists yet, the UI can render an ephemeral initial greeting.

### Send message

When the user sends a message:

- the message is validated and persisted
- the conversation is created on demand if needed
- the active profile is resolved
- the conversation model tier is synchronized with the profile
- the assistant response pipeline starts

### Stream assistant response

The assistant response is generated through the tutor agent loop and streamed back to the room.

Important responsibilities in the server flow:

- build prompt context
- choose provider/model from model tier
- allow tool use when applicable
- validate structured output
- apply server-side runtime effects
- persist the final assistant message

## Tutor Agent Loop

The main function is:

- `runTutorAgentLoop(...)`

Key characteristics:

- takes tutor message history
- optionally takes practice module context
- optionally takes chat room report context
- optionally takes tutor conversation report context
- can use tools
- expects structured JSON output
- can retry on correctable structured output errors

The loop uses:

- `generateText(...)`
- prompt rendering from prompt files
- model/provider helpers
- structured correction prompts
- a dedicated block repair pass for valid-but-misplaced exercise payloads

## Structured Output Blocks

The tutor can emit structured blocks such as:

- `message`
- `conversation_title`
- `sentence_evaluation`
- `practice_module_link`
- `dialogue_character_message`
- `dialogue_transcript`
- `direction_choice`
- `translate_to_english_prompt`
- `understand_in_spanish_prompt`
- `fill_in_the_blank_input`
- `fill_in_the_blank_choice`
- `multiple_choice`
- `matching_pairs`
- `unscramble_sentence`
- `tutor_plan`
- `tutor_plan_update`
- `quiz`

These blocks are validated before they are accepted into the system.

The block protocol source lives in
`/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/system-prompts/tutor/blocks/*.md`.
`blockProtocol.ts` composes those files into the main tutor prompt and the
block repair prompt, so block documentation is written once and reused by every
LLM loop that needs the contract.

`quiz_result` is a special server-generated/persisted block used by the quiz
completion flow. It exists in the schema and renderer because the app stores and
displays quiz evaluations, but the normal tutor response protocol does not ask
Mr. F to emit `quiz_result` directly.

The runtime keeps that boundary in code:

- `tutorAgentResponseSchema` validates normal Mr. F model output and rejects
  `quiz_result`.
- `persistedTutorResponseSchema` describes renderable/persisted blocks and
  includes `quiz_result`.

## Interactive Exercise Contracts

Interactive blocks are intentionally small contracts between the model and the
client. The model describes the pedagogical task; the client owns UI state,
ordering interaction, submission, and local completion behavior.

### Unscramble sentence

`unscramble_sentence` uses the `tokens` array as the canonical correct answer.

Current contract:

- the model sends `tokens` in the correct sentence order
- the model does not send pre-shuffled tokens
- the model does not send `acceptableTokenOrders`
- the client shuffles the tokens before showing them to the learner
- the client keeps the original `tokens` order as the hidden answer key
- the learner confirms the assembled sentence with the exercise submit button

This keeps the model's responsibility simple: provide the intended sentence as
ordered pieces. It also prevents ambiguity where a model-generated shuffled
array and a separate answer array could drift apart.

Quiz unscramble items follow the same principle: `quiz_unscramble_sentence`
stores ordered `tokens`; the quiz UI shuffles them for display.

### Fill in the blank

Fill-in-the-blank blocks render inline answers inside the pedagogical sentence.

Current UI expectations:

- input blanks should have enough width for the expected answer
- choice blanks should allow long selected options to remain readable
- blank controls should flex with content rather than clipping learner-visible
  text whenever possible

### Choice blocks

Choice-based blocks keep correctness data inside the structured block, but the
visual controls should feel like ordinary Bootstrap-era app controls rather than
custom disabled-looking widgets.

Current UI expectations:

- option labels may be long and must remain readable after selection
- submit/evaluate actions become enabled only when the learner has provided the
  required response
- button/link colors should come from Bootstrap, not exercise accent colors

### Direction choices

`direction_choice` is a non-evaluable navigation block for optional learner
directions.

Current contract:

- the model provides a Spanish `prompt` and 2 to 6 Spanish option labels
- the block must not contain correctness data
- the client renders the options as Bootstrap list-group buttons with generated
  A/B/C badges
- clicking an option sends a normal learner message such as
  `Elijo la opción A: ...`
- the learner may ignore the choices and type any other request

Use `multiple_choice` or `quiz` instead when the learner is being tested and one
or more options are correct.

### Dialogue practice

`dialogue_character_message` and `dialogue_transcript` are for role-play scenes
with fictional in-scene characters.

Current contract:

- Mr. F remains the tutor outside the scene and must not be cast as a character
- scene speakers should use invented proper names such as `Ana`, `Luis`,
  `Marta`, `Carlos`, `Emma`, or `James`
- tutor guidance, correction, scene setup, and reminders belong in `message`
- if the learner's current dialogue reply has unresolved errors, the tutor
  should correct or scaffold that reply before advancing to the next character
  turn
- the runtime schema rejects dialogue speakers such as `Mr. F`, `Mr F`,
  `Mr. Fornaris`, `Fornaris`, `Tutor`, `Teacher`, `Profesor`, `Maestro`,
  `Assistant`, or `AI`

## Runtime Side Effects

Some blocks are not just rendered. They also trigger server-side behavior.

That logic lives in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/tutorWorkflow/index.ts`

Current side effects include:

- creating or updating the visible tutor plan for the conversation
- auto-renaming a conversation when the model emits a conversation title block

Other blocks are render-only and stay inside the message stream. For example,
`sentence_evaluation` is rendered as a standalone tutor block and does not attach
metadata to a learner message.

## Visible Tutor Plans

Tutor conversations can have one visible teaching plan at a time. The plan is
rendered near the composer so the learner can see the current step, completed
steps, and upcoming steps while working.

Prompt wording reserves "visible plan" for this UI-backed feature. The tutor's
private adaptive reasoning should be described as an internal teaching
hypothesis or pedagogical direction, not as a plain "plan".

The model can create a plan with `tutor_plan` and mutate it with
`tutor_plan_update` operations. The server stores the fused plan in
conversation-level state and re-injects that stored plan into every later tutor
turn as teacher-only authoritative context.

This means the model does not reconstruct plan state by reading old plan blocks
from the transcript. It receives the current DB-backed plan directly before
each response.

## Tools Available to Mr. F

Mr. F has a deliberately constrained tool set.
Tools are defined with AI SDK `tool(...)` schemas. Each tool must document both
the tool itself and every input parameter because that documentation is part of
the model-facing contract.

The tutor system prompt carries broad tool boundaries only. Exact use cases,
non-use cases, id rules, optional-parameter behavior, and language requirements
belong in each tool description and parameter description.

Current tool families:

### Practice module tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/practiceModuleTools.ts`

Current tools:

- `list_practice_modules`
- `create_practice_module`
- `update_practice_module`
- `delete_practice_module`
- `build_practice_module_link`

Use these for explicit administration of saved practice module resources. Do
not use them merely because the current conversation was started from a module.

### Chat room tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/chatRoomTools.ts`

Current tools:

- `list_chat_rooms`
- `create_chat_room`
- `delete_chat_room`
- `list_chat_room_conversations`
- `get_chat_room_conversation`
- `evaluate_chat_room_conversation`
- `get_chat_room_conversation_report`

Use these for explicit administration, inspection, and report generation for
standalone chat room resources and their saved conversations.

### Learner progress tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/progressTools.ts`

Current tools:

- `get_learner_progress`

These tools are only enabled when the tutor has authenticated user/profile context.
They are merged into the tutor agent loop in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/index.ts`

## Quizzes

### Quiz generation

A tutor response can contain a `quiz` block. Quiz item kinds are intentionally prefixed with `quiz_` to reduce ambiguity with top-level block types.

`quiz` is an exam-style resource, not the normal format for everyday practice.
Use regular top-level blocks such as `multiple_choice`,
`fill_in_the_blank_input`, `fill_in_the_blank_choice`, `matching_pairs`,
`unscramble_sentence`, translation prompts, dialogue blocks, or `message` for
ordinary one-step exercises.

Appropriate quiz use cases:

- the learner explicitly asks for a quiz, test, exam, prueba, or examen
- the tutor intentionally needs a short diagnostic across several related items
- the tutor wants to verify what has been learned after a meaningful practice
  segment

The runtime schema requires at least 2 quiz items. A one-question check should
be represented as a regular practice block instead of `quiz`.

Examples:

- `quiz_open_text`
- `quiz_translate_to_english`
- `quiz_fill_in_the_blank_input`
- `quiz_multiple_choice`

### Quiz completion

When the user submits a quiz:

- the client emits a quiz completion event
- the server resolves the source quiz block
- a structured quiz-result evaluation is requested from the model
- the server combines the original quiz, the user's responses, and the
  evaluation into a persisted `quiz_result` message

### Quiz result evaluation

Quiz result generation does not rely on heuristic fallback responses anymore.

Current behavior:

- the model must return a valid structured evaluation
- if the shape is invalid, a dedicated correction loop asks the model to fix its own output
- retries are limited
- if evaluation still fails, the system surfaces an error rather than fabricating a result

### Quiz result UI

The client renders quiz results with dedicated UI rather than plain text.

Current characteristics:

- slide-by-slide navigation
- overall per-question tutor assessment
- inline visual error annotations
- tappable/clickable explanations through popovers

The original quiz card also transitions from an evaluating state to an evaluated state when the related `quiz_result` arrives.

### Quiz controls

Quiz navigation follows Bootstrap action hierarchy:

- the close control should use Bootstrap-friendly button styling
- `Atrás`, `Siguiente`, and `Evaluar` use primary button styling
- navigation buttons may be smaller than the evaluation button
- `Evaluar` stays disabled until the quiz can be submitted
- quiz controls use the normal UI font, not the pedagogical serif content font

## Tutor Conversation Reports

Tutor conversations can be finalized by the learner through `Finalizar y resumir`.

When finalized:

- the server generates a structured conversation report from the transcript
- the conversation is marked as closed
- if the conversation still has a generic title and was not manually renamed,
  the report summary title becomes the conversation title
- the original message history becomes read-only in the normal chat view
- the page exposes two tabs:
  - `Conversación`
  - `Resumen`
- the composer is hidden for the closed conversation

The report includes:

- summary title and description
- practiced topics
- progress highlights
- difficulty areas
- important vocabulary
- useful phrases
- recommendations
- next steps

From the summary, the learner can:

- start a new tutor conversation with `Practicar estos puntos`
- create a persistent practice module with `Crear módulo de práctica`

`Practicar estos puntos` does not create a module. It creates a new tutor
conversation seeded with a snapshot of the report, so Mr. F can continue with
targeted practice based on the finalized conversation.

Report-seeded tutor conversations split context into two layers:

- The persistent report context stays in the tutor system prompt as the
  conversation objective and background.
- A one-shot internal start message is added only for the first assistant turn of
  an empty report-seeded conversation.

This prevents later turns from repeatedly behaving like a fresh start while
still keeping the report available as pedagogical context.

## Correction And Repair Loops

The tutor runtime uses structured correction and repair loops at several
boundaries:

### Main tutor response correction

If the tutor returns invalid JSON or schema-invalid response blocks:

- the runtime can feed the model its own broken output
- attach the validation errors
- request a corrected full response

### Quiz result evaluation correction

If quiz evaluation output is invalid:

- the same general idea is used
- a dedicated quiz-result correction prompt is applied

### Message task leakage repair

If a schema-valid response puts an exercise payload inside a `message` block,
the runtime runs a smaller repair loop before returning blocks to the client.
This catches high-confidence patterns such as blanks, translation prompts,
unscramble instructions, matching prompts, multiple-choice prompts, and
bracketed correction markup. It also catches raw JSON or pseudo-block
evaluation payloads embedded inside message prose. The repair prompt receives
only the current blocks, the detected issues, and the shared block protocol.

This design is preferred over heuristic patching because it keeps the model responsible for producing valid structure.

## Model Tier

The tutor model tier is driven from the active profile.

Current tiers include:

- `regular`
- `advanced`
- `max`

The conversation model tier is synchronized with the profile when a conversation is joined or used, which keeps the runtime aligned with profile settings.
