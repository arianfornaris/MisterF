# Home Start Experience Exploration

## Product Question

Today the Mister F home page starts as a new tutor conversation. That is direct
and simple, but it also leaves the learner with a blank canvas: they must decide
what to practice before the product has helped them notice the best next step.

The exploration is whether the home/start surface should become a more guided
entry point:

- still fast enough to begin talking with Mr. F immediately
- personalized from the user's existing history
- connected to a built-in library of useful practice topics
- able to suggest teacher-created or previously generated content
- dynamic without forcing the user through tedious questionnaires

The goal is not a marketing landing page. For authenticated users, the first
screen should remain a working product surface.

## Current Behavior

The root route opens the chat surface. If there is no persisted conversation
yet, the UI can show an ephemeral initial greeting and the learner can type
directly.

Strengths:

- low friction
- conversational and intimate
- no heavy setup
- fits the core identity of Mister F as an adaptive tutor

Weaknesses:

- the learner may not know what to practice
- weak continuity from previous work
- hidden value from progress reports, chat rooms, modules, and future
  assignments
- built-in practice ideas have no obvious place to surface
- repeated visits can feel like starting from zero

## Direction

Keep "start a conversation" as the main affordance, but surround it with smart
starter options.

The home/start surface should answer:

> "What should I practice next, and why?"

without making the learner fill out a survey.

## Product Principles

- The composer stays available. Suggestions should not block conversation.
- The learner can ignore all suggestions and type anything.
- Suggestions should be useful in one click.
- Personalization should come from existing behavior, not onboarding friction.
- The UI should explain suggestions briefly, not expose ranking logic.
- Suggestions should mix remediation, continuity, curiosity, and teacher-led
  work.
- The system should avoid making the learner feel judged or boxed in.

## Suggested UI Model

### Chat-First Start With Topic Suggestions

The strongest first version is not a separate dashboard. It is a chat-first home
with a small suggestion layer above or near the composer.

Possible first-screen structure:

- Mr. F greeting or concise prompt
- primary composer
- suggestion chips/cards:
  - "Continue where you left off"
  - "Practice a weak point"
  - "Try a built-in topic"
  - "Review vocabulary"
  - "Start a teacher assignment" when relevant

This keeps the emotional center as conversation while giving the learner
momentum.

### Suggestion Card Anatomy

Each card should be small and actionable.

Fields:

- title
- short reason
- type badge
- estimated time
- primary action
- quiet dismiss action

Example Spanish learner-facing copy:

- `Practica preguntas en pasado`
- `Lo vimos en tu última conversación.`
- `8 min`
- `Empezar`

The reason should be concrete but gentle:

- `Apareció varias veces en tus correcciones recientes.`
- `Continúa el módulo que empezaste ayer.`
- `Tema recomendado para tu perfil.`
- `Tarea compartida por tu profesor.`

### Suggestion Types

- `continue_conversation`: resume an unfinished tutor thread
- `progress_focus`: practice a recurring difficulty from progress
- `vocabulary_review`: review words or phrases that need attention
- `built_in_topic`: start from curated built-in content
- `practice_module`: launch or continue a saved module
- `chat_room_follow_up`: practice issues found in a chat room report
- `assignment`: complete or continue teacher-assigned practice
- `generated_topic`: dynamic topic generated from profile/history
- `free_start`: open-ended suggestion such as "Tell Mr. F what you need today"

## Built-In Topic Library

Mister F should eventually have a built-in library of practice topics. This is
not the same as user-created practice modules. It is product-owned seed content
that can be recommended, remixed, and used to start conversations or assignments.

### Library Goals

- give new users immediate useful options
- provide high-quality defaults when history is sparse
- anchor personalization in reliable pedagogical categories
- support teachers who want quick starting points
- reduce dependence on fully dynamic generation for every visit

### Topic Shape

A built-in topic should have metadata and one or more launch modes.

Possible fields:

- id
- title
- short description
- skill focus
- level
- estimated time
- tags
- learner goal
- sample starter prompt
- optional quiz payload
- optional practice-module draft instructions
- prerequisites
- related topics
- version

Example topics:

- ordering food politely
- past simple vs present perfect
- talking about daily routines
- asking follow-up questions
- job interview answers
- travel problems
- describing symptoms at a clinic
- pronunciation-adjacent phrase practice
- common false friends for Spanish speakers

### Library Sources

Possible content sources:

- hand-authored seed topics
- AI-generated drafts reviewed by the product owner
- topics extracted from successful practice modules
- topics distilled from anonymized recurring learner difficulties later, only
  with a privacy-aware process
- teacher-authored templates promoted into the library later

Recommendation: start with hand-authored or owner-reviewed seed topics. Let the
AI generate drafts, but do not let the built-in library become fully automatic
until there is a review workflow.

## Personalization Signals

The suggestion engine can use existing product data.

### Profile Signals

- profile name
- description
- learning context
- model tier
- onboarding completion

### Conversation Signals

- recent conversation titles
- open/unfinished conversations
- finalized tutor reports
- difficulty areas
- next steps
- useful phrases
- vocabulary
- visible tutor plan state

### Progress Signals

- global progress summary
- focus areas
- recommended practice
- vocabulary needing attention
- recent progress events

### Chat Room Signals

- evaluated chat room reports
- recurring communication issues
- room topics and scenarios
- report-generated practice module availability

### Resource Signals

- saved practice modules
- recently used modules
- resource folders
- shared/imported resources
- generated resources not yet practiced

### Teacher/Assignment Signals

Future assignment signals:

- assignments shared with the learner
- unfinished attempts
- evaluated attempts with weak areas
- teacher-authored target topics
- due dates if added later

### Interaction Signals

Suggestions should learn gently from behavior:

- clicked
- started
- completed
- dismissed
- "not now"
- "more like this"
- repeated ignores

Avoid asking the user to rank or rate topics unless they volunteer feedback.

## Recommendation Strategy

The first recommendation engine can be deterministic with light model assistance
instead of a complex recommender system.

### Ranking Inputs

- relevance to recent difficulties
- continuity from unfinished work
- freshness/novelty
- estimated effort
- profile fit
- teacher-assigned priority
- built-in topic quality
- whether the learner dismissed similar suggestions

### Suggested Mix

A good home state should not show five versions of the same remediation idea.

Suggested slot mix:

1. one continuity item
2. one weakness/remediation item
3. one built-in discovery item
4. one teacher/resource item when available
5. one open-ended free-start option

### Explanation

Each suggestion needs a short explanation, but not too much.

Good:

- `From your recent corrections`
- `Based on your profile`
- `Popular starter topic`
- `Continue this module`
- `Shared with you`

Avoid:

- long analytics explanations
- raw model reasoning
- private prompt details
- anything that sounds like grading unless the user is reviewing an evaluated
  result

## LLM Use

The system can use the model in three different ways.

### Generate Suggestions

Given a compact context summary, ask the model for a short ranked list of topic
suggestions.

Inputs should be summaries and ids, not raw full transcripts:

- profile summary
- progress focus areas
- recent conversation/report titles
- available built-in topic ids and metadata
- available resource ids and metadata
- recent dismiss/click signals

Output should be structured:

- suggestion type
- source id when applicable
- title
- reason
- starter payload
- confidence

### Generate Starter Message

When a learner clicks a suggestion, the app can create a first user message or a
teacher-only context payload for Mr. F.

Two options:

1. Insert a user-visible starter message, such as
   `Quiero practicar preguntas en pasado.`
2. Create the conversation with hidden app context and let Mr. F begin with a
   concise learner-facing prompt.

Recommendation: use a visible starter message when the learner clicked a
clearly worded topic. It keeps the transcript understandable. Use hidden context
only for app-owned report/progress details that should not appear as if the
learner typed them.

### Generate Built-In Topic Drafts

The model can help draft built-in topics, but those should be stored as reviewed
content before being treated as product-owned library items.

## Data Model Ideas

This exploration does not require immediate schema work, but likely future
tables include:

### `built_in_practice_topics`

- id
- slug
- title
- description
- skill focus
- level
- tags JSON
- estimated minutes
- starter prompt
- quiz JSON or module instruction JSON
- active flag
- version
- timestamps

### `profile_topic_suggestions`

Optional cache for suggestions if generation becomes expensive.

- id
- user id
- profile id
- suggestion JSON
- generated at
- expires at
- source summary hash

### `topic_interactions`

Tracks lightweight behavior without requiring surveys.

- id
- user id
- profile id
- suggestion type
- source id
- action (`shown`, `clicked`, `dismissed`, `started`, `completed`)
- created at

### `conversation_starter_snapshots`

Optional if a conversation starts from a suggestion and needs durable context.

- conversation id
- starter type
- source id
- title
- reason
- context JSON

## Privacy And Safety

Personalization should avoid exposing private history too aggressively.

Sensitive examples:

- "You made this mistake 8 times" may feel punitive.
- "Based on your job interview anxiety" may expose profile details too directly.
- "Your teacher assigned..." is fine only if the assignment source is actually
  visible and intended.

Prefer softer phrasing:

- `This may help with a recent difficulty.`
- `This matches your current goals.`
- `This continues a topic you practiced recently.`

The logging policy should treat suggestion generation like other model-assisted
flows: production logs keep ids and metadata, not full learner text.

## Relationship To Homepage For Guests

Guests should not see a deeply personalized dashboard.

Guest start options:

- a simple Mr. F greeting
- a few built-in starter topics
- clear login/signup prompts for saving progress
- no claim that progress-based personalization is available before login

For authenticated users, the home surface can become much more contextual.

## UI Options To Explore

### Option A: Minimal Starter Chips

Keep the current chat view and add 3-5 suggestion chips above the composer.

Pros:

- simplest implementation
- low visual disruption
- preserves chat-first identity

Cons:

- limited room for explanation
- weak support for built-in library browsing

### Option B: Start Panel Above Composer

Show a compact panel with cards grouped by type, then the composer below.

Pros:

- enough room for reasons and metadata
- can mix history, built-in topics, and teacher assignments
- still keeps chat available

Cons:

- more design work
- can feel dashboard-like if oversized

### Option C: Dedicated Home Hub

Make `/` a hub with personalized recommendations, recent work, and topic
library, while `/c/new` starts pure chat.

Pros:

- most flexible long-term
- works well for teachers and students
- can expose library and assignments clearly

Cons:

- changes the product's first impression
- more navigation complexity
- risks delaying the core chat action

Recommendation: start with Option B. It gives enough surface area to learn what
suggestions are useful while preserving the conversational center.

## Built-In Library UI

The library should not feel like a giant course catalog at first.

Possible entry points:

- `Suggested for you`
- `Popular starters`
- `For your goals`
- `Review basics`
- `Classroom topics`
- `Situations`

Filters can come later. Early UI should favor a few curated rows and search.

Topic card fields:

- title
- level badge
- skill badge
- short description
- estimated time
- `Practice with Mr. F`
- optional `Start quiz` if the topic has a quiz payload

## How Suggestions Start Work

Clicking a suggestion can create different flows:

### Start Conversation

Use for:

- built-in topic
- progress focus
- vocabulary review
- generated topic

The server creates or opens a conversation and sends a starter message/context.

### Open Resource

Use for:

- practice module
- teacher assignment
- chat room follow-up

The app opens the relevant resource detail or attempt page.

### Resume

Use for:

- unfinished conversation
- unfinished assignment attempt
- partially used module

The app opens the existing state directly.

## Open Questions

1. Should `/` remain the chat page, or should it become a start hub with chat as
   the primary action?
2. Should suggestions appear only when there is no active conversation, or also
   inside existing conversations?
3. Should built-in topics be stored as data, markdown files, JSON fixtures, or
   database rows?
4. Should topic suggestions be generated on page load, cached per profile, or
   updated asynchronously in the background?
5. Who pays for LLM suggestion generation if it uses model calls?
6. Should the user be able to turn off personalization?
7. Should "teacher assignments" always outrank self-study suggestions?
8. Should a suggestion create a visible user message, hidden context, or both?
9. Should built-in topics generate a tutor conversation, a quiz, or a practice
   module?
10. How much of the user's past should the suggestion model see: compact
    summaries only, or selected raw examples when debugging/personalizing?

## Suggested Implementation Phases

### Phase 1: Static Built-In Starters

- Add a small curated topic file.
- Show starter chips/cards when opening a new conversation.
- Clicking a starter pre-fills or sends a visible user message.
- No LLM recommender yet.

### Phase 2: Progress-Aware Suggestions

- Use existing progress summaries and vocabulary to create deterministic
  suggestions.
- Add dismiss/click tracking.
- Keep suggestions local and explainable.

### Phase 3: Built-In Topic Library

- Add a browsable library page or panel.
- Add topic metadata, tags, levels, and related topics.
- Allow topics to launch tutor conversations or quizzes.

### Phase 4: Model-Assisted Ranking

- Build a compact profile/history summary for suggestion generation.
- Ask the model to rank candidate suggestions.
- Cache suggestions per profile with expiration.
- Keep deterministic fallback suggestions.

### Phase 5: Teacher/Assignment Integration

- Surface active teacher assignments.
- Recommend assignment follow-up after evaluation.
- Use teacher-authored topics as high-priority suggestions when appropriate.

### Phase 6: Feedback Loop

- Learn from clicks, dismissals, completions, and repeated ignores.
- Add quiet controls such as `Not now` and `More like this`.
- Avoid adding survey-like onboarding unless the user explicitly asks for
  customization.
