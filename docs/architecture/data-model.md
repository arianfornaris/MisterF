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

### User OpenRouter Key

Stores the managed OpenRouter key assigned to a user account for app-funded LLM
usage.

Important fields:

- `userId`
- encrypted key material
- OpenRouter key hash/label metadata
- status and last error
- configured limit and reset policy
- timestamps

This is account-scoped rather than profile-scoped. All profiles under the same
user draw from the same managed key.

## Profiles

### Profile

Profiles scope user-facing resources and tutor preferences.

Important fields:

- `id`
- `userId`
- `name`
- `description`
- `learningContext`
- `modelTier`
- `profileOnboardingCompletedAt`

`modelTier` is especially important because it now drives tutor model selection from the profile rather than from a per-chat UI selector.

`learningContext` stores learner-authored background for Mr. F, such as goals,
interests, work or study context, and reasons for learning English. The tutor
receives it as teacher-only prompt context.

`profileOnboardingCompletedAt` records whether the first-run profile onboarding
has been saved or intentionally skipped. Existing profiles are marked completed
by migration so current users are not forced through onboarding.

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
- an assignment-attempt snapshot source

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
- open-ended exercise submissions, including the source block and learner answer
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

### Conversation Tutor Plan

Stores the current fused visible teaching plan for a tutor conversation.

Important fields:

- `conversationId`
- `planJson`
- `createdAt`
- `updatedAt`

The plan JSON contains:

- Spanish title
- optional Spanish summary
- ordered steps with stable internal ids
- Spanish learner-facing labels
- step status (`pending`, `active`, `done`, or `skipped`)

The server re-injects this stored plan into each tutor turn as teacher-only
authoritative context so the model does not need to reconstruct plan state from
older transcript blocks.

### Conversation Assignment Attempt Snapshot

Stores a frozen copy of an evaluated assignment attempt when a learner starts
follow-up tutoring from a `Tarea` result.

Important fields:

- `conversationId`
- `assignmentAttemptId`
- assignment title, description, and target topic
- assignment snapshot JSON
- submitted responses JSON
- evaluated result JSON

The tutor receives this snapshot as teacher-only context so the follow-up chat
can target the detected difficulties without depending on mutable assignment
records.

## Teacher-Assigned Practice

Teacher-assigned practice is labeled `Tareas` in Spanish UI and uses
`Assignment` as the internal domain name.

### Assignment

Represents a teacher-authored, profile-scoped fixed practice sequence.

Important fields:

- `id`
- `userId`
- `profileId`
- `title`
- `description`
- `targetTopic`
- `level`
- `instructions`
- `quiz`
- favorite/archive metadata
- optional source/share metadata

`quiz` stores the validated assignment draft. The draft uses ordered blocks with
stable internal block ids and existing tutor `quiz` item payloads. This keeps
assignment evaluation aligned with the live tutor quiz contract.

### Assignment Share Link

Stores the public-but-unlisted link token for a shared assignment.

Important fields:

- `id`
- `assignmentId`
- optional `revokedAt`

### Assignment Attempt

Represents a student submission or teacher test submission against a frozen assignment
snapshot.

Important fields:

- `id`
- `assignmentId`
- optional `userId`
- optional `profileId`
- optional guest and claim tokens
- `status` (`draft`, `submitted`, `evaluating`, `evaluated`, or `failed`)
- `isPreview`
- `snapshot`
- `responses`
- optional `result`
- optional `progressEventId`
- timestamps for start, submit, and evaluation

Guest attempts use isolated tokens and can be claimed after login. Teacher test
attempts use `isPreview` and never write learner progress.

## Learner Progress

Learner progress is profile-scoped and summarizes practice across tutor
conversation reports, chat room conversation reports, and evaluated assignment
attempts.

### Learner Progress Profile

Stores the current compact global progress summary for one user/profile pair.

Important fields:

- `id`
- `userId`
- `profileId`
- `summary`
- `createdAt`
- `updatedAt`

The summary JSON contains:

- overview
- strengths
- focus areas
- recommended practice
- vocabulary
- count of source events used

### Learner Progress Event

Stores one compact progress event extracted from a completed practice source.

Important fields:

- numeric `id`
- `userId`
- `profileId`
- `sourceType`
- `sourceId`
- `eventDate`
- `title`
- `summary`
- `details`
- timestamps

Current source types:

- `tutor_conversation_report`
- `chat_room_conversation_report`

The event details JSON contains compact lists of practiced topics,
difficulties, progress notes, recommendations, and vocabulary. Events are the
source used to rebuild the global progress summary and the vocabulary tab.

## Payments And Credits

### Credit Purchase

Stores Stripe Checkout purchases and fulfillment state for credit top-ups.

Important fields:

- `id`
- `userId`
- `stripeCheckoutSessionId`
- `stripePaymentIntentId`
- `stripeEventId`
- `packageCode`
- `customerAmountCents`
- `creditedAmountCents`
- status (`pending`, `fulfilled`, or `failed`)
- OpenRouter key hash affected by fulfillment
- remaining-balance snapshots before and after fulfillment
- optional failure reason
- timestamps

The credits page shows only fulfilled purchases to learners. Pending and failed
records remain in the ledger for idempotency, auditability, support, and future
admin tooling.

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
- one `user` has one managed OpenRouter key for account-level credits
- one `profile` has many `conversations`
- one `profile` has many `practiceModules`
- one `profile` has many `practiceModuleCollections`
- one `profile` has many `chatRooms`
- one `profile` has one learner progress profile
- one `profile` has many learner progress events
- one `chatRoom` has many `chatRoomCharacters`
- one `chatRoom` has many `chatRoomConversations`
- one `chatRoomConversation` may have one report
- one tutor `conversation` may have one tutor conversation report
- one tutor conversation report may create one practice module

This model is strongly profile-scoped, which is an important design assumption across the application.
