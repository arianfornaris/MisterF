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

## V2 Resource Catalog Foundation

This section documents the schema introduced by
[Resource Simplification V2](../features/resource-simplification-v2.md). The
resource catalog uses `resources` as the shared header for reusable learning
objects, while type-specific tables keep runtime data.

V2 consolidates reusable learning objects under a generic `resources` header
table plus type-specific tables. `Roleplay` is part of the implemented V2
resource set.

### Resource

Represents the shared header for every reusable learning object.

Recommended fields:

- `id`
- `userId`
- `profileId`
- `type` (`quiz`, `practice_guide`, `resource_folder`, `roleplay`)
- `title`
- `description`
- optional `topic`
- optional `level`
- optional `archivedAt`
- optional `sourceResourceId`
- optional source user/profile metadata
- optional `sharedVia`
- timestamps

The resource header owns cross-cutting behavior: list/grid rendering, search,
filtering, archive state, shared/imported metadata, and the generic
options menu.

Recommended indexes:

- `(userId, profileId, archivedAt, updatedAt DESC, createdAt DESC)`
- `(profileId, type, archivedAt, updatedAt DESC, createdAt DESC)`
- `(profileId, archivedAt, updatedAt DESC, createdAt DESC)`
- `(profileId, sourceResourceId, sharedVia)`
- `(id, type)` as a unique composite key for folder membership constraints

### Type-Specific Resource Tables

Each concrete resource type should keep its runtime data in a separate table.
The recommended design is to use the same id as the generic resource:

- `quizzes.id` references `resources.id`
- `practice_guides.id` references `resources.id`
- `resource_folders.id` references `resources.id`
- `roleplays.id` references `resources.id`

This keeps URLs and authorization simpler because a resource id is also the
type-specific id.

`quizzes` should keep quiz-specific fields such as instructions,
quiz JSON, and authoring messages.

`practice_guides` should keep tutor-specific fields such as tutor instructions.

`resource_folders` may not need extra fields at first; the row exists to make
foreign keys and authorization explicit.

`roleplays` stores the roleplay title, description, scenario, level, one
pedagogical-focus text field, optional learner-turn limit, fixed two-character
payload, and AI-authoring message history. The scenario includes the
learner-facing context, and the first AI character line is generated dynamically
when a roleplay attempt starts.

`roleplay_attempts` stores runtime attempts with:

- `roleplayId`
- optional `userId` and `profileId`
- status (`draft`, `in_progress`, `evaluating`, `evaluated`, `failed`)
- frozen snapshot JSON
- transcript turn JSON
- evaluation result JSON
- optional progress event id
- timestamps

`conversation_roleplay_attempt_snapshots` stores a frozen roleplay result
context when a learner starts follow-up tutor practice from an evaluated
roleplay attempt.

### Resource Folder Item

Represents membership in a resource folder.

Recommended fields:

- `folderId`
- `resourceId`
- `resourceType`
- `position`
- timestamps

V2 folders support nesting. A folder can contain quizzes, practice guides,
resource folders, and roleplays.

The persistence model stores folder nesting in the same membership table used
for ordinary resources:

- store `resourceType` on the membership row
- allow `quiz`, `practice_guide`, `resource_folder`, and `roleplay`
- add a composite foreign key from `(resourceId, resourceType)` to
  `resources(id, type)`

Each resource or folder belongs to zero or one parent folder. Enforce that with a unique
constraint on `resourceId`.

Folder movement must prevent cycles at the repository/service boundary:

- a folder cannot contain itself
- a folder cannot move into one of its descendants
- moving to the catalog root clears the parent folder relationship

Recommended indexes:

- `(folderId, position ASC, createdAt ASC)`
- `(resourceId)` unique
- `(folderId, resourceId)` unique

### Resource Share Link

Represents one generic public-but-unlisted share token for any shareable
resource.

Recommended fields:

- `id`
- `resourceId`
- `createdAt`
- optional `revokedAt`

Recommended indexes:

- `(resourceId, revokedAt, createdAt DESC)`

### Resource Access Grant

Represents a live reference to a resource owned by another profile/user.

Important fields:

- `id`
- `resourceId`
- `userId`
- `profileId`
- `grantedByUserId`
- `grantedVia` (`link` or `profile`)
- optional `shareLinkId`
- optional `revokedAt`
- timestamps

Accepted share links and profile shares should create grants, not resource
copies. Recipients see the owner's current version and should not be able to
edit, archive, move, or re-share the resource. A folder grant also gives
read/use access to the folder's current contents.

### V2 URL Compatibility

If V2 lands before production, old V1 links can be removed or redirected as a
developer convenience. If any V1 links reach production, the migration must
preserve or redirect:

- quiz detail/share URLs
- practice guide detail/share URLs
- legacy chat room URLs, which now redirect to `/resources`

## Tutor Conversations

### Conversation

Represents a tutor chat thread.

Important fields:

- `id`
- `userId`
- `profileId`
- `activeAgent`
- `practiceGuideId` legacy internal field for practice guide snapshots
- `chatRoomConversationReportId` legacy nullable field retained until schema cleanup
- `modelTier`
- `title`
- `titleUpdatedByUser`
- optional `closedAt`

Conversations may optionally be associated with:

- a practice guide snapshot source
- a tutor conversation report snapshot source
- an quiz-attempt snapshot source
- a roleplay-attempt snapshot source

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

### Conversation Practice Guide Snapshot

Stores a frozen copy of practice guide context at conversation start. The
table and field names use the canonical `practice_guide` resource name.

This protects the conversation from future edits to the original guide.

### Legacy Conversation Chat Room Report Snapshot

Legacy table for frozen chat room report context. Chat rooms were removed as an
active product surface in Resource Simplification V2 Slice 7, so this table
should not be used by new runtime flows.

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
- optional `practiceGuideId` legacy internal field

The report JSON contains:

- practiced topics
- progress highlights
- difficulty areas
- vocabulary
- useful phrases
- recommendations
- next steps

`practiceGuideId` is set only when the learner chooses to create a persistent
practice guide from that report.

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

### Conversation Quiz Attempt Snapshot

Stores a frozen copy of an evaluated quiz attempt when a learner starts
follow-up tutoring from a `Quiz` result.

Important fields:

- `conversationId`
- `quizAttemptId`
- quiz title, description, and target topic
- quiz snapshot JSON
- submitted responses JSON
- evaluated result JSON

The tutor receives this snapshot as teacher-only context so the follow-up chat
can target the detected difficulties without depending on mutable quiz
records.

## Teacher-Assigned Practice

Teacher-assigned practice is labeled `Quizzes` in Spanish UI and uses
`Quiz` as the internal domain name.

### Quiz

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
- `authoringMessages`
- archive metadata
- optional source/share metadata

`quiz` stores the validated quiz draft. The draft uses ordered blocks with
stable internal block ids and existing tutor `quiz` item payloads. This keeps
quiz evaluation aligned with the live tutor quiz contract.

`authoringMessages` stores the lightweight teacher/assistant chat history used
by the quiz authoring `AI chat` tab. The history is sent as context when
the teacher asks Mr. F to revise the quiz, but the current `quiz` draft
remains the source of truth for the quiz content.
Assistant messages may also include a draft snapshot so future revision requests
can resolve teacher references to earlier quiz states without restoring a
separate authoring revision table.

### Quiz Share Link

Stores the public-but-unlisted link token for a shared quiz.

Important fields:

- `id`
- `quizId`
- optional `revokedAt`

### Quiz Attempt

Represents a student submission or teacher test submission against a frozen quiz
snapshot.

Important fields:

- `id`
- `quizId`
- optional `userId`
- optional `profileId`
- optional guest and claim tokens
- `status` (`draft`, `submitted`, `evaluating`, `evaluated`, or `failed`)
- `snapshot`
- `responses`
- optional `result`
- optional `progressEventId`
- timestamps for start, submit, and evaluation

Guest attempts use isolated tokens and can be claimed after login. Authenticated
evaluated attempts write learner progress for the active profile.

## Learner Progress

Learner progress is profile-scoped and summarizes practice across tutor
conversation reports and evaluated quiz attempts.

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

`details` may include optional resource metadata:

- `resourceId`
- `resourceType`

Quiz-attempt progress events should set these fields to the quiz
resource id and `quiz`. Practice-guide or roleplay progress can use the
same fields when those flows intentionally produce progress events. Older
events may not include this metadata.

Current source types:

- `tutor_conversation_report`
- `quiz_attempt`
- `roleplay_attempt`
- `chat_room_conversation_report` legacy only until schema cleanup

The event details JSON contains compact lists of practiced topics,
difficulties, progress notes, recommendations, vocabulary, and optional resource
context. Events are the source used to rebuild the global progress summary and
the vocabulary tab.

The progress UI labels source events through a shared server-side view helper:
quiz attempts appear as `Quiz`, roleplay attempts as `Roleplay`, tutor
conversation reports as `Bitácora`, and legacy or unknown sources fall back to
`Práctica`.

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

## Practice Guides

### Practice Guide

A reusable tutor configuration. The user-facing Spanish name is `Guía de
Práctica`; the repository, URL, and table implementation use
`PracticeGuide`/`practice_guides` as the canonical technical names.

Important fields:

- `id`
- `userId`
- `profileId`
- `title`
- `description`
- `tutorInstructions`
- archive/share metadata
- optional source metadata

### Practice Guide Share Links

Practice guide share links support legacy direct guide share URLs and mirror to
generic `resource_share_links`.

Each includes:

- share id
- target id
- creation time
- optional revocation time

## Legacy Chat Rooms

Chat rooms were removed as an active product surface in Resource Simplification
V2 Slice 7. The following tables may remain until the planned schema reset or an
explicit destructive migration removes them. Do not build new runtime features
against this model.

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
- optional `practiceGuideId` legacy internal field

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
- one `profile` has many resources
- one `resource` has one concrete type row when needed, such as an quiz
  or practice guide
- one `profile` has one learner progress profile
- one `profile` has many learner progress events
- one tutor `conversation` may have one tutor conversation report
- one tutor conversation report may create one practice guide
- legacy chat room entities may remain in the schema until cleanup, but no new
  product flow should depend on them

This model is strongly profile-scoped, which is an important design assumption across the application.
