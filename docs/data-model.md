# Data Model

This document describes the main persisted entities exposed by the repository layer.

The canonical types are defined in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/db/repository.ts`

The schema is initialized in:

- `/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/db/migrations.ts`

## Users and Authentication

### User

Represents an account.

Important fields:

- `id`
- `email`
- `fullName`
- `passwordHash`
- `emailVerified`
- timestamps
- optional `disabledAt`

### User Identity

Maps a user to an auth provider.

Providers currently include:

- local
- google
- facebook
- apple

### User Session

Stores active login sessions.

Important fields:

- session id
- `userId`
- `tokenHash`
- user agent
- IP address
- last seen
- expiry
- optional revocation

### Auth Action Token

Used for flows such as:

- email verification
- password reset

## Profiles

### Profile

Profiles scope user-facing resources and tutor preferences.

Important fields:

- `id`
- `userId`
- `name`
- `description`
- `modelTier`

`modelTier` is especially important because it now drives tutor model selection from the profile rather than from a per-chat UI selector.

## Tutor Conversations

### Conversation

Represents a tutor chat thread.

Important fields:

- `id`
- `userId`
- `profileId`
- `activeAgent`
- `practiceModuleId`
- `chatRoomConversationReportId`
- `modelTier`
- `title`
- `titleUpdatedByUser`
- optional `closedAt`

Conversations may optionally be associated with:

- a practice module snapshot source
- a chat room report snapshot source
- a tutor conversation report snapshot source

When `closedAt` is set, the conversation is treated as finalized/read-only. The
UI can still render the original transcript, but the chat composer is hidden and
socket message submission is rejected.

### Message

Represents one tutor conversation message.

Important fields:

- numeric `id`
- `conversationId`
- `role` (`user` or `model`)
- `content`
- optional structured `metadata`
- `createdAt`

Message metadata is used for features such as:

- sentence evaluation overlays
- exercise source tracking
- quiz result source tracking

### Conversation Practice Module Snapshot

Stores a frozen copy of practice module context at conversation start.

This protects the conversation from future edits to the original module.

### Conversation Chat Room Report Snapshot

Stores a frozen copy of a chat room report used as tutor context.

The snapshot includes:

- room title and description
- report summary
- report slides JSON

### Tutor Conversation Report

Stores the structured summary generated when a tutor conversation is finalized
with `Finalizar y resumir`.

Important fields:

- `conversationId`
- `userId`
- `profileId`
- `summaryTitle`
- `summaryDescription`
- `report`
- optional `practiceModuleId`

The report JSON contains:

- practiced topics
- progress highlights
- difficulty areas
- vocabulary
- useful phrases
- recommendations
- next steps

`practiceModuleId` is set only when the learner chooses to create a persistent
practice module from that report.

### Conversation Tutor Report Snapshot

Stores a frozen copy of a tutor conversation report when the learner starts a
new tutor conversation with `Practicar estos puntos`.

This keeps the new conversation stable even if the original report is changed or
extended later.

## Practice Modules

### Practice Module

A reusable tutor configuration.

Important fields:

- `id`
- `userId`
- `profileId`
- `title`
- `description`
- `tutorInstructions`
- favorite/archive/share metadata
- optional source metadata
- optional collection linkage

### Practice Module Collection

Groups multiple practice modules.

Important fields:

- `id`
- `userId`
- `profileId`
- `title`
- `description`
- favorite/archive/share metadata
- optional source metadata

### Practice Module Collection Item

Stores collection membership and order.

Important fields:

- `collectionId`
- `practiceModuleId`
- `position`

### Practice Module Share Links

Separate share link entities exist for:

- individual practice modules
- collections

Each includes:

- share id
- target id
- creation time
- optional revocation time

## Chat Rooms

### Chat Room

Represents a multi-character conversation scenario.

Important fields:

- `id`
- `userId`
- `profileId`
- `title`
- `description`
- archive/share/source metadata

### Chat Room Character

Represents one named character inside a room.

Important fields:

- `roomId`
- `name`
- `shortDescription`
- `fullDescription`
- `position`

### Chat Room Conversation

Represents one user-run conversation session inside a chat room.

Important fields:

- `id`
- `roomId`
- `userId`
- `profileId`
- `title`
- optional report linkage

### Chat Room Message

Represents one message inside a chat room conversation.

Important fields:

- `conversationId`
- `senderType` (`user`, `character`, `system`)
- `senderName`
- `content`
- optional evaluation metadata

### Chat Room Conversation Report

Stores the evaluation/report generated from a completed room conversation.

Important fields:

- `summaryTitle`
- `summaryDescription`
- `slides`
- optional `practiceModuleId`

Each report slide contains:

- title
- evaluation description
- message evaluation parts

### Chat Room Share Link

Allows link-based room sharing.

## Relationship Summary

At a high level:

- one `user` has many `profiles`
- one `profile` has many `conversations`
- one `profile` has many `practiceModules`
- one `profile` has many `practiceModuleCollections`
- one `profile` has many `chatRooms`
- one `chatRoom` has many `chatRoomCharacters`
- one `chatRoom` has many `chatRoomConversations`
- one `chatRoomConversation` may have one report
- one tutor `conversation` may have one tutor conversation report
- one tutor conversation report may create one practice module

This model is strongly profile-scoped, which is an important design assumption across the application.
