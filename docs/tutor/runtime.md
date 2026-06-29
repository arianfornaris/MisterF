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

If no persisted conversation exists yet, the UI can render an ephemeral initial
greeting. Initial greetings must use the same structured message shape as a real
tutor response: `content` contains the visible text and `metadata.blocks`
contains a normal `message` block. Do not introduce plain-text-only assistant
greetings, because model-facing history expects tutor messages to follow the
structured response protocol.

### Send message

When the user sends a message:

- the message is validated and persisted
- open-ended fill-in-the-blank submissions persist the completed sentence as
  learner message content and store `metadata.exerciseSubmission` with the
  source block, typed values, and completed sentence; the chat UI does not
  render that stored learner message as a separate bubble because the answer
  remains visible in the inline exercise
- the conversation is created on demand if needed
- a new conversation persists the initial greeting as a normal structured tutor
  `message` block before persisting the learner's first message
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
- optionally takes practice guide context
- optionally takes tutor conversation report context
- optionally takes learner profile context
- can use tools
- expects structured JSON output
- can retry on correctable structured output errors

The loop uses:

- `generateText(...)`
- prompt rendering from prompt files
- model/provider helpers
- structured correction prompts
- a dedicated block repair pass for valid-but-misplaced exercise payloads

## Tutor Style Contract

The tutor should be warm without becoming verbose. When the learner answers
correctly and the next step is clear, Mr. F should confirm the point briefly and
continue. Longer explanations are reserved for errors, visible confusion,
repeated difficulty, or explicit learner questions.

## Structured Output Blocks

The tutor can emit structured blocks such as:

- `message`
- `sentence_evaluation`
- `practice_guide_link`
- `dialogue_character_message`
- `dialogue_transcript`
- `translate_to_english_prompt`
- `understand_in_spanish_prompt`
- `open_text_prompt`
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

### Markdown in Block UI

Learner-facing instruction fields are Markdown-capable when they behave like
prompts or instructions rather than as answer values. This includes `message.markdown`,
dialogue markdown fields, top-level exercise `prompt` fields,
`multiple_choice.question`, `quiz.prompt`, and quiz item `prompt` fields.

The client renders those fields through the shared Markdown helper, which uses
`marked` with GitHub-flavored Markdown and line breaks enabled, then sanitizes
the resulting HTML with DOMPurify. If the libraries are unavailable, the helper
falls back to escaped text with line breaks.

Fields that participate in controls, answer matching, or placeholder parsing
remain plain text: answer options, matching-pair values, sentence fields,
fill-in-the-blank placeholder sentences, tokens, placeholders, labels, and
hidden rubrics. This avoids introducing formatting markup into values that the
runtime compares, shuffles, submits, or evaluates.

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

### Optional direction lists

Optional learner directions are not structured exercise blocks. When Mr. F
needs to offer several possible next directions and none of them is correct or
incorrect, he may write a short lettered list inside `message.markdown`.

Current contract:

- direction labels must be Spanish learner-facing prose
- use simple `a)`, `b)`, `c)` labels
- the list must be short and genuinely optional
- the learner may ignore the choices and type any other request
- do not use `multiple_choice` or `quiz` for these direction lists

Use `multiple_choice` or `quiz` only when the learner is being tested and one or
more options are correct.

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

Conversation renaming is handled by the `update_conversation_title` tool rather
than by a response block.

Other blocks are render-only and stay inside the message stream. For example,
`sentence_evaluation` is rendered as a standalone tutor block and does not attach
metadata to a learner message.

`sentence_evaluation.sourceText` is the complete evaluated learner text or
excerpt. For long writing practice, the tutor may evaluate one complete
sentence, clause, or meaningful excerpt from a larger text, then continue with
other excerpts in later turns. Its `parts` array must cover the whole
`sourceText`, not only the errors. The server validates this by comparing
`sourceText` with the concatenated `parts[].text` after lowercasing and ignoring
whitespace and punctuation. This keeps the UI from showing only isolated
problem fragments.

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

Tool results that contain historical or app-owned context should use a
teacher-only context envelope instead of returning bare transcript-like data.
The envelope states that the payload is external app context, not something the
learner or assistant said. This is especially important for progress snapshots,
reports, and other historical data.

Current tool families:

### Conversation runtime tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/conversationTools.ts`

Current tools:

- `update_conversation_title`

Use this internal runtime tool at most once for the first automatic title, when
the current conversation title is still generic and the learner's topic,
purpose, exercise direction, scenario, or repeated practice thread is clear.
After that, use it only when the learner explicitly asks in the current turn to
rename the conversation.

The tool input includes a required `reason`:

- `initial_topic` for the first automatic title while the current title is
  generic
- `explicit_user_request` only when the learner explicitly asks to rename the
  conversation

The server ignores no-op or generic titles and suppresses automatic updates
after a manual rename or already-specific title. This runtime tool does not emit
learner-visible chat tool status; successful renames update the conversation
state through the conversation rename event.

### Practice guide tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/practiceGuideTools.ts`

Current tools:

- `list_practice_guides`
- `create_practice_guide`
- `update_practice_guide`
- `delete_practice_guide`
- `build_practice_guide_link`

Use these only by explicit learner mandate for administration of saved practice
guide resources. Do not use them merely because the current conversation was
started from a guide, a visible tutor plan changed, an exercise completed, or a
guide-related action could be pedagogically useful.

`create_practice_guide` is model-facing administration for saved guides. The
tutor must use it only when the learner explicitly asks for or explicitly
confirms creating a saved "guía"/"guide". Requests for a plan, new plan,
practice plan, route, lesson outline, sequence of activities, exercises,
or next steps must stay in normal tutoring mode and use response blocks such as
`tutor_plan` when a visible in-chat plan is appropriate.

`update_practice_guide`, `delete_practice_guide`, `list_practice_guides`,
and `build_practice_guide_link` follow the same rule: the learner must
explicitly command that exact saved-guide action. Current guide context is
pedagogical guidance only; it is not permission to administer the saved guide.

### Learner progress tools

Defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/progressTools.ts`

Current tools:

- `get_learner_progress`

These tools are only enabled when the tutor has authenticated user/profile context.
`get_learner_progress` returns a teacher-only `learner_progress_snapshot`
context envelope. The actual progress payload lives under `data`; the envelope
itself must not be treated as a user message, assistant message, or transcript.
They are merged into the tutor agent loop in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/services/llmTutor/index.ts`

## Quizzes

### Quiz generation

A tutor response can contain a `quiz` block. Quiz item kinds are intentionally prefixed with `quiz_` to reduce ambiguity with top-level block types.

`quiz` is an exam-style resource, not the normal format for everyday practice.
Use regular top-level blocks such as `multiple_choice`,
`fill_in_the_blank_input`, `fill_in_the_blank_choice`, `open_text_prompt`,
`matching_pairs`, `unscramble_sentence`, translation prompts, dialogue blocks,
or `message` for ordinary one-step exercises.

Normal guided practice should emit at most one top-level learner exercise block
per tutor response. Feedback blocks and plan blocks may accompany that exercise,
but the tutor should not emit several `multiple_choice`, `open_text_prompt`,
fill-in-the-blank, matching, translation, or unscramble blocks in the same
response. If several items should be answered before feedback, use one `quiz`
block instead. A `quiz` should not be combined with another learner exercise
block in the same response.

Appropriate quiz use cases:

- the learner explicitly asks for a quiz, test, exam, prueba, or examen
- the tutor intentionally needs a short diagnostic across several related items
- the tutor wants to verify what has been learned after a meaningful practice
  segment

The runtime schema requires at least 2 quiz items. A one-question check should
be represented as a regular practice block instead of `quiz`.

### Open production granularity

`open_text_prompt` is for one short model-evaluated response unit at a time:
one learner-produced sentence, correction, explanation, or example. If a
practice guide, visible plan, report, or teacher instruction calls for several
open-ended examples, Mr. F should preserve the sequence but run it across
sequential turns. He should ask for the first item, evaluate it after
submission, and then continue with the next item.

Batching several open-ended answers into one submission should be reserved for
flows that are intentionally submitted as a whole, such as a `quiz`, checkpoint
review, or explicit learner-requested batch.

Examples include:

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
- create a persistent practice guide with `Crear guía de práctica`

`Practicar estos puntos` does not create a practice guide. It creates a new tutor
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
open-ended writing prompts, unscramble instructions, matching prompts,
multiple-choice prompts, and bracketed correction markup. It also catches raw
JSON or pseudo-block evaluation payloads embedded inside message prose. The
repair prompt receives
only the current blocks, the detected issues, and the shared block protocol.

This design is preferred over heuristic patching because it keeps the model responsible for producing valid structure.

## Model Tier

The tutor model tier is driven from the active profile.

Current tiers include:

- `regular`
- `advanced`
- `max`

The conversation model tier is synchronized with the profile when a conversation is joined or used, which keeps the runtime aligned with the profile form.

## Learner Profile Context

Each tutor turn loads the profile associated with the conversation and can
inject that profile's name, short description, and learning context into the
system prompt through `tutor/profile-context.md`.

This context is teacher-only background. It should help Mr. F choose examples,
topics, difficulty, tone, and practice situations, but it is not a learner
message, not a first-turn command, and not a replacement for the progress tool
or report-derived context.
