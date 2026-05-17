import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from './database.js';

export type MessageRole = 'user' | 'model';

export type StoredProfile = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredConversation = {
  activeAgent: 'tutor';
  practiceModuleId: string | null;
  id: string;
  modelTier: 'advanced' | 'max' | 'regular';
  profileId: string;
  titleUpdatedByUser: boolean;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoom = {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomCharacter = {
  id: string;
  roomId: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatRoomConversation = {
  id: string;
  roomId: string;
  userId: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatRoomMessageSenderType = 'character' | 'system' | 'user';
export type ChatRoomMessageEvaluationStatus = 'ok' | 'warning';

export type StoredChatRoomMessage = {
  id: number;
  conversationId: string;
  senderType: ChatRoomMessageSenderType;
  senderName: string;
  content: string;
  evaluationStatus: ChatRoomMessageEvaluationStatus | null;
  evaluationProblem: string | null;
  evaluationCreatedAt: string | null;
  createdAt: string;
};

export type StoredPracticeModule = {
  archivedAt: string | null;
  collectionId: string | null;
  id: string;
  isFavorite: boolean;
  positionInCollection: number | null;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourcePracticeModuleId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeModuleCollection = {
  archivedAt: string | null;
  id: string;
  isFavorite: boolean;
  userId: string;
  profileId: string;
  sharedVia: 'profile' | 'link' | null;
  sourceCollectionId: string | null;
  sourceProfileId: string | null;
  sourceUserId: string | null;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPracticeModuleCollectionItem = {
  collectionId: string;
  practiceModuleId: string;
  position: number;
  createdAt: string;
};

export type StoredPracticeModuleShareLink = {
  practiceModuleId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredPracticeModuleCollectionShareLink = {
  collectionId: string;
  createdAt: string;
  id: string;
  revokedAt: string | null;
};

export type StoredConversationPracticeModuleSnapshot = {
  practiceModuleId: string | null;
  conversationId: string;
  createdAt: string;
  description: string;
  title: string;
  tutorInstructions: string;
};

export type StoredMessage = {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type ChatRoomRow = {
  id: string;
  user_id: string;
  profile_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type ChatRoomCharacterRow = {
  id: string;
  room_id: string;
  name: string;
  short_description: string;
  full_description: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type ChatRoomConversationRow = {
  id: string;
  room_id: string;
  user_id: string;
  profile_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatRoomMessageRow = {
  id: number;
  conversation_id: string;
  sender_type: ChatRoomMessageSenderType;
  sender_name: string;
  content: string;
  evaluation_status: ChatRoomMessageEvaluationStatus | null;
  evaluation_problem: string | null;
  evaluation_created_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: number;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: string | null;
  created_at: string;
};

type ConversationRow = {
  active_agent: string;
  practice_module_id: string | null;
  id: string;
  model_tier: 'advanced' | 'max' | 'regular';
  profile_id: string;
  title: string;
  title_updated_by_user: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleRow = {
  archived_at: string | null;
  collection_id: string | null;
  id: string;
  is_favorite: number;
  position_in_collection: number | null;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_practice_module_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  user_id: string;
  title: string;
  description: string;
  tutor_instructions: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleShareLinkRow = {
  practice_module_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

type PracticeModuleCollectionRow = {
  archived_at: string | null;
  id: string;
  is_favorite: number;
  user_id: string;
  profile_id: string;
  shared_via: 'profile' | 'link' | null;
  source_collection_id: string | null;
  source_profile_id: string | null;
  source_user_id: string | null;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type PracticeModuleCollectionItemRow = {
  collection_id: string;
  practice_module_id: string;
  position: number;
  created_at: string;
};

type ConversationPracticeModuleSnapshotRow = {
  practice_module_id: string | null;
  conversation_id: string;
  created_at: string;
  description: string;
  title: string;
  tutor_instructions: string;
};

type PracticeModuleCollectionShareLinkRow = {
  collection_id: string;
  created_at: string;
  id: string;
  revoked_at: string | null;
};

const defaultConversationTitle = 'Nueva conversación';
const defaultProfileName = 'Perfil principal';

function toStoredProfile(row: ProfileRow): StoredProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredConversation(row: ConversationRow): StoredConversation {
  return {
    activeAgent: 'tutor',
    practiceModuleId: row.practice_module_id,
    id: row.id,
    modelTier: row.model_tier,
    profileId: row.profile_id,
    title: row.title,
    titleUpdatedByUser: Boolean(row.title_updated_by_user),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoom(row: ChatRoomRow): StoredChatRoom {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomCharacter(
  row: ChatRoomCharacterRow,
): StoredChatRoomCharacter {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomConversation(
  row: ChatRoomConversationRow,
): StoredChatRoomConversation {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    profileId: row.profile_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredChatRoomMessage(
  row: ChatRoomMessageRow,
): StoredChatRoomMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    content: row.content,
    evaluationStatus: row.evaluation_status,
    evaluationProblem: row.evaluation_problem,
    evaluationCreatedAt: row.evaluation_created_at,
    createdAt: row.created_at,
  };
}

function toStoredPracticeModule(row: PracticeModuleRow): StoredPracticeModule {
  return {
    archivedAt: row.archived_at,
    collectionId: row.collection_id,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
    positionInCollection: row.position_in_collection,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourcePracticeModuleId: row.source_practice_module_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    tutorInstructions: row.tutor_instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredPracticeModuleCollection(
  row: PracticeModuleCollectionRow,
): StoredPracticeModuleCollection {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
    userId: row.user_id,
    profileId: row.profile_id,
    sharedVia: row.shared_via,
    sourceCollectionId: row.source_collection_id,
    sourceProfileId: row.source_profile_id,
    sourceUserId: row.source_user_id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredPracticeModuleCollectionItem(
  row: PracticeModuleCollectionItemRow,
): StoredPracticeModuleCollectionItem {
  return {
    collectionId: row.collection_id,
    practiceModuleId: row.practice_module_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toStoredPracticeModuleShareLink(
  row: PracticeModuleShareLinkRow,
): StoredPracticeModuleShareLink {
  return {
    practiceModuleId: row.practice_module_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredPracticeModuleCollectionShareLink(
  row: PracticeModuleCollectionShareLinkRow,
): StoredPracticeModuleCollectionShareLink {
  return {
    collectionId: row.collection_id,
    createdAt: row.created_at,
    id: row.id,
    revokedAt: row.revoked_at,
  };
}

function toStoredConversationPracticeModuleSnapshot(
  row: ConversationPracticeModuleSnapshotRow,
): StoredConversationPracticeModuleSnapshot {
  return {
    practiceModuleId: row.practice_module_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    description: row.description,
    title: row.title,
    tutorInstructions: row.tutor_instructions,
  };
}

function toStoredMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata ? parseMetadata(row.metadata) : null,
    createdAt: row.created_at,
  };
}

export function createProfile(input: {
  userId: string;
  name: string;
  description?: string;
}): StoredProfile {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO profiles (id, user_id, name, description)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, input.userId, input.name, input.description ?? '');

  const profile = findProfileForUser(id, input.userId);
  if (!profile) {
    throw new Error('Could not load newly created profile.');
  }

  return profile;
}

export function findProfileForUser(
  id: string,
  userId: string,
): StoredProfile | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM profiles
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ProfileRow | undefined;

  return row ? toStoredProfile(row) : null;
}

export function findProfileById(id: string): StoredProfile | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM profiles
        WHERE id = ?
      `,
    )
    .get(id) as ProfileRow | undefined;

  return row ? toStoredProfile(row) : null;
}

export function listProfilesForUser(userId: string): StoredProfile[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM profiles
        WHERE user_id = ?
        ORDER BY created_at ASC, updated_at ASC
      `,
    )
    .all(userId) as ProfileRow[];

  return rows.map(toStoredProfile);
}

export function ensureUserHasProfile(userId: string): StoredProfile {
  const existingProfiles = listProfilesForUser(userId);
  if (existingProfiles.length > 0) {
    return existingProfiles[0];
  }

  return createProfile({
    description: '',
    name: defaultProfileName,
    userId,
  });
}

export function updateProfile(input: {
  profileId: string;
  userId: string;
  name: string;
  description: string;
}): StoredProfile | null {
  getDb()
    .prepare(
      `
        UPDATE profiles
        SET name = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.name, input.description, input.profileId, input.userId);

  return findProfileForUser(input.profileId, input.userId);
}

export function createConversation(
  userId: string,
  profileId: string,
  title = defaultConversationTitle,
  options: {
    modelTier?: 'advanced' | 'max' | 'regular';
    practiceModuleId?: string | null;
  } = {},
): StoredConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO conversations (
          id,
          user_id,
          profile_id,
          title,
          practice_module_id,
          active_agent,
          model_tier
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      userId,
      profileId,
      title,
      options.practiceModuleId ?? null,
      'tutor',
      options.modelTier ?? 'regular',
    );

  const conversation = findConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created conversation.');
  }

  return conversation;
}

export function createConversationFromPracticeModule(
  userId: string,
  practiceModule: StoredPracticeModule,
): StoredConversation {
  const conversation = createConversation(
    userId,
    practiceModule.profileId,
    defaultConversationTitle,
    {
      practiceModuleId: practiceModule.id,
    },
  );

  createConversationPracticeModuleSnapshot(conversation.id, practiceModule);
  return conversation;
}

export function findConversationForUser(
  id: string,
  userId: string,
): StoredConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
             , model_tier
        FROM conversations
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ConversationRow | undefined;

  return row ? toStoredConversation(row) : null;
}

export function getOrCreateConversation(
  userId: string,
  profileId: string,
  id?: string | null,
): StoredConversation {
  if (id) {
    const existing = findConversationForUser(id, userId);
    if (existing) {
      return existing;
    }
  }

  return createConversation(userId, profileId);
}

export function touchConversation(conversationId: string): void {
  getDb()
    .prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(conversationId);
}

export function listConversationsForProfile(
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent
             , model_tier
        FROM conversations
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function renameConversationForUser(
  id: string,
  userId: string,
  title: string,
  options: { updatedByUser?: boolean } = {},
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET title = ?,
            title_updated_by_user = CASE
              WHEN ? THEN 1
              ELSE title_updated_by_user
            END
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(title, options.updatedByUser ? 1 : 0, id, userId);

  return findConversationForUser(id, userId);
}

export function updateConversationModelTierForUser(
  id: string,
  userId: string,
  modelTier: 'advanced' | 'max' | 'regular',
): StoredConversation | null {
  getDb()
    .prepare(
      `
        UPDATE conversations
        SET model_tier = ?
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(modelTier, id, userId);

  return findConversationForUser(id, userId);
}

export function deleteConversationForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function createChatRoom(input: {
  userId: string;
  profileId: string;
  title: string;
  description: string;
  characters: Array<{
    name: string;
    shortDescription?: string;
    fullDescription: string;
  }>;
}): StoredChatRoom {
  const db = getDb();
  const roomId = randomUUID();
  const insertRoom = db.prepare(
    `
      INSERT INTO chat_rooms (id, user_id, profile_id, title, description)
      VALUES (?, ?, ?, ?, ?)
    `,
  );
  const insertCharacter = db.prepare(
    `
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  db.transaction(() => {
    insertRoom.run(
      roomId,
      input.userId,
      input.profileId,
      input.title,
      input.description,
    );

    input.characters.forEach((character, index) => {
      insertCharacter.run(
        randomUUID(),
        roomId,
        character.name,
        character.shortDescription ?? '',
        character.fullDescription,
        index,
      );
    });
  })();

  const room = findChatRoomForUser(roomId, input.userId);
  if (!room) {
    throw new Error('Could not load newly created chat room.');
  }

  return room;
}

export function findChatRoomForUser(
  id: string,
  userId: string,
): StoredChatRoom | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, created_at, updated_at
        FROM chat_rooms
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ChatRoomRow | undefined;

  return row ? toStoredChatRoom(row) : null;
}

export function listChatRoomsForProfile(
  userId: string,
  profileId: string,
): StoredChatRoom[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, created_at, updated_at
        FROM chat_rooms
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as ChatRoomRow[];

  return rows.map(toStoredChatRoom);
}

export function updateChatRoomForUser(input: {
  roomId: string;
  userId: string;
  title: string;
  description: string;
  characters: Array<{
    name: string;
    shortDescription?: string;
    fullDescription: string;
  }>;
}): StoredChatRoom | null {
  const db = getDb();
  const room = findChatRoomForUser(input.roomId, input.userId);
  if (!room) {
    return null;
  }

  const updateRoom = db.prepare(
    `
      UPDATE chat_rooms
      SET title = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  );
  const deleteCharacters = db.prepare(
    'DELETE FROM chat_room_characters WHERE room_id = ?',
  );
  const insertCharacter = db.prepare(
    `
      INSERT INTO chat_room_characters (
        id,
        room_id,
        name,
        short_description,
        full_description,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  db.transaction(() => {
    updateRoom.run(input.title, input.description, input.roomId, input.userId);
    deleteCharacters.run(input.roomId);

    input.characters.forEach((character, index) => {
      insertCharacter.run(
        randomUUID(),
        input.roomId,
        character.name,
        character.shortDescription ?? '',
        character.fullDescription,
        index,
      );
    });
  })();

  return findChatRoomForUser(input.roomId, input.userId);
}

export function listChatRoomCharacters(
  roomId: string,
): StoredChatRoomCharacter[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, room_id, name, short_description, full_description, position, created_at, updated_at
        FROM chat_room_characters
        WHERE room_id = ?
        ORDER BY position ASC, created_at ASC
      `,
    )
    .all(roomId) as ChatRoomCharacterRow[];

  return rows.map(toStoredChatRoomCharacter);
}

export function createChatRoomConversation(
  userId: string,
  room: StoredChatRoom,
  title = room.title,
): StoredChatRoomConversation {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO chat_room_conversations (id, room_id, user_id, profile_id, title)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(id, room.id, userId, room.profileId, title);

  const conversation = findChatRoomConversationForUser(id, userId);
  if (!conversation) {
    throw new Error('Could not load newly created chat room conversation.');
  }

  return conversation;
}

export function findChatRoomConversationForUser(
  id: string,
  userId: string,
): StoredChatRoomConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, room_id, user_id, profile_id, title, created_at, updated_at
        FROM chat_room_conversations
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as ChatRoomConversationRow | undefined;

  return row ? toStoredChatRoomConversation(row) : null;
}

export function listChatRoomConversationsForRoom(
  roomId: string,
  userId: string,
): StoredChatRoomConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, room_id, user_id, profile_id, title, created_at, updated_at
        FROM chat_room_conversations
        WHERE room_id = ? AND user_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(roomId, userId) as ChatRoomConversationRow[];

  return rows.map(toStoredChatRoomConversation);
}

export function findLatestChatRoomConversationForRoom(
  roomId: string,
  userId: string,
): StoredChatRoomConversation | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, room_id, user_id, profile_id, title, created_at, updated_at
        FROM chat_room_conversations
        WHERE room_id = ? AND user_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(roomId, userId) as ChatRoomConversationRow | undefined;

  return row ? toStoredChatRoomConversation(row) : null;
}

export function touchChatRoomConversation(conversationId: string): void {
  getDb()
    .prepare(
      'UPDATE chat_room_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
    .run(conversationId);
}

export function createPracticeModule(input: {
  collectionId?: string | null;
  positionInCollection?: number | null;
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourcePracticeModuleId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
  tutorInstructions: string;
}): StoredPracticeModule {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO practice_modules (
          id,
          user_id,
          profile_id,
          title,
          description,
          tutor_instructions,
          collection_id,
          position_in_collection,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.profileId,
      input.title,
      input.description,
      input.tutorInstructions,
      input.collectionId ?? null,
      input.positionInCollection ?? null,
      input.sourcePracticeModuleId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const practiceModule = findPracticeModuleForUser(id, input.userId);
  if (!practiceModule) {
    throw new Error('Could not load newly created practice module.');
  }

  return practiceModule;
}

export function findPracticeModuleForUser(
  id: string,
  userId: string,
): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as PracticeModuleRow | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function findPracticeModuleById(id: string): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleRow | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function listPracticeModulesForProfile(
  userId: string,
  profileId: string,
): StoredPracticeModule[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as PracticeModuleRow[];

  return rows.map(toStoredPracticeModule);
}

export function createPracticeModuleCollection(input: {
  profileId: string;
  sharedVia?: 'profile' | 'link' | null;
  sourceCollectionId?: string | null;
  sourceProfileId?: string | null;
  sourceUserId?: string | null;
  userId: string;
  title: string;
  description: string;
}): StoredPracticeModuleCollection {
  const id = randomUUID();
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_collections (
          id,
          user_id,
          profile_id,
          title,
          description,
          is_favorite,
          archived_at,
          source_collection_id,
          source_user_id,
          source_profile_id,
          shared_via
        )
        VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.userId,
      input.profileId,
      input.title,
      input.description,
      input.sourceCollectionId ?? null,
      input.sourceUserId ?? null,
      input.sourceProfileId ?? null,
      input.sharedVia ?? null,
    );

  const collection = findPracticeModuleCollectionForUser(id, input.userId);
  if (!collection) {
    throw new Error('Could not load newly created practice module collection.');
  }

  return collection;
}

export function findPracticeModuleCollectionForUser(
  id: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, userId) as PracticeModuleCollectionRow | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function findPracticeModuleCollectionById(
  id: string,
): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleCollectionRow | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function listPracticeModuleCollectionsForProfile(
  userId: string,
  profileId: string,
): StoredPracticeModuleCollection[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ? AND profile_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId) as PracticeModuleCollectionRow[];

  return rows.map(toStoredPracticeModuleCollection);
}

export function updatePracticeModuleCollection(input: {
  collectionId: string;
  userId: string;
  title: string;
  description: string;
}): StoredPracticeModuleCollection | null {
  getDb()
    .prepare(
      `
        UPDATE practice_module_collections
        SET title = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(input.title, input.description, input.collectionId, input.userId);

  return findPracticeModuleCollectionForUser(input.collectionId, input.userId);
}

export function findImportedPracticeModuleCollectionForProfile(input: {
  profileId: string;
  sourceCollectionId: string;
  userId: string;
}): StoredPracticeModuleCollection | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, user_id, profile_id, title, description, is_favorite, archived_at, source_collection_id, source_user_id, source_profile_id, shared_via, created_at, updated_at
        FROM practice_module_collections
        WHERE user_id = ?
          AND profile_id = ?
          AND source_collection_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourceCollectionId) as
    | PracticeModuleCollectionRow
    | undefined;

  return row ? toStoredPracticeModuleCollection(row) : null;
}

export function setPracticeModuleCollectionFavoriteForUser(
  collectionId: string,
  userId: string,
  isFavorite: boolean,
): StoredPracticeModuleCollection | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_module_collections
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(isFavorite ? 1 : 0, collectionId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function archivePracticeModuleCollectionForUser(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const collection = findPracticeModuleCollectionForUser(collectionId, userId);
  if (!collection) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE practice_module_collections
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(collectionId, userId);

    db.prepare(
      `
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `,
    ).run(userId, collectionId);
  });

  transaction();
  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function restorePracticeModuleCollectionForUser(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollection | null {
  const collection = findPracticeModuleCollectionForUser(collectionId, userId);
  if (!collection) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE practice_module_collections
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    ).run(collectionId, userId);

    db.prepare(
      `
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND collection_id = ?
      `,
    ).run(userId, collectionId);
  });

  transaction();
  return findPracticeModuleCollectionForUser(collectionId, userId);
}

export function listPracticeModuleCollectionItems(
  collectionId: string,
  userId: string,
): StoredPracticeModuleCollectionItem[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
          AND user_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId, userId) as PracticeModuleCollectionItemRow[];

  return rows.map(toStoredPracticeModuleCollectionItem);
}

export function listPracticeModulesForCollection(
  collectionId: string,
  userId: string,
): Array<StoredPracticeModuleCollectionItem & { practiceModule: StoredPracticeModule }> {
  return listPracticeModuleCollectionItems(collectionId, userId)
    .map((item) => {
      const practiceModule = findPracticeModuleForUser(item.practiceModuleId, userId);
      return practiceModule ? { ...item, practiceModule } : null;
    })
    .filter((entry): entry is StoredPracticeModuleCollectionItem & { practiceModule: StoredPracticeModule } => Boolean(entry));
}

function listPracticeModulesByCollectionId(
  collectionId: string,
): StoredPracticeModule[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE collection_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId) as PracticeModuleRow[];

  return rows.map(toStoredPracticeModule);
}

function normalizePracticeModuleCollectionPositions(collectionId: string): void {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          collection_id,
          id AS practice_module_id,
          COALESCE(position_in_collection, 0) AS position,
          created_at
        FROM practice_modules
        WHERE collection_id = ?
        ORDER BY position_in_collection ASC, created_at ASC
      `,
    )
    .all(collectionId) as PracticeModuleCollectionItemRow[];

  const update = db.prepare(
    `
      UPDATE practice_modules
      SET position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ?
    `,
  );

  rows.forEach((row, index) => {
    update.run(index + 1, row.collection_id, row.practice_module_id);
  });
}

export function listPracticeModuleCollectionsContainingModule(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModuleCollection[] {
  const practiceModule = findPracticeModuleForUser(practiceModuleId, userId);
  if (!practiceModule?.collectionId) {
    return [];
  }

  const collection = findPracticeModuleCollectionForUser(practiceModule.collectionId, userId);
  return collection ? [collection] : [];
}

export function addPracticeModuleToCollection(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  const practiceModule = findPracticeModuleForUser(input.practiceModuleId, input.userId);
  if (!collection || !practiceModule || collection.profileId !== practiceModule.profileId) {
    return false;
  }

  const db = getDb();
  if (practiceModule.collectionId === input.collectionId) {
    return true;
  }

  const nextPositionRow = db
    .prepare(
      `
        SELECT COALESCE(MAX(position), 0) AS max_position
        FROM practice_modules
        WHERE collection_id = ?
      `,
    )
    .get(input.collectionId) as { max_position: number };

  const previousCollectionId = practiceModule.collectionId;
  db.prepare(
    `
      UPDATE practice_modules
      SET collection_id = ?,
          position_in_collection = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
  ).run(input.collectionId, nextPositionRow.max_position + 1, input.practiceModuleId, input.userId);

  if (previousCollectionId) {
    normalizePracticeModuleCollectionPositions(previousCollectionId);
  }

  db.prepare(
    `
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id IN (?, ?)
    `,
  ).run(input.collectionId, previousCollectionId ?? input.collectionId);

  return true;
}

export function removePracticeModuleFromCollection(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  if (!collection) {
    return false;
  }

  const db = getDb();
  const result = db.prepare(
    `
      UPDATE practice_modules
      SET collection_id = NULL,
          position_in_collection = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE collection_id = ? AND id = ? AND user_id = ?
    `,
  ).run(input.collectionId, input.practiceModuleId, input.userId);

  if (result.changes < 1) {
    return false;
  }

  normalizePracticeModuleCollectionPositions(input.collectionId);
  db.prepare(
    `
      UPDATE practice_module_collections
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(input.collectionId);

  return true;
}

export function movePracticeModuleCollectionItem(input: {
  collectionId: string;
  practiceModuleId: string;
  userId: string;
  direction: 'up' | 'down';
}): boolean {
  const collection = findPracticeModuleCollectionForUser(input.collectionId, input.userId);
  if (!collection) {
    return false;
  }

  const items = listPracticeModuleCollectionItems(input.collectionId, input.userId);
  const index = items.findIndex((item) => item.practiceModuleId === input.practiceModuleId);
  if (index < 0) {
    return false;
  }

  const swapIndex = input.direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) {
    return false;
  }

  const current = items[index];
  const other = items[swapIndex];
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(-1, input.collectionId, current.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(current.position, input.collectionId, other.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_modules
        SET position_in_collection = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_id = ? AND id = ?
      `,
    ).run(other.position, input.collectionId, current.practiceModuleId);

    db.prepare(
      `
        UPDATE practice_module_collections
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(input.collectionId);
  });

  transaction();
  return true;
}

export function deletePracticeModuleForUser(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM practice_modules WHERE id = ? AND user_id = ?')
    .run(id, userId);

  return result.changes > 0;
}

export function setPracticeModuleFavoriteForUser(
  practiceModuleId: string,
  userId: string,
  isFavorite: boolean,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET is_favorite = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(isFavorite ? 1 : 0, practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function archivePracticeModuleForUser(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function restorePracticeModuleForUser(
  practiceModuleId: string,
  userId: string,
): StoredPracticeModule | null {
  const result = getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET archived_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(practiceModuleId, userId);

  if (result.changes < 1) {
    return null;
  }

  return findPracticeModuleForUser(practiceModuleId, userId);
}

export function listConversationsForPracticeModule(
  practiceModuleId: string,
  userId: string,
  profileId: string,
): StoredConversation[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, user_id, title, title_updated_by_user, created_at, updated_at, practice_module_id, profile_id, active_agent, model_tier
        FROM conversations
        WHERE user_id = ? AND profile_id = ? AND practice_module_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
    )
    .all(userId, profileId, practiceModuleId) as ConversationRow[];

  return rows.map(toStoredConversation);
}

export function updatePracticeModule(input: {
  practiceModuleId: string;
  description: string;
  title: string;
  tutorInstructions: string;
  userId: string;
}): StoredPracticeModule | null {
  getDb()
    .prepare(
      `
        UPDATE practice_modules
        SET title = ?,
            description = ?,
            tutor_instructions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
    )
    .run(
      input.title,
      input.description,
      input.tutorInstructions,
      input.practiceModuleId,
      input.userId,
    );

  return findPracticeModuleForUser(input.practiceModuleId, input.userId);
}

export function findImportedPracticeModuleForProfile(input: {
  profileId: string;
  sourcePracticeModuleId: string;
  userId: string;
}): StoredPracticeModule | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          archived_at,
          collection_id,
          id,
          is_favorite,
          position_in_collection,
          user_id,
          title,
          description,
          tutor_instructions,
          created_at,
          updated_at,
          profile_id,
          source_practice_module_id,
          source_user_id,
          source_profile_id,
          shared_via
        FROM practice_modules
        WHERE user_id = ?
          AND profile_id = ?
          AND source_practice_module_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
    )
    .get(input.userId, input.profileId, input.sourcePracticeModuleId) as
    | PracticeModuleRow
    | undefined;

  return row ? toStoredPracticeModule(row) : null;
}

export function importPracticeModuleToProfile(input: {
  shareKind: 'profile' | 'link';
  sourcePracticeModule: StoredPracticeModule;
  targetProfileId: string;
  userId: string;
}): StoredPracticeModule {
  const existing = findImportedPracticeModuleForProfile({
    profileId: input.targetProfileId,
    sourcePracticeModuleId: input.sourcePracticeModule.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  return createPracticeModule({
    description: input.sourcePracticeModule.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourcePracticeModuleId: input.sourcePracticeModule.id,
    sourceProfileId: input.sourcePracticeModule.profileId,
    sourceUserId: input.sourcePracticeModule.userId,
    title: input.sourcePracticeModule.title,
    tutorInstructions: input.sourcePracticeModule.tutorInstructions,
    userId: input.userId,
  });
}

export function importPracticeModuleCollectionToProfile(input: {
  shareKind: 'profile' | 'link';
  sourceCollection: StoredPracticeModuleCollection;
  targetProfileId: string;
  userId: string;
}): StoredPracticeModuleCollection {
  const existing = findImportedPracticeModuleCollectionForProfile({
    profileId: input.targetProfileId,
    sourceCollectionId: input.sourceCollection.id,
    userId: input.userId,
  });
  if (existing) {
    return existing;
  }

  const importedCollection = createPracticeModuleCollection({
    description: input.sourceCollection.description,
    profileId: input.targetProfileId,
    sharedVia: input.shareKind,
    sourceCollectionId: input.sourceCollection.id,
    sourceProfileId: input.sourceCollection.profileId,
    sourceUserId: input.sourceCollection.userId,
    title: input.sourceCollection.title,
    userId: input.userId,
  });

  const sourceModules = listPracticeModulesByCollectionId(input.sourceCollection.id);
  sourceModules.forEach((sourceModule, index) => {
    createPracticeModule({
      collectionId: importedCollection.id,
      description: sourceModule.description,
      positionInCollection: index + 1,
      profileId: input.targetProfileId,
      sharedVia: input.shareKind,
      sourcePracticeModuleId: sourceModule.id,
      sourceProfileId: sourceModule.profileId,
      sourceUserId: sourceModule.userId,
      title: sourceModule.title,
      tutorInstructions: sourceModule.tutorInstructions,
      userId: input.userId,
    });
  });

  return importedCollection;
}

export function findPracticeModuleShareLinkById(
  id: string,
): StoredPracticeModuleShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleShareLinkRow | undefined;

  return row ? toStoredPracticeModuleShareLink(row) : null;
}

export function findPracticeModuleCollectionShareLinkById(
  id: string,
): StoredPracticeModuleCollectionShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE id = ?
      `,
    )
    .get(id) as PracticeModuleCollectionShareLinkRow | undefined;

  return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}

export function findPracticeModuleShareLinkForPracticeModule(
  practiceModuleId: string,
): StoredPracticeModuleShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, practice_module_id, created_at, revoked_at
        FROM practice_module_share_links
        WHERE practice_module_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(practiceModuleId) as PracticeModuleShareLinkRow | undefined;

  return row ? toStoredPracticeModuleShareLink(row) : null;
}

export function findPracticeModuleCollectionShareLinkForCollection(
  collectionId: string,
): StoredPracticeModuleCollectionShareLink | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, collection_id, created_at, revoked_at
        FROM practice_module_collection_share_links
        WHERE collection_id = ?
          AND revoked_at IS NULL
        LIMIT 1
      `,
    )
    .get(collectionId) as PracticeModuleCollectionShareLinkRow | undefined;

  return row ? toStoredPracticeModuleCollectionShareLink(row) : null;
}

export function getOrCreatePracticeModuleShareLink(
  practiceModuleId: string,
): StoredPracticeModuleShareLink {
  const existing = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_share_links (id, practice_module_id)
        VALUES (?, ?)
        ON CONFLICT(practice_module_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, practiceModuleId);

  const created = findPracticeModuleShareLinkForPracticeModule(practiceModuleId);
  if (!created) {
    throw new Error('Could not load newly created practice-module share link.');
  }

  return created;
}

export function getOrCreatePracticeModuleCollectionShareLink(
  collectionId: string,
): StoredPracticeModuleCollectionShareLink {
  const existing = findPracticeModuleCollectionShareLinkForCollection(collectionId);
  if (existing) {
    return existing;
  }

  const id = randomBytes(18).toString('base64url');
  getDb()
    .prepare(
      `
        INSERT INTO practice_module_collection_share_links (id, collection_id)
        VALUES (?, ?)
        ON CONFLICT(collection_id) DO UPDATE SET
          revoked_at = NULL
      `,
    )
    .run(id, collectionId);

  const created = findPracticeModuleCollectionShareLinkForCollection(collectionId);
  if (!created) {
    throw new Error('Could not load newly created practice module collection share link.');
  }

  return created;
}

export function createConversationPracticeModuleSnapshot(
  conversationId: string,
  practiceModule: StoredPracticeModule,
): StoredConversationPracticeModuleSnapshot {
  getDb()
    .prepare(
      `
        INSERT OR REPLACE INTO conversation_practice_module_snapshots (
          conversation_id,
          practice_module_id,
          title,
          description,
          tutor_instructions
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      conversationId,
      practiceModule.id,
      practiceModule.title,
      practiceModule.description,
      practiceModule.tutorInstructions,
    );

  const snapshot = getConversationPracticeModuleSnapshot(conversationId);
  if (!snapshot) {
    throw new Error('Could not load conversation practice-module snapshot.');
  }

  return snapshot;
}

export function getConversationPracticeModuleSnapshot(
  conversationId: string,
): StoredConversationPracticeModuleSnapshot | null {
  const row = getDb()
    .prepare(
      `
        SELECT conversation_id, practice_module_id, title, description, tutor_instructions, created_at
        FROM conversation_practice_module_snapshots
        WHERE conversation_id = ?
      `,
    )
    .get(conversationId) as ConversationPracticeModuleSnapshotRow | undefined;

  return row ? toStoredConversationPracticeModuleSnapshot(row) : null;
}

export function listMessages(conversationId: string): StoredMessage[] {
  const rows = getDb()
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as MessageRow[];

  return rows.map(toStoredMessage);
}

export function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  metadata: Record<string, unknown> | null = null,
): StoredMessage {
  const db = getDb();
  const insert = db.prepare(
    `
      INSERT INTO messages (conversation_id, role, content, metadata)
      VALUES (?, ?, ?, ?)
    `,
  );
  const result = insert.run(
    conversationId,
    role,
    content,
    metadata ? JSON.stringify(metadata) : null,
  );

  touchConversation(conversationId);

  const row = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as MessageRow;

  return toStoredMessage(row);
}

export function findMessageInConversation(
  messageId: number,
  conversationId: string,
): StoredMessage | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  return row ? toStoredMessage(row) : null;
}

export function updateMessageMetadata(
  messageId: number,
  conversationId: string,
  metadataPatch: Record<string, unknown>,
): StoredMessage | null {
  const db = getDb();
  const existing = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  if (!existing) {
    return null;
  }

  const currentMetadata = existing.metadata
    ? parseMetadata(existing.metadata)
    : null;
  const nextMetadata = {
    ...(currentMetadata ?? {}),
    ...metadataPatch,
  };

  db.prepare(
    `
      UPDATE messages
      SET metadata = ?
      WHERE id = ? AND conversation_id = ?
    `,
  ).run(JSON.stringify(nextMetadata), messageId, conversationId);

  const updated = db
    .prepare(
      `
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages
        WHERE id = ? AND conversation_id = ?
      `,
    )
    .get(messageId, conversationId) as MessageRow | undefined;

  return updated ? toStoredMessage(updated) : null;
}

export function listChatRoomMessages(
  conversationId: string,
): StoredChatRoomMessage[] {
  const rows = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all(conversationId) as ChatRoomMessageRow[];

  return rows.map(toStoredChatRoomMessage);
}

export function findChatRoomMessage(
  conversationId: string,
  messageId: number,
): StoredChatRoomMessage | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE conversation_id = ? AND id = ?
      `,
    )
    .get(conversationId, messageId) as ChatRoomMessageRow | undefined;

  return row ? toStoredChatRoomMessage(row) : null;
}

export function addChatRoomMessage(
  conversationId: string,
  senderType: ChatRoomMessageSenderType,
  senderName: string,
  content: string,
): StoredChatRoomMessage {
  const db = getDb();
  const result = db
    .prepare(
      `
        INSERT INTO chat_room_messages (conversation_id, sender_type, sender_name, content)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(conversationId, senderType, senderName, content);

  touchChatRoomConversation(conversationId);

  const row = db
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_name,
          content,
          evaluation_status,
          evaluation_problem,
          evaluation_created_at,
          created_at
        FROM chat_room_messages
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as ChatRoomMessageRow;

  return toStoredChatRoomMessage(row);
}

export function updateChatRoomMessageEvaluation(input: {
  conversationId: string;
  messageId: number;
  status: ChatRoomMessageEvaluationStatus;
  problem?: string | null;
}): StoredChatRoomMessage | null {
  const db = getDb();
  db.prepare(
    `
      UPDATE chat_room_messages
      SET evaluation_status = ?,
          evaluation_problem = ?,
          evaluation_created_at = CURRENT_TIMESTAMP
      WHERE id = ? AND conversation_id = ?
    `,
  ).run(
    input.status,
    input.status === 'warning' ? (input.problem?.trim() || null) : null,
    input.messageId,
    input.conversationId,
  );

  const row = db.prepare(
    `
      SELECT
        id,
        conversation_id,
        sender_type,
        sender_name,
        content,
        evaluation_status,
        evaluation_problem,
        evaluation_created_at,
        created_at
      FROM chat_room_messages
      WHERE id = ? AND conversation_id = ?
    `,
  ).get(input.messageId, input.conversationId) as ChatRoomMessageRow | undefined;

  return row ? toStoredChatRoomMessage(row) : null;
}

function parseMetadata(metadata: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
