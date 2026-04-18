import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string | null;
  emailVerified: boolean;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  email_verified: 0 | 1;
};

type AuthActionTokenType = 'email_verification' | 'password_reset';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified === 1,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): AuthUser | null {
  const row = getDb()
    .prepare(
      `
        SELECT id, email, full_name, password_hash, email_verified
        FROM users
        WHERE email = ? AND disabled_at IS NULL
      `,
    )
    .get(normalizeEmail(email)) as UserRow | undefined;

  return row ? toAuthUser(row) : null;
}

export function findUserBySessionTokenHash(tokenHash: string): AuthUser | null {
  const row = getDb()
    .prepare(
      `
        SELECT users.id, users.email, users.full_name, users.password_hash, users.email_verified
        FROM user_sessions
        INNER JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.token_hash = ?
          AND user_sessions.revoked_at IS NULL
          AND datetime(user_sessions.expires_at) > CURRENT_TIMESTAMP
          AND users.disabled_at IS NULL
      `,
    )
    .get(tokenHash) as UserRow | undefined;

  if (!row) {
    return null;
  }

  getDb()
    .prepare(
      `
        UPDATE user_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE token_hash = ?
      `,
    )
    .run(tokenHash);

  return toAuthUser(row);
}

export function createLocalUser(input: {
  email: string;
  fullName: string;
  passwordHash: string;
}): AuthUser {
  const db = getDb();
  const id = randomUUID();
  const email = normalizeEmail(input.email);

  const create = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO users (id, email, full_name, password_hash)
        VALUES (?, ?, ?, ?)
      `,
    ).run(id, email, input.fullName.trim(), input.passwordHash);

    db.prepare(
      `
        INSERT INTO user_identities (id, user_id, provider, provider_subject, email)
        VALUES (?, ?, 'local', ?, ?)
      `,
    ).run(randomUUID(), id, email, email);
  });

  create();

  const user = findUserByEmail(email);
  if (!user) {
    throw new Error('Could not load newly created user.');
  }

  return user;
}

export function createSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): void {
  getDb()
    .prepare(
      `
        INSERT INTO user_sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      randomUUID(),
      input.userId,
      input.tokenHash,
      input.expiresAt.toISOString(),
      input.userAgent ?? null,
      input.ipAddress ?? null,
    );
}

export function createAuthActionToken(input: {
  expiresAt: Date;
  tokenHash: string;
  type: AuthActionTokenType;
  userId: string;
}): void {
  const db = getDb();
  const create = db.transaction(() => {
    db.prepare(
      `
        UPDATE auth_action_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND type = ? AND used_at IS NULL
      `,
    ).run(input.userId, input.type);

    db.prepare(
      `
        INSERT INTO auth_action_tokens (
          id,
          user_id,
          type,
          token_hash,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    ).run(
      randomUUID(),
      input.userId,
      input.type,
      input.tokenHash,
      input.expiresAt.toISOString(),
    );
  });

  create();
}

export function findUserByAuthActionToken(input: {
  tokenHash: string;
  type: AuthActionTokenType;
}): AuthUser | null {
  const row = getDb()
    .prepare(
      `
        SELECT users.id, users.email, users.full_name, users.password_hash, users.email_verified
        FROM auth_action_tokens
        INNER JOIN users ON users.id = auth_action_tokens.user_id
        WHERE auth_action_tokens.token_hash = ?
          AND auth_action_tokens.type = ?
          AND auth_action_tokens.used_at IS NULL
          AND datetime(auth_action_tokens.expires_at) > CURRENT_TIMESTAMP
          AND users.disabled_at IS NULL
      `,
    )
    .get(input.tokenHash, input.type) as UserRow | undefined;

  return row ? toAuthUser(row) : null;
}

export function markAuthActionTokenUsed(tokenHash: string): void {
  getDb()
    .prepare(
      `
        UPDATE auth_action_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND used_at IS NULL
      `,
    )
    .run(tokenHash);
}

export function markEmailVerified(userId: string): void {
  getDb()
    .prepare(
      `
        UPDATE users
        SET email_verified = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(userId);
}

export function updateUserPassword(input: {
  passwordHash: string;
  userId: string;
}): void {
  getDb()
    .prepare(
      `
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(input.passwordHash, input.userId);
}

export function revokeUserSessions(userId: string): void {
  getDb()
    .prepare(
      `
        UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND revoked_at IS NULL
      `,
    )
    .run(userId);
}

export function revokeSession(tokenHash: string): void {
  getDb()
    .prepare(
      `
        UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND revoked_at IS NULL
      `,
    )
    .run(tokenHash);
}
