# Chatrooms Feature

## Purpose

This feature adds a new kind of conversation experience to Mister F: chatrooms.

The goal of chatrooms is not to tutor the user directly, and not to use the Mr. F teaching workflow. The goal is to simulate a more natural social conversation so the user writes in English more freely and the system can later detect recurring difficulties, gaps, and patterns.

Chatrooms are plain-text conversations. They do not use formatted tutor messages, markdown rendering, interactive exercise blocks, or Mr. F interventions.

## Product Definition

A chatroom is a reusable room configuration that contains:

- a room name
- a room description
- 1 to 3 AI characters

Each AI character contains:

- a required name
- an optional short description for UI display
- a required full description used only by the AI system

The user joins a chatroom and participates in a group conversation with those AI characters.

## Main Principles

- Chatrooms are separate from the normal Mr. F chat experience.
- Chatrooms use plain text only.
- Chatrooms should feel like a regular group chat, not like a lesson.
- Mr. F does not appear inside chatrooms.
- The room prompt is about simulating a believable chat environment.
- The first version uses the regular AI model tier.

## Sidebar Entry

The left side panel will include a new entry:

- `Salas de chat`

That section should show:

- existing chatrooms
- an option to create a new chatroom

## Chatroom Creation UI

### Room Fields

The room creation form should include:

- `Nombre de la sala`
- `Descripción de la sala`
- a control to add characters

### Room Description Guidance

The room description should explain what kind of conversation the room is for.

Helpful hints for the room description:

- what the room is about
- what kind of people are in the room
- what kinds of topics usually come up
- the tone of the room
- whether the room is casual, serious, playful, argumentative, professional, etc.

The description should not be treated as a hidden system prompt for Mr. F. It is room context for the chat simulation.

## Character Creation UI

Each character form should include:

- `Nombre`
- `Descripción corta` (optional, for UI only)
- `Descripción completa` (required, for AI only)

### Character Full Description Guidance

The full description should allow the creator to define things such as:

- personality
- tone of voice
- communication style
- opinions or tendencies
- level of formality
- attitude toward the room topic
- how direct, shy, funny, skeptical, friendly, impulsive, or opinionated the character is

This description is not shown to the user during the conversation.

### Character Limits

- minimum characters per room: 1
- maximum characters per room: 3

## Chatroom Listing UI

Each existing room should appear as a card with:

- room name
- room description or summary
- character count
- actions:
  - `Editar`
  - `Historial`
  - `Unirse`

## Conversations Inside a Room

A room is not the same thing as a single conversation.

The room is a reusable configuration.
Each room can have multiple conversations over time.

The user can:

- create a new conversation in a room
- continue an older conversation in the same room

When the user joins an existing conversation, the conversation continues from where it stopped.

## Chatroom Message Format

Chatrooms use a plain group chat format:

- plain text only
- no markdown
- no rich tutor blocks
- no sentence evaluation UI
- no structured exercise UI

The experience should resemble a normal messaging app or chat group.

## Initial Room Join Behavior

When a conversation begins, the room first shows join messages like:

- `<character name> se unió al chat...`
- `<user name> se unió al chat...`

This applies to all AI characters in the room and to the user.

The join messages help establish the room context and make the room feel like a real chat.

## AI Architecture

Each AI character should be treated as an independent entity.

Each character uses:

- a shared chatroom system prompt
- its own private character prompt

Important rule:

- a character should not directly see the full description of the other characters

The character should know the visible room context and the conversation history, but not the hidden internal prompt details of the other agents.

## Room Loop

The chatroom uses a loop that is different from the Mr. F tutoring loop.

For V1, the loop is manually advanced by the user.

There is no automatic server timer in the first version.

### V1 Trigger Model

The room advances in two ways:

- the user sends a message
- the user presses a UI button to continue the conversation

Suggested button label:

- `Continuar`

This button triggers the next room step.

## Why Manual Advance in V1

Manual advance is preferred in the first version because:

- it avoids complicated timing problems
- it does not interrupt the user while writing
- it keeps costs easier to control
- it simplifies the room coordinator
- it still allows AI characters to speak without waiting only for the user

## Turn Selection Model

The room should not force every character to speak at every step.

Instead:

1. the room coordinator triggers a step
2. eligible characters evaluate whether they want to speak
3. each character returns an internal speaking score
4. the coordinator selects the best candidate
5. if the best score passes a threshold, that character generates the next message
6. otherwise, nobody speaks in that step

This gives the conversation more natural variation and prevents spammy multi-character replies.

## Character Intent Evaluation

Conceptually, each character is asked something like:

- do you want to speak now?

The answer should be internal, not user-visible.

The simplest form is a score between 0 and 1.

Later, this can expand to include optional metadata such as:

- why the character wants to speak
- who they are reacting to
- whether their impulse is weak or strong

For V1, the important part is that only the coordinator decides who actually speaks.

## Eligible Speaker Rules

The coordinator should keep only simple mechanical state.

Examples:

- who spoke most recently
- cooldown per character
- how many AI turns happened without user input
- maximum allowed consecutive AI turns without the user

The coordinator should not try to own deep semantic interpretation of the conversation.
Each agent can interpret the chat in its own way.

## Consecutive AI Turn Limit

AI characters should be able to speak without waiting for the user every single time, but this must be bounded.

The earlier idea of allowing up to 5 consecutive AI messages is considered too high as the normal behavior.

For V1:

- there should be a strict limit on consecutive AI-only turns
- the limit should be lower than 5 in normal behavior
- 5 may exist as a hard upper guard if needed, but should not be the common pattern

The main purpose is still to get the user to write.

## V1 Scope

Included in V1:

- chatroom creation
- up to 3 AI characters per room
- room listing
- room editing
- room conversations
- continuing old conversations
- plain text group chat UI
- manual `Continuar` loop
- regular model tier only

Not included in V1:

- real invited users
- email invitations
- automatic timed ticks
- Mr. F joining the room
- markdown messages
- tutor-style structured blocks
- exercise widgets
- semantic orchestration beyond simple speaker selection

## Future Directions

Possible future iterations:

- invite real users by link
- guest participants without account creation
- optional server-side timed ticks
- optional autoplay mode
- Mr. F post-room analysis
- converting detected weaknesses into practice modules
- room templates and presets

## Summary

Chatrooms are a separate conversation mode focused on natural written production.

They are designed to:

- simulate social chat
- encourage the user to write in their own words
- produce more realistic language samples
- create better input for later pedagogical analysis

The first version should stay intentionally simple:

- plain text
- AI-only participants
- reusable rooms
- persistent room conversations
- manual room advancement
- independent character agents coordinated by a lightweight central loop
