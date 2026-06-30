# Block Input Standardization

This document records the current inconsistency around tutor blocks that ask the
learner to respond. The goal is to make it clear which blocks should own their
input UI, which blocks may intentionally use the normal chat composer, and how
the implemented `open_text_prompt` block fits that standard.

## Problem

Mr. F uses structured blocks so the client can render exercises with the right
interaction pattern. Some blocks already capture the learner response inside the
block UI, while others display a task and expect the learner to answer in the
regular chat composer.

That mixed behavior creates ambiguity:

- A learner response in the chat may be an answer, a clarification question, a
  request for a hint, or a topic change.
- The model receives less precise context because the original block and the
  learner answer are not bundled together.
- `message` can become a catch-all for open-ended exercises, even though the
  protocol says learner task payloads should live in typed blocks.

Recent logs showed this concrete example:

```json
{
  "blocks": [
    {
      "type": "message",
      "markdown": "Por favor, escribe una oración usando **in** para referirte a un tiempo (como un mes o año) o a un lugar (un espacio cerrado)."
    }
  ]
}
```

This is valid JSON, but it is not a good UI contract. The task should be a typed
interactive block.

The same applies when `message` asks the learner to identify and correct errors
in a sentence list:

```json
{
  "blocks": [
    {
      "type": "message",
      "markdown": "Aquí tienes un nuevo grupo de oraciones. ¿Podrías decirme cuál es el error en cada una y cómo las corregirías?\n\n1. I have been waiting for the bus in 30 minutes.\n2. The project was completed in my boss.\n3. We are going to meet for 9:00 AM."
    }
  ]
}
```

That should be split into ordinary framing prose plus an `open_text_prompt`,
because the learner response is open-ended and model-evaluated.

## Standardization Principle

If a block asks the learner to complete, choose, translate, rewrite, explain, or
produce an answer as part of a structured exercise, the block should usually own
the response UI.

The normal chat composer should remain available for:

- ordinary conversation
- learner questions
- requests for hints
- topic changes
- role-play turns when the experience is intentionally conversational

When a block owns the response UI, the app should:

- keep the learner answer visually attached to that block
- avoid rendering a separate normal learner chat bubble for that submission
- send the model a structured internal context that includes the source block,
  the learner answer, and any hidden rubric or answer guidance
- let Mr. F respond normally afterward with structured blocks

## Current Block Inventory

| Block | Requires learner response? | Current response path | Standardization status |
| --- | --- | --- | --- |
| `message` | Sometimes used that way, but should not be | Normal chat | Problematic when it contains an exercise task |
| `dialogue_character_message` | Yes, in role-play | Normal chat | Intentional exception candidate |
| `dialogue_transcript` | No | None | No change needed |
| `matching_pairs` | Yes | Block UI | Already standardized |
| `fill_in_the_blank_input` | Yes | Inline input, hidden structured submission | Already standardized |
| `fill_in_the_blank_choice` | Yes | Inline dropdowns, completion event | Already standardized |
| `multiple_choice` | Yes | Block UI | Already standardized |
| `unscramble_sentence` | Yes | Block UI | Already standardized |
| `translate_to_english_prompt` | Yes | Normal chat | Needs standardization decision |
| `understand_in_spanish_prompt` | Yes | Normal chat | Needs standardization decision |
| `open_text_prompt` | Yes | Multiline textarea, hidden structured submission | Implemented and standardized |
| `tutor_plan` | No | Plan panel | No change needed |
| `tutor_plan_update` | No | Server/client plan update | No change needed |
| `sentence_evaluation` | Sometimes asks for retry after correction | Normal chat | Acceptable for now, possible future refinement |
| `quiz` | Yes | Quiz UI | Already standardized |
| `quiz_result` | No direct response | Server-generated result | No change needed |

## Existing Standardized Patterns

### Locally evaluated UI blocks

These blocks contain their own visible controls and local answer checking:

- `fill_in_the_blank_choice`
- `multiple_choice`
- `matching_pairs`
- `unscramble_sentence`

After successful completion, the client emits an `exercise:*_completed` socket
event. The server stores the exercise result in message metadata and sends a
teacher-only completion context to the tutor.

### Model-evaluated inline block

`fill_in_the_blank_input` follows the same pattern that `open_text_prompt`
now uses:

- the learner types in the block UI
- the app sends a hidden structured exercise submission
- no separate learner bubble is rendered
- the model receives the source block plus the learner answer
- Mr. F evaluates naturally in the next response

This is the shared pattern for model-evaluated inline practice.

### Quiz UI

`quiz` also owns its input UI, including `quiz_open_text`, but it is a larger
assessment/review block. It should not become the default solution for ordinary
one-question open practice.

## Implemented `open_text_prompt`

`open_text_prompt` is a top-level, lightweight, model-evaluated exercise
block for one open-ended response.

Example:

```json
{
  "type": "open_text_prompt",
  "prompt": "Escribe una oración usando **in** para referirte a un tiempo o a un lugar cerrado.",
  "placeholder": "I live in...",
  "submitLabel": "Revisar oración",
  "rubric": "Evalúa si el estudiante usa 'in' correctamente para tiempo o lugar. Corrige otros errores sin perder el foco principal."
}
```

Current semantics:

- `prompt` is visible learner-facing Spanish instruction.
- `placeholder` is optional visible Spanish or English scaffold text.
- `submitLabel` is optional visible Spanish button text generated by the model.
  The client should enforce a short length limit and fall back to a stable
  product label "Enviar respuesta" when it is missing or invalid.
- `rubric` is optional hidden evaluator guidance in Spanish.
- The block always renders a multiline textarea plus a submit action.
- The block should stay granular: one learner-produced sentence, correction,
  explanation, or example at a time. If a practice guide or plan needs several
  open-ended answers, Mr. F should ask for them across sequential turns instead
  of one large textarea submission, unless the flow is explicitly a quiz,
  checkpoint, or batch assessment.
- The block should not define its own `maxLength` field. The implementation
  should reuse the same product default and server-side normalization used by
  quiz open-text answers.
- After submission, the textarea becomes read-only or disabled while Mr. F
  responds.
- The learner's submitted text remains visible inside the block.
- The normal chat composer is not used for the formal answer.
- The submitted answer should persist the same way `fill_in_the_blank_input`
  does: as a hidden structured exercise submission attached to a stored user
  message's metadata.

Recommended model-facing completion context:

```text
INTERNAL OPEN TEXT PROMPT COMPLETED.
The learner submitted an open_text_prompt exercise in the UI.
Use this as teacher-only context. Do not mention the existence of the internal report.
Prompt: Escribe una oración usando in...
Rubric: Evalúa si el estudiante usa 'in' correctamente...
Learner response: I work in Monday.
Now evaluate the response and continue naturally as the tutor.
```

This lets Mr. F respond with ordinary tutor blocks, often:

- `sentence_evaluation` when there are visible language errors
- `message` for concise explanation, reinforcement, or next step
- another exercise block when appropriate

## Translation and Comprehension Prompts

`translate_to_english_prompt` and `understand_in_spanish_prompt` currently show a
specialized prompt card but rely on the normal chat composer for the answer.
They are therefore inconsistent with the proposed standard.

There are two reasonable paths:

1. Keep the specialized block types and add textarea submission UI to each.
2. Replace them conceptually with `open_text_prompt` plus a `purpose` or
   specialized hidden rubric.

The first path preserves semantic specificity. The second path reduces the
number of block types. For now, the safer migration is to keep them as separate
blocks and add owned input UI later, because their prompts have useful
specialized semantics and rendering.

## Dialogue Practice Exception

`dialogue_character_message` is an intentional candidate exception. The learner
is not completing a form-like exercise; they are continuing a role-play. Using
the normal chat composer can feel natural and preserves conversational flow.

If role-play later needs tighter state, a separate `dialogue_reply_prompt` could
be introduced, but that should be a separate design decision.

## Sentence Evaluation Retry

`sentence_evaluation` is primarily feedback, not an input prompt. However, when
it marks text as `improve` or `error`, the tutor often asks the learner to try
again.

For now, retrying in the normal chat is acceptable because the learner is
responding to feedback rather than filling a new exercise card. If this becomes
ambiguous, a future `correction_retry_prompt` or `open_text_prompt` follow-up
could make the retry explicit.

## Message Block Boundary

`message` should not own structured exercise answers. It may contain:

- explanations
- encouragement
- framing
- brief feedback
- optional direction choices with no correct answer
- clarifying questions that are not structured exercises

It should not contain:

- "write one sentence..." as an exercise task
- "correct these sentences..." as a task payload
- translation prompts
- fill-in-the-blank prompts
- multiple-choice options
- matching pairs
- shuffled tokens
- visible inline correction markup

The block repair detector flags phrases such as:

- "escribe una oración..."
- "redacta..."
- "corrige estas oraciones..."
- "reescribe..."
- "responde con tus propias palabras..."
- "dime en inglés..."

The repair prompt can move those tasks from `message` into
`open_text_prompt` when the answer is open-ended and not covered by a more
specific block.

## Implementation Status

Implemented:

- top-level `open_text_prompt` protocol documentation
- server schema and TypeScript type support
- chat card with textarea, submit button, disabled/submitted state, and visible
  submitted answer display
- hidden exercise-submission flow based on the existing
  `fill_in_the_blank_input` pattern
- model-facing completion context for submitted open-text answers through
  structured exercise-submission history
- block repair detection for open-ended tasks leaked into `message`
- tests for valid `open_text_prompt`, message leakage detection, and structured
  submission history

Still pending:

- revisit `translate_to_english_prompt` and `understand_in_spanish_prompt` so
  they also own their input UI.

## Resolved Decisions

- `open_text_prompt` always uses a multiline textarea.
- Submitted open-text answers persist like `fill_in_the_blank_input`: stored as
  a user message with structured exercise-submission metadata and hidden from
  normal chat rendering.
- `open_text_prompt` does not add a `maxLength` protocol field. It should reuse
  the quiz open-text product default.
- The model may generate an optional `submitLabel` in Spanish for the button.
  The client should validate length and use "Enviar respuesta" as the stable
  fallback when needed.
- Translation and comprehension prompts remain separate block types. They should
  later receive their own textarea submission UI instead of being folded into
  `open_text_prompt`.
